// docent CLI. 사용법: node docent.mjs <명령> [--project <디렉터리>]
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authLogin, authSave } from './commands/auth.mjs';
import { runBuild } from './commands/build.mjs';
import { runCapture } from './commands/capture.mjs';
import { runCrawl } from './commands/crawl.mjs';
import { runRecord } from './commands/record.mjs';
import { runScenarios } from './commands/scenarios.mjs';
import { runInit } from './commands/init.mjs';
import { runInventory } from './commands/inventory.mjs';
import { runPending } from './commands/pending.mjs';
import { runReview } from './commands/review.mjs';
import { endSession, startSession } from './commands/session.mjs';
import { runApprove, runStart, runStatus, runStop } from './commands/run.mjs';
import { runtimeInstall, runtimeStatus } from './commands/runtime.mjs';
import { runUpdate } from './commands/update.mjs';
import { runValidate } from './commands/validate.mjs';
import { setCliLanguage, t } from './lib/cli-text.mjs';
import { loadConfig } from './lib/config.mjs';
import { PlaywrightMissing } from './lib/playwright.mjs';
import { hashFiles } from './lib/source-hash.mjs';

// 안내 문구는 언어를 정한 뒤에 만든다(모듈을 읽을 때가 아니라)
const usage = () =>
  [
    t('사용법: docent <명령> [--project <디렉터리>]'),
    '',
    t('명령:'),
    t('  init [--app <폴더>]'),
    t('                 프로젝트를 파악해 .docent/config.yaml을 만듭니다(모노레포는 문서로 만들 앱 폴더)'),
    t('  inventory      화면 목록(.docent/inventory.json)을 만듭니다'),
    t('  update         코드가 바뀐 뒤 다시 할 일(새 화면·삭제 후보·재분석·시나리오·재캡처)'),
    t('  pending        다시 분석할 화면(결과 없음·소스 변경·확인 항목 답변)을 보여 줍니다'),
    t('  validate [ID…] 분석 결과의 스키마·근거·연결을 검사합니다(화면 ID를 주면 그 화면만)'),
    t('  review         확인 필요 항목(.docent/review.md)을 모읍니다'),
    '  build [--preset delivery|handover|portfolio] [--format html,readme,pdf,pptx]',
    t('                 .docent/out/에 산출물을 만듭니다'),
    t('  hash <파일…>   화면 JSON의 sourceHash 값을 계산합니다'),
    t('  run approve    사용자가 동의한 run.json 명령을 이 컴퓨터에서 승인(.docent/.run-approved)'),
    t('  run start [--install] | stop | status  .docent/run.json대로 대상 앱 실행·중지·확인'),
    t('  crawl          실행 중인 앱을 링크로 돌며 화면 목록과 대조(.docent/crawl.json)'),
    t('  scenarios      시나리오를 (다시) 써야 하는 화면(캡처 경로 필요·GIF 대상·낡음)'),
    t('  capture [id…]  화면 캡처(.docent/media/img)'),
    t('  record [id…]   조작 GIF 녹화(.docent/media/gif)'),
    t('  auth login | save  로그인 상태 저장(login: config.yaml의 auth와 환경변수, save: 브라우저에서 직접 로그인)'),
    t('  runtime status|install  화면 캡처용 Playwright 확인·설치(사용자 동의 후)'),
    t('  session start  분석 세션 시작(비밀 파일 읽기 차단)'),
    t('  session end    분석 세션 종료'),
  ].join('\n');

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
  // 안내 문구 언어: DOCENT_LANG > config.yaml의 language > ko. 설정이 깨졌으면 여기서는 넘어가고 명령이 알린다
  let configLanguage = 'ko';
  try {
    configLanguage = (await loadConfig(project)).language;
  } catch {}
  setCliLanguage(process.env.DOCENT_LANG ?? configLanguage);
  switch (command) {
    case 'init': {
      const at = args.indexOf('--app');
      const r = await runInit(project, at > 0 ? { app: args[at + 1] ?? '' } : {});
      if (r.apps) {
        console.log(t('모노레포에서 앱을 여러 개 찾았습니다. 문서로 만들 앱을 골라 다시 실행하세요: docent init --app <폴더>'));
        for (const a of r.apps) console.log(`- ${a.dir}\t${[...a.detectors, ...(a.desktop ? [a.desktop] : [])].join(', ') || t('화면 앱(감지기 없음)')}`);
        return 0;
      }
      console.log(r.created ? t('.docent/config.yaml을 만들었습니다.') : t('.docent/config.yaml이 이미 있어 그대로 둡니다.'));
      if (r.appIgnored) console.log(t('--app은 쓰지 않았습니다. 앱 폴더를 바꾸려면 .docent/config.yaml의 app을 고치세요.'));
      if (r.app) console.log(t('앱 폴더: {0}', r.app));
      console.log(t('감지된 프레임워크: {0}', r.detectors.length ? r.detectors.join(', ') : t('없음 (에이전트 탐색으로 화면을 찾습니다)')));
      if (r.desktop) console.log(t('데스크톱 앱({0})입니다: 화면 분석·산출물은 소스만으로 만들고, 화면 캡처·GIF는 지원하지 않습니다(실행·캡처 단계는 건너뜁니다)', r.desktop));
      return 0;
    }
    case 'inventory': {
      const { inventory, problems, warnings } = await runInventory(project);
      const pages = inventory.screens.filter((s) => s.kind === 'page').length;
      console.log(t('화면 {0}개 (page {1}, 하위 화면 {2})', inventory.screens.length, pages, inventory.screens.length - pages));
      for (const s of inventory.screens) console.log(`- ${s.id}\t${s.route ?? t('({0}의 하위 화면)', s.parentId)}\t${s.source}`);
      listProblems(t('제외한 항목:'), problems);
      for (const w of warnings) console.log(t('경고: {0}', w));
      return 0;
    }
    case 'update': {
      const r = await runUpdate(project);
      const show = (title, list) => console.log(`${title}: ${list.length ? list.join(', ') : t('없음')}`);
      show(t('새 화면'), r.added);
      show(t('삭제 후보(자동으로 지우지 않음)'), r.removed);
      show(t('다시 분석'), r.reanalyze.map((x) => `${x.id}(${x.reason})`));
      show(t('시나리오 작성'), r.rescenario.map((x) => `${x.id}(${x.reason})`));
      show(t('다시 캡처'), r.recapture);
      listProblems(t('제외한 항목:'), r.problems);
      for (const w of r.warnings) console.log(t('경고: {0}', w));
      return 0;
    }
    case 'pending': {
      const list = await runPending(project);
      if (!list.length) console.log(t('다시 분석할 화면이 없습니다.'));
      for (const { id, reason } of list) console.log(`${id}\t${reason}`);
      return 0;
    }
    case 'validate': {
      const only = args.slice(1).filter((a) => !a.startsWith('--'));
      const { ok, problems } = await runValidate(project, { only });
      if (ok) console.log(only.length ? t('검증 통과: {0}', only.join(', ')) : t('검증 통과'));
      else listProblems(t('문제 {0}건:', problems.length), problems);
      return ok ? 0 : 1;
    }
    case 'review': {
      const { items } = await runReview(project);
      console.log(t('확인 필요 항목 {0}건 → .docent/review.md', items));
      return 0;
    }
    case 'build': {
      const flag = (name) => {
        const i = args.indexOf(name);
        return i >= 0 ? args[i + 1] : undefined;
      };
      const formats = flag('--format')?.split(',').map((f) => f.trim()).filter(Boolean);
      const r = await runBuild(project, { assetsDir: ASSETS_DIR, preset: flag('--preset'), formats });
      console.log(t('산출물 {0}개 → .docent/out/', r.files.length));
      for (const f of r.files.filter((f) => !f.startsWith('html/') || f === 'html/index.html')) console.log(`- ${f}`);
      for (const w of r.warnings) console.log(t('경고: {0}', w));
      for (const k of r.skipped) console.log(t('건너뜀({0}): {1}', k.format, k.reason));
      return 0;
    }
    case 'hash': {
      const files = args.slice(1);
      if (!files.length) break;
      console.log(await hashFiles(project, files));
      return 0;
    }
    case 'run': {
      if (sub === 'approve') {
        const r = await runApprove(project);
        console.log(`${t('다음 명령을 승인했습니다:')}\n${r.commands}`);
        return 0;
      }
      if (sub === 'start') {
        const r = await runStart(project, { install: args.includes('--install') });
        console.log(r.reused ? t('이미 응답 중인 앱을 씁니다: {0}', r.baseUrl) : t('앱을 띄웠습니다: {0}', r.baseUrl));
        return 0;
      }
      if (sub === 'stop') {
        const r = await runStop(project);
        console.log(r.stopped ? t('앱을 멈췄습니다.') : t('docent가 띄운 앱이 없습니다.'));
        return 0;
      }
      if (sub === 'status') {
        const r = await runStatus(project);
        console.log(r.configured ? `${r.baseUrl} — ${r.up ? t('응답 중') : t('응답 없음')}${r.pid ? ` (pid ${r.pid})` : ''}` : t('.docent/run.json 없음'));
        return 0;
      }
      break;
    }
    case 'crawl': {
      const r = await runCrawl(project);
      console.log(t('방문 {0}개, 목록에 없는 경로 {1}개, 도달하지 못한 화면 {2}개 → .docent/crawl.json', r.visited.length, r.unmatched.length, r.unreached.length));
      for (const p of r.unmatched) console.log(t('- 목록에 없음: {0}', p));
      for (const id of r.unreached) console.log(t('- 도달 못 함: {0}', id));
      for (const w of r.warnings) console.log(t('경고: {0}', w));
      return 0;
    }
    case 'scenarios': {
      const list = await runScenarios(project);
      if (!list.length) console.log(t('시나리오를 쓸 화면이 없습니다.'));
      for (const { id, reason } of list) console.log(`${id}\t${reason}`);
      return 0;
    }
    case 'capture': {
      const r = await runCapture(project, args.slice(1));
      console.log(t('캡처 {0}개, 실패 {1}개, 건너뜀 {2}개 → .docent/media/img', r.captured.length, r.failed.length, r.skipped.length));
      for (const f of r.failed) console.log(t('- 실패 {0}: {1}', f.id, f.reason));
      for (const f of r.skipped) console.log(t('- 건너뜀 {0}: {1}', f.id, f.reason));
      return 0;
    }
    case 'record': {
      const r = await runRecord(project, args.slice(1));
      console.log(t('GIF {0}개, 실패 {1}개, 건너뜀 {2}개 → .docent/media/gif', r.recorded.length, r.failed.length, r.skipped.length));
      for (const f of r.failed) console.log(t('- 실패 {0}: {1}', f.id, f.reason));
      for (const f of r.skipped) console.log(t('- 건너뜀 {0}: {1}', f.id, f.reason));
      return 0;
    }
    case 'auth': {
      if (sub !== 'login' && sub !== 'save') break;
      const r = sub === 'login' ? await authLogin(project) : await authSave(project);
      console.log(t('로그인 상태를 저장했습니다: {0}', r.statePath));
      return 0;
    }
    case 'runtime': {
      if (sub !== 'status' && sub !== 'install') break;
      const r = sub === 'install' ? await runtimeInstall() : await runtimeStatus();
      if (!r.installed) {
        console.log(t('Playwright 없음 — 설치 위치: {0} (docent runtime install)', r.dir));
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
  console.error(usage());
  return 2;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`docent: ${err.message}`);
    process.exit(err instanceof PlaywrightMissing ? 3 : 1);
  },
);
