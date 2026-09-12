import {test,before,after} from 'node:test';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:3110';let server;
before(async()=>{
  server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'3110',OPENROUTER_API_KEY:'',OPENROUTER_MODEL:'',AI_ACCESS_TOKEN:'unit-test-operator',TELEMETRY_INGEST_TOKEN:'unit-test-gateway',NODE_ENV:'test'},stdio:'ignore'});
  for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await delay(100);}
  throw new Error('Telemetry test server did not start');
});
after(()=>server?.kill());
const post=(path,body={},headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('HTTP gateway requires separate credentials and never modifies simulation',async()=>{
  const body={siteId:'yinchuan-reference',observations:[{assetId:'B10',metric:'indoorC',unit:'degC',value:22.3,quality:'good',source:'unit-test synthetic fixture',timestamp:new Date().toISOString()}]};
  assert.equal((await post('/api/telemetry/ingest',body)).status,401);
  assert.equal((await post('/api/telemetry/ingest',body,{'X-Telemetry-Token':'unit-test-operator'})).status,401);
  assert.equal((await post('/api/telemetry/ingest',body,{'X-Telemetry-Token':'unit-test-gateway'})).status,200);
  assert.equal((await post('/api/telemetry')).status,401);
  const read=await(await post('/api/telemetry',{}, {'X-AI-Access-Code':'unit-test-operator'})).json();
  assert.equal(read.status,'receiving');assert.equal(read.observations[0].value,22.3);
  const state=await(await post('/api/state')).json();assert.notEqual(state.buildings.find(b=>b.id==='B10').indoorC,22.3);
  assert.equal((await post('/api/telemetry/ingest',body,{'X-Telemetry-Token':'unit-test-gateway',Origin:'https://invalid.example'})).status,403);
  assert.equal((await post('/api/actuate',{})).status,404);
});
