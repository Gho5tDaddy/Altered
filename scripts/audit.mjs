import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const require=createRequire(import.meta.url);
const registry=require('../dist/src/content-registry.js');
const ledger=require('../dist/src/audit-ledger.js');
const pkg=require('../package.json');
const hostedWorker=(await import(pathToFileURL(resolve('dist/server/index.js')).href)).default;

const hostedPageResponse=await hostedWorker.fetch(new Request('https://altered.audit/'));
const hostedPage=await hostedPageResponse.text();
if(hostedPageResponse.status!==200||!hostedPage.includes('Ferocitus')||!hostedPage.includes('data:image/jpeg;base64,')){
  throw new Error('Hosted release did not contain Ferocitus and embedded form art.');
}
const hostedManifestResponse=await hostedWorker.fetch(new Request('https://altered.audit/manifest.json'));
const hostedManifest=await hostedManifestResponse.json();
if(hostedManifestResponse.status!==200||hostedManifest.short_name!=='Altered')throw new Error('Hosted PWA manifest failed validation.');
const hostedServiceWorkerResponse=await hostedWorker.fetch(new Request('https://altered.audit/sw.js'));
if(hostedServiceWorkerResponse.status!==200||!(await hostedServiceWorkerResponse.text()).includes("url.pathname.startsWith('/api/')")){
  throw new Error('Hosted service worker could cache private API data.');
}
const invalidCatalogResponse=await hostedWorker.fetch(new Request('https://altered.audit/api/srd/catalog?domain=unknown'));
if(invalidCatalogResponse.status!==400||invalidCatalogResponse.headers.get('cache-control')!=='no-store'){
  throw new Error('Hosted SRD route validation or no-store policy failed.');
}
const missingResponse=await hostedWorker.fetch(new Request('https://altered.audit/not-a-route'));
if(missingResponse.status!==404)throw new Error('Hosted route allowlist failed.');

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,stable(item)]));
  return value;
}
function digest(value){return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');}

const snapshot=ledger.rulesAuditSnapshot();
const content=registry.CONTENT_PACKS.map(pack=>({
  id:pack.metadata.id,
  domain:pack.metadata.domain,
  version:pack.metadata.version,
  ruleset:pack.metadata.ruleset,
  verified:pack.metadata.verified,
  records:Object.keys(pack.records).length,
  sha256:digest(pack.records)
}));
const evidence={
  artifact:'Altered D&D 5e 2024 rules audit evidence',
  version:pkg.version,
  generatedAt:new Date().toISOString(),
  rules:{...snapshot,ledgerSha256:digest(ledger.RULE_LEDGER)},
  content:{packs:content,totalRecords:content.reduce((sum,pack)=>sum+pack.records,0),manifestSha256:digest(content)},
  interactionMatrix:ledger.FUNCTION_INVENTORY.map(entry=>({functionId:entry.id,ruleIds:entry.ruleIds,stateRead:entry.stateRead,stateChanged:entry.stateChanged,failureStates:entry.failureStates})),
  verification:{
    command:'npm run audit',
    result:'passed before this artifact was generated',
    scope:['TypeScript strict typecheck','Node rules-engine and schema tests','content registry and provenance tests','executable desktop and phone browser startup','hosted PWA and proxy runtime','static UI, storage, and security contract tests']
  },
  legalBoundary:'SRD 5.2.1 mechanics are redistributable under CC BY 4.0. Public and user-owned D&D Beyond data is normalized for private use without copying paid descriptive text.'
};

await writeFile(resolve('AUDIT_EVIDENCE.json'),`${JSON.stringify(evidence,null,2)}\n`,'utf8');
console.log(`Wrote AUDIT_EVIDENCE.json with ${snapshot.rules} rules, ${snapshot.functions} functions, and ${evidence.content.totalRecords} content records.`);
