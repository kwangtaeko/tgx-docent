// Playwright가 필요한 테스트용. 없으면 건너뛰지 않고 실패한다(CI에 설치되어 있어야 함).
import { launchBrowser } from '../../skills/docent/scripts/src/lib/playwright.mjs';

let shared;
export async function browser() {
  shared ??= await launchBrowser();
  return shared;
}

export async function closeBrowser() {
  if (shared) await shared.close();
  shared = undefined;
}
