import assert from 'node:assert/strict';
import { buildMePhotosWhere, parseListParam } from '../lib/me_photos.mjs';

assert.deepEqual(parseListParam(undefined), []);
assert.deepEqual(parseListParam(''), []);
assert.deepEqual(parseListParam('a,b, c'), ['a', 'b', 'c']);
assert.deepEqual(parseListParam(['x', ' y ']), ['x', 'y']);

const w1 = buildMePhotosWhere({ userId: 'u1', month: 2, tags: ['t1', 't2'], camera: 'Sony' });
assert.equal(w1.whereSql.includes('owner_user_id'), true);
assert.equal(w1.params.length, 4);
assert.equal(w1.params[0], 'u1');

const w2 = buildMePhotosWhere({ userId: 'u1', month: 13, tags: [], camera: '' });
assert.equal(w2.whereSql, ' where p.owner_user_id = $1');
assert.deepEqual(w2.params, ['u1']);

const w3 = buildMePhotosWhere({ userId: 'u1', month: 2, day: 6, tags: [], camera: null });
assert.equal(w3.whereSql.includes('extract(month'), true);
assert.equal(w3.whereSql.includes('extract(day'), true);
assert.deepEqual(w3.params, ['u1', 2, 6]);

console.log('me_photos.test.mjs: ok');
