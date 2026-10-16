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

test('프로젝트 밖·제외 패턴은 무시한다', async () => {
  const dir = await project({ 'package.json': '{"workspaces":["../outside/*","!apps/*"]}' });
  assert.deepEqual(await findWorkspaceApps(dir), []);
});
