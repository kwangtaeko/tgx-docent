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

test('git이 없으면 화면 파일 중 가장 최근 수정일, 파일도 없으면 unknown', async () => {
  const { utimes, writeFile } = await import('node:fs/promises');
  const dir = await mkdtemp(join(tmpdir(), 'docent-date-'));
  assert.equal(projectDate(dir, {}), 'unknown');
  await writeFile(join(dir, 'a.jsp'), '');
  await writeFile(join(dir, 'b.jsp'), '');
  await utimes(join(dir, 'a.jsp'), new Date('2025-03-04T10:00:00Z'), new Date('2025-03-04T10:00:00Z'));
  await utimes(join(dir, 'b.jsp'), new Date('2025-05-06T10:00:00Z'), new Date('2025-05-06T10:00:00Z'));
  assert.equal(projectDate(dir, {}, ['a.jsp', 'b.jsp', 'missing.jsp']), '2025-05-06');
});
