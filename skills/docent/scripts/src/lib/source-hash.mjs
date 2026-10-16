// 화면을 이루는 파일들의 내용 해시. 증분 갱신 판단 기준이다. (설계 문서 13장)
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { t } from './cli-text.mjs';
import { normalizeRel } from './paths.mjs';

export async function hashFiles(rootDir, relPaths) {
  const hash = createHash('sha256');
  for (const rel of [...new Set(relPaths.map(normalizeRel))].sort()) {
    let content;
    try {
      content = await readFile(join(rootDir, rel), 'utf8');
    } catch (err) {
      throw new Error(t('소스 해시 계산 실패: {0} ({1})', rel, err.code ?? err.message));
    }
    // 체크아웃 환경(autocrlf)에 따라 해시가 달라지지 않도록 줄바꿈을 LF로 맞춘다.
    hash.update(rel).update('\0').update(content.replace(/\r\n?/g, '\n')).update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}
