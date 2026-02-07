import assert from 'node:assert/strict';
import { resolveAdminRoute } from '../utils/adminRoutes';

assert.deepEqual(resolveAdminRoute('/admin', false), { redirectTo: '/admin/me/albums' });
assert.deepEqual(resolveAdminRoute('/admin/', false), { redirectTo: '/admin/me/albums' });

assert.deepEqual(resolveAdminRoute('/admin/manage/photos', false), { redirectTo: '/admin/me/albums' });
assert.deepEqual(resolveAdminRoute('/admin/manage/photos', true), { tab: 'photos' });

assert.deepEqual(resolveAdminRoute('/admin/me/uploads', false), { tab: 'me_uploads' });
assert.deepEqual(resolveAdminRoute('/admin/me/profile', true), { tab: 'settings' });

assert.deepEqual(resolveAdminRoute('/admin/unknown', true), {});

console.log('adminRoutes.test.ts: ok');

