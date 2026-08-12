import test from 'node:test';
import assert from 'node:assert/strict';
import {applyOwnedContentPack,matchesOwnedContentPack,ownedContentTemplate,parseOwnedContentPack,privateMechanicPack} from '../src/owned-content.js';
import {parseCharacter} from '../src/schema.js';
import {SAMPLE_CHARACTERS} from '../src/sample-data.js';

const moon=parseCharacter(SAMPLE_CHARACTERS[0]);

test('private owned-content template validates and applies to its character',()=>{
  const pack=parseOwnedContentPack(ownedContentTemplate(moon));
  assert.equal(matchesOwnedContentPack(moon,pack),true);
  const result=applyOwnedContentPack(moon,pack);
  assert.equal(result.applied,true);
  assert.equal(result.added.transformations,1);
  assert.ok(result.character.transformationGrants?.some(grant=>grant.id==='example-transformation'));
});

test('compact private mechanic completion remains schema-v1 character-local data',()=>{
  const pack=privateMechanicPack(moon,{packId:'ddb-123-paid-feature',name:'Paid Feature',source:'D&D Beyond character 123 — user-confirmed',summary:'Add 10 feet to Speed while this feature is available.',mode:'speed',speedBonus:10,retainInWildShape:true,activation:'none'});
  assert.equal(pack.schemaVersion,1);assert.deepEqual(pack.appliesTo,[{characterId:moon.id}]);assert.equal(pack.content.features[0]?.grants?.speedBonus,10);assert.equal(pack.content.features[0]?.retention?.wildshape,true);
  const result=applyOwnedContentPack(moon,pack);assert.equal(result.applied,true);assert.equal(result.added.features,1);
});

test('subclass matching is case-insensitive and level-aware',()=>{
  const pack=parseOwnedContentPack({
    schemaVersion:1,kind:'altered-owned-content-pack',metadata:{id:'moon-private',name:'Moon Private',version:'1.0.0',source:'Owned book',privateUse:true},
    appliesTo:[{className:'druid',subclass:'circle of the moon',minimumClassLevel:6}],
    content:{customForms:[],transformationGrants:[{id:'moon-overlay',label:'Moon Overlay',profile:'overlay',formIds:[],source:'Owned book',actionCost:'bonus',effects:{acBonus:1}}],features:[],resources:[],spells:[]}
  });
  assert.equal(matchesOwnedContentPack(moon,pack),true);
});

test('private custom form and transformation grant merge into a character',()=>{
  const pack=parseOwnedContentPack({
    schemaVersion:1,kind:'altered-owned-content-pack',metadata:{id:'undead-private',name:'Undead Private',version:'1.0.0',source:'Owned book',privateUse:true},
    appliesTo:[{characterId:moon.id}],
    content:{
      customForms:[{id:'private-shadow-form',name:'Private Shadow Form',type:'Undead',cr:5,size:'Medium',ac:16,hp:60,hitDice:'8d8+24',abilities:{str:16,dex:14,con:16,int:10,wis:12,cha:14},saves:{},skills:{},speeds:{walk:30},senses:['Darkvision 60 ft.'],resistances:['Necrotic'],immunities:[],vulnerabilities:[],traits:[],actions:[],source:{ruleset:'Private owned content',page:'Owned book',verified:'User-entered'}}],
      transformationGrants:[{id:'private-shadow',label:'Private Shadow Form',profile:'custom',formIds:['private-shadow-form'],source:'Owned book',actionCost:'bonus',endActionCost:'bonus',duration:'10 minutes'}],features:[],resources:[],spells:[]
    }
  });
  const result=applyOwnedContentPack(moon,pack);
  assert.equal(result.character.customForms['private-shadow-form']?.type,'Undead');
  assert.ok(result.character.transformationGrants?.some(grant=>grant.id==='private-shadow'));
});

test('nonmatching private packs do not alter the character',()=>{
  const pack=parseOwnedContentPack({
    schemaVersion:1,kind:'altered-owned-content-pack',metadata:{id:'wizard-only',name:'Wizard Only',version:'1.0.0',source:'Owned book',privateUse:true},
    appliesTo:[{className:'Wizard'}],content:{customForms:[],transformationGrants:[{id:'wizard-overlay',label:'Wizard Overlay',profile:'overlay',formIds:[],source:'Owned book',actionCost:'action',effects:{acBonus:1}}],features:[],resources:[],spells:[]}
  });
  const result=applyOwnedContentPack(moon,pack);
  assert.equal(result.applied,false);
  assert.equal(result.character,moon);
});

test('owned-content packs must explicitly be private-use data',()=>{
  assert.throws(()=>parseOwnedContentPack({schemaVersion:1,kind:'altered-owned-content-pack',metadata:{id:'bad',name:'Bad',version:'1',source:'Unknown',privateUse:false},appliesTo:[{}],content:{customForms:[],transformationGrants:[{id:'x',label:'X',profile:'overlay',formIds:[],source:'Unknown',actionCost:'action',effects:{acBonus:1}}],features:[],resources:[],spells:[]}}),/privateUse/);
});

test('owned packs merge known and seen form references for private transformations',()=>{
  const pack=parseOwnedContentPack({schemaVersion:1,kind:'altered-owned-content-pack',metadata:{id:'private-form-lists',name:'Private Form Lists',version:'1.0.0',source:'Owned book',privateUse:true},appliesTo:[{characterId:moon.id}],content:{customForms:[{id:'private-beast',name:'Private Beast',type:'Beast',cr:1,size:'Medium',ac:13,hp:18,hitDice:'4d8',abilities:{str:14,dex:14,con:12,int:3,wis:12,cha:6},saves:{},skills:{},speeds:{walk:40},senses:[],resistances:[],immunities:[],vulnerabilities:[],traits:[],actions:[],source:{ruleset:'Private',page:'Owned book',verified:'User-entered'}}],knownForms:['private-beast'],seenForms:['private-beast'],transformationGrants:[],features:[],resources:[],spells:[]}});
  const moonWithRoom=parseCharacter({...moon,knownForms:moon.knownForms.slice(0,5),customForms:Object.values(moon.customForms)});const result=applyOwnedContentPack(moonWithRoom,pack);assert.equal(result.added.knownForms,1);assert.equal(result.added.seenForms,1);assert.ok(result.character.knownForms.includes('private-beast'));assert.ok(result.character.seenForms.includes('private-beast'));
});
