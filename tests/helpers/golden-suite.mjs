// 픽스처 골든 산출물의 공통 검사. 픽스처마다 goldenSuite(...)로 test()를 등록한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInventory } from '../../skills/docent/scripts/src/commands/inventory.mjs';
import { checkEvidence } from '../../skills/docent/scripts/src/lib/evidence.mjs';
import { validateInventory, validateScenario, validateScreen, validateSummary } from '../../skills/docent/scripts/src/lib/schema.mjs';
import { assignIds, childId } from '../../skills/docent/scripts/src/lib/screen-id.mjs';
import { hashFiles } from '../../skills/docent/scripts/src/lib/source-hash.mjs';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

export async function loadExpected(expected) {
  const inventory = await readJson(join(expected, 'inventory.json'));
  const screens = new Map();
  for (const f of (await readdir(join(expected, 'screens'))).filter((n) => n.endsWith('.json'))) {
    screens.set(f.replace(/\.json$/, ''), await readJson(join(expected, 'screens', f)));
  }
  const summary = await readJson(join(expected, 'summary.json'));
  let scenarios = [];
  try {
    scenarios = (await readdir(join(expected, 'scenarios'))).filter((n) => n.endsWith('.json'));
  } catch {
    // 실행하지 않는 픽스처(WebForms)는 시나리오가 없다
  }
  return { inventory, screens, summary, scenarios };
}

// 픽스처를 임시 폴더로 복사하고 골든 inventory.agent.json으로 inventory 명령을 돌린다
export async function inventoryFromAgent(root, expected, detectors = []) {
  const dir = await mkdtemp(join(tmpdir(), 'docent-agent-'));
  await cp(root, dir, { recursive: true, filter: (src) => !/[\\/](node_modules|target|\.next)$/.test(src) });
  await mkdir(join(dir, '.docent'), { recursive: true });
  await cp(join(expected, 'inventory.agent.json'), join(dir, '.docent', 'inventory.agent.json'));
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(dir, '.docent', 'config.yaml'), `detectors: [${detectors.join(', ')}]\n`);
  return runInventory(dir);
}

function evidenceChecks(s) {
  const checks = [[s.title.evidence], [s.purpose.evidence]];
  if (s.menuPath) checks.push([s.menuPath.evidence]);
  for (const x of [...s.roles, ...s.sections]) checks.push([x.evidence]);
  for (const f of s.fields) checks.push([f.evidence, f.label]);
  for (const a of s.actions) checks.push([a.evidence, a.label]);
  for (const m of s.messages) checks.push([m.evidence, m.text]);
  return checks;
}

// pages·children: 기대 개수, edges: 반드시 있어야 할 'a->b' 간선
export function goldenSuite({ root, expected, pages, children, edges }) {
  const loaded = loadExpected(expected);

  test(`${root}: inventory·screens·summary가 스키마를 통과한다`, async () => {
    const { inventory, screens, summary } = await loaded;
    let r = validateInventory(inventory);
    assert.ok(r.valid, r.errors.join('\n'));
    for (const [name, s] of screens) {
      r = validateScreen(s);
      assert.ok(r.valid, `${name}: ${r.errors.join('\n')}`);
      assert.equal(s.id, name);
    }
    r = validateSummary(summary);
    assert.ok(r.valid, r.errors.join('\n'));
  });

  test(`${root}: inventory의 id 집합 = screens 폴더, 화면 수`, async () => {
    const { inventory, screens } = await loaded;
    assert.deepEqual(new Set(inventory.screens.map((s) => s.id)), new Set(screens.keys()));
    assert.equal(inventory.screens.filter((s) => s.kind === 'page').length, pages);
    assert.equal(inventory.screens.filter((s) => s.kind !== 'page').length, children);
  });

  test(`${root}: page id는 assignIds 결과, 하위 화면 id는 childId 형식`, async () => {
    const { inventory, screens } = await loaded;
    const ids = new Set(screens.keys());
    const list = inventory.screens.filter((s) => s.kind === 'page');
    const expectedIds = assignIds(list.map((p) => p.route));
    for (const p of list) assert.equal(p.id, expectedIds.get(p.route));
    for (const s of inventory.screens.filter((x) => x.kind !== 'page')) {
      assert.ok(ids.has(s.parentId), s.id);
      assert.equal(childId(s.parentId, s.id.slice(s.parentId.length + 2)), s.id);
    }
  });

  test(`${root}: navigatesTo·opens가 가리키는 id가 모두 존재하고 기대 간선이 있다`, async () => {
    const { screens } = await loaded;
    const found = new Set();
    for (const s of screens.values()) {
      for (const a of s.actions) {
        for (const target of [a.navigatesTo, a.opens].filter(Boolean)) {
          assert.ok(screens.has(target), `${s.id}: ${target}`);
          found.add(`${s.id}->${target}`);
        }
      }
    }
    for (const e of edges) assert.ok(found.has(e), e);
  });

  test(`${root}: 모든 evidence가 실제 위치를 가리키고 라벨·문구가 근처에 있다`, async () => {
    const { inventory, screens } = await loaded;
    const failures = [];
    for (const entry of inventory.screens) {
      const r = await checkEvidence(root, entry.evidence);
      if (!r.ok) failures.push(`inventory ${entry.id}: ${r.reason}`);
    }
    for (const s of screens.values()) {
      for (const [ev, text] of evidenceChecks(s)) {
        const r = await checkEvidence(root, ev, text === undefined ? {} : { expectText: text });
        if (!r.ok) failures.push(`${s.id}: ${r.reason}`);
      }
    }
    assert.deepEqual(failures, []);
  });

  test(`${root}: sourceHash = hashFiles(readFiles)`, async () => {
    const { screens } = await loaded;
    for (const s of screens.values()) assert.equal(s.sourceHash, await hashFiles(root, s.readFiles), s.id);
  });

  test(`${root}: workflow 간선은 실제 동작 간선이다`, async () => {
    const { screens, summary } = await loaded;
    for (const wf of summary.workflows) {
      for (let i = 0; i + 1 < wf.steps.length; i++) {
        const [a, b] = [wf.steps[i], wf.steps[i + 1]];
        const viaAction = screens.get(a).actions.some((x) => x.navigatesTo === b || x.opens === b);
        const closeToParent = screens.get(a).parentId === b; // 하위 화면을 닫고 부모로 돌아감
        assert.ok(viaAction || closeToParent, `${wf.name}: ${a} → ${b}`);
      }
    }
  });

  test(`${root}: 골든 서술은 합니다체다`, async () => {
    const { screens } = await loaded;
    for (const s of screens.values()) {
      assert.match(s.purpose.value, /니다$/, s.id);
      for (const a of s.actions) assert.match(a.effect, /니다\.?$/, `${s.id} ${a.label}`);
    }
  });

  test(`${root}: 시나리오가 스키마를 통과하고 화면 해시와 같다`, async () => {
    const { screens, scenarios } = await loaded;
    for (const f of scenarios) {
      const sc = await readJson(join(expected, 'scenarios', f));
      const r = validateScenario(sc);
      assert.ok(r.valid, `${f}: ${r.errors.join('; ')}`);
      assert.equal(`${sc.screenId}.json`, f);
      assert.equal(sc.sourceHash, screens.get(sc.screenId).sourceHash, f);
      for (const step of [...sc.setup, ...sc.steps]) {
        assert.notEqual(step.label, '삭제', `${f}: 되돌릴 수 없는 동작`);
        assert.ok(!String(step.value ?? '').includes('${'), `${f}: 환경변수 값이 캡처·GIF에 찍힘`);
      }
    }
  });
}
