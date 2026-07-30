import test from 'node:test';
import assert from 'node:assert/strict';
import {CREATURES} from '../src/content-registry.js';

test('every bundled creature has current provenance and valid action references',()=>{
  for(const creature of Object.values(CREATURES)){
    assert.match(creature.source.ruleset,/2024/);
    assert.match(creature.source.verified,/^2026-07-30$/);
    const ids=new Set<string>();
    for(const action of creature.actions){assert.ok(!ids.has(action.id),`${creature.name} repeats action id ${action.id}`);ids.add(action.id);}
    for(const action of creature.actions){
      if(action.type==='multiattack'){
        for(const id of action.sequence)assert.ok(ids.has(id),`${creature.name} Multiattack references missing ${id}`);
        for(const variant of action.variants??[])for(const id of variant.sequence)assert.ok(ids.has(id),`${creature.name} Multiattack variant references missing ${id}`);
      }
      if(action.type==='attack'){const riderIds=new Set<string>();for(const rider of action.riders??[]){assert.ok(!riderIds.has(rider.id),`${creature.name} ${action.name} repeats rider ${rider.id}`);riderIds.add(rider.id);}}
    }
  }
});

test('all creature numeric values remain within safe app bounds',()=>{
  for(const creature of Object.values(CREATURES)){
    assert.ok(creature.ac>=1&&creature.ac<=40);
    assert.ok(creature.hp>=1&&creature.hp<=5000);
    assert.ok(creature.cr>=0&&creature.cr<=30);
    for(const score of Object.values(creature.abilities))assert.ok(score>=1&&score<=30);
  }
});
