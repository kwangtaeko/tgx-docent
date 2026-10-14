// .docent/media/ — 캡처·GIF·실패 기록. build가 지우는 out/ 밖에 둔다.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { docentDir, readJsonIfExists, writeJson } from './workspace.mjs';

export function mediaPaths(projectDir) {
  const root = join(docentDir(projectDir), 'media');
  return {
    root,
    img: (id) => join(root, 'img', `${id}.png`),
    gif: (id) => join(root, 'gif', `${id}.gif`),
    fail: (id) => join(root, 'fail', `${id}.png`),
    failures: join(root, 'failures.json'),
  };
}

export async function ensureMediaDirs(projectDir) {
  const { root } = mediaPaths(projectDir);
  for (const sub of ['img', 'gif', 'fail']) await mkdir(join(root, sub), { recursive: true });
}

export async function readFailures(projectDir) {
  try {
    return (await readJsonIfExists(mediaPaths(projectDir).failures)) ?? [];
  } catch {
    return [];
  }
}

const order = (a, b) => (a.id === b.id ? (a.kind < b.kind ? -1 : 1) : a.id < b.id ? -1 : 1);

export async function recordFailure(projectDir, failure) {
  const list = (await readFailures(projectDir)).filter((f) => !(f.id === failure.id && f.kind === failure.kind));
  list.push({ id: failure.id, kind: failure.kind, ...(failure.step !== undefined ? { step: failure.step } : {}), reason: failure.reason });
  await writeJson(mediaPaths(projectDir).failures, list.sort(order));
}

export async function clearFailure(projectDir, id, kind) {
  const list = await readFailures(projectDir);
  const next = list.filter((f) => !(f.id === id && f.kind === kind));
  if (next.length !== list.length) await writeJson(mediaPaths(projectDir).failures, next);
}
