import test from 'node:test';
import assert from 'node:assert/strict';
import {DDB_FEAT_SELECTION_EVIDENCE,migratePersistedCharacter} from '../src/data-migrations.js';
import {parseCharacter} from '../src/schema.js';

function character(sourceId='152187683',evidence:string[]=[],provider:'local'|'dndbeyond'='dndbeyond'){
  return parseCharacter({schemaVersion:1,id:`ddb-${sourceId}`,name:'Ferocitus',species:'Goliath',creatureType:'Humanoid',size:'Medium',totalLevel:1,classes:[{name:'Druid',level:1}],abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},hp:{current:10,max:10},ac:10,speed:30,proficiencies:{saves:{},skills:{}},knownForms:[],seenForms:[],spells:[],spellSlots:{},feats:['Tough','Dark Bargain'],features:[],resources:[],equipment:{armorCategory:'none',shield:false,transformBehavior:'merge'},items:[{id:'axe-1',name:'Handaxe',type:'Weapon',equipped:true,attuned:false,requiresAttunement:false,ruleset:'2024',sourceIds:[],mechanics:'included-in-imported-totals'}],provenance:{provider,...(provider==='dndbeyond'?{sourceId}:{}),ruleset:'2024',rulesetEvidence:evidence,reviewRequired:false},customForms:[]});
}

test('repairs the known unfinished feat in an older saved Ferocitus import',()=>{
  const result=migratePersistedCharacter(character());
  assert.deepEqual(result.character.feats,['Tough']);assert.equal(result.repairs.length,2);
  assert.equal(result.character.items[0]?.attack?.damage,'1d6');
  const bundledResult=migratePersistedCharacter(character('152187683',[],'local'));
  assert.deepEqual(bundledResult.character.feats,['Tough']);assert.equal(bundledResult.repairs.length,2);
  assert.equal(bundledResult.character.items[0]?.attack?.range,20);
});

test('does not remove feats from other characters or newly verified imports',()=>{
  assert.deepEqual(migratePersistedCharacter(character('999999999')).character.feats,['Tough','Dark Bargain']);
  const verified=migratePersistedCharacter(character('152187683',[DDB_FEAT_SELECTION_EVIDENCE]));
  assert.deepEqual(verified.character.feats,['Tough','Dark Bargain']);
  assert.equal(verified.character.items[0]?.attack?.damage,'1d6');
});

test('does not seed owner inventory into empty or unrelated character saves',()=>{
  const ferocitus=character();ferocitus.items=[];const repaired=migratePersistedCharacter(ferocitus);assert.equal(repaired.character.items.length,0);
  const other=character('999999999');other.items=[];assert.equal(migratePersistedCharacter(other).character.items.length,0);
});
