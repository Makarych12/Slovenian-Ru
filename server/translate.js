export const DEEPL_ENDPOINT = 'https://api-free.deepl.com/v2/translate';
export async function translate(input, env = process.env, fetcher = fetch) {
 const {text, sourceLang, targetLang} = input;
 if(typeof text !== 'string' || !text.trim() || text.length > 5000 || !['RU','SL'].includes(sourceLang) || !['RU','SL'].includes(targetLang) || sourceLang === targetLang)
  throw Object.assign(new Error('Введите от 1 до 5000 символов и выберите RU ⇄ SL.'), {status:400});
 if(!env.DEEPL_API_KEY) throw Object.assign(new Error('DeepL не настроен: отсутствует серверный ключ.'), {status:503});
 let response;
 try {
  response = await fetcher(DEEPL_ENDPOINT, {
   method:'POST',
   headers:{'Content-Type':'application/json', Authorization:`DeepL-Auth-Key ${env.DEEPL_API_KEY}`},
   body:JSON.stringify({text:[text], source_lang:sourceLang, target_lang:targetLang}),
   signal:AbortSignal.timeout(30000)
  });
 } catch {
  throw Object.assign(new Error('Не удалось подключиться к DeepL. Перевод прекращён.'), {status:502});
 }
 if(!response.ok) throw Object.assign(new Error(`DeepL: HTTP ${response.status}. Перевод прекращён.`), {status:response.status, deepLStatus:response.status});
 let data;
 try { data = await response.json(); } catch {
  throw Object.assign(new Error('DeepL вернул некорректный ответ.'), {status:502, deepLStatus:response.status});
 }
 const translation = data.translations?.[0]?.text;
 if(typeof translation !== 'string' || !translation.trim()) throw Object.assign(new Error('DeepL вернул пустой перевод.'), {status:502, deepLStatus:response.status});
 return {ok:true, translation, provider:'DeepL', deepLStatus:response.status};
}
