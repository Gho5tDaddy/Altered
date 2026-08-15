import {spawn} from 'node:child_process';
import {access,mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const worker=(await import(pathToFileURL(path.join(root,'dist','server','index.js')).href)).default;
const candidates=[
  process.env.ALTERED_BROWSER,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

let browser;
for(const candidate of candidates){
  try{await access(candidate);browser=candidate;break;}catch{}
}
if(!browser)throw new Error('Browser audit requires Chrome or Edge. Set ALTERED_BROWSER to its executable path.');

const server=createServer(async(request,response)=>{
  try{
    const origin=`http://127.0.0.1:${server.address().port}`;
    const headers=new Headers();
    for(const [key,value] of Object.entries(request.headers))if(typeof value==='string')headers.set(key,value);
    headers.set('oai-authenticated-user-id','altered-browser-audit');
    headers.set('oai-authenticated-user-email','audit@altered.local');
    headers.set('oai-authenticated-user-full-name','Altered%20Audit');
    headers.set('oai-authenticated-user-full-name-encoding','percent-encoded-utf-8');
    const result=await worker.fetch(new Request(new URL(request.url??'/',origin),{method:request.method,headers}));
    response.writeHead(result.status,Object.fromEntries(result.headers.entries()));
    response.end(Buffer.from(await result.arrayBuffer()));
  }catch(error){
    response.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});
    response.end(error instanceof Error?error.message:'Hosted audit server failed.');
  }
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const port=server.address().port;
const profile=await mkdtemp(path.join(tmpdir(),'altered-browser-audit-'));

function dumpDom(width,height){
  return new Promise((resolve,reject)=>{
    const child=spawn(browser,[
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--enable-logging=stderr',
      '--virtual-time-budget=12000',
      `--window-size=${width},${height}`,
      `--user-data-dir=${profile}`,
      '--dump-dom',
      `http://127.0.0.1:${port}/`,
    ],{windowsHide:true});
    let output='',errors='';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data',chunk=>{output+=chunk;});
    child.stderr.on('data',chunk=>{errors+=chunk;});
    const timeout=setTimeout(()=>{child.kill();reject(new Error('Browser audit timed out.'));},30_000);
    child.once('error',reject);
    child.once('close',code=>{
      clearTimeout(timeout);
      if(code!==0){reject(new Error(`Browser audit exited ${code}: ${errors.slice(-1000)}`));return;}
      resolve({dom:output,errors});
    });
  });
}

try{
  for(const [label,width,height] of [['desktop',1280,900],['phone',390,844]]){
    const {dom,errors}=await dumpDom(width,height);
    if(!dom.includes('data-altered-ready="true"')){
      const status=dom.match(/id="status-message"[^>]*>([^<]*)</i)?.[1]??'no startup status';
      const consoleErrors=errors.split(/\r?\n/).filter(line=>/CONSOLE|ERROR/i.test(line)).slice(-5).join(' | ');
      throw new Error(`${label} build did not finish startup (${status}; ${dom.length} DOM characters${consoleErrors?`; ${consoleErrors}`:''}).`);
    }
    if(!dom.includes('data-altered-character="Kaelen Thorn"'))throw new Error(`${label} build did not load the labeled demo character.`);
    if(!/(?:\bopen\b[^>]*id="new-user-character-dialog"|id="new-user-character-dialog"[^>]*\bopen\b)/.test(dom)){
      const index=dom.indexOf('new-user-character-dialog');
      throw new Error(`${label} build did not present first-time character setup (${index<0?'dialog missing':dom.slice(Math.max(0,index-80),index+180)}).`);
    }
    if(dom.includes('data-altered-ready="error"'))throw new Error(`${label} build reported a startup error.`);
    if(!dom.includes('data-altered-workspace="play"'))throw new Error(`${label} build did not initialize the Play workspace.`);
    if(!dom.includes('class="persistent-form-visual"'))throw new Error(`${label} build did not keep the form artwork mounted.`);
    for(const id of ['nav-play','nav-forms','nav-sheet','nav-more'])if(!dom.includes(`id="${id}"`))throw new Error(`${label} build is missing ${id}.`);
  }
  console.log('Hosted browser audit passed at desktop and phone dimensions.');
}finally{
  await new Promise(resolve=>server.close(resolve));
  await rm(profile,{recursive:true,force:true});
}
