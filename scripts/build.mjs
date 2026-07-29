import {mkdir,readFile,readdir,copyFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const build=path.join(root,'build');
const dist=path.join(root,'dist');
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});

for(const name of await readdir(path.join(root,'public')))await copyFile(path.join(root,'public',name),path.join(dist,name));
await mkdir(path.join(dist,'tests'),{recursive:true});
await mkdir(path.join(dist,'src'),{recursive:true});
for(const name of await readdir(path.join(build,'tests')))if(name.endsWith('.js'))await copyFile(path.join(build,'tests',name),path.join(dist,'tests',name));
for(const name of await readdir(path.join(build,'src')))if(name.endsWith('.js'))await copyFile(path.join(build,'src',name),path.join(dist,'src',name));

const moduleNames=['rules-data.js','content-registry.js','storage.js','schema.js','owned-content.js','engine.js','sample-data.js','app.js'];
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
await writeFile(path.join(dist,'altered-standalone.html'),html);
console.log(`Built ${dist}`);
