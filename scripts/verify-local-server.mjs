import assert from 'node:assert/strict';
import {once} from 'node:events';

process.env.PORT='0';
const {server}=await import('./serve.mjs?platform-verification');
const initialAddress=server.address();
if(!initialAddress||typeof initialAddress==='string'||initialAddress.port===0)await once(server,'listening');

try{
  const address=server.address();
  assert.ok(address&&typeof address==='object','Local server did not expose a test port.');
  const origin=`http://127.0.0.1:${address.port}`;
  for(const [asset,expectedType] of [['form-tiger.jpg','image/jpeg'],['pdf.worker.min.mjs','text/javascript; charset=utf-8']]){
    const response=await fetch(`${origin}/${asset}`,{method:'HEAD'});
    assert.equal(response.status,200,`${asset} was not served.`);
    assert.equal(response.headers.get('content-type'),expectedType,`${asset} used the wrong MIME type.`);
  }
  const page=await fetch(`${origin}/`,{method:'HEAD'});
  const policy=page.headers.get('content-security-policy')??'';
  assert.ok(policy.includes("'wasm-unsafe-eval'"),'OCR WASM permission is missing.');
  assert.ok(policy.includes('https://cdn.jsdelivr.net'),'The pinned OCR dependency origin is missing.');
  assert.ok(policy.includes("worker-src 'self' blob:"),'OCR worker permissions are missing.');
  console.log('Local server MIME and OCR policy verified.');
}finally{
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}
