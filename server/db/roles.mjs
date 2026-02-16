
import { pool } from '../db.mjs';

export const getAllRoles = async () => {
  const res = await pool.query('SELECT * FROM roles ORDER BY created_at ASC');
  return res.rows;
};

export const getRoleById = async (id) => {
  const res = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
  return res.rows[0];
};

export const createRole = async (role) => {
  const { id, name, description, permissions } = role;
  const res = await pool.query(
    'INSERT INTO roles (id, name, description, permissions) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, name, description, permissions || []]
  );
  return res.rows[0];
};

export const updateRole = async (id, updates) => {
  const { name, description, permissions } = updates;
  const res = await pool.query(
    'UPDATE roles SET name = COALESCE($2, name), description = COALESCE($3, description), permissions = COALESCE($4, permissions), updated_at = NOW() WHERE id = $1 RETURNING *',
    [id, name, description, permissions]
  );
  return res.rows[0];
};

export const deleteRole = async (id) => {
  // Check if system role
  const role = await getRoleById(id);
  if (role && role.is_system) {
    throw new Error('Cannot delete system role');
  }
  // Check if users are assigned
  const usersRes = await pool.query('SELECT COUNT(*) FROM users WHERE role = $1', [id]);
  if (parseInt(usersRes.rows[0].count) > 0) {
    throw new Error('Cannot delete role with assigned users');
  }
  
  await pool.query('DELETE FROM roles WHERE id = $1', [id]);
  return true;
};
