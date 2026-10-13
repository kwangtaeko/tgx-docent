import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('plugin.json과 marketplace.json의 이름·버전이 일치한다', async () => {
  const plugin = JSON.parse(await readFile('.claude-plugin/plugin.json', 'utf8'));
  const market = JSON.parse(await readFile('.claude-plugin/marketplace.json', 'utf8'));
  assert.equal(plugin.name, 'docent');
  assert.equal(market.name, 'tgx-docent');
  assert.equal(market.plugins[0].name, plugin.name);
  assert.equal(market.plugins[0].version, plugin.version);
  assert.equal(market.plugins[0].source, './');
});

test('SKILL.md 프런트매터에 name: docent가 있다', async () => {
  const md = await readFile('skills/docent/SKILL.md', 'utf8');
  assert.match(md, /^---\nname: docent\ndescription: .+\n---/);
});
