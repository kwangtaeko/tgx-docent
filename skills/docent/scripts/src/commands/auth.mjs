// docent auth login | save — 로그인 상태(Playwright storage state)를 .docent/auth/state.json에 저장한다. (설계 문서 8장)
// 계정 값은 환경변수에서만 읽고 어디에도 기록하지 않는다.
import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { loadConfig } from '../lib/config.mjs';
import { launchBrowser } from '../lib/playwright.mjs';
import { docentDir } from '../lib/workspace.mjs';
import { loadRun } from './run.mjs';

export const statePath = (projectDir) => join(docentDir(projectDir), 'auth', 'state.json');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// 저장된 로그인 상태가 있으면 그것으로 컨텍스트를 만든다
export async function newContext(browser, projectDir, options = {}) {
  const state = statePath(projectDir);
  return browser.newContext({ ...options, ...((await exists(state)) ? { storageState: state } : {}) });
}

export async function authLogin(projectDir) {
  const { auth } = await loadConfig(projectDir);
  if (!auth?.loginPath || !auth?.fields?.length || !auth?.submit) {
    throw new Error('config.yaml에 auth(loginPath, fields, submit) 설정이 없습니다');
  }
  const missing = auth.fields.filter((f) => !process.env[f.env]).map((f) => f.env);
  if (missing.length) throw new Error(`로그인에 필요한 환경변수가 없습니다: ${missing.join(', ')}`);

  const run = await loadRun(projectDir);
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(new URL(auth.loginPath, run.baseUrl).href);
    for (const field of auth.fields) await page.getByLabel(field.label, { exact: true }).fill(process.env[field.env]);
    await Promise.all([
      page.waitForLoadState('load').catch(() => {}),
      page.getByRole('button', { name: auth.submit, exact: true }).click(),
    ]);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    const path = new URL(page.url()).pathname;
    const success = auth.successPath ?? '/';
    if (path === auth.loginPath || !path.startsWith(success)) {
      throw new Error(`로그인 실패: 로그인 후 ${success}가 아니라 ${path}에 머물렀습니다. 계정 환경변수(${auth.fields.map((f) => f.env).join(', ')})를 확인하세요`);
    }
    await mkdir(join(docentDir(projectDir), 'auth'), { recursive: true });
    await context.storageState({ path: statePath(projectDir) });
    return { statePath: statePath(projectDir) };
  } finally {
    await browser.close();
  }
}

// 화면이 있는 브라우저에서 사용자가 직접 로그인한 뒤 Enter를 누르면 상태를 저장한다(대화형)
export async function authSave(projectDir) {
  const run = await loadRun(projectDir);
  const browser = await launchBrowser({ headless: false });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(run.baseUrl);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    await rl.question('브라우저에서 로그인을 마친 뒤 여기서 Enter를 누르세요… ');
    rl.close();
    await mkdir(join(docentDir(projectDir), 'auth'), { recursive: true });
    await context.storageState({ path: statePath(projectDir) });
    return { statePath: statePath(projectDir) };
  } finally {
    await browser.close();
  }
}
