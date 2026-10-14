// docent CLI. 사용법: node docent.mjs <명령> [--project <디렉터리>]
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authLogin, authSave } from './commands/auth.mjs';
import { runBuild } from './commands/build.mjs';
import { runCapture } from './commands/capture.mjs';
import { runCrawl } from './commands/crawl.mjs';
import { runRecord } from './commands/record.mjs';
import { runInit } from './commands/init.mjs';
import { runInventory } from './commands/inventory.mjs';
import { runPending } from './commands/pending.mjs';
import { runReview } from './commands/review.mjs';
import { endSession, startSession } from './commands/session.mjs';
import { runStart, runStatus, runStop } from './commands/run.mjs';
import { runtimeInstall, runtimeStatus } from './commands/runtime.mjs';
import { runValidate } from './commands/validate.mjs';
import { PlaywrightMissing } from './lib/playwright.mjs';
import { hashFiles } from './lib/source-hash.mjs';

const USAGE = `사용법: docent <명령> [--project <디렉터리>]

명령:
  init           프로젝트를 파악해 .docent/config.yaml을 만듭니다
  inventory      화면 목록(.docent/inventory.json)을 만듭니다
  pending        다시 분석할 화면(결과 없음·소스 변경·확인 항목 답변)을 보여 줍니다
  validate       분석 결과의 스키마·근거·연결을 검사합니다
  review         확인 필요 항목(.docent/review.md)을 모읍니다
  build          .docent/out/에 HTML 사이트와 소개 README를 만듭니다
  hash <파일…>   화면 JSON의 sourceHash 값을 계산합니다
  run start [--install] | stop | status  .docent/run.json대로 대상 앱 실행·중지·확인
  crawl          실행 중인 앱을 링크로 돌며 화면 목록과 대조(.docent/crawl.json)
  capture [id…]  화면 캡처(.docent/media/img)
  record [id…]   조작 GIF 녹화(.docent/media/gif)
  auth login | save  로그인 상태 저장(login: config.yaml의 auth와 환경변수, save: 브라우저에서 직접 로그인)
  runtime status|install  화면 캡처용 Playwright 확인·설치(사용자 동의 후)
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
    case 'pending': {
      const list = await runPending(project);
      if (!list.length) console.log('다시 분석할 화면이 없습니다.');
      for (const { id, reason } of list) console.log(`${id}\t${reason}`);
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
    case 'hash': {
      const files = args.slice(1);
      if (!files.length) break;
      console.log(await hashFiles(project, files));
      return 0;
    }
    case 'run': {
      if (sub === 'start') {
        const r = await runStart(project, { install: args.includes('--install') });
        console.log(r.reused ? `이미 응답 중인 앱을 씁니다: ${r.baseUrl}` : `앱을 띄웠습니다: ${r.baseUrl}`);
        return 0;
      }
      if (sub === 'stop') {
        const r = await runStop(project);
        console.log(r.stopped ? '앱을 멈췄습니다.' : 'docent가 띄운 앱이 없습니다.');
        return 0;
      }
      if (sub === 'status') {
        const r = await runStatus(project);
        console.log(r.configured ? `${r.baseUrl} — ${r.up ? '응답 중' : '응답 없음'}${r.pid ? ` (pid ${r.pid})` : ''}` : '.docent/run.json 없음');
        return 0;
      }
      break;
    }
    case 'crawl': {
      const r = await runCrawl(project);
      console.log(`방문 ${r.visited.length}개, 목록에 없는 경로 ${r.unmatched.length}개, 도달하지 못한 화면 ${r.unreached.length}개 → .docent/crawl.json`);
      for (const p of r.unmatched) console.log(`- 목록에 없음: ${p}`);
      for (const id of r.unreached) console.log(`- 도달 못 함: ${id}`);
      return 0;
    }
    case 'capture': {
      const r = await runCapture(project, args.slice(1));
      console.log(`캡처 ${r.captured.length}개, 실패 ${r.failed.length}개, 건너뜀 ${r.skipped.length}개 → .docent/media/img`);
      for (const f of r.failed) console.log(`- 실패 ${f.id}: ${f.reason}`);
      for (const f of r.skipped) console.log(`- 건너뜀 ${f.id}: ${f.reason}`);
      return 0;
    }
    case 'record': {
      const r = await runRecord(project, args.slice(1));
      console.log(`GIF ${r.recorded.length}개, 실패 ${r.failed.length}개, 건너뜀 ${r.skipped.length}개 → .docent/media/gif`);
      for (const f of r.failed) console.log(`- 실패 ${f.id}: ${f.reason}`);
      for (const f of r.skipped) console.log(`- 건너뜀 ${f.id}: ${f.reason}`);
      return 0;
    }
    case 'auth': {
      if (sub !== 'login' && sub !== 'save') break;
      const r = sub === 'login' ? await authLogin(project) : await authSave(project);
      console.log(`로그인 상태를 저장했습니다: ${r.statePath}`);
      return 0;
    }
    case 'runtime': {
      if (sub !== 'status' && sub !== 'install') break;
      const r = sub === 'install' ? await runtimeInstall() : await runtimeStatus();
      if (!r.installed) {
        console.log(`Playwright 없음 — 설치 위치: ${r.dir} (docent runtime install)`);
        return 3;
      }
      console.log(`Playwright ${r.version} (${r.from}: ${r.dir})`);
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
    process.exit(err instanceof PlaywrightMissing ? 3 : 1);
  },
);
