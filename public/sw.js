const CACHE='altered-v0.22.2';
const ASSETS=['./','./index.html','./styles.css','./app.bundle.js','./manifest.json','./icon-192.png','./icon-512.png','./sample-character.json','./sample-characters.json'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  // Character imports and live SRD lookups can contain private or changing data.
  // They must always honor the server's no-store policy and never enter the PWA cache.
  if(url.pathname.startsWith('/api/'))return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request);
      if(response.ok){const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put(event.request.mode==='navigate'?'./index.html':event.request,copy));}
      return response;
    }catch{
      return await caches.match(event.request)??(event.request.mode==='navigate'?await caches.match('./index.html'):undefined)??new Response('Altered is unavailable offline until its first successful load.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
