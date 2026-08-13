import test from 'node:test';
import assert from 'node:assert/strict';
import {DDB_FEAT_SELECTION_EVIDENCE,migratePersistedCharacter} from '../src/data-migrations.js';
import {parseCharacter} from '../src/schema.js';

function character(sourceId='152187683',evidence:string[]=[]){
  return parseCharacter({schemaVersion:1,id:`ddb-${sourceId}`,name:'Ferocitus',species:'Goliath',creatureType:'Humanoid',size:'Medium',totalLevel:1,classes:[{name:'Druid',level:1}],abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},hp:{current:10,max:10},ac:10,speed:30,proficiencies:{saves:{},skills:{}},knownForms:[],seenForms:[],spells:[],spellSlots:{},feats:['Tough','Dark Bargain'],features:[],resources:[],equipment:{armorCategory:'none',shield:false,transformBehavior:'merge'},items:[],provenance:{provider:'dndbeyond',sourceId,ruleset:'2024',rulesetEvidence:evidence,reviewRequired:false},customForms:[]});
}

test('repairs the known unfinished feat in an older saved Ferocitus import',()=>{
  const result=migratePersistedCharacter(character());
  assert.deepEqual(result.character.feats,['Tough']);assert.equal(result.repairs.length,1);
});

test('does not remove feats from other characters or newly verified imports',()=>{
  assert.deepEqual(migratePersistedCharacter(character('999999999')).character.feats,['Tough','Dark Bargain']);
  assert.deepEqual(migratePersistedCharacter(character('152187683',[DDB_FEAT_SELECTION_EVIDENCE])).character.feats,['Tough','Dark Bargain']);
});
