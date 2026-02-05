import { pool } from '../db.mjs';

export const registerMediaRoutes = async (app) => {
  app.get('/media/photos/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
    },
    handler: async (req, reply) => {
      const id = String(req.params.id);
      const r = await pool.query('select image_mime, image_bytes, image_url from photos where id=$1', [id]);
      if (r.rowCount === 0) return reply.code(404).send();
      if (!r.rows[0]?.image_bytes) {
        if (r.rows[0]?.image_url) return reply.redirect(String(r.rows[0].image_url));
        return reply.code(404).send();
      }
      const mime = r.rows[0].image_mime || 'application/octet-stream';
      return reply.type(mime).send(r.rows[0].image_bytes);
    },
  });

  app.get('/media/avatars/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
    },
    handler: async (req, reply) => {
      const id = String(req.params.id);
      const r = await pool.query('select avatar_mime, avatar_bytes, avatar_url from users where id=$1', [id]);
      if (r.rowCount === 0) return reply.code(404).send();
      if (!r.rows[0]?.avatar_bytes) {
        if (r.rows[0]?.avatar_url) return reply.redirect(String(r.rows[0].avatar_url));
        return reply.code(404).send();
      }
      const mime = r.rows[0].avatar_mime || 'application/octet-stream';
      return reply.type(mime).send(r.rows[0].avatar_bytes);
    },
  });
};

