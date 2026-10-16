import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findWorkspaceApps } from '../../skills/docent/scripts/src/lib/workspaces.mjs';
import { project } from '../helpers/project.mjs';

test('package.json workspaces의 { packages } 형식과 리터럴 경로', async () => {
  const dir = await project({
    'package.json': '{"workspaces":{"packages":["site","tools/**"]}}',
    'site/package.json': '{"dependencies":{"@sveltejs/kit":"2"}}',
    'tools/cli/package.json': '{"dependencies":{"commander":"12"}}',
    'tools/docs/package.json': '{"dependencies":{"nuxt":"3"}}',
  });
  assert.deepEqual(await findWorkspaceApps(dir), [
    { dir: 'site', detectors: ['sveltekit'] },
    { dir: 'tools/docs', detectors: ['vue'] },
  ]);
});

test('워크스페이스 설정이 없으면 apps/*·packages/*를 본다', async () => {
  const dir = await project({
    'package.json': '{}',
    'apps/shop/package.json': '{"dependencies":{"react-router-dom":"6"}}',
    'apps/shop/node_modules/x/package.json': '{"dependencies":{"next":"15"}}',
  });
  assert.deepEqual(await findWorkspaceApps(dir), [{ dir: 'apps/shop', detectors: ['react-router'] }]);
});

test('워크스페이스 설정이 없으면 루트 바로 아래 폴더(frontend/ 등)도 본다', async () => {
  const dir = await project({
    'frontend/package.json': '{"dependencies":{"react-router-dom":"7"}}',
    'backend/build.gradle': '',
    'docs/readme.md': '',
  });
  assert.deepEqual(await findWorkspaceApps(dir), [{ dir: 'frontend', detectors: ['react-router'] }]);
});

test('프로젝트 밖·제외 패턴은 무시한다', async () => {
  const dir = await project({ 'package.json': '{"workspaces":["../outside/*","!apps/*"]}' });
  assert.deepEqual(await findWorkspaceApps(dir), []);
});

test('감지기가 맞는 앱이 없으면 화면 라이브러리·데스크톱 앱을 후보로', async () => {
  const dir = await project({
    'package.json': '{"workspaces":["apps/*","packages/*"]}',
    'apps/desktop/package.json': '{"dependencies":{"react":"19"},"devDependencies":{"electron":"44"}}',
    'apps/tauri/package.json': '{"dependencies":{"@tauri-apps/api":"2","vue":"3"}}',
    'packages/shared/package.json': '{"dependencies":{"zod":"3"}}',
  });
  assert.deepEqual(await findWorkspaceApps(dir), [
    { dir: 'apps/desktop', detectors: [], desktop: 'electron' },
    { dir: 'apps/tauri', detectors: [], desktop: 'tauri' },
  ]);
});

test('감지기가 맞는 앱이 있으면 그 앱만', async () => {
  const dir = await project({
    'package.json': '{"workspaces":["apps/*"]}',
    'apps/web/package.json': '{"dependencies":{"next":"15"}}',
    'apps/desktop/package.json': '{"devDependencies":{"electron":"44"}}',
  });
  assert.deepEqual(await findWorkspaceApps(dir), [{ dir: 'apps/web', detectors: ['nextjs'] }]);
});
