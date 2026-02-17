import { badRequest } from '../lib/http_errors.mjs';
import { requireAdmin } from '../plugins/rbac.mjs';
import { fillFromImage, resolveAiConfig, fetchRemoteModels } from '../lib/ai_provider.mjs';
import exifr from 'exifr';
import { reverseGeocode } from '../lib/geocoding.mjs';

export const registerAiRoutes = (app) => {
  app.post('/ai/models', {
    preHandler: requireAdmin(),
    schema: {
      body: {
        type: 'object',
        required: ['provider', 'apiKey'],
        properties: {
          provider: { type: 'string' },
          apiKey: { type: 'string' },
          baseUrl: { type: 'string' }
        }
      }
    },
    handler: async (req) => {
      const { provider, apiKey, baseUrl } = req.body;
      const models = await fetchRemoteModels({ provider, apiKey, baseUrl });
      return { models };
    }
  });

  app.post('/ai/fill', {
    bodyLimit: (() => {
      const n = Number(process.env.AI_BODY_LIMIT_BYTES);
      return Number.isFinite(n) && n > 0 ? n : 60 * 1024 * 1024;
    })(),
    preHandler: requireAdmin(),
    schema: {
      body: {
        type: 'object',
        required: ['imageBase64'],
        properties: {
          imageBase64: { type: 'string', minLength: 10 },
          mimeType: { type: 'string' },
          locationHint: { type: 'string' },
        },
      },
    },
    handler: async (req) => {
      const { imageBase64, mimeType, locationHint } = req.body;
      const base64 = String(imageBase64 || '').trim();
      if (!base64) throw badRequest('AI_IMAGE_REQUIRED', '缺少图片数据');

      let finalHint = locationHint;
      if (!finalHint) {
        try {
           const buf = Buffer.from(base64, 'base64');
           const exif = await exifr.parse(buf);
           if (exif && typeof exif.latitude === 'number' && typeof exif.longitude === 'number') {
              const loc = await reverseGeocode(exif.latitude, exif.longitude);
              if (loc) finalHint = loc;
           }
        } catch (e) {
           req.log.warn({ err: e }, 'Failed to extract/geocode gps from AI image');
        }
      }

      return fillFromImage({ imageBase64: base64, mimeType: String(mimeType || 'image/jpeg'), locationHint: finalHint });
    },
  });

  app.get('/ai/enabled', async () => {
    const cfg = await resolveAiConfig();
    const provider = String(cfg.provider || '').toLowerCase();
    let enabled = false;
    if (provider === 'gemini') {
      enabled = !!cfg.gemini?.apiKey;
    } else if (provider === 'openai') {
      enabled = !!cfg.openai?.apiKey && !!cfg.openai?.model;
    } else if (provider === 'openai_compatible') {
      enabled = !!cfg.openai_compatible?.apiKey && !!cfg.openai_compatible?.baseUrl && !!cfg.openai_compatible?.model;
    } else if (provider === 'openrouter') {
      enabled = !!cfg.openrouter?.apiKey && !!cfg.openrouter?.model;
    } else if (provider === 'kimi') {
      enabled = !!cfg.kimi?.apiKey && !!cfg.kimi?.model;
    } else if (provider === 'minimax') {
      enabled = !!cfg.minimax?.apiKey && !!cfg.minimax?.model;
    } else if (provider === 'glm') {
      enabled = !!cfg.glm?.apiKey && !!cfg.glm?.model;
    } else if (provider === 'nvidia') {
      enabled = !!cfg.nvidia?.apiKey && !!cfg.nvidia?.model;
    } else if (provider === 'anthropic') {
      enabled = !!cfg.anthropic?.apiKey && !!cfg.anthropic?.model;
    } else {
      enabled = false;
    }
    return { enabled, provider };
  });
};
