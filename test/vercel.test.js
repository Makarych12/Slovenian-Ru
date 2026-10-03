import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import health from '../api/health.js';
import translate from '../api/translate.js';

test('Vercel routes accept pre-parsed JSON, keep DeepL server-side and validate requests',async()=>{
 const originalFetch=globalThis.fetch,originalKey=process.env.DEEPL_API_KEY;
 process.env.DEEPL_API_KEY='server-test-secret';
 const calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({translations:[{text:'translated'}]}),{status:200});};
 const server=http.createServer(async(req,res)=>{
  if(req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;req.body=JSON.parse(body);}
  return (req.url==='/api/health'?health:translate)(req,res);
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const healthResponse=await originalFetch(base+'/api/health');
  assert.deepEqual(await healthResponse.json(),{ok:true,deepLConfigured:true,provider:'DeepL'});
  for(const [sourceLang,targetLang,text]of [['SL','RU','Dober dan.'],['RU','SL','Добрый день.']]){
   const response=await originalFetch(base+'/api/translate',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({sourceLang,targetLang,text})});
   assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
   const body=await response.text();assert.ok(!body.includes(process.env.DEEPL_API_KEY));
   assert.deepEqual(JSON.parse(body),{ok:true,translation:'translated',provider:'DeepL',deepLStatus:200});
   const call=calls.at(-1);assert.equal(call.url,'https://api-free.deepl.com/v2/translate');
   assert.equal(call.options.headers.Authorization,'DeepL-Auth-Key server-test-secret');
   assert.deepEqual(JSON.parse(call.options.body),{text:[text],source_lang:sourceLang,target_lang:targetLang});
  }
  const post=(body,headers={})=>originalFetch(base+'/api/translate',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  assert.equal((await post(null)).status,400);
  assert.equal((await post({text:'x'.repeat(40001)})).status,413);
  assert.equal((await post({}, {Origin:'https://foreign.example'})).status,403);
  assert.equal((await originalFetch(base+'/api/translate')).status,405);
  assert.equal(calls.length,2);
 }finally{
  globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.DEEPL_API_KEY;else process.env.DEEPL_API_KEY=originalKey;
  server.close();await once(server,'close');
 }
});
