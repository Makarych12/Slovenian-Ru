import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {translate} from './translate.js';
const root=path.resolve(fileURLToPath(new URL('../pwa/',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const limits=new Map();
setInterval(()=>{for(const [key,v] of limits)if(Date.now()-v.time>60000)limits.delete(key);},60000).unref();
export const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/health')return json(200,{ok:true,deepLConfigured:!!process.env.DEEPL_API_KEY,provider:'DeepL'});
 if(url.pathname==='/api/translate'){
  if(req.method!=='POST')return json(405,{ok:false,error:'Используйте POST.'});
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return json(403,{ok:false,error:'Недопустимый источник запроса.'});
  const key=req.socket.remoteAddress;let rate=limits.get(key);if(!rate||Date.now()-rate.time>60000)rate={time:Date.now(),count:0};limits.set(key,rate);if(++rate.count>30)return json(429,{ok:false,error:'Слишком много запросов. Подождите минуту.'});
  if(!(req.headers['content-type']||'').includes('application/json'))return json(415,{ok:false,error:'Ожидается JSON.'});
  let body='';for await(const part of req){body+=part;if(Buffer.byteLength(body)>40000)return json(413,{ok:false,error:'Запрос слишком большой.'});}
  let input;try{input=JSON.parse(body);}catch{return json(400,{ok:false,error:'Некорректный JSON.'});}
  if(!input||typeof input!=='object')return json(400,{ok:false,error:'Некорректный запрос.'});
  return json(200,await translate(input));
 }
 if(url.pathname.startsWith('/api/'))return json(404,{ok:false,error:'Не найдено.'});
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 const filename=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!filename.startsWith(root+path.sep)||path.basename(filename).startsWith('.')){res.writeHead(403);return res.end();}
 const data=await readFile(filename);res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
 }catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else json(error.status||500,{ok:false,error:error.status?error.message:'Ошибка сервера.',...(error.deepLStatus ? {provider:'DeepL',deepLStatus:error.deepLStatus} : {})});}
});
server.requestTimeout=60000;
server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log(`RailSI Translate: http://${process.env.HOST||'127.0.0.1'}:${server.address().port}`));
