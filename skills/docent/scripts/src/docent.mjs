// docent CLI. 사용법: node docent.mjs <명령> [--project <디렉터리>]
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBuild } from './commands/build.mjs';
import { runInit } from './commands/init.mjs';
import { runInventory } from './commands/inventory.mjs';
import { runReview } from './commands/review.mjs';
import { endSession, startSession } from './commands/session.mjs';
import { runValidate } from './commands/validate.mjs';

const USAGE = `사용법: docent <명령> [--project <디렉터리>]

명령:
  init           프로젝트를 파악해 .docent/config.yaml을 만듭니다
  inventory      화면 목록(.docent/inventory.json)을 만듭니다
  validate       분석 결과의 스키마·근거·연결을 검사합니다
  review         확인 필요 항목(.docent/review.md)을 모읍니다
  build          .docent/out/에 HTML 사이트와 소개 README를 만듭니다
  session start  분석 세션 시작(비밀 파일 읽기 차단)
  session end    분석 세션 종료`;

// 번들(dist/docent.mjs) 기준 skills/docent/assets
const ASSETS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets');

function parseArgs(argv) {
  const args = [];
  let project = process.cwd();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project') project = resolve(argv[++i]);
    else args.push(argv[i]);
  }
  return { args, project };
}

function listProblems(title, problems) {
  if (problems.length) console.log(`${title}\n${problems.map((p) => `- ${p}`).join('\n')}`);
}

async function main() {
  const { args, project } = parseArgs(process.argv.slice(2));
  const [command, sub] = args;
  switch (command) {
    case 'init': {
      const r = await runInit(project);
      console.log(r.created ? '.docent/config.yaml을 만들었습니다.' : '.docent/config.yaml이 이미 있어 그대로 둡니다.');
      console.log(`감지된 프레임워크: ${r.detectors.length ? r.detectors.join(', ') : '없음 (에이전트 탐색으로 화면을 찾습니다)'}`);
      return 0;
    }
    case 'inventory': {
      const { inventory, problems } = await runInventory(project);
      const pages = inventory.screens.filter((s) => s.kind === 'page').length;
      console.log(`화면 ${inventory.screens.length}개 (page ${pages}, 하위 화면 ${inventory.screens.length - pages})`);
      for (const s of inventory.screens) console.log(`- ${s.id}\t${s.route ?? `(${s.parentId}의 하위 화면)`}\t${s.source}`);
      listProblems('제외한 항목:', problems);
      return 0;
    }
    case 'validate': {
      const { ok, problems } = await runValidate(project);
      if (ok) console.log('검증 통과');
      else listProblems(`문제 ${problems.length}건:`, problems);
      return ok ? 0 : 1;
    }
    case 'review': {
      const { items } = await runReview(project);
      console.log(`확인 필요 항목 ${items}건 → .docent/review.md`);
      return 0;
    }
    case 'build': {
      const { files } = await runBuild(project, { assetsDir: ASSETS_DIR });
      console.log(`산출물 ${files.length}개 → .docent/out/ (html/index.html, README.md)`);
      return 0;
    }
    case 'session':
      if (sub === 'start') {
        await startSession(project);
        return 0;
      }
      if (sub === 'end') {
        await endSession(project);
        return 0;
      }
      break;
  }
  console.error(USAGE);
  return 2;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`docent: ${err.message}`);
    process.exit(1);
  },
);
