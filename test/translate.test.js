import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translate, DEEPL_ENDPOINT} from '../server/translate.js';
for(const [sourceLang,targetLang,text] of [['SL','RU','Strojevodja mora pred odhodom preveriti stanje lokomotive.'],['RU','SL','Машинист должен проверить локомотив.']]) {
 test(`${sourceLang} → ${targetLang}: exact request and unchanged response`,async()=>{
  let calls=0;
  const translated='  Точный ответ <keep> & текст.  ';
  const result=await translate({text,sourceLang,targetLang,aiPolish:true},{DEEPL_API_KEY:'test-secret'},async(url,options)=>{
   calls++;assert.equal(url,DEEPL_ENDPOINT);assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,'DeepL-Auth-Key test-secret');
   assert.deepEqual(JSON.parse(options.body),{text:[text],source_lang:sourceLang,target_lang:targetLang});
   return new Response(JSON.stringify({translations:[{text:translated}]}),{status:200});
  });
  assert.equal(calls,1);assert.equal(result.translation,translated);assert.equal(result.provider,'DeepL');assert.equal(result.deepLStatus,200);assert.ok(!JSON.stringify(result).includes('test-secret'));
 });
}
const input={text:'Kako se danes počutiš?',sourceLang:'SL',targetLang:'RU'};
test('missing key never sends request',async()=>{await assert.rejects(()=>translate(input,{},()=>assert.fail()),e=>e.status===503);});
for(const status of [403,429,456,500]) test(`DeepL HTTP ${status} stops after one request`,async()=>{let calls=0;await assert.rejects(()=>translate(input,{DEEPL_API_KEY:'key'},async()=>{calls++;return new Response('error',{status});}),e=>e.status===status&&e.deepLStatus===status);assert.equal(calls,1);});
test('network failure stops after one request and hides secrets',async()=>{let calls=0;await assert.rejects(()=>translate(input,{DEEPL_API_KEY:'secret'},async()=>{calls++;throw new Error('secret');}),e=>e.status===502&&!e.message.includes('secret'));assert.equal(calls,1);});
test('invalid and empty responses fail',async()=>{for(const body of ['invalid','{}','{"translations":[{"text":""}]}'])await assert.rejects(()=>translate(input,{DEEPL_API_KEY:'key'},async()=>new Response(body)),e=>e.status===502);});
test('input validation',async()=>{for(const change of [{text:''},{text:'a'.repeat(5001)},{sourceLang:'EN'},{targetLang:'SL'}])await assert.rejects(()=>translate({...input,...change},{},()=>assert.fail()),e=>e.status===400);});
