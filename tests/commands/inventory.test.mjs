import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runInit } from '../../skills/docent/scripts/src/commands/init.mjs';
import { runInventory } from '../../skills/docent/scripts/src/commands/inventory.mjs';
import { copyFixture, EXPECTED, readJsonFile, writeAgentModal, writeJsonFile } from '../helpers/fixture.mjs';

const withoutMenu = ({ menuPath, ...rest }) => rest;

async function prepared() {
  const dir = await copyFixture();
  await runInit(dir);
  await writeAgentModal(dir);
  return dir;
}

async function setConfig(dir, yaml) {
  await writeFile(join(dir, '.docent', 'config.yaml'), yaml);
}

test('감지기 + 에이전트 항목이 골든 inventory와 같다', async () => {
  const dir = await prepared();
  const { inventory, problems } = await runInventory(dir);
  const golden = await readJsonFile(join(EXPECTED, 'inventory.json'));
  assert.deepEqual(problems, []);
  assert.deepEqual(inventory.screens.map(withoutMenu), golden.screens.map(withoutMenu));
  assert.deepEqual(await readJsonFile(join(dir, '.docent', 'inventory.json')), inventory);
});

test('기존 ID와 menuPath를 유지한다', async () => {
  const dir = await prepared();
  const first = (await runInventory(dir)).inventory;
  const target = first.screens.find((s) => s.route === '/orders/new');
  target.id = 'custom-x';
  target.menuPath = ['주문관리', '주문 등록'];
  await writeJsonFile(join(dir, '.docent', 'inventory.json'), first);
  const { inventory } = await runInventory(dir);
  const again = inventory.screens.find((s) => s.route === '/orders/new');
  assert.equal(again.id, 'custom-x');
  assert.deepEqual(again.menuPath, ['주문관리', '주문 등록']);
  assert.ok(inventory.screens.some((s) => s.id === 'custom-x--customer-search'));
});

test('idMap', async () => {
  const dir = await prepared();
  await setConfig(dir, 'detectors: [nextjs]\nscreens:\n  idMap:\n    /orders: ORD1000\n');
  const { inventory } = await runInventory(dir);
  assert.equal(inventory.screens.find((s) => s.route === '/orders').id, 'ORD1000');
});

test('exclude는 하위 화면까지 뺀다', async () => {
  const dir = await prepared();
  await setConfig(dir, 'detectors: [nextjs]\nscreens:\n  exclude: ["/admin/**", "/orders/new"]\n');
  const ids = (await runInventory(dir)).inventory.screens.map((s) => s.id);
  assert.ok(!ids.includes('admin-users'));
  assert.ok(!ids.includes('orders-new'));
  assert.ok(!ids.includes('orders-new--customer-search'));
  assert.ok(ids.includes('orders'));
});

test('include는 맞는 page만 남긴다', async () => {
  const dir = await prepared();
  await setConfig(dir, 'detectors: [nextjs]\nscreens:\n  include: ["/orders/*"]\n');
  const routes = (await runInventory(dir)).inventory.screens.filter((s) => s.kind === 'page').map((s) => s.route);
  assert.deepEqual(routes, ['/orders/[id]', '/orders/new']);
});

test('근거가 틀린 에이전트 항목만 빠진다', async () => {
  const dir = await prepared();
  const path = join(dir, '.docent', 'inventory.agent.json');
  const agent = await readJsonFile(path);
  agent.screens[0].evidence = 'app/orders/new/order-form.tsx:999';
  await writeJsonFile(path, agent);
  const { inventory, problems } = await runInventory(dir);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /customer-search/);
  assert.equal(inventory.screens.length, 7);
});

test('부모가 없는 하위 화면은 빠진다', async () => {
  const dir = await prepared();
  const path = join(dir, '.docent', 'inventory.agent.json');
  const agent = await readJsonFile(path);
  agent.screens[0].parentRoute = '/nope';
  await writeJsonFile(path, agent);
  const { problems } = await runInventory(dir);
  assert.match(problems[0], /부모 화면 \/nope 없음/);
});

test('감지기 없이 에이전트 page만으로 동작한다', async () => {
  const dir = await copyFixture();
  await runInit(dir);
  await setConfig(dir, 'detectors: []\n');
  await writeJsonFile(join(dir, '.docent', 'inventory.agent.json'), {
    screens: [
      { route: '/login', kind: 'page', files: ['./app/login/page.tsx'], evidence: 'app/login/page.tsx:3' },
      { route: '/orders', kind: 'page', files: ['app/orders/page.tsx'], evidence: 'app/orders/page.tsx:8' },
    ],
  });
  const { inventory, problems } = await runInventory(dir);
  assert.deepEqual(problems, []);
  assert.deepEqual(
    inventory.screens.map((s) => [s.id, s.source, s.files[0]]),
    [
      ['login', 'agent', 'app/login/page.tsx'],
      ['orders', 'agent', 'app/orders/page.tsx'],
    ],
  );
});

test('없는 파일을 가리키는 항목은 빠진다', async () => {
  const dir = await prepared();
  const path = join(dir, '.docent', 'inventory.agent.json');
  const agent = await readJsonFile(path);
  agent.screens[0].files = ['app/orders/new/nope.tsx'];
  await writeJsonFile(path, agent);
  const { problems } = await runInventory(dir);
  assert.match(problems[0], /nope\.tsx/);
});

test('분석된 화면의 menuPath를 inventory에 반영한다', async () => {
  const { cp } = await import('node:fs/promises');
  const dir = await prepared();
  await cp(join(EXPECTED, 'screens'), join(dir, '.docent', 'screens'), { recursive: true });
  const { inventory } = await runInventory(dir);
  const golden = await readJsonFile(join(EXPECTED, 'inventory.json'));
  assert.deepEqual(inventory, golden);
});

test('idMap이 다른 화면 ID와 겹치면 적용하지 않고 문제로 알린다', async () => {
  const dir = await prepared();
  await setConfig(dir, 'detectors: [nextjs]\nscreens:\n  idMap:\n    /orders: login\n');
  const { inventory, problems } = await runInventory(dir);
  const ids = inventory.screens.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(inventory.screens.find((s) => s.route === '/orders').id, 'orders');
  assert.ok(problems.some((p) => p.includes('idMap') && p.includes('login')), problems.join('\n'));
});

test('config.app이 있으면 그 폴더에서 감지하고 경로에 폴더를 붙인다', async () => {
  const { project } = await import('../helpers/project.mjs');
  const dir = await project({
    'package.json': '{"private":true,"workspaces":["apps/*"]}',
    'apps/web/package.json': '{"dependencies":{"next":"15"}}',
    'apps/web/app/page.tsx': 'export default function Home() {}\n',
    'apps/web/app/orders/page.tsx': "import { List } from '../../components/List';\nexport default function Orders() {}\n",
    'apps/web/components/List.tsx': 'export function List() {}\n',
  });
  assert.equal((await runInit(dir)).app, 'apps/web');
  const { inventory, problems } = await runInventory(dir);
  assert.deepEqual(problems, []);
  assert.deepEqual(
    inventory.screens.map(({ route, files, evidence }) => ({ route, files, evidence })),
    [
      { route: '/', files: ['apps/web/app/page.tsx'], evidence: 'apps/web/app/page.tsx:1' },
      { route: '/orders', files: ['apps/web/app/orders/page.tsx', 'apps/web/components/List.tsx'], evidence: 'apps/web/app/orders/page.tsx:2' },
    ],
  );
});

test('config.app 폴더가 없으면 문제로 알린다', async () => {
  const dir = await prepared();
  await setConfig(dir, 'app: apps/none\ndetectors: [nextjs]\n');
  const { inventory, problems } = await runInventory(dir);
  assert.ok(problems.some((p) => /app 폴더 apps\/none/.test(p)), problems.join());
  assert.equal(inventory.screens.filter((s) => s.source.startsWith('detector:')).length, 0);
});

test('view: 같은 주소에서 메뉴로 바뀌는 화면은 부모 page의 하위 화면이 된다', async () => {
  const { project } = await import('../helpers/project.mjs');
  const dir = await project({
    'package.json': '{}',
    'src/App.tsx': 'export function App() {\n  return <nav><a onClick={() => setView("home")}>홈</a><a onClick={() => setView("report")}>보고서</a></nav>;\n}\n',
    '.docent/config.yaml': 'detectors: []\n',
    '.docent/inventory.agent.json': JSON.stringify({
      screens: [
        { route: '/', kind: 'page', files: ['src/App.tsx'], evidence: 'src/App.tsx:2' },
        { route: null, kind: 'view', parentRoute: '/', name: 'report', files: ['src/App.tsx'], evidence: 'src/App.tsx:2' },
      ],
    }),
  });
  const { inventory, problems } = await runInventory(dir);
  assert.deepEqual(problems, []);
  assert.deepEqual(inventory.screens.map(({ id, kind, parentId }) => ({ id, kind, parentId })), [
    { id: 'home', kind: 'page', parentId: undefined },
    { id: 'home--report', kind: 'view', parentId: 'home' },
  ]);
});
