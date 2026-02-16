
import { strict as assert } from 'node:assert';

const BASE_URL = 'http://localhost:2615';
const ADMIN_HEADERS = {
  'content-type': 'application/json',
  'x-user-id': 'admin_test',
  'x-user-role': 'admin',
  'x-user-permissions': 'admin_access',
  'x-user-name': 'Admin Test'
};

const TEST_ROLE_ID = 'test_editor_role';
const TEST_USER_EMAIL = 'test_role_user@example.com';
let createdUserId = null;

async function request(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      ...ADMIN_HEADERS
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  } else {
    delete options.headers['content-type'];
  }
  
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  
  if (!res.ok) {
    const error = new Error(`Request failed: ${method} ${path} ${res.status} ${JSON.stringify(data)}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function main() {
  console.log('Starting verification...');

  // 1. Clean up potential leftovers
  try {
    // Try to find user to delete first
    const usersPage = await request('GET', `/users/page?q=${TEST_USER_EMAIL}`);
    const user = usersPage.items.find(u => u.email === TEST_USER_EMAIL);
    if (user) {
        await request('DELETE', `/users/${user.id}`);
        console.log('Cleaned up existing user');
    }

    await request('DELETE', `/roles/${TEST_ROLE_ID}`);
    console.log('Cleaned up role');
  } catch (e) {
      console.log('Cleanup warning:', e.message);
  }

  // Let's try to create the role
  console.log('Creating role...');
  const role = await request('POST', '/roles', {
    id: TEST_ROLE_ID,
    name: '测试编辑角色',
    description: '用于测试的角色',
    permissions: ['basic_access']
  });
  assert.equal(role.id, TEST_ROLE_ID);
  console.log('Role created:', role);

  // 2. Create a user with this role
  console.log('Creating user with role...');
  const user = await request('POST', '/users', {
    name: 'Test Role User',
    email: TEST_USER_EMAIL,
    password: 'password123',
    role: TEST_ROLE_ID
  });
  createdUserId = user.id;
  assert.equal(user.role, TEST_ROLE_ID);
  console.log('User created:', user);

  // 3. Verify user has the role (fetch user details)
  // The GET /users/page returns items. I need to filter by ID or Email.
  console.log('Verifying user role...');
  const usersPage = await request('GET', `/users/page?q=${TEST_USER_EMAIL}`);
  const foundUser = usersPage.items.find(u => u.email === TEST_USER_EMAIL);
  assert.ok(foundUser, 'User not found');
  assert.equal(foundUser.role, TEST_ROLE_ID);
  console.log('User role verified.');

  // 4. Try to delete the role (should fail)
  console.log('Attempting to delete role (should fail)...');
  try {
    await request('DELETE', `/roles/${TEST_ROLE_ID}`);
    throw new Error('Should have failed');
  } catch (e) {
    if (e.message === 'Should have failed') throw e;
    console.log('Delete failed as expected:', e.data?.message || e.message);
  }

  // 5. Update user role to 'family'
  console.log('Updating user role to family...');
  await request('PATCH', `/users/${createdUserId}`, {
    role: 'family'
  });
  console.log('User role updated.');

  // 6. Delete the role (should succeed)
  console.log('Deleting role (should succeed)...');
  await request('DELETE', `/roles/${TEST_ROLE_ID}`);
  console.log('Role deleted.');

  // 7. Cleanup user
  console.log('Cleaning up user...');
  await request('DELETE', `/users/${createdUserId}`);
  console.log('User deleted.');

  console.log('All tests passed!');
}

main().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
