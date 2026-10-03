import {translate} from './translate.js';
const limits=new Map();
setInterval(()=>{for(const [key,v] of limits)if(Date.now()-v.time>60000)limits.delete(key);},60000).unref();
export async function handleApi(req,res){
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/health')return json(200,{ok:true,deepLConfigured:!!process.env.DEEPL_API_KEY,provider:'DeepL'});
 if(url.pathname==='/api/translate'){
  if(req.method!=='POST')return json(405,{ok:false,error:'Используйте POST.'});
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return json(403,{ok:false,error:'Недопустимый источник запроса.'});
  const key=process.env.VERCEL ? req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress : req.socket.remoteAddress;let rate=limits.get(key);if(!rate||Date.now()-rate.time>60000)rate={time:Date.now(),count:0};limits.set(key,rate);if(++rate.count>30)return json(429,{ok:false,error:'Слишком много запросов. Подождите минуту.'});
  if(!(req.headers['content-type']||'').includes('application/json'))return json(415,{ok:false,error:'Ожидается JSON.'});
  let input;
  if(req.body!==undefined){
   if(Buffer.byteLength(typeof req.body==='string'?req.body:JSON.stringify(req.body))>40000)return json(413,{ok:false,error:'Запрос слишком большой.'});
   try{input=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return json(400,{ok:false,error:'Некорректный JSON.'});}
  }else{
   let body='';for await(const part of req){body+=part;if(Buffer.byteLength(body)>40000)return json(413,{ok:false,error:'Запрос слишком большой.'});}
   try{input=JSON.parse(body);}catch{return json(400,{ok:false,error:'Некорректный JSON.'});}
  }
  if(!input||typeof input!=='object')return json(400,{ok:false,error:'Некорректный запрос.'});
  return json(200,await translate(input));
 }
 return json(404,{ok:false,error:'Не найдено.'});
 }catch(error){return json(error.status||500,{ok:false,error:error.status?error.message:'Ошибка сервера.',...(error.deepLStatus?{provider:'DeepL',deepLStatus:error.deepLStatus}:{})});}
}
