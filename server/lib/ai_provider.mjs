import { GoogleGenAI } from '@google/genai';
import crypto from 'node:crypto';
import { HttpError } from './http_errors.mjs';
import { pool } from '../db.mjs';
import { geocodeByName } from './geocoding.mjs';

const pick = (...values) => {
  for (const v of values) {
    const s = String(v || '').trim();
    if (s) return s;
  }
  return '';
};

const isGlmVisionModel = (model) => {
  const m = String(model || '').trim().toLowerCase();
  if (!m) return false;
  return m.includes('v') || m.includes('vision');
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

const sha256Hex = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const withTimeout = async (promise, timeoutMs) => {
  const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000;
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new HttpError(502, 'AI_UPSTREAM_ERROR', `请求超时(${ms}ms)`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const postJsonWithTimeout = async (url, { headers, body, timeoutMs }) => {
  const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(headers || {}),
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
  } catch (e) {
    const message = e?.name === 'AbortError' ? `请求超时(${ms}ms)` : String(e?.message || e);
    throw new HttpError(502, 'AI_UPSTREAM_ERROR', message.slice(0, 400));
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  const json = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })();

  if (!res.ok) {
    let msg = String(json?.error?.message || json?.message || text || 'LLM 请求失败').slice(0, 400);
    msg = `[${res.status}] ${msg}`;
    const err = new HttpError(502, 'AI_UPSTREAM_ERROR', msg);
    err.upstreamStatus = res.status;
    throw err;
  }

  return json;
};

const formatIsoWithOffset = ({ year, month, day, hour, minute, second }, offsetMinutes) => {
  const pad = (n) => String(n).padStart(2, '0');
  const sign = offsetMinutes <= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const offH = pad(Math.floor(abs / 60));
  const offM = pad(abs % 60);
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}${sign}${offH}:${offM}`;
};

export const parseFilenameDate = (filename, offsetMinutes = 0) => {
  const raw = String(filename || '').trim();
  if (!raw) return null;
  const base = raw.replace(/\.[^.]+$/, '');
  const m = /(\d{4})[-_./ ]?(\d{2})[-_./ ]?(\d{2})(?:[ T_-]?(\d{2})[-_: ]?(\d{2})[-_: ]?(\d{2}))?/.exec(base);
  if (!m) return null;
  const year = Number.parseInt(m[1], 10);
  const month = Number.parseInt(m[2], 10);
  const day = Number.parseInt(m[3], 10);
  const hour = Number.parseInt(m[4] || '0', 10);
  const minute = Number.parseInt(m[5] || '0', 10);
  const second = Number.parseInt(m[6] || '0', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
  const iso = formatIsoWithOffset({ year, month, day, hour, minute, second }, offsetMinutes);
  const dateOnly = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { iso, dateOnly };
};

export const extractFilenameLocationCandidate = (filename) => {
  const raw = String(filename || '').trim();
  if (!raw) return '';
  const base = raw.replace(/\.[^.]+$/, '');
  
  // Skip common camera file prefixes/patterns that are definitely not locations
  const ignorePatterns = [
    /^IMG_?\d+$/i,
    /^DSC_?\d+$/i,
    /^PXL_?\d+$/i,
    /^Screenshot_?\d+$/i,
    /^DJI_?\d+$/i,
    /^VID_?\d+$/i,
    /^MOV_?\d+$/i,
    /^SAM_?\d+$/i,
    /^HUAWEI_?\d+$/i,
    /^MMExport_?\d+$/i,
    /^WX_?\d+$/i,
    /^O1CN01/i, // Taobao/Alibaba images
    /^TB2/i,
    /^\d+$/, // Pure numbers
    /^image[-_]\d+$/i,
    /^photo[-_]\d+$/i
  ];

  if (ignorePatterns.some(p => p.test(base))) return '';

  const withoutDate = base.replace(/(\d{4})[-_./ ]?(\d{2})[-_./ ]?(\d{2})(?:[ T_-]?(\d{2})[-_: ]?(\d{2})[-_: ]?(\d{2}))?/g, ' ');
  const stripped = withoutDate.replace(/[0-9]/g, ' ').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Skip if the result is just common generic words after stripping
  const genericWords = ['copy', 'edit', 'filtered', 'restored', 'enhanced', 'original', 'highres'];
  if (genericWords.includes(stripped.toLowerCase())) return '';

  return stripped.length >= 2 ? stripped : '';
};

const getAiParseCache = async (hash, parseType) => {
  const key = `${hash}:${parseType}`;
  const res = await pool.query('select result, expires_at from ai_parse_cache where cache_key = $1', [key]);
  const row = res.rows?.[0];
  if (!row) return null;
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (!expiresAt || expiresAt <= Date.now()) {
    await pool.query('delete from ai_parse_cache where cache_key = $1', [key]);
    return null;
  }
  return row.result || null;
};

const setAiParseCache = async (hash, parseType, result) => {
  const key = `${hash}:${parseType}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await pool.query(
    `
      insert into ai_parse_cache (cache_key, parse_type, result, expires_at)
      values ($1, $2, $3, $4)
      on conflict (cache_key)
      do update set result = excluded.result, expires_at = excluded.expires_at, parse_type = excluded.parse_type
    `,
    [key, parseType, result, expiresAt],
  );
};

const runTextPrompt = async ({ prompt, timeoutMs }) => {
  const cfg = await resolveAiConfig();
  const provider = String(cfg.provider || '').toLowerCase();

  if (provider === 'gemini') {
    if (!cfg.gemini.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 GEMINI_API_KEY/GOOGLE_API_KEY');
    const ai = new GoogleGenAI({ apiKey: cfg.gemini.apiKey });
    const m = ai.getGenerativeModel({ model: cfg.gemini.model });
    const result = await withTimeout(
      m.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
      timeoutMs,
    );
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
    const json = await postJsonWithTimeout(url, {
      headers,
      body: { model, messages: [{ role: 'user', content: prompt }] },
      timeoutMs,
    });
    return extractText(json?.choices?.[0]?.message?.content);
  }

  if (provider === 'anthropic') {
    if (!cfg.anthropic.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 ANTHROPIC_API_KEY');
    const url = 'https://api.anthropic.com/v1/messages';
    const json = await postJsonWithTimeout(url, {
      headers: { 'x-api-key': cfg.anthropic.apiKey, 'anthropic-version': '2023-06-01' },
      body: { model: cfg.anthropic.model, max_tokens: 1000, messages: [{ role: 'user', content: prompt }] },
      timeoutMs,
    });
    const content = Array.isArray(json?.content) ? json.content.map((p) => (p?.type === 'text' ? String(p.text || '') : '')).join('\n') : '';
    return extractText(content);
  }

  throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_PROVIDER 或任一大模型 Key');
};

const runVisionPrompt = async ({ prompt, imageBase64, mimeType, timeoutMs }) => {
  const cfg = await resolveAiConfig();
  const provider = String(cfg.provider || '').toLowerCase();

  if (provider === 'gemini') {
    if (!cfg.gemini.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 GEMINI_API_KEY/GOOGLE_API_KEY');
    const ai = new GoogleGenAI({ apiKey: cfg.gemini.apiKey });
    const m = ai.getGenerativeModel({ model: cfg.gemini.model });
    const result = await withTimeout(
      m.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: String(mimeType || 'image/jpeg'), data: imageBase64 } }] }],
      }),
      timeoutMs,
    );
    return extractText(result?.response?.text?.());
  }

  if (provider === 'openai') {
    if (!cfg.openai.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPENAI_API_KEY');
    if (!cfg.openai.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPENAI_MODEL 或 AI_MODEL');
    const url = `${String(cfg.openai.baseUrl).replace(/\/+$/, '')}/chat/completions`;
    const dataUrl = `data:${String(mimeType || 'image/jpeg')};base64,${imageBase64}`;
    const json = await postJsonWithTimeout(url, {
      headers: { authorization: `Bearer ${cfg.openai.apiKey}` },
      body: { model: cfg.openai.model, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }] },
      timeoutMs,
    });
    return extractText(json?.choices?.[0]?.message?.content);
  }

  if (provider === 'openai_compatible') {
    if (!cfg.openai_compatible.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_COMPATIBLE_API_KEY 或 AI_API_KEY');
    if (!cfg.openai_compatible.baseUrl) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_COMPATIBLE_BASE_URL 或 AI_BASE_URL');
    if (!cfg.openai_compatible.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_COMPATIBLE_MODEL 或 AI_MODEL');
    const url = `${String(cfg.openai_compatible.baseUrl).replace(/\/+$/, '')}/chat/completions`;
    const dataUrl = `data:${String(mimeType || 'image/jpeg')};base64,${imageBase64}`;
    const json = await postJsonWithTimeout(url, {
      headers: { authorization: `Bearer ${cfg.openai_compatible.apiKey}` },
      body: { model: cfg.openai_compatible.model, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }] },
      timeoutMs,
    });
    return extractText(json?.choices?.[0]?.message?.content);
  }

  if (provider === 'openrouter') {
    if (!cfg.openrouter.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPEN_ROUTER_API_KEY');
    if (!cfg.openrouter.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPEN_ROUTER_MODEL 或 AI_MODEL');
    const url = `${String(cfg.openrouter.baseUrl).replace(/\/+$/, '')}/chat/completions`;
    const dataUrl = `data:${String(mimeType || 'image/jpeg')};base64,${imageBase64}`;
    const json = await postJsonWithTimeout(url, {
      headers: {
        authorization: `Bearer ${cfg.openrouter.apiKey}`,
        'http-referer': pick(process.env.OPENROUTER_SITE_URL),
        'x-title': pick(process.env.OPENROUTER_APP_NAME),
      },
      body: { model: cfg.openrouter.model, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }] },
      timeoutMs,
    });
    return extractText(json?.choices?.[0]?.message?.content);
  }

  if (['kimi', 'minimax', 'glm', 'nvidia'].includes(provider)) {
    let apiKey, baseUrl, model;
    if (provider === 'kimi') ({ apiKey, baseUrl, model } = cfg.kimi);
    else if (provider === 'minimax') ({ apiKey, baseUrl, model } = cfg.minimax);
    else if (provider === 'glm') ({ apiKey, baseUrl, model } = cfg.glm);
    else ({ apiKey, baseUrl, model } = cfg.nvidia);
    if (!apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', `未配置 ${provider} API Key`);
    if (provider === 'glm' && !isGlmVisionModel(model)) {
      throw new HttpError(400, 'AI_MODEL_UNSUPPORTED', 'GLM 当前模型不支持图像');
    }
    const url = `${String(baseUrl).replace(/\/+$/, '')}/chat/completions`;
    const dataUrl = `data:${String(mimeType || 'image/jpeg')};base64,${imageBase64}`;
    const json = await postJsonWithTimeout(url, {
      headers: { authorization: `Bearer ${apiKey}` },
      body: { model, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }] },
      timeoutMs,
    });
    return extractText(json?.choices?.[0]?.message?.content);
  }

  if (provider === 'anthropic') {
    if (!cfg.anthropic.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 ANTHROPIC_API_KEY');
    if (!cfg.anthropic.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 ANTHROPIC_MODEL 或 AI_MODEL');
    const url = 'https://api.anthropic.com/v1/messages';
    const json = await postJsonWithTimeout(url, {
      headers: { 'x-api-key': cfg.anthropic.apiKey, 'anthropic-version': '2023-06-01' },
      body: { model: cfg.anthropic.model, max_tokens: 700, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: String(mimeType || 'image/jpeg'), data: imageBase64 } }, { type: 'text', text: prompt }] }] },
      timeoutMs,
    });
    const text = Array.isArray(json?.content) ? json.content.map((p) => (p?.type === 'text' ? String(p.text || '') : '')).join('\n') : '';
    return extractText(text);
  }

  throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 AI_PROVIDER 或任一大模型 Key');
};

export const inferSupplementalFromImage = async ({ imageBase64, mimeType, filename, tzOffsetMinutes, hasLocation, hasDate }) => {
  const buffer = Buffer.from(String(imageBase64 || ''), 'base64');
  const hash = sha256Hex(buffer);
  const supplemental = {};

  if (!hasDate && filename) {
    const parsed = parseFilenameDate(filename, tzOffsetMinutes || 0);
    if (parsed?.iso) {
      supplemental.dateTime = { value: parsed.iso, dateOnly: parsed.dateOnly, source: 'filename', confidence: 1 };
    }
  }

  if (!hasLocation && filename) {
    const candidate = extractFilenameLocationCandidate(filename);
    if (candidate) {
      let result = await getAiParseCache(hash, 'filename-location');
      if (!result) {
        try {
          const prompt = `
仅输出 JSON，不要任何额外文本：
{
  "isLocation": boolean,
  "confidence": number,
  "locationName": string
}
请判断以下字符串是否可能是地点名称：
"${candidate}"
confidence 范围 0-1，locationName 在 isLocation=false 时输出空字符串。
          `.trim();
          const text = await runTextPrompt({ prompt, timeoutMs: 5000 });
          result = extractJson(text);
          if (result) await setAiParseCache(hash, 'filename-location', result);
        } catch {
        }
      }
      if (result?.isLocation && Number(result?.confidence) >= 0.8) {
        const geo = await geocodeByName(String(result?.locationName || candidate));
        if (geo?.location) {
          supplemental.location = { value: geo.location, lat: geo.lat, lng: geo.lng, source: 'filename', confidence: Number(result?.confidence) || 0.8 };
        }
      }
    }
  }

  const needLocation = !hasLocation && !supplemental.location;
  const needDate = !hasDate && !supplemental.dateTime;

  if (needLocation || needDate) {
    let ocrText = (await getAiParseCache(hash, 'watermark-text'))?.text;
    if (!ocrText) {
      try {
        const prompt = `
仅输出图片中可见的文字内容，不要输出任何解释或其他文本。
          `.trim();
        const text = await runVisionPrompt({ prompt, imageBase64, mimeType, timeoutMs: 5000 });
        ocrText = String(text || '').trim();
        if (ocrText) await setAiParseCache(hash, 'watermark-text', { text: ocrText });
      } catch (e) {
        console.error('OCR Error:', e);
        ocrText = '';
      }
    }

    if (ocrText) {
      let analyzed = await getAiParseCache(hash, 'watermark-analyze');
      if (!analyzed) {
        try {
          const offsetMinutes = Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : 0;
          const prompt = `
仅输出 JSON，不要任何额外文本：
{
  "location": { "value": string, "confidence": number },
  "datetime": { "value": string, "confidence": number }
}
value 格式要求：
- location: 标准地名（如 "Paris, France"），若无则空字符串
- datetime: ISO 8601 格式（YYYY-MM-DDTHH:mm:ss+HH:mm），若无则空字符串
confidence: 0-1

当前时区偏移：${offsetMinutes} 分钟（请根据此偏移量校正 OCR 中的时间）
OCR 文本内容：
"${ocrText}"
          `.trim();
          const text = await runTextPrompt({ prompt, timeoutMs: 5000 });
          analyzed = extractJson(text);
          if (analyzed) await setAiParseCache(hash, 'watermark-analyze', analyzed);
        } catch {
        }
      }

      if (analyzed) {
        if (needLocation && analyzed.location?.value && Number(analyzed.location.confidence) >= 0.8) {
          const geo = await geocodeByName(analyzed.location.value);
          if (geo?.location) {
            supplemental.location = { value: geo.location, lat: geo.lat, lng: geo.lng, source: 'watermark', confidence: Number(analyzed.location.confidence) };
          }
        }
        if (needDate && analyzed.datetime?.value && Number(analyzed.datetime.confidence) >= 0.8) {
           const d = analyzed.datetime.value;
           // Simple validation
           if (!Number.isNaN(Date.parse(d))) {
             supplemental.dateTime = { value: d, dateOnly: d.split('T')[0], source: 'watermark', confidence: Number(analyzed.datetime.confidence) };
           }
        }
      }
    }
  }


  return { supplemental };
};

const postJson = async (url, { headers, body }) => {
  const timeoutMsRaw = Number(process.env.AI_HTTP_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 60_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(headers || {}),
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
  } catch (e) {
    const message = e?.name === 'AbortError' ? `请求超时(${timeoutMs}ms)` : String(e?.message || e);
    throw new HttpError(502, 'AI_UPSTREAM_ERROR', message.slice(0, 400));
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  const json = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })();

  if (!res.ok) {
    let msg = String(json?.error?.message || json?.message || text || 'LLM 请求失败').slice(0, 400);
    msg = `[${res.status}] ${msg}`;
    const err = new HttpError(502, 'AI_UPSTREAM_ERROR', msg);
    err.upstreamStatus = res.status;
    throw err;
  }

  return json;
};

const makePrompt = (locationHint, filename) => {
  const locInstruction = locationHint 
    ? `- Photo was taken at: "${locationHint}". Use this EXACTLY for locationHint field.`
    : `- locationHint 用中文给一个“地点参考”，尽量具体但不要硬编；不确定就输出场景类型（如：城市街区/山野/海边/室内/夜景等）。`;

  const filenameInstruction = filename
    ? `- Filename is: "${filename}". You MAY use this to infer context or shooting info if relevant.`
    : '';

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
- If the photo's EXIF data is missing, try to extract shooting information (camera, lens, settings) from the visual watermarks (if any) or the filename.
${filenameInstruction}
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

const openAiCompatibleFill = async ({ apiKey, baseUrl, model, imageBase64, mimeType, extraHeaders, locationHint, filename, provider }) => {
  const url = `${String(baseUrl).replace(/\/+$/, '')}/chat/completions`;
  const dataUrl = `data:${String(mimeType || 'image/jpeg')};base64,${imageBase64}`;

  const body = {
    model,
    stream: false,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: makePrompt(locationHint, filename) },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature: 0.7,
  };

  // 针对 GLM 模型的特殊处理
  if (provider === 'glm') {
     // 显式增加 max_tokens，防止截断
     body.max_tokens = 1024;
  }

  const json = await postJson(url, {
    headers: {
      authorization: `Bearer ${apiKey}`,
      ...(extraHeaders || {}),
    },
    body,
  });

  const text = json?.choices?.[0]?.message?.content || '';
  const parsed = extractJson(text);
  if (!parsed) {
    console.error('AI Response Parse Error:', JSON.stringify(json, null, 2));
    throw new HttpError(502, 'AI_BAD_RESPONSE', 'AI 返回格式异常，无法解析 JSON');
  }
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
  const geminiEmbeddingModel = pick(dbAi.gemini?.embeddingModel, process.env.GEMINI_EMBEDDING_MODEL, 'text-embedding-004');

  const openaiKey = pick(dbAi.openai?.apiKey, process.env.OPENAI_API_KEY);
  const openaiBaseUrl = pick(dbAi.openai?.baseUrl, process.env.OPENAI_BASE_URL, 'https://api.openai.com/v1');
  const openaiModel = pick(dbAi.openai?.model, model, process.env.OPENAI_MODEL);
  const openaiEmbeddingModel = pick(dbAi.openai?.embeddingModel, process.env.OPENAI_EMBEDDING_MODEL, 'text-embedding-3-small');

  // Generic OpenAI-compatible
  const compatibleKey = pick(dbAi.openai_compatible?.apiKey, process.env.AI_COMPATIBLE_API_KEY, process.env.AI_API_KEY);
  const compatibleBaseUrl = pick(dbAi.openai_compatible?.baseUrl, process.env.AI_COMPATIBLE_BASE_URL, process.env.AI_BASE_URL);
  const compatibleModel = pick(dbAi.openai_compatible?.model, model, process.env.AI_COMPATIBLE_MODEL);
  const compatibleEmbeddingModel = pick(dbAi.openai_compatible?.embeddingModel, process.env.AI_COMPATIBLE_EMBEDDING_MODEL, process.env.AI_EMBEDDING_MODEL, 'text-embedding-3-small');

  const anthropicKey = pick(dbAi.anthropic?.apiKey, process.env.ANTHROPIC_API_KEY);
  const anthropicModel = pick(dbAi.anthropic?.model, model, process.env.ANTHROPIC_MODEL);

  const openRouterKey = pick(dbAi.openrouter?.apiKey, process.env.OPEN_ROUTER_API_KEY);
  const openRouterBaseUrl = pick(dbAi.openrouter?.baseUrl, process.env.OPEN_ROUTER_BASE_URL, 'https://openrouter.ai/api/v1');
  const openRouterModel = pick(dbAi.openrouter?.model, model, process.env.OPEN_ROUTER_MODEL);
  const openRouterEmbeddingModel = pick(dbAi.openrouter?.embeddingModel, process.env.OPEN_ROUTER_EMBEDDING_MODEL, 'text-embedding-3-small');

  const kimiKey = pick(dbAi.kimi?.apiKey, process.env.KIMI_API_KEY);
  const kimiBaseUrl = pick(dbAi.kimi?.baseUrl, process.env.KIMI_BASE_URL, 'https://api.moonshot.cn/v1');
  const kimiModel = pick(dbAi.kimi?.model, model, process.env.KIMI_MODEL, 'moonshot-v1-8k');
  const kimiEmbeddingModel = pick(dbAi.kimi?.embeddingModel, process.env.KIMI_EMBEDDING_MODEL, 'text-embedding-3-small');

  const minimaxKey = pick(dbAi.minimax?.apiKey, process.env.MINIMAX_API_KEY);
  const minimaxBaseUrl = pick(dbAi.minimax?.baseUrl, process.env.MINIMAX_BASE_URL, 'https://api.minimax.chat/v1');
  const minimaxModel = pick(dbAi.minimax?.model, model, process.env.MINIMAX_MODEL, 'abab6.5s-chat');
  const minimaxEmbeddingModel = pick(dbAi.minimax?.embeddingModel, process.env.MINIMAX_EMBEDDING_MODEL, 'embo-01');

  const glmKey = pick(dbAi.glm?.apiKey, process.env.GLM_API_KEY);
  const glmBaseUrl = pick(dbAi.glm?.baseUrl, process.env.GLM_BASE_URL, 'https://open.bigmodel.cn/api/paas/v4');
  const glmModel = pick(dbAi.glm?.model, model, process.env.GLM_MODEL, 'glm-4-flash');
  const glmEmbeddingModel = pick(dbAi.glm?.embeddingModel, process.env.GLM_EMBEDDING_MODEL, 'embedding-3');

  const nvidiaKey = pick(dbAi.nvidia?.apiKey, process.env.NVIDIA_API_KEY);
  const nvidiaBaseUrl = pick(dbAi.nvidia?.baseUrl, process.env.NVIDIA_BASE_URL, 'https://integrate.api.nvidia.com/v1');
  const nvidiaModel = pick(dbAi.nvidia?.model, model, process.env.NVIDIA_MODEL, 'meta/llama-3.1-405b-instruct');
  const nvidiaEmbeddingModel = pick(dbAi.nvidia?.embeddingModel, process.env.NVIDIA_EMBEDDING_MODEL, 'nvidia/nv-embedqa-e5-v5');

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

export const fillFromImage = async ({ imageBase64, mimeType, locationHint, filename }) => {
  const cfg = await resolveAiConfig();
  const provider = String(cfg.provider || '').toLowerCase();

  if (provider === 'gemini') {
    if (!cfg.gemini.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 GEMINI_API_KEY/GOOGLE_API_KEY');
    return geminiFill({ apiKey: cfg.gemini.apiKey, model: cfg.gemini.model, imageBase64, mimeType, locationHint, filename });
  }

  if (provider === 'openai') {
    if (!cfg.openai.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPENAI_API_KEY');
    if (!cfg.openai.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 OPENAI_MODEL 或 AI_MODEL');
    return openAiCompatibleFill({ apiKey: cfg.openai.apiKey, baseUrl: cfg.openai.baseUrl, model: cfg.openai.model, imageBase64, mimeType, locationHint, filename });
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
      filename,
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
      filename,
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
      filename,
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
      filename,
    });
  }

  if (provider === 'glm') {
    if (!cfg.glm.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 GLM_API_KEY');
    if (!isGlmVisionModel(cfg.glm.model)) {
      throw new HttpError(400, 'AI_MODEL_UNSUPPORTED', 'GLM 当前模型不支持图像，请使用 GLM-4.6V 或 GLM-4.6V-FlashX');
    }
    return openAiCompatibleFill({
      apiKey: cfg.glm.apiKey,
      baseUrl: cfg.glm.baseUrl,
      model: cfg.glm.model,
      imageBase64,
      mimeType,
      locationHint,
      filename,
      provider: 'glm',
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
      filename,
    });
  }

  if (provider === 'anthropic') {
    if (!cfg.anthropic.apiKey) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 ANTHROPIC_API_KEY');
    if (!cfg.anthropic.model) throw new HttpError(501, 'AI_NOT_CONFIGURED', '未配置 ANTHROPIC_MODEL 或 AI_MODEL');
    return anthropicFill({ apiKey: cfg.anthropic.apiKey, model: cfg.anthropic.model, imageBase64, mimeType, locationHint, filename });
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
