import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectDate } from '../../skills/docent/scripts/src/lib/project-date.mjs';

test('config.date가 우선', async () => {
  assert.equal(projectDate('.', { date: '2026-01-02' }), '2026-01-02');
});

test('git 저장소면 마지막 커밋 날짜', () => {
  assert.match(projectDate('.', {}), /^\d{4}-\d{2}-\d{2}$/);
});

test('git이 없으면 unknown', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'docent-date-'));
  assert.equal(projectDate(dir, {}), 'unknown');
});
