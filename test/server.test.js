import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('HTTP app assets, private files, API validation and missing key',async()=>{
 const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',DEEPL_API_KEY:''},stdio:['ignore','pipe','pipe']});
 try{
  const url=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(new Error('Server startup timeout')),5000);child.stdout.on('data',data=>{log+=data;const match=log.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});child.once('error',reject);});
  for(const asset of ['/','/app.js','/style.css','/glossary.json','/phrases.json','/manifest.webmanifest','/sw.js','/icon-192.png','/icon-512.png']){const res=await fetch(url+asset);assert.equal(res.status,200,asset);assert.ok((await res.arrayBuffer()).byteLength>0);}
  const home=await fetch(url);assert.ok(home.headers.get('content-security-policy').includes("script-src 'self'"));
  assert.notEqual((await fetch(url+'/.env')).status,200);
  assert.equal((await fetch(url+'/api/translate')).status,405);
  const post=body=>fetch(url+'/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body});
  assert.equal((await post('null')).status,400);assert.equal((await post('{')).status,400);
  assert.equal((await post(JSON.stringify({text:'привет',sourceLang:'RU',targetLang:'SL'}))).status,503);
  assert.equal((await fetch(url+'/api/translate',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://foreign.example'},body:'{}'})).status,403);
 }finally{child.kill();await once(child,'exit');}
});
