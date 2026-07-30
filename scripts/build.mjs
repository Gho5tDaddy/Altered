import {mkdir,readFile,readdir,copyFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const build=path.join(root,'build');
const dist=path.join(root,'dist');
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});

const publicNames=await readdir(path.join(root,'public'));
for(const name of publicNames)await copyFile(path.join(root,'public',name),path.join(dist,name));
await mkdir(path.join(dist,'tests'),{recursive:true});
await mkdir(path.join(dist,'src'),{recursive:true});
for(const name of await readdir(path.join(build,'tests')))if(name.endsWith('.js'))await copyFile(path.join(build,'tests',name),path.join(dist,'tests',name));
for(const name of await readdir(path.join(build,'src')))if(name.endsWith('.js'))await copyFile(path.join(build,'src',name),path.join(dist,'src',name));

// Bundle every compiled source module so adding a new import cannot leave the
// production app with a module-not-found failure. Sort for reproducible output.
const moduleNames=(await readdir(path.join(build,'src')))
  .filter(name=>name.endsWith('.js'))
  .sort();
const entries=[];
for(const name of moduleNames){
  const code=await readFile(path.join(build,'src',name),'utf8');
  entries.push(`${JSON.stringify('/src/'+name)}: function(require,module,exports){\n${code}\n}`);
}
const bundle=`(function(){\n'use strict';\nconst modules={${entries.join(',\n')}};\nconst cache={};\nfunction resolve(from,request){if(!request.startsWith('.'))return request;const parts=from.split('/');parts.pop();for(const part of request.split('/')){if(part==='.'||part==='')continue;if(part==='..')parts.pop();else parts.push(part);}return parts.join('/');}\nfunction load(id){if(cache[id])return cache[id].exports;if(!modules[id])throw new Error('Module not found: '+id);const module={exports:{}};cache[id]=module;const localRequire=request=>load(resolve(id,request));modules[id](localRequire,module,module.exports);return module.exports;}\nload('/src/app.js');\n})();\n`;
await writeFile(path.join(dist,'app.bundle.js'),bundle);

let html=await readFile(path.join(dist,'index.html'),'utf8');
const css=await readFile(path.join(dist,'styles.css'),'utf8');
html=html.replace('<link rel="stylesheet" href="styles.css">',`<style>\n${css}\n</style>`).replace('<script src="app.bundle.js"></script>',`<script>\n${bundle.replaceAll('</script>','<\\/script>')}\n</script>`).replace('<link rel="manifest" href="manifest.json">','');
for(const name of publicNames.filter(name=>/^form-.*\.jpg$/i.test(name))){
  const image=await readFile(path.join(root,'public',name));
  html=html.replaceAll(name,`data:image/jpeg;base64,${image.toString('base64')}`);
}
await Promise.all([
  writeFile(path.join(dist,'altered-standalone.html'),html),
  writeFile(path.join(dist,'altered-ferocitus.html'),html),
]);

// Sites hosting uses a tiny Cloudflare-compatible worker around the same
// self-contained standalone build. No second application implementation is
// introduced, and owner-only hosting never needs separate image assets.
await mkdir(path.join(dist,'server'),{recursive:true});
await writeFile(path.join(dist,'server','package.json'),'{"type":"module"}\n');
const hostedPage=Buffer.from(html,'utf8').toString('base64');
const hostedWorker=`const PAGE=${JSON.stringify(hostedPage)};
let bytes;
function pageBytes(){if(bytes)return bytes;const binary=atob(PAGE);bytes=Uint8Array.from(binary,character=>character.charCodeAt(0));return bytes;}
const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'};
export default{async fetch(request){const url=new URL(request.url);if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
if(url.pathname.startsWith('/api/'))return Response.json({error:'Live imports are unavailable in the private phone build. Ferocitus and the verified built-in rules remain available.'},{status:503,headers:{'Cache-Control':'no-store'}});
if(url.pathname==='/sw.js')return new Response('',{status:404,headers:{'Content-Type':'application/javascript','Cache-Control':'no-store'}});
return new Response(request.method==='HEAD'?null:pageBytes(),{status:200,headers});}};\n`;
await writeFile(path.join(dist,'server','index.js'),hostedWorker);
console.log(`Built ${dist}`);
