const PAGE=__ALTERED_PAGE_BASE64__;
const MANIFEST=__ALTERED_MANIFEST__;
const ASSET_LINKS=__ALTERED_ASSET_LINKS__;
const SERVICE_WORKER=__ALTERED_SERVICE_WORKER__;
const ICONS=__ALTERED_ICONS__;
const FORM_IMAGES=__ALTERED_FORM_IMAGES__;
const TOOL_ASSETS=__ALTERED_TOOL_ASSETS__;
const DOWNLOAD_ASSETS=__ALTERED_DOWNLOAD_ASSETS__;
const ANDROID_DOWNLOAD_PATH='/downloads/Altered-Android-v0.29.32.apk';
const ANDROID_DOWNLOAD_URL='https://raw.githubusercontent.com/Gho5tDaddy/Altered/main/public/downloads/Altered-Android-v0.29.32.apk';
const LOGIN_PAGE=`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#0b0e11">
  <title>Sign in to Altered</title>
  <style>
    :root{color-scheme:dark;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#050607;color:#f1ede5}
    *{box-sizing:border-box}body{min-height:100dvh;margin:0;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at 50% 0,#242a2e 0,#0b0e11 46%,#020303 100%)}
    main{width:min(430px,100%);border:1px solid #5f5039;padding:clamp(22px,6vw,34px);background:linear-gradient(145deg,rgba(25,29,31,.98),rgba(8,10,11,.99));box-shadow:0 24px 70px rgba(0,0,0,.62),0 0 0 1px rgba(226,197,142,.08);clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}
    .mark{width:58px;height:58px;display:grid;place-items:center;border:1px solid #c9872b;border-radius:16px;color:#efb456;background:#111518;box-shadow:inset 0 0 0 3px #090b0d;font-size:29px;font-weight:900}
    h1{margin:18px 0 4px;font-size:1.55rem;letter-spacing:.07em}p{margin:0;color:#aeb5ba;line-height:1.55}.purpose{margin-top:12px;font-size:.9rem}
    a{display:flex;align-items:center;justify-content:center;min-height:50px;margin-top:22px;border:1px solid #c9872b;border-radius:10px;background:linear-gradient(180deg,#efb456,#c9872b);color:#171108;text-decoration:none;font-weight:850}
    a:focus-visible{outline:3px solid rgba(239,180,86,.55);outline-offset:3px}.note{margin-top:14px;font-size:.76rem;color:#8f999f}.seal{display:flex;align-items:center;gap:7px;margin-top:18px;padding-top:14px;border-top:1px solid #313b43;color:#aeb5ba;font-size:.76rem}.seal b{color:#b4d9bf}
  </style>
</head>
<body><main>
  <div class="mark" aria-hidden="true">A</div>
  <h1>ALTERED</h1>
  <p>Rules-aware transformation character sheet</p>
  <p class="purpose">Sign in to open your table dashboard. New users can create a free ChatGPT account on the next screen.</p>
  <a href="/signin-with-chatgpt?return_to=%2F">Sign in or create account</a>
  <p class="note">Altered never receives or stores your password. Account PDFs are private to your sign-in; character saves and structured packs remain device-local.</p>
  <div class="seal"><b>Secure account access</b><span>managed by ChatGPT</span></div>
</main></body></html>`;

let pageBytes;
let srdStatusCache;
const apiRateWindows=new Map();
const encoder=new TextEncoder();
const ddbRoute=/^\/api\/dndbeyond\/character\/(\d{5,15})$/;
const ddbOrigin='https://character-service.dndbeyond.com';
const maxDdbResponseBytes=5*1024*1024;
const srdOrigin='https://api.open5e.com';
const srdDocument='srd-2024';
const srdVersion='5.2.1';
const maxSrdResponseBytes=2*1024*1024;
const maxPrivatePdfBytes=500*1024*1024;
const maxPrivatePdfPartBytes=5*1024*1024;
const maxPrivatePdfParts=Math.ceil(maxPrivatePdfBytes/maxPrivatePdfPartBytes);
const privatePdfRoute=/^\/api\/private-pdfs(?:\/([A-Za-z0-9-]{8,80}))?$/;
const srdDomains=Object.freeze({
  rules:56,classes:24,species:9,backgrounds:4,feats:17,items:203,magicitems:757,
  weapons:38,armor:13,creatures:331,spells:339,weaponproperties:17,
});
const contentSecurityPolicy="default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; connect-src 'self' https://cdn.jsdelivr.net; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const apiWindowMs=10*60*1000;

function headers(contentType,cacheControl='no-cache'){
  return {
    'Content-Type':contentType,
    'Cache-Control':cacheControl,
    'Content-Security-Policy':contentSecurityPolicy,
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Referrer-Policy':'no-referrer',
    'Cross-Origin-Opener-Policy':'same-origin',
    'Cross-Origin-Resource-Policy':'same-origin',
    'Strict-Transport-Security':'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
  };
}

function decodeBase64(value){
  const binary=atob(value);
  return Uint8Array.from(binary,character=>character.charCodeAt(0));
}

function json(status,body,extraHeaders={}){
  return new Response(JSON.stringify(body),{status,headers:{...headers('application/json; charset=utf-8','no-store'),...extraHeaders}});
}

function identityText(value,maximum=160){
  return typeof value==='string'?value.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,maximum):'';
}

function authenticatedUser(request){
  const id=identityText(request.headers.get('oai-authenticated-user-id'),200);
  const email=identityText(request.headers.get('oai-authenticated-user-email'),254);
  if(!id||!email)return null;
  let fullName='';
  const encodedName=request.headers.get('oai-authenticated-user-full-name');
  if(encodedName&&request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){
    try{fullName=identityText(decodeURIComponent(encodedName),100);}catch{}
  }
  const emailName=identityText(email.split('@')[0]?.replace(/[._-]+/g,' '),60);
  return {id,email,displayName:fullName||emailName||'Adventurer'};
}

function guardApiRequest(request,kind,limit){
  const user=authenticatedUser(request);
  if(!user)return json(401,{error:'Sign in to Altered to use this feature.'});
  const fetchSite=request.headers.get('Sec-Fetch-Site');
  if(request.headers.get('X-Altered-Request')!=='app'||(fetchSite&&fetchSite!=='same-origin')){
    return json(403,{error:'This endpoint is available only to the Altered application.'});
  }
  const address=(request.headers.get('CF-Connecting-IP')??'local').slice(0,64);
  const key=`${kind}:${user.id}:${address}`;
  const now=Date.now();
  let window=apiRateWindows.get(key);
  if(!window||now>=window.resetAt){
    window={count:0,resetAt:now+apiWindowMs};
    apiRateWindows.set(key,window);
  }
  if(window.count>=limit){
    const retryAfter=Math.max(1,Math.ceil((window.resetAt-now)/1000));
    return json(429,{error:'Too many requests. Wait a few minutes and try again.'},{'Retry-After':String(retryAfter)});
  }
  window.count+=1;
  if(apiRateWindows.size>512){
    const oldest=apiRateWindows.keys().next().value;
    if(oldest&&oldest!==key)apiRateWindows.delete(oldest);
  }
  return null;
}

function privatePdfPrefix(user){return `private-pdfs/${encodeURIComponent(user.id)}/`;}
function privatePdfFilename(request){
  const raw=request.headers.get('X-Altered-Filename')??'';let decoded='';try{decoded=decodeURIComponent(raw);}catch{}
  const safe=identityText(decoded,180).replace(/[\\/:*?"<>|]+/g,'-').replace(/\.+$/,'').trim();
  return safe.toLowerCase().endsWith('.pdf')?safe:`${safe||'private-reference'}.pdf`;
}
function privatePdfDisposition(filename){return `attachment; filename="${filename.replace(/["\\\r\n]/g,'_')}"`;}
function privatePdfUploadId(url){
  const value=url.searchParams.get('uploadId')??'';
  return value&&value.length<=2048&&!/[\u0000-\u001f\u007f]/.test(value)?value:'';
}
function privatePdfOperationError(error){
  const message=error instanceof Error?error.message:'';
  if(/multipart upload does not exist|10024/i.test(message))return json(409,{error:'The secure upload session was not recognized. Start the PDF upload again.'});
  if(/network connection lost/i.test(message))return json(503,{error:'The PDF connection was interrupted. Altered will retry each piece automatically.'});
  return json(500,{error:'Altered could not complete the private PDF operation.'});
}
async function handlePrivatePdfs(request,env,user,id){
  const bucket=env?.PRIVATE_FILES;if(!bucket)return json(503,{error:'Private account storage is not configured yet.'});
  const prefix=privatePdfPrefix(user);const key=id?`${prefix}${id}`:'';const url=new URL(request.url);const action=url.searchParams.get('action')??'';
  if(!id&&request.method==='GET'){
    const listing=await bucket.list({prefix,limit:100,include:['customMetadata']});
    const documents=listing.objects.map(object=>({id:object.key.slice(prefix.length),name:identityText(object.customMetadata?.filename,180)||'Private reference.pdf',size:object.size,uploadedAt:identityText(object.customMetadata?.uploadedAt,40)||object.uploaded?.toISOString?.()||new Date().toISOString()})).filter(record=>record.id).sort((a,b)=>b.uploadedAt.localeCompare(a.uploadedAt));
    return json(200,{documents});
  }
  if(!id)return json(405,{error:'Unsupported private PDF operation.'},{Allow:'GET'});
  if(request.method==='POST'&&action==='create'){
    const declared=Number.parseInt(request.headers.get('X-Altered-Size')??'',10);if(!Number.isFinite(declared)||declared<5)return json(400,{error:'The PDF upload has no valid size.'});if(declared>maxPrivatePdfBytes)return json(413,{error:'PDF exceeds the 500 MB account-storage limit.'});
    const filename=privatePdfFilename(request);const uploadedAt=new Date().toISOString();const upload=await bucket.createMultipartUpload(key,{httpMetadata:{contentType:'application/pdf',contentDisposition:privatePdfDisposition(filename)},customMetadata:{filename,uploadedAt,declaredSize:String(declared)}});return json(201,{id,uploadId:upload.uploadId});
  }
  if(request.method==='PUT'&&action==='part'){
    const uploadId=privatePdfUploadId(url);const partNumber=Number.parseInt(url.searchParams.get('partNumber')??'',10);const declared=Number.parseInt(request.headers.get('X-Altered-Part-Size')??request.headers.get('content-length')??'',10);
    if(!uploadId||!Number.isInteger(partNumber)||partNumber<1||partNumber>maxPrivatePdfParts)return json(400,{error:'The PDF upload part is invalid.'});if(!Number.isFinite(declared)||declared<1||declared>maxPrivatePdfPartBytes)return json(413,{error:'The PDF upload part exceeds 5 MB.'});if(!request.body)return json(400,{error:'The PDF upload part is empty.'});
    let value=request.body;if(partNumber===1){const bytes=new Uint8Array(await request.arrayBuffer());if(bytes.length<5||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')return json(415,{error:'Choose a valid PDF file.'});value=bytes;}
    const uploaded=await bucket.resumeMultipartUpload(key,uploadId).uploadPart(partNumber,value);return json(200,{partNumber:uploaded.partNumber,etag:uploaded.etag});
  }
  if(request.method==='POST'&&action==='complete'){
    const uploadId=privatePdfUploadId(url);if(!uploadId)return json(400,{error:'The PDF upload session is missing.'});const body=await request.json();const parts=Array.isArray(body?.parts)?body.parts:[];
    if(!parts.length||parts.length>maxPrivatePdfParts||new Set(parts.map(part=>part?.partNumber)).size!==parts.length||parts.some(part=>!Number.isInteger(part?.partNumber)||part.partNumber<1||part.partNumber>maxPrivatePdfParts||typeof part?.etag!=='string'||part.etag.length>256))return json(400,{error:'The PDF upload confirmation is invalid.'});
    const object=await bucket.resumeMultipartUpload(key,uploadId).complete(parts);if(object.size>maxPrivatePdfBytes){await bucket.delete(key);return json(413,{error:'PDF exceeds the 500 MB account-storage limit.'});}return json(201,{id,size:object.size});
  }
  if(request.method==='DELETE'&&action==='abort'){
    const uploadId=privatePdfUploadId(url);if(!uploadId)return json(400,{error:'The PDF upload session is missing.'});try{await bucket.resumeMultipartUpload(key,uploadId).abort();}catch(error){if(!/multipart upload does not exist|10024/i.test(error instanceof Error?error.message:''))throw error;}return json(200,{aborted:true});
  }
  if(request.method==='GET'||request.method==='HEAD'){
    const metadata=await bucket.head(key);if(!metadata)return json(404,{error:'That private PDF was not found for this account.'});const filename=identityText(metadata.customMetadata?.filename,180)||'Private reference.pdf';const responseHeaders={...headers('application/pdf','private, no-store'),'Accept-Ranges':'bytes','Content-Disposition':privatePdfDisposition(filename)};
    if(request.method==='HEAD')return new Response(null,{headers:{...responseHeaders,'Content-Length':String(metadata.size)}});
    const requested=request.headers.get('Range');if(requested){const match=requested.match(/^bytes=(\d+)-(\d*)$/);if(!match)return new Response(null,{status:416,headers:{...responseHeaders,'Content-Range':`bytes */${metadata.size}`}});const start=Number.parseInt(match[1],10),requestedEnd=match[2]?Number.parseInt(match[2],10):metadata.size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(requestedEnd)||start<0||start>=metadata.size||requestedEnd<start)return new Response(null,{status:416,headers:{...responseHeaders,'Content-Range':`bytes */${metadata.size}`}});const end=Math.min(requestedEnd,metadata.size-1),length=end-start+1;const object=await bucket.get(key,{range:{offset:start,length}});if(!object)return json(404,{error:'That private PDF was not found for this account.'});return new Response(object.body,{status:206,headers:{...responseHeaders,'Content-Length':String(length),'Content-Range':`bytes ${start}-${end}/${metadata.size}`}});}
    const object=await bucket.get(key);if(!object)return json(404,{error:'That private PDF was not found for this account.'});return new Response(object.body,{headers:{...responseHeaders,'Content-Length':String(object.size)}});
  }
  if(request.method==='DELETE'){await bucket.delete(key);return json(200,{deleted:true});}
  return json(405,{error:'Unsupported private PDF operation.'},{Allow:'GET, HEAD, POST, PUT, DELETE'});
}

async function boundedUpstreamJson(url,signal,maxBytes=maxSrdResponseBytes){
  // Cloudflare's Worker fetch accepts a URL string or Request. Normalizing URL
  // objects here keeps the same code valid in both Node preview and production.
  // The edge runtime supports manual redirect handling rather than the
  // browser-only "error" mode. Non-2xx responses (including redirects) are
  // rejected below, so no request can escape the fixed upstream host.
  const upstream=await fetch(String(url),{headers:{Accept:'application/json'},redirect:'manual',signal});
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
  async fetch(request,env){
    const url=new URL(request.url);
    const privatePdfMatch=url.pathname.match(privatePdfRoute);
    if(privatePdfMatch){
      const rangeRead=request.method==='GET'&&Boolean(request.headers.get('Range'));const operation=request.method==='PUT'?'pdf-upload-part':request.method==='POST'?'pdf-upload-control':request.method==='DELETE'?'pdf-delete':rangeRead?'pdf-range-read':'pdf-read';const limit=request.method==='PUT'?180:rangeRead?2400:60;const blocked=guardApiRequest(request,operation,limit);if(blocked)return blocked;const user=authenticatedUser(request);
      try{return await handlePrivatePdfs(request,env,user,privatePdfMatch[1]);}catch(error){console.error('Altered private PDF failure',error instanceof Error?`${error.name}: ${error.message}`:'Unknown error');return privatePdfOperationError(error);}
    }
    if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
    const ddbMatch=url.pathname.match(ddbRoute);
    if(ddbMatch?.[1]){
      const blocked=guardApiRequest(request,'ddb',12);
      return blocked??(request.method==='HEAD'?new Response(null,{status:204,headers:headers('application/json; charset=utf-8','no-store')}):proxyDdbCharacter(ddbMatch[1]));
    }
    if(url.pathname==='/api/srd/status'){
      const blocked=guardApiRequest(request,'srd-status',30);
      return blocked??(request.method==='HEAD'?new Response(null,{status:204,headers:headers('application/json; charset=utf-8','no-store')}):proxySrdStatus());
    }
    if(url.pathname==='/api/srd/catalog'){
      const blocked=guardApiRequest(request,'srd-catalog',90);
      return blocked??(request.method==='HEAD'?new Response(null,{status:204,headers:headers('application/json; charset=utf-8','no-store')}):proxySrdCatalog(url));
    }
    if(url.pathname==='/api/auth/me'){
      const blocked=guardApiRequest(request,'auth-me',120);
      if(blocked)return blocked;
      const user=authenticatedUser(request);
      return request.method==='HEAD'
        ?new Response(null,{status:204,headers:headers('application/json; charset=utf-8','no-store')})
        :json(200,{displayName:user.displayName,email:user.email});
    }
    if(url.pathname==='/manifest.json')return new Response(request.method==='HEAD'?null:MANIFEST,{headers:headers('application/manifest+json; charset=utf-8','no-cache')});
    if(url.pathname==='/.well-known/assetlinks.json')return new Response(request.method==='HEAD'?null:ASSET_LINKS,{headers:headers('application/json; charset=utf-8','public, max-age=3600')});
    if(url.pathname==='/sw.js')return new Response(request.method==='HEAD'?null:SERVICE_WORKER,{headers:headers('application/javascript; charset=utf-8','no-cache')});
    if(url.pathname==='/favicon.ico'){
      const icon=ICONS['/icon-192.png'];
      return new Response(request.method==='HEAD'?null:decodeBase64(icon.data),{headers:headers(icon.type,'public, max-age=86400')});
    }
    if(url.pathname in ICONS){
      const icon=ICONS[url.pathname];
      return new Response(request.method==='HEAD'?null:decodeBase64(icon.data),{headers:headers(icon.type,'public, max-age=86400')});
    }
    if(url.pathname in FORM_IMAGES){
      const image=FORM_IMAGES[url.pathname];
      return new Response(request.method==='HEAD'?null:decodeBase64(image.data),{headers:headers(image.type,'public, max-age=86400')});
    }
    if(url.pathname in TOOL_ASSETS){
      const asset=TOOL_ASSETS[url.pathname];
      return new Response(request.method==='HEAD'?null:decodeBase64(asset.data),{headers:headers(asset.type,'public, max-age=31536000, immutable')});
    }
    if(url.pathname in DOWNLOAD_ASSETS){
      const asset=DOWNLOAD_ASSETS[url.pathname];
      const bytes=decodeBase64(asset.data);
      return new Response(request.method==='HEAD'?null:bytes,{headers:{...headers(asset.type,'public, max-age=31536000, immutable'),'Content-Disposition':`attachment; filename="${asset.name}"`,'Content-Length':String(bytes.byteLength)}});
    }
    if(url.pathname===ANDROID_DOWNLOAD_PATH)return Response.redirect(ANDROID_DOWNLOAD_URL,302);
    if(url.pathname.startsWith('/downloads/')&&env?.ASSETS?.fetch)return env.ASSETS.fetch(request);
    if(url.pathname!=='/'&&url.pathname!=='/index.html')return new Response('Not found',{status:404,headers:headers('text/plain; charset=utf-8','no-cache')});
    if(!authenticatedUser(request))return new Response(request.method==='HEAD'?null:LOGIN_PAGE,{headers:headers('text/html; charset=utf-8','private, no-store')});
    if(!pageBytes)pageBytes=decodeBase64(PAGE);
    return new Response(request.method==='HEAD'?null:pageBytes,{headers:headers('text/html; charset=utf-8','private, no-store')});
  },
};
