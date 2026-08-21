import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {networkInterfaces} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','dist');
const lanMode=process.argv.slice(2).includes('--lan');
const host=lanMode?'0.0.0.0':'127.0.0.1';
const port=Number.parseInt(process.env.PORT??'4173',10);
const contentTypes=new Map([
  ['.css','text/css; charset=utf-8'],
  ['.html','text/html; charset=utf-8'],
  ['.ico','image/x-icon'],
  ['.js','text/javascript; charset=utf-8'],
  ['.jpeg','image/jpeg'],
  ['.jpg','image/jpeg'],
  ['.json','application/json; charset=utf-8'],
  ['.mjs','text/javascript; charset=utf-8'],
  ['.png','image/png'],
  ['.svg','image/svg+xml'],
  ['.webmanifest','application/manifest+json; charset=utf-8'],
]);
const freshExtensions=new Set(['.css','.html','.js','.json','.mjs','.webmanifest']);
const ddbRoute=/^\/api\/dndbeyond\/character\/(\d{5,15})$/;
const ddbOrigin='https://character-service.dndbeyond.com';
const maxDdbResponseBytes=5*1024*1024;
const srdStatusRoute=/^\/api\/srd\/status$/;
const srdCatalogRoute=/^\/api\/srd\/catalog$/;
const srdOrigin='https://api.open5e.com';
const srdDocument='srd-2024';
const srdVersion='5.2.1';
const srdDomains=Object.freeze({
  rules:56,classes:24,species:9,backgrounds:4,feats:17,items:203,magicitems:757,
  weapons:38,armor:13,creatures:331,spells:339,weaponproperties:17,
});
const maxSrdResponseBytes=2*1024*1024;
// The OCR entry bundle is local. Tesseract's browser worker, WASM core, and
// English model are loaded lazily from its pinned jsDelivr release on first use.
const contentSecurityPolicy="default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; connect-src 'self' https://cdn.jsdelivr.net; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
let srdStatusCache;

function json(response,status,body){
  response.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'Content-Security-Policy':contentSecurityPolicy,
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Referrer-Policy':'no-referrer',
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
  }).end(JSON.stringify(body));
}

async function proxyDdbCharacter(request,response,id){
  if(request.method==='HEAD'){
    response.writeHead(204,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end();
    return;
  }
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15_000);
  try{
    const upstream=await fetch(`${ddbOrigin}/character/v5/character/${id}`,{
      headers:{Accept:'application/json','User-Agent':'Altered local character importer'},
      redirect:'error',
      signal:controller.signal,
    });
    if(!upstream.ok){
      if(upstream.status===403){json(response,403,{error:'D&D Beyond blocked this character. In the character builder, set Character Privacy to Public, save, and try again.'});return;}
      if(upstream.status===404){json(response,404,{error:'D&D Beyond could not find that character ID.'});return;}
      json(response,502,{error:`D&D Beyond returned status ${upstream.status}. Try again later.`});return;
    }
    const declared=Number.parseInt(upstream.headers.get('content-length')??'0',10);
    if(declared>maxDdbResponseBytes){json(response,502,{error:'D&D Beyond returned more character data than Altered can safely import.'});return;}
    const body=await upstream.text();
    if(Buffer.byteLength(body,'utf8')>maxDdbResponseBytes){json(response,502,{error:'D&D Beyond returned more character data than Altered can safely import.'});return;}
    let payload;try{payload=JSON.parse(body);}catch{json(response,502,{error:'D&D Beyond returned data in an unexpected format.'});return;}
    json(response,200,payload);
  }catch(error){
    const timedOut=error instanceof Error&&error.name==='AbortError';
    json(response,502,{error:timedOut?'D&D Beyond did not respond within 15 seconds.':'Altered could not reach D&D Beyond. Check the connection and try again.'});
  }finally{
    clearTimeout(timeout);
  }
}

async function boundedUpstreamJson(url,signal,maxBytes=maxSrdResponseBytes){
  const upstream=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Altered local SRD support catalog'},redirect:'error',signal});
  if(!upstream.ok)throw new Error(`upstream status ${upstream.status}`);
  const declared=Number.parseInt(upstream.headers.get('content-length')??'0',10);
  if(declared>maxBytes)throw new Error('upstream response is too large');
  const body=await upstream.text();if(Buffer.byteLength(body,'utf8')>maxBytes)throw new Error('upstream response is too large');
  return JSON.parse(body);
}

async function currentSrdStatus(signal){
  const now=Date.now();
  if(srdStatusCache&&now-srdStatusCache.cachedAt<6*60*60*1000)return srdStatusCache.value;
  const entries=await Promise.all(Object.entries(srdDomains).map(async([domain])=>{
    const url=new URL(`/v2/${domain}/`,srdOrigin);url.searchParams.set('document__key__in',srdDocument);url.searchParams.set('limit','1');
    const page=await boundedUpstreamJson(url,signal,256*1024);
    const count=Number.isInteger(page?.count)&&page.count>=0?page.count:0;return [domain,count];
  }));
  const counts=Object.fromEntries(entries);
  const recordCount=Object.values(counts).reduce((sum,value)=>sum+value,0);
  const healthy=Object.entries(srdDomains).every(([domain,minimum])=>counts[domain]>=minimum);
  const value={sourceVersion:srdVersion,sourceDocument:srdDocument,provider:'Open5e live SRD 2024 catalog',checkedAt:new Date().toISOString(),healthy,recordCount,counts};
  srdStatusCache={cachedAt:now,value};return value;
}

async function proxySrdStatus(request,response){
  if(request.method==='HEAD'){response.writeHead(204,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end();return;}
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15_000);
  try{json(response,200,await currentSrdStatus(controller.signal));}
  catch(error){const timedOut=error instanceof Error&&error.name==='AbortError';json(response,502,{error:timedOut?'The SRD support catalog did not respond within 15 seconds.':'Altered could not validate the live SRD support catalog.'});}
  finally{clearTimeout(timeout);}
}

async function proxySrdCatalog(request,response,requestUrl){
  if(request.method==='HEAD'){response.writeHead(204,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end();return;}
  const domain=requestUrl.searchParams.get('domain')??'';if(!(domain in srdDomains)){json(response,400,{error:'Unsupported SRD catalog domain.'});return;}
  const query=(requestUrl.searchParams.get('q')??'').trim().slice(0,120);const exact=requestUrl.searchParams.get('exact')==='1';
  const page=Math.max(1,Math.min(500,Number.parseInt(requestUrl.searchParams.get('page')??'1',10)||1));
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15_000);
  try{
    const url=new URL(`/v2/${domain}/`,srdOrigin);url.searchParams.set('document__key__in',srdDocument);url.searchParams.set('limit','25');url.searchParams.set('page',String(page));
    if(query)url.searchParams.set(exact?'name__iexact':'name__icontains',query);
    const upstream=await boundedUpstreamJson(url,controller.signal);
    const results=Array.isArray(upstream?.results)?upstream.results.slice(0,25).filter(record=>{
      if(!record||typeof record!=='object'||Array.isArray(record))return false;
      const key=record.document&&typeof record.document==='object'&&!Array.isArray(record.document)?record.document.key:undefined;
      return key===undefined||key===srdDocument;
    }):[];
    json(response,200,{domain,count:Number.isInteger(upstream?.count)?upstream.count:results.length,page,results});
  }catch(error){
    const timedOut=error instanceof Error&&error.name==='AbortError';
    json(response,502,{error:timedOut?'The SRD support catalog did not respond within 15 seconds.':'Altered could not load validated SRD support data.'});
  }finally{clearTimeout(timeout);}
}

const server=createServer(async (request,response)=>{
  try{
    if(request.method!=='GET'&&request.method!=='HEAD'){
      response.writeHead(405,{'Allow':'GET, HEAD','Content-Type':'text/plain; charset=utf-8'}).end('Method not allowed');
      return;
    }
    const requestUrl=new URL(request.url??'/',`http://${host}`);const pathname=decodeURIComponent(requestUrl.pathname);
    const ddbMatch=pathname.match(ddbRoute);
    if(ddbMatch?.[1]){
      await proxyDdbCharacter(request,response,ddbMatch[1]);
      return;
    }
    if(srdStatusRoute.test(pathname)){await proxySrdStatus(request,response);return;}
    if(srdCatalogRoute.test(pathname)){await proxySrdCatalog(request,response,requestUrl);return;}
    const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,'');
    const file=path.resolve(root,relative);
    if(file!==root&&!file.startsWith(`${root}${path.sep}`)){
      response.writeHead(403).end('Forbidden');
      return;
    }
    const info=await stat(file);
    if(!info.isFile())throw new Error('Not a file');
    const extension=path.extname(file);
    response.writeHead(200,{
      'Content-Type':contentTypes.get(extension)??'application/octet-stream',
      'Cache-Control':freshExtensions.has(extension)?'no-cache':'public, max-age=86400',
      'Content-Security-Policy':contentSecurityPolicy,
      'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
      'Referrer-Policy':'no-referrer',
      'X-Content-Type-Options':'nosniff',
      'X-Frame-Options':'DENY',
    });
    if(request.method==='HEAD')response.end();else createReadStream(file).pipe(response);
  }catch{
    response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Not found');
  }
});

function accessUrls(){
  if(!lanMode)return [`http://${host}:${port}`];
  const addresses=Object.values(networkInterfaces()).flat().filter(address=>
    address&&!address.internal&&(address.family==='IPv4'||address.family===4)
  ).map(address=>address.address);
  return [...new Set(addresses)].map(address=>`http://${address}:${port}`);
}

server.listen(port,host,()=>{
  if(lanMode)console.log('Altered LAN access is enabled for devices on this private network.');
  for(const url of accessUrls())console.log(`Altered is running at ${url}`);
});

export {server};
