import { GoogleGenAI } from '@google/genai';
import { HttpError } from './http_errors.mjs';

const pick = (...values) => {
  for (const v of values) {
    const s = String(v || '').trim();
    if (s) return s;
  }
  return '';
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

const makePrompt = () => {
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
 - locationHint 用中文给一个“地点参考”，尽量具体但不要硬编；不确定就输出场景类型（如：城市街区/山野/海边/室内/夜景等）。
  `.trim();
};

const geminiFill = async ({ apiKey, model, imageBase64, mimeType }) => {
  const ai = new GoogleGenAI({ apiKey });
  const m = ai.getGenerativeModel({ model });

  const result = await m.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { text: makePrompt() },
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

const openAiCompatibleFill = async ({ apiKey, baseUrl, model, imageBase64, mimeType, extraHeaders }) => {
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
            { type: 'text', text: makePrompt() },
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

const anthropicFill = async ({ apiKey, model, imageBase64, mimeType }) => {
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
            { type: 'text', text: makePrompt() },
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

export const resolveAiConfig = () => {
  const provider = pick(process.env.AI_PROVIDER).toLowerCase();
  const model = pick(process.env.AI_MODEL);

  const geminiKey = pick(process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY);
  const geminiModel = pick(model, process.env.GEMINI_MODEL, 'gemini-3-flash');

  const openaiKey = pick(process.env.OPENAI_API_KEY);
  const openaiBaseUrl = pick(process.env.OPENAI_BASE_URL, 'https://api.openai.com/v1');
  const openaiModel = pick(model, process.env.OPENAI_MODEL);

  // Generic OpenAI-compatible
  const compatibleKey = pick(process.env.AI_COMPATIBLE_API_KEY, process.env.AI_API_KEY);
  const compatibleBaseUrl = pick(process.env.AI_COMPATIBLE_BASE_URL, process.env.AI_BASE_URL);
  const compatibleModel = pick(model, process.env.AI_COMPATIBLE_MODEL);

  const anthropicKey = pick(process.env.ANTHROPIC_API_KEY);
  const anthropicModel = pick(model, process.env.ANTHROPIC_MODEL);

  const openRouterKey = pick(process.env.OPEN_ROUTER_API_KEY);
  const openRouterBaseUrl = pick(process.env.OPEN_ROUTER_BASE_URL, 'https://openrouter.ai/api/v1');
  const openRouterModel = pick(model, process.env.OPEN_ROUTER_MODEL);

  const gatewayKey = pick(process.env.AI_GATEWAY_API_KEY);
  const gatewayBaseUrl = pick(process.env.AI_GATEWAY_BASE_URL);
  const gatewayModel = pick(model, process.env.AI_GATEWAY_MODEL);

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
      : gatewayKey
      ? 'vercelai_gateway'
      : '');

  return {
    provider: inferredProvider,
    gemini: { apiKey: geminiKey, model: geminiModel },
    openai: { apiKey: openaiKey, baseUrl: openaiBaseUrl, model: openaiModel },
    openai_compatible: { apiKey: compatibleKey, baseUrl: compatibleBaseUrl, model: compatibleModel },
    anthropic: { apiKey: anthropicKey, model: anthropicModel },
    openrouter: { apiKey: openRouterKey, baseUrl: openRouterBaseUrl, model: openRouterModel },
    vercelai_gateway: { apiKey: gatewayKey, baseUrl: gatewayBaseUrl, model: gatewayModel },
  };
};

export const fillFromImage = async ({ imageBase64, mimeType }) => {
  const cfg = resolveAiConfig();
  const provider = String(cfg.provider || '').toLowerCase();

  if (provider === 'gemini') {
    if (!cfg.gemini.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 GEMINI_API_KEY/GOOGLE_API_KEY');
    return geminiFill({ apiKey: cfg.gemini.apiKey, model: cfg.gemini.model, imageBase64, mimeType });
  }

  if (provider === 'openai') {
    if (!cfg.openai.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPENAI_API_KEY');
    if (!cfg.openai.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPENAI_MODEL 或 AI_MODEL');
    return openAiCompatibleFill({ apiKey: cfg.openai.apiKey, baseUrl: cfg.openai.baseUrl, model: cfg.openai.model, imageBase64, mimeType });
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
      extraHeaders: {
        'http-referer': pick(process.env.OPENROUTER_SITE_URL),
        'x-title': pick(process.env.OPENROUTER_APP_NAME),
      },
    });
  }

  if (provider === 'vercelai_gateway') {
    if (!cfg.vercelai_gateway.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_GATEWAY_API_KEY');
    if (!cfg.vercelai_gateway.baseUrl) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_GATEWAY_BASE_URL');
    if (!cfg.vercelai_gateway.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_GATEWAY_MODEL 或 AI_MODEL');
    return openAiCompatibleFill({ apiKey: cfg.vercelai_gateway.apiKey, baseUrl: cfg.vercelai_gateway.baseUrl, model: cfg.vercelai_gateway.model, imageBase64, mimeType });
  }

  if (provider === 'anthropic') {
    if (!cfg.anthropic.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 ANTHROPIC_API_KEY');
    if (!cfg.anthropic.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 ANTHROPIC_MODEL 或 AI_MODEL');
    return anthropicFill({ apiKey: cfg.anthropic.apiKey, model: cfg.anthropic.model, imageBase64, mimeType });
  }

  throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_PROVIDER 或任一大模型 Key');
};

const extractText = (maybe) => {
  const s = String(maybe || '').trim();
  return s;
};

export const critiqueFromImage = async ({ imageBase64, mimeType }) => {
  const cfg = resolveAiConfig();
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

  if (provider === 'vercelai_gateway') {
    if (!cfg.vercelai_gateway.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_GATEWAY_API_KEY');
    if (!cfg.vercelai_gateway.baseUrl) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_GATEWAY_BASE_URL');
    if (!cfg.vercelai_gateway.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_GATEWAY_MODEL 或 AI_MODEL');
    const url = `${String(cfg.vercelai_gateway.baseUrl).replace(/\/+$/, '')}/chat/completions`;
    const dataUrl = `data:${String(mimeType || 'image/jpeg')};base64,${imageBase64}`;
    const json = await postJson(url, {
      headers: { authorization: `Bearer ${cfg.vercelai_gateway.apiKey}` },
      body: { model: cfg.vercelai_gateway.model, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }] } },
    );
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
