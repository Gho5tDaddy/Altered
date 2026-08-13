const CACHE='altered-hosted-v0.29.1';
const ASSETS=['./manifest.json','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./pdf.bundle.js','./tesseract.bundle.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(()=>new Response('Reconnect to sign in and open Altered.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}})));
    return;
  }
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request);
      if(response.ok){
        const copy=response.clone();
        void caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      }
      return response;
    }catch{
      return await caches.match(event.request)??new Response('Altered is unavailable offline until its first successful load.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
