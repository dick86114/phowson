import { GoogleGenAI } from '@google/genai';
import { HttpError } from './http_errors.mjs';
import { pool } from '../db.mjs';

const pick = (...values) => {
  for (const v of values) {
    const s = String(v || '').trim();
    if (s) return s;
  }
  return '';
};

export const fetchRemoteModels = async ({ provider, apiKey, baseUrl }) => {
  const normalizedProvider = String(provider || '').toLowerCase();
  
  if (['openai', 'openai_compatible', 'openrouter', 'kimi', 'minimax', 'glm', 'nvidia'].includes(normalizedProvider)) {
    if (!apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', 'Missing API Key');
    
    // Default base URLs if not provided
    let url = baseUrl;
    if (!url) {
       if (normalizedProvider === 'openai') url = 'https://api.openai.com/v1';
       else if (normalizedProvider === 'openrouter') url = 'https://openrouter.ai/api/v1';
       else if (normalizedProvider === 'kimi') url = 'https://api.moonshot.cn/v1';
       else if (normalizedProvider === 'minimax') url = 'https://api.minimax.chat/v1';
       else if (normalizedProvider === 'glm') url = 'https://open.bigmodel.cn/api/paas/v4';
       else if (normalizedProvider === 'nvidia') url = 'https://integrate.api.nvidia.com/v1';
    }
    
    url = `${String(url).replace(/\/+$/, '')}/models`;
    
    const headers = { authorization: `Bearer ${apiKey}` };
    if (normalizedProvider === 'openrouter') {
      headers['http-referer'] = pick(process.env.OPENROUTER_SITE_URL);
      headers['x-title'] = pick(process.env.OPENROUTER_APP_NAME);
    }

    try {
      const res = await fetch(url, { method: 'GET', headers });
      if (!res.ok) {
         const text = await res.text();
         throw new Error(`Failed to fetch models: ${res.status} ${text}`);
      }
      const json = await res.json();
      // Standard OpenAI format: { data: [ { id: 'gpt-4', ... } ] }
      if (Array.isArray(json?.data)) {
        return json.data.map(m => m.id).filter(Boolean);
      }
      return [];
    } catch (e) {
      throw new HttpError(502, 'AI_UPSTREAM_ERROR', e.message);
    }
  }

  // Gemini (Google GenAI)
  if (normalizedProvider === 'gemini') {
    if (!apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', 'Missing API Key');
    // Google GenAI SDK doesn't expose a simple listModels helper in the same way or requires complex setup.
    // We can use the REST API.
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json = await res.json();
      // Format: { models: [ { name: 'models/gemini-pro', ... } ] }
      if (Array.isArray(json?.models)) {
        return json.models.map(m => m.name.replace(/^models\//, '')).filter(Boolean);
      }
      return [];
    } catch (e) {
       throw new HttpError(502, 'AI_UPSTREAM_ERROR', e.message);
    }
  }

  // Anthropic
  if (normalizedProvider === 'anthropic') {
    // Anthropic API currently doesn't have a public "list models" endpoint like OpenAI.
    // We return a static list of known models or empty.
    return [
      'claude-3-5-sonnet-20240620',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
  }

  return [];
};

const extractJson = (text) => {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const noFences = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(noFences);
  } catch {
  }

  const start = noFences.indexOf('{');
  const end = noFences.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const slice = noFences.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {
    }
  }

  return null;
};

const postJson = async (url, { headers, body }) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(headers || {}),
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await res.text();
  const json = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })();

  if (!res.ok) {
    const msg = String(json?.error?.message || json?.message || text || 'LLM 请求失败').slice(0, 400);
    const err = new HttpError(502, 'AI_UPSTREAM_ERROR', msg);
    err.upstreamStatus = res.status;
    throw err;
  }

  return json;
};

const makePrompt = (locationHint) => {
  const locInstruction = locationHint 
    ? `- Photo was taken at: "${locationHint}". Use this EXACTLY for locationHint field.`
    : `- locationHint 用中文给一个“地点参考”，尽量具体但不要硬编；不确定就输出场景类型（如：城市街区/山野/海边/室内/夜景等）。`;

  return `
Analyze this photo and return STRICT JSON with these keys:
{
  "title": string,
  "description": string,
  "tags": string[],
  "locationHint": string,
  "category": "landscape"|"portrait"|"street"|"travel"|"macro"|"uncategorized",
  "exif": {"camera"?:string,"lens"?:string,"aperture"?:string,"shutterSpeed"?:string,"iso"?:string,"focalLength"?:string}
}
Rules:
- Output JSON only. No markdown. No extra text.
- Use Chinese for title/description/tags.
${locInstruction}
  `.trim();
};

const geminiFill = async ({ apiKey, model, imageBase64, mimeType, locationHint }) => {
  const ai = new GoogleGenAI({ apiKey });
  const m = ai.getGenerativeModel({ model });

  const result = await m.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { text: makePrompt(locationHint) },
          { inlineData: { mimeType: String(mimeType || 'image/jpeg'), data: imageBase64 } },
        ],
      },
    ],
  });

  const text = result?.response?.text?.() || '';
  const data = extractJson(text);
  if (!data) throw new HttpError(502, 'AI_BAD_RESPONSE', 'AI 返回格式异常');
  return data;
};

const openAiCompatibleFill = async ({ apiKey, baseUrl, model, imageBase64, mimeType, extraHeaders, locationHint }) => {
  const url = `${String(baseUrl).replace(/\/+$/, '')}/chat/completions`;
  const dataUrl = `data:${String(mimeType || 'image/jpeg')};base64,${imageBase64}`;

  const json = await postJson(url, {
    headers: {
      authorization: `Bearer ${apiKey}`,
      ...(extraHeaders || {}),
    },
    body: {
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: makePrompt(locationHint) },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.7,
    },
  });

  const text = json?.choices?.[0]?.message?.content || '';
  const parsed = extractJson(text);
  if (!parsed) throw new HttpError(502, 'AI_BAD_RESPONSE', 'AI 返回格式异常');
  return parsed;
};

const anthropicFill = async ({ apiKey, model, imageBase64, mimeType, locationHint }) => {
  const url = 'https://api.anthropic.com/v1/messages';
  const json = await postJson(url, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: {
      model,
      max_tokens: 700,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: String(mimeType || 'image/jpeg'), data: imageBase64 } },
            { type: 'text', text: makePrompt(locationHint) },
          ],
        },
      ],
    },
  });

  const text = Array.isArray(json?.content)
    ? json.content.map((p) => (p?.type === 'text' ? String(p.text || '') : '')).join('\n')
    : '';
  const parsed = extractJson(text);
  if (!parsed) throw new HttpError(502, 'AI_BAD_RESPONSE', 'AI 返回格式异常');
  return parsed;
};

export const resolveAiConfig = async () => {
  let dbAi = {};
  try {
    const res = await pool.query(`select data from site_settings where id = 'global'`);
    dbAi = res.rows?.[0]?.data?.ai || {};
  } catch (e) {
    // ignore
  }

  const provider = pick(dbAi.provider, process.env.AI_PROVIDER).toLowerCase();
  const model = pick(process.env.AI_MODEL);

  const geminiKey = pick(dbAi.gemini?.apiKey, process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY);
  const geminiModel = pick(dbAi.gemini?.model, model, process.env.GEMINI_MODEL, 'gemini-3-flash');
  const geminiEmbeddingModel = pick(process.env.GEMINI_EMBEDDING_MODEL, 'text-embedding-004');

  const openaiKey = pick(dbAi.openai?.apiKey, process.env.OPENAI_API_KEY);
  const openaiBaseUrl = pick(dbAi.openai?.baseUrl, process.env.OPENAI_BASE_URL, 'https://api.openai.com/v1');
  const openaiModel = pick(dbAi.openai?.model, model, process.env.OPENAI_MODEL);
  const openaiEmbeddingModel = pick(process.env.OPENAI_EMBEDDING_MODEL, 'text-embedding-3-small');

  // Generic OpenAI-compatible
  const compatibleKey = pick(dbAi.openai_compatible?.apiKey, process.env.AI_COMPATIBLE_API_KEY, process.env.AI_API_KEY);
  const compatibleBaseUrl = pick(dbAi.openai_compatible?.baseUrl, process.env.AI_COMPATIBLE_BASE_URL, process.env.AI_BASE_URL);
  const compatibleModel = pick(dbAi.openai_compatible?.model, model, process.env.AI_COMPATIBLE_MODEL);
  const compatibleEmbeddingModel = pick(process.env.AI_COMPATIBLE_EMBEDDING_MODEL, process.env.AI_EMBEDDING_MODEL, 'text-embedding-3-small');

  const anthropicKey = pick(dbAi.anthropic?.apiKey, process.env.ANTHROPIC_API_KEY);
  const anthropicModel = pick(dbAi.anthropic?.model, model, process.env.ANTHROPIC_MODEL);

  const openRouterKey = pick(dbAi.openrouter?.apiKey, process.env.OPEN_ROUTER_API_KEY);
  const openRouterBaseUrl = pick(dbAi.openrouter?.baseUrl, process.env.OPEN_ROUTER_BASE_URL, 'https://openrouter.ai/api/v1');
  const openRouterModel = pick(dbAi.openrouter?.model, model, process.env.OPEN_ROUTER_MODEL);
  const openRouterEmbeddingModel = pick(process.env.OPEN_ROUTER_EMBEDDING_MODEL, 'text-embedding-3-small');

  const kimiKey = pick(dbAi.kimi?.apiKey, process.env.KIMI_API_KEY);
  const kimiBaseUrl = pick(dbAi.kimi?.baseUrl, process.env.KIMI_BASE_URL, 'https://api.moonshot.cn/v1');
  const kimiModel = pick(dbAi.kimi?.model, model, process.env.KIMI_MODEL, 'moonshot-v1-8k');
  const kimiEmbeddingModel = pick(process.env.KIMI_EMBEDDING_MODEL, 'text-embedding-3-small');

  const minimaxKey = pick(dbAi.minimax?.apiKey, process.env.MINIMAX_API_KEY);
  const minimaxBaseUrl = pick(dbAi.minimax?.baseUrl, process.env.MINIMAX_BASE_URL, 'https://api.minimax.chat/v1');
  const minimaxModel = pick(dbAi.minimax?.model, model, process.env.MINIMAX_MODEL, 'abab6.5s-chat');
  const minimaxEmbeddingModel = pick(process.env.MINIMAX_EMBEDDING_MODEL, 'embo-01');

  const glmKey = pick(dbAi.glm?.apiKey, process.env.GLM_API_KEY);
  const glmBaseUrl = pick(dbAi.glm?.baseUrl, process.env.GLM_BASE_URL, 'https://open.bigmodel.cn/api/paas/v4');
  const glmModel = pick(dbAi.glm?.model, model, process.env.GLM_MODEL, 'glm-4-flash');
  const glmEmbeddingModel = pick(process.env.GLM_EMBEDDING_MODEL, 'embedding-3');

  const nvidiaKey = pick(dbAi.nvidia?.apiKey, process.env.NVIDIA_API_KEY);
  const nvidiaBaseUrl = pick(dbAi.nvidia?.baseUrl, process.env.NVIDIA_BASE_URL, 'https://integrate.api.nvidia.com/v1');
  const nvidiaModel = pick(dbAi.nvidia?.model, model, process.env.NVIDIA_MODEL, 'meta/llama-3.1-405b-instruct');
  const nvidiaEmbeddingModel = pick(process.env.NVIDIA_EMBEDDING_MODEL, 'nvidia/nv-embedqa-e5-v5');

  const inferredProvider =
    provider ||
    (geminiKey
      ? 'gemini'
      : openaiKey
      ? 'openai'
      : compatibleKey && compatibleBaseUrl
      ? 'openai_compatible'
      : anthropicKey
      ? 'anthropic'
      : openRouterKey
      ? 'openrouter'
      : kimiKey
      ? 'kimi'
      : minimaxKey
      ? 'minimax'
      : glmKey
      ? 'glm'
      : nvidiaKey
      ? 'nvidia'
      : '');

  return {
    provider: inferredProvider,
    gemini: { apiKey: geminiKey, model: geminiModel, embeddingModel: geminiEmbeddingModel },
    openai: { apiKey: openaiKey, baseUrl: openaiBaseUrl, model: openaiModel, embeddingModel: openaiEmbeddingModel },
    openai_compatible: { apiKey: compatibleKey, baseUrl: compatibleBaseUrl, model: compatibleModel, embeddingModel: compatibleEmbeddingModel },
    anthropic: { apiKey: anthropicKey, model: anthropicModel },
    openrouter: { apiKey: openRouterKey, baseUrl: openRouterBaseUrl, model: openRouterModel, embeddingModel: openRouterEmbeddingModel },
    kimi: { apiKey: kimiKey, baseUrl: kimiBaseUrl, model: kimiModel, embeddingModel: kimiEmbeddingModel },
    minimax: { apiKey: minimaxKey, baseUrl: minimaxBaseUrl, model: minimaxModel, embeddingModel: minimaxEmbeddingModel },
    glm: { apiKey: glmKey, baseUrl: glmBaseUrl, model: glmModel, embeddingModel: glmEmbeddingModel },
    nvidia: { apiKey: nvidiaKey, baseUrl: nvidiaBaseUrl, model: nvidiaModel, embeddingModel: nvidiaEmbeddingModel },
  };
};

const geminiGenerateEmbedding = async ({ apiKey, model, text }) => {
  const ai = new GoogleGenAI({ apiKey });
  const m = ai.getGenerativeModel({ model });
  const result = await m.embedContent(text);
  return result.embedding.values;
};

const openAiCompatibleGenerateEmbedding = async ({ apiKey, baseUrl, model, text }) => {
  const url = `${String(baseUrl).replace(/\/+$/, '')}/embeddings`;
  
  const json = await postJson(url, {
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
    body: {
      model,
      input: text,
    },
  });

  const embedding = json?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new HttpError(502, 'AI_BAD_RESPONSE', 'AI Embedding 返回格式异常');
  }
  return embedding;
};

export const generateEmbedding = async ({ text }) => {
  const cfg = await resolveAiConfig();
  const provider = String(cfg.provider || '').toLowerCase();

  if (provider === 'gemini') {
    if (!cfg.gemini.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 GEMINI_API_KEY');
    return geminiGenerateEmbedding({ apiKey: cfg.gemini.apiKey, model: cfg.gemini.embeddingModel, text });
  }

  if (provider === 'openai') {
    if (!cfg.openai.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPENAI_API_KEY');
    return openAiCompatibleGenerateEmbedding({ apiKey: cfg.openai.apiKey, baseUrl: cfg.openai.baseUrl, model: cfg.openai.embeddingModel, text });
  }

  if (provider === 'openai_compatible') {
    if (!cfg.openai_compatible.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_COMPATIBLE_API_KEY');
    return openAiCompatibleGenerateEmbedding({ 
      apiKey: cfg.openai_compatible.apiKey, 
      baseUrl: cfg.openai_compatible.baseUrl, 
      model: cfg.openai_compatible.embeddingModel, 
      text 
    });
  }

  if (provider === 'openrouter') {
    if (!cfg.openrouter.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPEN_ROUTER_API_KEY');
    return openAiCompatibleGenerateEmbedding({ 
      apiKey: cfg.openrouter.apiKey, 
      baseUrl: cfg.openrouter.baseUrl, 
      model: cfg.openrouter.embeddingModel, 
      text 
    });
  }

  if (provider === 'kimi') {
    if (!cfg.kimi.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 KIMI_API_KEY');
    return openAiCompatibleGenerateEmbedding({ 
      apiKey: cfg.kimi.apiKey, 
      baseUrl: cfg.kimi.baseUrl, 
      model: cfg.kimi.embeddingModel, 
      text 
    });
  }

  if (provider === 'minimax') {
    if (!cfg.minimax.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 MINIMAX_API_KEY');
    return openAiCompatibleGenerateEmbedding({ 
      apiKey: cfg.minimax.apiKey, 
      baseUrl: cfg.minimax.baseUrl, 
      model: cfg.minimax.embeddingModel, 
      text 
    });
  }

  if (provider === 'glm') {
    if (!cfg.glm.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 GLM_API_KEY');
    return openAiCompatibleGenerateEmbedding({ 
      apiKey: cfg.glm.apiKey, 
      baseUrl: cfg.glm.baseUrl, 
      model: cfg.glm.embeddingModel, 
      text 
    });
  }

  if (provider === 'nvidia') {
    if (!cfg.nvidia.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 NVIDIA_API_KEY');
    return openAiCompatibleGenerateEmbedding({ 
      apiKey: cfg.nvidia.apiKey, 
      baseUrl: cfg.nvidia.baseUrl, 
      model: cfg.nvidia.embeddingModel, 
      text 
    });
  }

  throw new HttpError(501, 'AI_NOT_CONFIGURED', '不支持的 Embedding Provider (Anthropic 不支持 Embedding)');
};

export const fillFromImage = async ({ imageBase64, mimeType, locationHint }) => {
  const cfg = await resolveAiConfig();
  const provider = String(cfg.provider || '').toLowerCase();

  if (provider === 'gemini') {
    if (!cfg.gemini.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 GEMINI_API_KEY/GOOGLE_API_KEY');
    return geminiFill({ apiKey: cfg.gemini.apiKey, model: cfg.gemini.model, imageBase64, mimeType, locationHint });
  }

  if (provider === 'openai') {
    if (!cfg.openai.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPENAI_API_KEY');
    if (!cfg.openai.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPENAI_MODEL 或 AI_MODEL');
    return openAiCompatibleFill({ apiKey: cfg.openai.apiKey, baseUrl: cfg.openai.baseUrl, model: cfg.openai.model, imageBase64, mimeType, locationHint });
  }

  if (provider === 'openai_compatible') {
    if (!cfg.openai_compatible.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_COMPATIBLE_API_KEY 或 AI_API_KEY');
    if (!cfg.openai_compatible.baseUrl) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_COMPATIBLE_BASE_URL 或 AI_BASE_URL');
    if (!cfg.openai_compatible.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_COMPATIBLE_MODEL 或 AI_MODEL');
    return openAiCompatibleFill({
      apiKey: cfg.openai_compatible.apiKey,
      baseUrl: cfg.openai_compatible.baseUrl,
      model: cfg.openai_compatible.model,
      imageBase64,
      mimeType,
      locationHint,
    });
  }

  if (provider === 'openrouter') {
    if (!cfg.openrouter.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPEN_ROUTER_API_KEY');
    if (!cfg.openrouter.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPEN_ROUTER_MODEL 或 AI_MODEL');
    return openAiCompatibleFill({
      apiKey: cfg.openrouter.apiKey,
      baseUrl: cfg.openrouter.baseUrl,
      model: cfg.openrouter.model,
      imageBase64,
      mimeType,
      locationHint,
      extraHeaders: {
        'http-referer': pick(process.env.OPENROUTER_SITE_URL),
        'x-title': pick(process.env.OPENROUTER_APP_NAME),
      },
    });
  }

  if (provider === 'kimi') {
    if (!cfg.kimi.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 KIMI_API_KEY');
    return openAiCompatibleFill({
      apiKey: cfg.kimi.apiKey,
      baseUrl: cfg.kimi.baseUrl,
      model: cfg.kimi.model,
      imageBase64,
      mimeType,
      locationHint,
    });
  }

  if (provider === 'minimax') {
    if (!cfg.minimax.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 MINIMAX_API_KEY');
    return openAiCompatibleFill({
      apiKey: cfg.minimax.apiKey,
      baseUrl: cfg.minimax.baseUrl,
      model: cfg.minimax.model,
      imageBase64,
      mimeType,
      locationHint,
    });
  }

  if (provider === 'glm') {
    if (!cfg.glm.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 GLM_API_KEY');
    return openAiCompatibleFill({
      apiKey: cfg.glm.apiKey,
      baseUrl: cfg.glm.baseUrl,
      model: cfg.glm.model,
      imageBase64,
      mimeType,
      locationHint,
    });
  }

  if (provider === 'nvidia') {
    if (!cfg.nvidia.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 NVIDIA_API_KEY');
    return openAiCompatibleFill({
      apiKey: cfg.nvidia.apiKey,
      baseUrl: cfg.nvidia.baseUrl,
      model: cfg.nvidia.model,
      imageBase64,
      mimeType,
      locationHint,
    });
  }

  if (provider === 'anthropic') {
    if (!cfg.anthropic.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 ANTHROPIC_API_KEY');
    if (!cfg.anthropic.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 ANTHROPIC_MODEL 或 AI_MODEL');
    return anthropicFill({ apiKey: cfg.anthropic.apiKey, model: cfg.anthropic.model, imageBase64, mimeType, locationHint });
  }

  throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_PROVIDER 或任一大模型 Key');
};

const extractText = (maybe) => {
  const s = String(maybe || '').trim();
  return s;
};

export const translateText = async ({ text, targetLang = 'Chinese' }) => {
  const cfg = await resolveAiConfig();
  const provider = String(cfg.provider || '').toLowerCase();

  const prompt = `
Please translate the following text into ${targetLang}. 
If the text is already in ${targetLang}, return it as is.
Only output the translated text, do not include any other explanations.

Text to translate:
${text}
  `.trim();

  if (provider === 'gemini') {
    if (!cfg.gemini.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 GEMINI_API_KEY/GOOGLE_API_KEY');
    const ai = new GoogleGenAI({ apiKey: cfg.gemini.apiKey });
    const m = ai.getGenerativeModel({ model: cfg.gemini.model });
    const result = await m.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return extractText(result?.response?.text?.());
  }

  if (['openai', 'openai_compatible', 'openrouter', 'kimi', 'minimax', 'glm', 'nvidia'].includes(provider)) {
    let apiKey, baseUrl, model;
    
    if (provider === 'openai') {
      ({ apiKey, baseUrl, model } = cfg.openai);
    } else if (provider === 'openai_compatible') {
      ({ apiKey, baseUrl, model } = cfg.openai_compatible);
    } else if (provider === 'openrouter') {
      ({ apiKey, baseUrl, model } = cfg.openrouter);
    } else if (provider === 'kimi') {
      ({ apiKey, baseUrl, model } = cfg.kimi);
    } else if (provider === 'minimax') {
      ({ apiKey, baseUrl, model } = cfg.minimax);
    } else if (provider === 'glm') {
      ({ apiKey, baseUrl, model } = cfg.glm);
    } else if (provider === 'nvidia') {
      ({ apiKey, baseUrl, model } = cfg.nvidia);
    }

    if (!apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', `未配置 API Key for ${provider}`);
    
    const url = `${String(baseUrl).replace(/\/+$/, '')}/chat/completions`;
    
    const headers = { authorization: `Bearer ${apiKey}` };
    if (provider === 'openrouter') {
      headers['http-referer'] = pick(process.env.OPENROUTER_SITE_URL);
      headers['x-title'] = pick(process.env.OPENROUTER_APP_NAME);
    }

    const json = await postJson(url, {
      headers,
      body: { 
        model, 
        messages: [{ role: 'user', content: prompt }] 
      },
    });
    return extractText(json?.choices?.[0]?.message?.content);
  }

  if (provider === 'anthropic') {
    if (!cfg.anthropic.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 ANTHROPIC_API_KEY');
    const url = 'https://api.anthropic.com/v1/messages';
    const json = await postJson(url, {
      headers: { 'x-api-key': cfg.anthropic.apiKey, 'anthropic-version': '2023-06-01' },
      body: { 
        model: cfg.anthropic.model, 
        max_tokens: 1000, 
        messages: [{ role: 'user', content: prompt }] 
      },
    });
    const content = Array.isArray(json?.content) ? json.content.map((p) => (p?.type === 'text' ? String(p.text || '') : '')).join('\n') : '';
    return extractText(content);
  }

  throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_PROVIDER 或任一大模型 Key');
};

export const critiqueFromImage = async ({ imageBase64, mimeType }) => {
  const cfg = await resolveAiConfig();
  const provider = String(cfg.provider || '').toLowerCase();

  const prompt = `
请用中文对这张照片做一段摄影点评（120-200字）：
- 描述主体与构图亮点
- 指出光影/色彩的优缺点
- 给出可改进的建议
仅输出点评文本，不要包含 JSON 或其他说明。
  `.trim();

  if (provider === 'gemini') {
    if (!cfg.gemini.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 GEMINI_API_KEY/GOOGLE_API_KEY');
    const ai = new GoogleGenAI({ apiKey: cfg.gemini.apiKey });
    const m = ai.getGenerativeModel({ model: cfg.gemini.model });
    const result = await m.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: String(mimeType || 'image/jpeg'), data: imageBase64 } }] }],
    });
    return extractText(result?.response?.text?.());
  }

  if (provider === 'openai') {
    if (!cfg.openai.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPENAI_API_KEY');
    if (!cfg.openai.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPENAI_MODEL 或 AI_MODEL');
    const url = `${String(cfg.openai.baseUrl).replace(/\/+$/, '')}/chat/completions`;
    const dataUrl = `data:${String(mimeType || 'image/jpeg')};base64,${imageBase64}`;
    const json = await postJson(url, {
      headers: { authorization: `Bearer ${cfg.openai.apiKey}` },
      body: { model: cfg.openai.model, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }] },
    });
    return extractText(json?.choices?.[0]?.message?.content);
  }

  if (provider === 'openai_compatible') {
    if (!cfg.openai_compatible.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_COMPATIBLE_API_KEY 或 AI_API_KEY');
    if (!cfg.openai_compatible.baseUrl) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_COMPATIBLE_BASE_URL 或 AI_BASE_URL');
    if (!cfg.openai_compatible.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_COMPATIBLE_MODEL 或 AI_MODEL');
    const url = `${String(cfg.openai_compatible.baseUrl).replace(/\/+$/, '')}/chat/completions`;
    const dataUrl = `data:${String(mimeType || 'image/jpeg')};base64,${imageBase64}`;
    const json = await postJson(url, {
      headers: { authorization: `Bearer ${cfg.openai_compatible.apiKey}` },
      body: { model: cfg.openai_compatible.model, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }] },
    });
    return extractText(json?.choices?.[0]?.message?.content);
  }
  if (provider === 'openrouter') {
    if (!cfg.openrouter.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPEN_ROUTER_API_KEY');
    if (!cfg.openrouter.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPEN_ROUTER_MODEL 或 AI_MODEL');
    const url = `${String(cfg.openrouter.baseUrl).replace(/\/+$/, '')}/chat/completions`;
    const dataUrl = `data:${String(mimeType || 'image/jpeg')};base64,${imageBase64}`;
    const json = await postJson(url, {
      headers: {
        authorization: `Bearer ${cfg.openrouter.apiKey}`,
        'http-referer': pick(process.env.OPENROUTER_SITE_URL),
        'x-title': pick(process.env.OPENROUTER_APP_NAME),
      },
      body: { model: cfg.openrouter.model, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }] } },
    );
    return extractText(json?.choices?.[0]?.message?.content);
  }

  if (['kimi', 'minimax', 'glm', 'nvidia'].includes(provider)) {
    let apiKey, baseUrl, model;
    if (provider === 'kimi') ({ apiKey, baseUrl, model } = cfg.kimi);
    else if (provider === 'minimax') ({ apiKey, baseUrl, model } = cfg.minimax);
    else if (provider === 'glm') ({ apiKey, baseUrl, model } = cfg.glm);
    else ({ apiKey, baseUrl, model } = cfg.nvidia);

    if (!apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', `未配置 ${provider} API Key`);
    
    const url = `${String(baseUrl).replace(/\/+$/, '')}/chat/completions`;
    const dataUrl = `data:${String(mimeType || 'image/jpeg')};base64,${imageBase64}`;
    
    const json = await postJson(url, {
      headers: { authorization: `Bearer ${apiKey}` },
      body: { 
        model, 
        messages: [{ 
          role: 'user', 
          content: [
            { type: 'text', text: prompt }, 
            { type: 'image_url', image_url: { url: dataUrl } }
          ] 
        }] 
      },
    });
    return extractText(json?.choices?.[0]?.message?.content);
  }

  if (provider === 'anthropic') {
    if (!cfg.anthropic.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 ANTHROPIC_API_KEY');
    if (!cfg.anthropic.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 ANTHROPIC_MODEL 或 AI_MODEL');
    const url = 'https://api.anthropic.com/v1/messages';
    const json = await postJson(url, {
      headers: { 'x-api-key': cfg.anthropic.apiKey, 'anthropic-version': '2023-06-01' },
      body: { model: cfg.anthropic.model, max_tokens: 700, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: String(mimeType || 'image/jpeg'), data: imageBase64 } }, { type: 'text', text: prompt }] }] } },
    );
    const text = Array.isArray(json?.content) ? json.content.map((p) => (p?.type === 'text' ? String(p.text || '') : '')).join('\n') : '';
    return extractText(text);
  }

  throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_PROVIDER 或任一大模型 Key');
};
