import assert from 'node:assert/strict';
import { getPaginationModel } from '../components/Pagination';

const m0 = getPaginationModel(0, 1, 20);
assert.equal(m0.totalPages, 1);
assert.equal(m0.safePage, 1);
assert.equal(m0.rangeText, '0 条');
assert.deepEqual(m0.pageItems, [1]);

const m1 = getPaginationModel(120, 1, 50);
assert.equal(m1.totalPages, 3);
assert.equal(m1.safePage, 1);
assert.equal(m1.rangeText, '1-50 / 120 条');
assert.deepEqual(m1.pageItems, [1, 2, 3]);

const m2 = getPaginationModel(1000, 50, 10);
assert.equal(m2.totalPages, 100);
assert.equal(m2.safePage, 50);
assert.deepEqual(m2.pageItems, [1, '...', 49, 50, 51, '...', 100]);

const m3 = getPaginationModel(1000, 999, 10);
assert.equal(m3.safePage, 100);


