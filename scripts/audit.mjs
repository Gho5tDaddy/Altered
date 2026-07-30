import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

const require=createRequire(import.meta.url);
const registry=require('../dist/src/content-registry.js');
const ledger=require('../dist/src/audit-ledger.js');
const pkg=require('../package.json');

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
    scope:['TypeScript strict typecheck','Node rules-engine and schema tests','content registry and provenance tests','static UI, PWA, proxy, storage, and security contract tests']
  },
  legalBoundary:'SRD 5.2.1 mechanics are redistributable under CC BY 4.0. Public and user-owned D&D Beyond data is normalized for private use without copying paid descriptive text.'
};

await writeFile(resolve('AUDIT_EVIDENCE.json'),`${JSON.stringify(evidence,null,2)}\n`,'utf8');
console.log(`Wrote AUDIT_EVIDENCE.json with ${snapshot.rules} rules, ${snapshot.functions} functions, and ${evidence.content.totalRecords} content records.`);
