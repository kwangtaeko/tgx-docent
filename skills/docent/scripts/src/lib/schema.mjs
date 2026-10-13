// 중간 산출물(inventory.json, inventory.agent.json, screens/*.json)의 JSON Schema 검증.
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';

const SCHEMA_DIR = new URL('../../../schemas/', import.meta.url);
const ajv = new Ajv2020({ allErrors: true });

function compile(name) {
  const schema = JSON.parse(readFileSync(new URL(`${name}.schema.json`, SCHEMA_DIR), 'utf8'));
  const validate = ajv.compile(schema);
  return (data) => {
    const valid = validate(data);
    const errors = valid ? [] : validate.errors.map((e) => `${e.instancePath || '/'} ${e.message}`);
    return { valid, errors };
  };
}

export const validateInventory = compile('inventory');
export const validateScreen = compile('screen');
export const validateInventoryAgent = compile('inventory-agent');
