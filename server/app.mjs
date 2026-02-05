import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { registerErrorHandling } from './plugins/error.mjs';
import { registerAuth } from './plugins/auth.mjs';
import { registerCategoryRoutes } from './routes/categories.mjs';
import { registerHealthRoutes } from './routes/health.mjs';
import { registerMediaRoutes } from './routes/media.mjs';
import { registerPhotoRoutes } from './routes/photos.mjs';
import { registerStatsRoutes } from './routes/stats.mjs';
import { registerUserRoutes } from './routes/users.mjs';
import { registerAdminRoutes } from './routes/admin.mjs';
import { registerAuthRoutes } from './routes/auth.mjs';
import { registerAiRoutes } from './routes/ai.mjs';
import { registerActivityRoutes } from './routes/activity.mjs';
import { registerGamificationRoutes } from './routes/gamification.mjs';

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return true;
  if (/^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin)) return true;
  return false;
};

export const createApp = () => {
  const uploadMaxBytesEnv = Number(process.env.UPLOAD_MAX_BYTES);
  const uploadMaxBytes = Number.isFinite(uploadMaxBytesEnv) && uploadMaxBytesEnv > 0 ? uploadMaxBytesEnv : 60 * 1024 * 1024;

  const app = Fastify({
    logger: true,
    bodyLimit: Math.max(30 * 1024 * 1024, uploadMaxBytes + 2 * 1024 * 1024),
  });

  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });

  app.register(cors, {
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'x-user-id', 'x-user-name', 'x-user-avatar', 'x-user-role'],
    exposedHeaders: ['x-request-id'],
    credentials: true,
  });

  app.register(multipart, {
    limits: {
      fileSize: uploadMaxBytes,
    },
  });

  registerAuth(app);
  registerErrorHandling(app);

  app.register(registerHealthRoutes);
  app.register(registerCategoryRoutes);
  app.register(registerAuthRoutes);
  app.register(registerMediaRoutes);
  app.register(registerPhotoRoutes);
  app.register(registerStatsRoutes);
  app.register(registerUserRoutes);
  app.register(registerAdminRoutes);
  app.register(registerAiRoutes);
  app.register(registerActivityRoutes);
  app.register(registerGamificationRoutes);

  return app;
};
