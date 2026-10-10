import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { optionalVenderCrmConfig, venderCrmSettingsPresent } from '../src/lib/server/vendercrm-settings.mjs';
const pair = { VENDERCRM_URL: 'https://crm.example.com/', VENDERCRM_API_KEY: 'synthetic-test-key' };
test('absent sink stays disabled and incomplete settings fail', () => {
 assert.equal(optionalVenderCrmConfig({}), null);
 assert.equal(optionalVenderCrmConfig({ VENDERCRM_URL: '', VENDERCRM_API_KEY: '' }), null);
 assert.equal(venderCrmSettingsPresent({}), false);
 for (const env of [{ VENDERCRM_URL: pair.VENDERCRM_URL }, { VENDERCRM_API_KEY: pair.VENDERCRM_API_KEY }, {...pair, VENDERCRM_API_KEY: 'bad\r\nheader'}]) assert.throws(() => optionalVenderCrmConfig(env));
});
test('canonical origin produces one endpoint and remains server secret', () => {
 const config = optionalVenderCrmConfig(pair);
 assert.equal(config.leadsUrl, 'https://crm.example.com/api/v1/leads');
 assert.equal(config.apiKey, pair.VENDERCRM_API_KEY);
 for (const output of [JSON.stringify(config), JSON.stringify({...config}), inspect(config), JSON.stringify(config.doctor())]) assert.ok(!output.includes(pair.VENDERCRM_API_KEY));
 for (const url of ['http://crm.example.com','https://u:p@crm.example.com','https://crm.example.com/api/v1/leads','https://crm.example.com:0','https://localhost','https://localhost.','https://crm.internal.','https://10.0.0.1','https://crm.example.com/?']) assert.throws(()=>optionalVenderCrmConfig({...pair,VENDERCRM_URL:url}));
});
test('fresh module after artifact rebuild reads unchanged external settings', async () => {
 const env = {...pair}; const before = {...env};
 const fresh = await import('../src/lib/server/vendercrm-settings.mjs?rebuild');
 assert.equal(fresh.optionalVenderCrmConfig(env).apiKey, pair.VENDERCRM_API_KEY);
 assert.deepEqual(env,before);
});

import * as nodeModule from 'node:module';
import { readFileSync as readSource } from 'node:fs';
async function loadConsumer(path, replacements = []) {
 let code = nodeModule.stripTypeScriptTypes(readSource(new URL(path, import.meta.url), 'utf8'));
 for (const [from, to] of replacements) code = code.replace(from, to);
 return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const stripAvailable = typeof nodeModule.stripTypeScriptTypes === 'function';

test('actual sink validates before mocked fetch and preserves idempotency payload', { skip: !stripAvailable }, async () => {
 const prior = {...process.env}; const fetchBefore = globalThis.fetch;
 try {
  process.env.VENDERCRM_URL = pair.VENDERCRM_URL; process.env.VENDERCRM_API_KEY = pair.VENDERCRM_API_KEY;
  const types = nodeModule.stripTypeScriptTypes(readSource(new URL('../src/lib/crm/types.ts', import.meta.url), 'utf8'));
  const typesUrl = 'data:text/javascript;base64,' + Buffer.from(types).toString('base64');
  const consumer = await loadConsumer('../src/lib/crm/vendercrm.ts', [['"@/lib/crm/types"', JSON.stringify(typesUrl)], ['"@/lib/server/vendercrm-settings.mjs"', JSON.stringify(new URL("../src/lib/server/vendercrm-settings.mjs", import.meta.url).href)]]);
  let called=0; globalThis.fetch=async (url,init)=>{called++;assert.equal(url,'https://crm.example.com/api/v1/leads');assert.equal(init.headers['x-api-key'],pair.VENDERCRM_API_KEY);assert.equal(JSON.parse(init.body).idempotency_key,'synthetic-id');return {ok:true,status:201};};
  assert.equal((await consumer.venderCrmSink().deliver({phone:'synthetic-phone',idempotencyKey:'synthetic-id'})).ok,true);
  assert.equal(called,1);
  delete process.env.VENDERCRM_URL;
  const failed=await consumer.venderCrmSink().deliver({}); assert.equal(failed.ok,false);assert.equal(failed.permanent,true);assert.equal(called,1);
 } finally { globalThis.fetch=fetchBefore; for(const key of Object.keys(process.env)) if(!(key in prior))delete process.env[key];Object.assign(process.env,prior); }
});
