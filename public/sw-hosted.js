const CACHE='altered-hosted-v0.24.1';
const ASSETS=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request);
      if(response.ok){
        const copy=response.clone();
        const key=event.request.mode==='navigate'?'./index.html':event.request;
        void caches.open(CACHE).then(cache=>cache.put(key,copy));
      }
      return response;
    }catch{
      return await caches.match(event.request)??(event.request.mode==='navigate'?await caches.match('./index.html'):undefined)??new Response('Altered is unavailable offline until its first successful load.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
