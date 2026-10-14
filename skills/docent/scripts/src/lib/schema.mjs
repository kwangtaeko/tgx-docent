// 중간 산출물(inventory.json, inventory.agent.json, screens/*.json, summary.json)의 JSON Schema 검증.
// 스키마는 import로 불러와 번들(dist)에 함께 들어가게 한다.
import Ajv2020 from 'ajv/dist/2020.js';
import inventoryAgentSchema from '../../../schemas/inventory-agent.schema.json' with { type: 'json' };
import inventorySchema from '../../../schemas/inventory.schema.json' with { type: 'json' };
import runSchema from '../../../schemas/run.schema.json' with { type: 'json' };
import screenSchema from '../../../schemas/screen.schema.json' with { type: 'json' };
import summarySchema from '../../../schemas/summary.schema.json' with { type: 'json' };

const ajv = new Ajv2020({ allErrors: true });

function compile(schema) {
  const validate = ajv.compile(schema);
  return (data) => {
    const valid = validate(data);
    const errors = valid ? [] : validate.errors.map((e) => `${e.instancePath || '/'} ${e.message}`);
    return { valid, errors };
  };
}

export const validateInventory = compile(inventorySchema);
export const validateScreen = compile(screenSchema);
export const validateInventoryAgent = compile(inventoryAgentSchema);
export const validateSummary = compile(summarySchema);
export const validateRun = compile(runSchema);
