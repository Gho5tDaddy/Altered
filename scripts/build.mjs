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

let hostedHtml=await readFile(path.join(dist,'index.html'),'utf8');
const css=await readFile(path.join(dist,'styles.css'),'utf8');
hostedHtml=hostedHtml
  .replace('<link rel="stylesheet" href="styles.css">',()=>`<style>\n${css}\n</style>`)
  // Compiled source can legitimately contain replacement tokens such as "$&".
  // A function replacement keeps those tokens literal instead of corrupting
  // the standalone script with the matched external script tag.
  .replace('<script src="app.bundle.js"></script>',()=>`<script>\n${bundle.replaceAll('</script>','<\\/script>')}\n</script>`);
let standaloneHtml=hostedHtml.replace('<link rel="manifest" href="manifest.json">','');
for(const name of publicNames.filter(name=>/^form-.*\.jpg$/i.test(name))){
  const image=await readFile(path.join(root,'public',name));
  standaloneHtml=standaloneHtml.replaceAll(name,`data:image/jpeg;base64,${image.toString('base64')}`);
}
await Promise.all([
  writeFile(path.join(dist,'altered-standalone.html'),standaloneHtml),
  writeFile(path.join(dist,'altered-ferocitus.html'),standaloneHtml),
]);

// Sites hosting serves the same embedded application plus the minimal PWA
// surface and guarded data routes needed for feature parity away from the PC.
await mkdir(path.join(dist,'server'),{recursive:true});
await writeFile(path.join(dist,'server','package.json'),'{"type":"module"}\n');
const hostedPage=Buffer.from(hostedHtml,'utf8').toString('base64');
const manifest=await readFile(path.join(root,'public','manifest.json'),'utf8');
const assetLinks=await readFile(path.join(root,'public','assetlinks.json'),'utf8');
const hostedServiceWorker=await readFile(path.join(root,'public','sw-hosted.js'),'utf8');
const icons=Object.fromEntries(await Promise.all(['icon-192.png','icon-512.png','icon-maskable-512.png'].map(async name=>[
  `/${name}`,
  {type:'image/png',data:(await readFile(path.join(root,'public',name))).toString('base64')},
])));
const formImages=Object.fromEntries(await Promise.all(publicNames.filter(name=>/^form-.*\.jpg$/i.test(name)).map(async name=>[
  `/${name}`,
  {type:'image/jpeg',data:(await readFile(path.join(root,'public',name))).toString('base64')},
])));
const workerTemplate=await readFile(path.join(root,'scripts','hosted-worker.template.js'),'utf8');
const hostedWorker=workerTemplate
  .replace('__ALTERED_PAGE_BASE64__',()=>JSON.stringify(hostedPage))
  .replace('__ALTERED_MANIFEST__',()=>JSON.stringify(manifest))
  .replace('__ALTERED_ASSET_LINKS__',()=>JSON.stringify(assetLinks))
  .replace('__ALTERED_SERVICE_WORKER__',()=>JSON.stringify(hostedServiceWorker))
  .replace('__ALTERED_ICONS__',()=>JSON.stringify(icons))
  .replace('__ALTERED_FORM_IMAGES__',()=>JSON.stringify(formImages));
await writeFile(path.join(dist,'server','index.js'),hostedWorker);
console.log(`Built ${dist}`);
