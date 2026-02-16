
import { requireAdmin } from '../plugins/rbac.mjs';
import { getAllRoles, createRole, updateRole, deleteRole } from '../db/roles.mjs';

export const registerRoleRoutes = async (app) => {
  app.get('/roles', {
    preHandler: requireAdmin(),
    handler: async (req) => {
      const roles = await getAllRoles();
      return roles;
    },
  });

  app.post('/roles', {
    preHandler: requireAdmin(),
    schema: {
      body: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string', minLength: 1, maxLength: 50 },
          name: { type: 'string', minLength: 1, maxLength: 50 },
          description: { type: 'string' },
          permissions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    handler: async (req) => {
      const { id, name, description, permissions } = req.body;
      const role = await createRole({ id, name, description, permissions });
      return role;
    },
  });

  app.patch('/roles/:id', {
    preHandler: requireAdmin(),
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 50 },
          description: { type: 'string' },
          permissions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    handler: async (req) => {
      const { id } = req.params;
      const { name, description, permissions } = req.body;
      const role = await updateRole(id, { name, description, permissions });
      return role;
    },
  });

  app.delete('/roles/:id', {
    preHandler: requireAdmin(),
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
    handler: async (req) => {
      const { id } = req.params;
      await deleteRole(id);
      return { success: true };
    },
  });
};
