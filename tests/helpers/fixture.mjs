import { cp, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const FIXTURE = 'fixtures/nextjs-sample';
export const EXPECTED = 'fixtures/expected/nextjs-sample';

// 픽스처 앱을 임시 디렉터리로 복사한다(node_modules·.next 제외).
export async function copyFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'docent-fx-'));
  await cp(FIXTURE, dir, {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|\.next|\.docent)([\\/]|$)/.test(src),
  });
  return dir;
}

export async function readJsonFile(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function writeJsonFile(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2) + '\n');
}

// 골든의 하위 화면을 에이전트가 쓴 inventory.agent.json 형식으로 바꿔 넣는다.
export async function writeAgentModal(projectDir) {
  await mkdir(join(projectDir, '.docent'), { recursive: true });
  await writeJsonFile(join(projectDir, '.docent', 'inventory.agent.json'), {
    screens: [
      {
        route: null,
        kind: 'modal',
        parentRoute: '/orders/new',
        name: 'customer-search',
        files: ['app/orders/new/customer-search.tsx'],
        evidence: 'app/orders/new/order-form.tsx:18',
      },
    ],
  });
}

// 골든 inventory·screens(·summary)를 .docent/로 복사한다.
export async function copyGoldenWorkspace(projectDir, { summary = true } = {}) {
  const docent = join(projectDir, '.docent');
  await mkdir(docent, { recursive: true });
  await cp(join(EXPECTED, 'inventory.json'), join(docent, 'inventory.json'));
  await cp(join(EXPECTED, 'screens'), join(docent, 'screens'), { recursive: true });
  if (summary) await cp(join(EXPECTED, 'summary.json'), join(docent, 'summary.json'));
  return docent;
}
