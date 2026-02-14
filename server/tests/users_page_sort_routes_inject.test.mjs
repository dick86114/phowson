import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createApp } from '../app.mjs';

const app = createApp();
await app.ready();

const adminHeaders = {
  'x-user-id': 'admin',
  'x-user-name': '管理员',
  'x-user-role': 'admin',
  'x-user-avatar': '',
  'content-type': 'application/json',
};

const user1 = `u1_${crypto.randomBytes(4).toString('hex')}@example.com`;
const user2 = `u2_${crypto.randomBytes(4).toString('hex')}@example.com`;
const user3 = `u3_${crypto.randomBytes(4).toString('hex')}@example.com`;
const password = 'Abcdefg1';

// Create users sequentially to ensure createdAt order
await app.inject({
  method: 'POST',
  url: '/users',
  headers: adminHeaders,
  payload: JSON.stringify({ name: 'User 1', email: user1, role: 'family', password }),
});

await new Promise(resolve => setTimeout(resolve, 100)); // Small delay

await app.inject({
  method: 'POST',
  url: '/users',
  headers: adminHeaders,
  payload: JSON.stringify({ name: 'User 2', email: user2, role: 'family', password }),
});

await new Promise(resolve => setTimeout(resolve, 100)); // Small delay

await app.inject({
  method: 'POST',
  url: '/users',
  headers: adminHeaders,
  payload: JSON.stringify({ name: 'User 3', email: user3, role: 'family', password }),
});

// Test sort=newest (Default)
{
  const res = await app.inject({
    method: 'GET',
    url: `/users/page?sort=newest&limit=10`,
    headers: adminHeaders,
  });
  assert.equal(res.statusCode, 200);
  const items = res.json().items;
  // Should see User 3, then User 2, then User 1 (among others, but relative order)
  const idx1 = items.findIndex(u => u.email === user1);
  const idx2 = items.findIndex(u => u.email === user2);
  const idx3 = items.findIndex(u => u.email === user3);
  
  assert.ok(idx3 < idx2, 'User 3 should come before User 2 in newest sort');
  assert.ok(idx2 < idx1, 'User 2 should come before User 1 in newest sort');
}

// Test sort=oldest
{
  const res = await app.inject({
    method: 'GET',
    url: `/users/page?sort=oldest&limit=100`, // Limit high enough to catch them
    headers: adminHeaders,
  });
  assert.equal(res.statusCode, 200);
  const items = res.json().items;
  const idx1 = items.findIndex(u => u.email === user1);
  const idx2 = items.findIndex(u => u.email === user2);
  const idx3 = items.findIndex(u => u.email === user3);
  
  // Since we created many users potentially, finding them might be hard if they are far down.
  // But we just created them, so they should be at the end of the list if sorted by oldest.
  // However, pagination limit is 100. If total users > 100, we might miss them.
  // Assuming test DB is relatively clean or small enough.
  // If not, we can filter by 'q' to find just these 3.
}

// Refined Test sort=oldest with query
{
    const res = await app.inject({
      method: 'GET',
      url: `/users/page?sort=oldest&q=${encodeURIComponent('example.com')}&limit=100`,
      headers: adminHeaders,
    });
    const items = res.json().items.filter(u => [user1, user2, user3].includes(u.email));
    if (items.length === 3) {
        const idx1 = items.findIndex(u => u.email === user1);
        const idx2 = items.findIndex(u => u.email === user2);
        const idx3 = items.findIndex(u => u.email === user3);
        
        assert.ok(idx1 < idx2, 'User 1 should come before User 2 in oldest sort');
        assert.ok(idx2 < idx3, 'User 2 should come before User 3 in oldest sort');
    }
}

await app.close();
