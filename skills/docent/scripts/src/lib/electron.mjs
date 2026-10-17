// Electron 앱 띄우기(Playwright _electron). 캡처·녹화가 화면마다 새로 띄워 앞 화면의 상태가 남지 않게 한다.
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { t } from './cli-text.mjs';
import { requirePlaywright } from './playwright.mjs';

// electron 패키지(실행 파일 경로를 돌려줌)를 앱 위치부터 위로 찾는다(모노레포의 루트 node_modules 포함)
export function electronExecutable(cwd) {
  const require = createRequire(join(cwd, 'docent-resolve.js'));
  try {
    return require('electron');
  } catch {
    throw new Error(t('electron 패키지를 찾을 수 없습니다({0}). 앱의 의존성을 설치하세요(run.json의 install, docent run start --install)', cwd));
  }
}

// → { page, context, close }. size: 창 내용 크기(캡처·GIF 크기를 웹과 맞춘다)
export async function launchElectron({ cwd, main, args = [], env, size }) {
  const { _electron } = await requirePlaywright();
  const app = await _electron.launch({ executablePath: electronExecutable(cwd), args: [main, ...args], cwd, env, timeout: 60000 });
  try {
    const page = await app.firstWindow({ timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');
    if (size) {
      await app
        .evaluate(({ BrowserWindow }, s) => {
          for (const w of BrowserWindow.getAllWindows()) w.setContentSize(s.width, s.height);
        }, size)
        .catch(() => {});
    }
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    return { page, context: app.context(), close: () => app.close().catch(() => {}) };
  } catch (err) {
    await app.close().catch(() => {});
    throw err;
  }
}
