import {createServer} from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const worker=(await import(pathToFileURL(path.join(root,'dist','server','index.js')).href)).default;
const host='127.0.0.1';
const port=Number.parseInt(process.env.PORT??'4174',10);

const server=createServer(async(request,response)=>{
  try{
    const origin=`http://${host}:${port}`;
    const headers=new Headers();
    for(const [key,value] of Object.entries(request.headers))if(typeof value==='string')headers.set(key,value);
    headers.set('oai-authenticated-user-id','altered-local-preview');
    headers.set('oai-authenticated-user-email','local@altered.preview');
    headers.set('oai-authenticated-user-full-name','Local%20Adventurer');
    headers.set('oai-authenticated-user-full-name-encoding','percent-encoded-utf-8');
    const result=await worker.fetch(new Request(new URL(request.url??'/',origin),{method:request.method,headers}));
    response.writeHead(result.status,Object.fromEntries(result.headers.entries()));
    response.end(Buffer.from(await result.arrayBuffer()));
  }catch(error){
    response.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});
    response.end(error instanceof Error?error.message:'Hosted preview failed.');
  }
});

server.listen(port,host,()=>console.log(`Hosted Altered preview is running at http://${host}:${port}`));
export {server};
