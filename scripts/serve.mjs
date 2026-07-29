import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','dist');
const host='127.0.0.1';
const port=Number.parseInt(process.env.PORT??'4173',10);
const contentTypes=new Map([
  ['.css','text/css; charset=utf-8'],
  ['.html','text/html; charset=utf-8'],
  ['.js','text/javascript; charset=utf-8'],
  ['.json','application/json; charset=utf-8'],
  ['.png','image/png'],
  ['.svg','image/svg+xml'],
  ['.webmanifest','application/manifest+json; charset=utf-8'],
]);

const server=createServer(async (request,response)=>{
  try{
    const pathname=decodeURIComponent(new URL(request.url??'/',`http://${host}`).pathname);
    const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,'');
    const file=path.resolve(root,relative);
    if(file!==root&&!file.startsWith(`${root}${path.sep}`)){
      response.writeHead(403).end('Forbidden');
      return;
    }
    const info=await stat(file);
    if(!info.isFile())throw new Error('Not a file');
    response.writeHead(200,{'Content-Type':contentTypes.get(path.extname(file))??'application/octet-stream'});
    createReadStream(file).pipe(response);
  }catch{
    response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Not found');
  }
});

server.listen(port,host,()=>console.log(`Altered is running at http://${host}:${port}`));
