import assert from 'node:assert/strict';
import test from 'node:test';
import {FUNCTION_INVENTORY,RULE_LEDGER,ruleById,rulesAuditSnapshot} from '../src/audit-ledger.js';

test('rules ledger has unique, traceable entries for every executable behavior',()=>{
  const ids=new Set<string>();
  for(const entry of RULE_LEDGER){
    assert.ok(!ids.has(entry.id),`duplicate rule ${entry.id}`);ids.add(entry.id);
    assert.ok(entry.source.url.startsWith('https://'));
    assert.ok(entry.source.ruleset.includes('2024'));
    assert.match(entry.reviewed,/^\d{4}-\d{2}-\d{2}$/);
    if(entry.automation==='calculated'||entry.automation==='conditional'){
      assert.ok(entry.implementation.length>0,`${entry.id} has no implementation reference`);
      assert.ok(entry.tests.length>0,`${entry.id} has no test reference`);
    }
  }
});

test('function inventory maps every state-changing surface to ledger rules',()=>{
  const ids=new Set<string>();
  for(const entry of FUNCTION_INVENTORY){
    assert.ok(!ids.has(entry.id),`duplicate function ${entry.id}`);ids.add(entry.id);
    assert.ok(entry.stateRead.length>0);
    assert.ok(entry.ruleIds.length>0);
    for(const ruleId of entry.ruleIds)assert.ok(ruleById(ruleId),`${entry.id} references missing ${ruleId}`);
  }
});

test('all twelve 2024 base classes have an audit entry',()=>{
  const expected=['barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard'];
  for(const name of expected)assert.ok(ruleById(`class.${name}`),`missing ${name}`);
});

test('audit snapshot reports every automation state and rules domain',()=>{
  const snapshot=rulesAuditSnapshot();
  assert.equal(snapshot.rules,RULE_LEDGER.length);
  assert.equal(snapshot.functions,FUNCTION_INVENTORY.length);
  assert.equal(Object.values(snapshot.counts).reduce((sum,value)=>sum+value,0),snapshot.rules);
  assert.equal(Object.values(snapshot.domains).reduce((sum,value)=>sum+value,0),snapshot.rules);
});
