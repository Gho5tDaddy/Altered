import test from 'node:test';
import assert from 'node:assert/strict';
import {FEROCITUS_CHARACTER} from '../src/ferocitus-data.js';
import {parseCharacter} from '../src/schema.js';
import {availableTransformations,createInitialState} from '../src/engine.js';

test('fresh standalone data opens with a complete Ferocitus character',()=>{
  const character=parseCharacter(FEROCITUS_CHARACTER);
  assert.equal(character.id,'ddb-152187683');
  assert.equal(character.name,'Ferocitus');
  assert.equal(character.hp.max,80);
  assert.deepEqual(character.classes.map(entry=>[entry.name,entry.level,entry.subclass]),[
    ['Barbarian',1,null],
    ['Druid',5,'Circle of the Moon'],
  ]);
  assert.equal(character.resources.find(resource=>resource.id==='wild-shape')?.current,2);
  assert.equal(character.resources.find(resource=>resource.id==='rage')?.current,2);
  assert.equal(character.feats.includes('Dark Bargain'),false);
  assert.equal(character.items.length,15);
  assert.ok(character.items.some(item=>item.name==='Cloak of Protection'&&item.effects?.some(effect=>effect.kind==='armor-class')));
  assert.ok(character.items.some(item=>item.name==='Greataxe'&&item.equipped&&item.attack));
  assert.deepEqual(character.knownForms,[
    'brown-bear','dire-wolf','giant-octopus','giant-spider','lion','tiger',
  ]);
  const options=availableTransformations(character,createInitialState(character));
  for(const label of ['Brown Bear','Dire Wolf','Giant Octopus','Giant Spider','Lion','Tiger']){
    assert.ok(options.some(option=>option.label===label),`${label} should be available`);
  }
});
