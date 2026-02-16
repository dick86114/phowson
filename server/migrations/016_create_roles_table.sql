
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default roles
INSERT INTO roles (id, name, description, permissions, is_system)
VALUES 
  ('admin', '管理员', '系统管理员，拥有所有权限', ARRAY['admin_access', 'basic_access'], TRUE),
  ('family', '家庭成员', '普通家庭成员，拥有基本访问权限', ARRAY['basic_access'], TRUE),
  ('guest', '访客', '访客用户，权限受限', ARRAY[]::TEXT[], TRUE)
ON CONFLICT (id) DO NOTHING;

-- Add foreign key constraint to users table (if not already present)
-- Note: users.role is already text. We just add the FK constraint.
-- But first, ensure all existing users have valid roles.
UPDATE users SET role = 'family' WHERE role NOT IN (SELECT id FROM roles);

ALTER TABLE users 
DROP CONSTRAINT IF EXISTS fk_users_role;

ALTER TABLE users
ADD CONSTRAINT fk_users_role
FOREIGN KEY (role) REFERENCES roles(id)
ON UPDATE CASCADE
ON DELETE SET DEFAULT;
