const PAGE=__ALTERED_PAGE_BASE64__;
const MANIFEST=__ALTERED_MANIFEST__;
const SERVICE_WORKER=__ALTERED_SERVICE_WORKER__;
const ICONS=__ALTERED_ICONS__;

let pageBytes;
let srdStatusCache;
const encoder=new TextEncoder();
const ddbRoute=/^\/api\/dndbeyond\/character\/(\d{5,15})$/;
const ddbOrigin='https://character-service.dndbeyond.com';
const maxDdbResponseBytes=5*1024*1024;
const srdOrigin='https://api.open5e.com';
const srdDocument='srd-2024';
const srdVersion='5.2.1';
const maxSrdResponseBytes=2*1024*1024;
const srdDomains=Object.freeze({
  rules:56,classes:24,species:9,backgrounds:4,feats:17,items:203,magicitems:757,
  weapons:38,armor:13,creatures:331,spells:339,weaponproperties:17,
});
const contentSecurityPolicy="default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

function headers(contentType,cacheControl='no-cache'){
  return {
    'Content-Type':contentType,
    'Cache-Control':cacheControl,
    'Content-Security-Policy':contentSecurityPolicy,
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Referrer-Policy':'no-referrer',
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
  };
}

function decodeBase64(value){
  const binary=atob(value);
  return Uint8Array.from(binary,character=>character.charCodeAt(0));
}

function json(status,body){
  return new Response(JSON.stringify(body),{status,headers:headers('application/json; charset=utf-8','no-store')});
}

async function boundedUpstreamJson(url,signal,maxBytes=maxSrdResponseBytes){
  // Cloudflare's Worker fetch accepts a URL string or Request. Normalizing URL
  // objects here keeps the same code valid in both Node preview and production.
  const upstream=await fetch(String(url),{headers:{Accept:'application/json'},redirect:'error',signal});
  if(!upstream.ok){
    const error=new Error(`upstream status ${upstream.status}`);
    error.status=upstream.status;
    throw error;
  }
  const declared=Number.parseInt(upstream.headers.get('content-length')??'0',10);
  if(declared>maxBytes)throw new Error('upstream response is too large');
  const body=await upstream.text();
  if(encoder.encode(body).byteLength>maxBytes)throw new Error('upstream response is too large');
  return JSON.parse(body);
}

async function proxyDdbCharacter(id){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15_000);
  try{
    return json(200,await boundedUpstreamJson(
      `${ddbOrigin}/character/v5/character/${id}`,
      controller.signal,
      maxDdbResponseBytes,
    ));
  }catch(error){
    console.error('Altered D&D Beyond upstream failure',error instanceof Error?`${error.name}: ${error.message}`:'Unknown error');
    if(error?.status===403)return json(403,{error:'D&D Beyond blocked this character. Set Character Privacy to Public, save, and try again.'});
    if(error?.status===404)return json(404,{error:'D&D Beyond could not find that character ID.'});
    const timedOut=error instanceof Error&&error.name==='AbortError';
    return json(502,{error:timedOut?'D&D Beyond did not respond within 15 seconds.':'Altered could not reach D&D Beyond. Check the connection and try again.'});
  }finally{
    clearTimeout(timeout);
  }
}

async function currentSrdStatus(signal){
  const now=Date.now();
  if(srdStatusCache&&now-srdStatusCache.cachedAt<6*60*60*1000)return srdStatusCache.value;
  const entries=await Promise.all(Object.entries(srdDomains).map(async([domain])=>{
    const url=new URL(`/v2/${domain}/`,srdOrigin);
    url.searchParams.set('document__key__in',srdDocument);
    url.searchParams.set('limit','1');
    const page=await boundedUpstreamJson(url,signal,256*1024);
    const count=Number.isInteger(page?.count)&&page.count>=0?page.count:0;
    return [domain,count];
  }));
  const counts=Object.fromEntries(entries);
  const recordCount=Object.values(counts).reduce((sum,value)=>sum+value,0);
  const healthy=Object.entries(srdDomains).every(([domain,minimum])=>counts[domain]>=minimum);
  const value={sourceVersion:srdVersion,sourceDocument:srdDocument,provider:'Open5e live SRD 2024 catalog',checkedAt:new Date().toISOString(),healthy,recordCount,counts};
  srdStatusCache={cachedAt:now,value};
  return value;
}

async function proxySrdStatus(){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15_000);
  try{
    return json(200,await currentSrdStatus(controller.signal));
  }catch(error){
    console.error('Altered SRD status upstream failure',error instanceof Error?`${error.name}: ${error.message}`:'Unknown error');
    const timedOut=error instanceof Error&&error.name==='AbortError';
    return json(502,{error:timedOut?'The SRD support catalog did not respond within 15 seconds.':'Altered could not validate the live SRD support catalog.'});
  }finally{
    clearTimeout(timeout);
  }
}

async function proxySrdCatalog(requestUrl){
  const domain=requestUrl.searchParams.get('domain')??'';
  if(!(domain in srdDomains))return json(400,{error:'Unsupported SRD catalog domain.'});
  const query=(requestUrl.searchParams.get('q')??'').trim().slice(0,120);
  const exact=requestUrl.searchParams.get('exact')==='1';
  const page=Math.max(1,Math.min(500,Number.parseInt(requestUrl.searchParams.get('page')??'1',10)||1));
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15_000);
  try{
    const url=new URL(`/v2/${domain}/`,srdOrigin);
    url.searchParams.set('document__key__in',srdDocument);
    url.searchParams.set('limit','25');
    url.searchParams.set('page',String(page));
    if(query)url.searchParams.set(exact?'name__iexact':'name__icontains',query);
    const upstream=await boundedUpstreamJson(url,controller.signal);
    const results=Array.isArray(upstream?.results)?upstream.results.slice(0,25).filter(record=>{
      if(!record||typeof record!=='object'||Array.isArray(record))return false;
      const key=record.document&&typeof record.document==='object'&&!Array.isArray(record.document)?record.document.key:undefined;
      return key===undefined||key===srdDocument;
    }):[];
    return json(200,{domain,count:Number.isInteger(upstream?.count)?upstream.count:results.length,page,results});
  }catch(error){
    console.error('Altered SRD catalog upstream failure',error instanceof Error?`${error.name}: ${error.message}`:'Unknown error');
    const timedOut=error instanceof Error&&error.name==='AbortError';
    return json(502,{error:timedOut?'The SRD support catalog did not respond within 15 seconds.':'Altered could not load validated SRD support data.'});
  }finally{
    clearTimeout(timeout);
  }
}

export default {
  async fetch(request){
    if(request.method!=='GET'&&request.method!=='HEAD'){
      return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
    }
    const url=new URL(request.url);
    const ddbMatch=url.pathname.match(ddbRoute);
    if(ddbMatch?.[1])return request.method==='HEAD'?new Response(null,{status:204,headers:headers('application/json; charset=utf-8','no-store')}):proxyDdbCharacter(ddbMatch[1]);
    if(url.pathname==='/api/srd/status')return request.method==='HEAD'?new Response(null,{status:204,headers:headers('application/json; charset=utf-8','no-store')}):proxySrdStatus();
    if(url.pathname==='/api/srd/catalog')return request.method==='HEAD'?new Response(null,{status:204,headers:headers('application/json; charset=utf-8','no-store')}):proxySrdCatalog(url);
    if(url.pathname==='/manifest.json')return new Response(request.method==='HEAD'?null:MANIFEST,{headers:headers('application/manifest+json; charset=utf-8','no-cache')});
    if(url.pathname==='/sw.js')return new Response(request.method==='HEAD'?null:SERVICE_WORKER,{headers:headers('application/javascript; charset=utf-8','no-cache')});
    if(url.pathname in ICONS){
      const icon=ICONS[url.pathname];
      return new Response(request.method==='HEAD'?null:decodeBase64(icon.data),{headers:headers(icon.type,'public, max-age=86400')});
    }
    if(url.pathname!=='/'&&url.pathname!=='/index.html')return new Response('Not found',{status:404,headers:headers('text/plain; charset=utf-8','no-cache')});
    if(!pageBytes)pageBytes=decodeBase64(PAGE);
    return new Response(request.method==='HEAD'?null:pageBytes,{headers:headers('text/html; charset=utf-8','no-cache')});
  },
};
