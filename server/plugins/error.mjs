import { HttpError } from '../lib/http_errors.mjs';

const pickMessage = (err) => {
  if (err instanceof HttpError) return err.message;
  if (typeof err?.message === 'string' && err.message) return err.message;
  return '服务器错误';
};

const pickStatus = (err) => {
  if (err instanceof HttpError && Number.isInteger(err.status)) return err.status;
  const status = Number(err?.statusCode ?? err?.status);
  if (Number.isFinite(status) && status >= 400) return status;
  return 500;
};

const pickCode = (err) => {
  if (err instanceof HttpError && err.code) return String(err.code);
  const status = pickStatus(err);
  if (status === 404) return 'NOT_FOUND';
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  return 'INTERNAL_ERROR';
};

export const registerErrorHandling = (app) => {
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      code: 'NOT_FOUND',
      message: '接口不存在',
      requestId: req.id,
    });
  });

  app.setErrorHandler((err, req, reply) => {
    console.log('Error Handler Hit:', err);
    const status = pickStatus(err);
    const code = pickCode(err);
    const message = pickMessage(err);

    if (status >= 500) {
      req.log.error({ err, requestId: req.id }, 'request failed');
    } else {
      req.log.warn({ err, requestId: req.id }, 'request failed');
    }

    reply.code(status).send({
      code,
      message,
      requestId: req.id,
    });
  });
};

