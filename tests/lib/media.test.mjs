import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearFailure, readFailures, recordFailure } from '../../skills/docent/scripts/src/lib/media.mjs';

async function project() {
  const dir = await mkdtemp(join(tmpdir(), 'docent-media-'));
  await mkdir(join(dir, '.docent', 'media'), { recursive: true });
  return dir;
}

test('동시에 실패를 기록해도 잃지 않는다', async () => {
  const dir = await project();
  await Promise.all(Array.from({ length: 20 }, (_, i) => recordFailure(dir, { id: `s${String(i).padStart(2, '0')}`, kind: 'gif', reason: 'x' })));
  assert.equal((await readFailures(dir)).length, 20);
  await Promise.all(Array.from({ length: 10 }, (_, i) => clearFailure(dir, `s${String(i).padStart(2, '0')}`, 'gif')));
  assert.equal((await readFailures(dir)).length, 10);
});
