import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCharacter,safeJsonParse} from '../src/schema.js';

const base={name:'Safe',species:'Human',classes:[{name:'Druid',level:2}],abilities:{str:10,dex:10,con:10,int:10,wis:16,cha:10},hp:{current:12,max:12},ac:13,speed:30,proficiencies:{saves:['int','wis'],skills:['Perception']},knownForms:['cat'],seenForms:['cat'],spells:[],spellSlots:{},feats:[],features:[],equipment:{armorCategory:'none',shield:false,transformBehavior:'merge'}};

test('normalizes a valid character and adds core resources',()=>{const c=parseCharacter(base);assert.equal(c.totalLevel,2);assert.equal(c.resources.find(r=>r.id==='wild-shape')?.max,2)});
test('rejects mismatched total level',()=>assert.throws(()=>parseCharacter({...base,totalLevel:3}),/does not equal/));
test('rejects unsafe damage expressions',()=>assert.throws(()=>parseCharacter({...base,spells:[{name:'Bad',level:1,sourceClass:'Druid',ability:'wis',castingTime:'magic-action',damage:[{expression:'1d6;alert(1)',type:'Fire'}]}]}),/safe dice expression/));
test('rejects unknown damage types',()=>assert.throws(()=>parseCharacter({...base,spells:[{name:'Bad',level:1,sourceClass:'Druid',ability:'wis',castingTime:'magic-action',damage:[{expression:'1d6',type:'Laser'}]}]}),/supported damage type/));
test('safeJsonParse enforces size limit',()=>assert.throws(()=>safeJsonParse(' '.repeat(1_000_001)),/1 MB/));

test('rejects unknown spell action costs instead of silently defaulting',()=>assert.throws(()=>parseCharacter({...base,spells:[{name:'Bad Timing',level:1,sourceClass:'Druid',ability:'wis',castingTime:'instant'}]}),/castingTime must be one of/));

test('rejects unsafe healing expressions',()=>assert.throws(()=>parseCharacter({...base,spells:[{name:'Bad Healing',level:1,sourceClass:'Druid',ability:'wis',castingTime:'magic-action',healing:'2d8+alert(1)'}]}),/healing is not a safe dice expression/));

test('validates explicit spell resolution modes',()=>{
  const parsed=parseCharacter({...base,spells:[{name:'Magic Dart',level:1,sourceClass:'Wizard',ability:'int',castingTime:'magic-action',damage:[{expression:'3d4+3',type:'Force'}],resolution:'automatic'}]});
  assert.equal(parsed.spells[0]?.resolution,'automatic');
  assert.throws(()=>parseCharacter({...base,spells:[{name:'Bad Mode',level:1,sourceClass:'Wizard',ability:'int',castingTime:'magic-action',resolution:'guess'}]}),/resolution is unsupported/);
});

test('parses structured feature grants without converting arbitrary prose',()=>{
  const c=parseCharacter({...base,features:[{
    id:'test-aura',name:'Test Aura',source:'Fixture',summary:'Structured test fixture.',
    retention:{wildshape:true},
    grants:{speedBonus:10,resistances:['Cold','Fire'],saveBonusAbility:'con',saveBonusFromAbility:'wis',acFormula:{base:10,abilities:['dex','wis']}}
  }]});
  const grants=c.features[0]?.grants;
  assert.equal(grants?.speedBonus,10);
  assert.deepEqual(grants?.resistances,['Cold','Fire']);
  assert.equal(grants?.saveBonusAbility,'con');
  assert.deepEqual(grants?.acFormula,{base:10,abilities:['dex','wis']});
});

test('rejects unsupported custom transformation profiles',()=>assert.throws(()=>parseCharacter({...base,transformationGrants:[{id:'bad',label:'Bad',profile:'anything',formIds:['cat'],source:'Fixture',actionCost:'action'}]}),/profile is unsupported/));

test('class and spell matching accept ordinary case differences without losing mechanics',()=>{
  const c=parseCharacter({...base,classes:[{name:'dRuId',level:2}],spells:[{name:'pOlYmOrPh',level:4,sourceClass:'druid',ability:'wis',prepared:true,castingTime:'magic-action',concentration:true}],spellSlots:{'4':{current:1,max:1}}});
  assert.equal(c.classes[0]?.name,'Druid');assert.equal(c.spells[0]?.name,'pOlYmOrPh');
});


test('mixed-case classes, subclasses, species, and creature types retain their mechanics',()=>{
  const c=parseCharacter({...base,species:'gOLiaTh',classes:[{name:'dRuId',level:3,subclass:'circle OF THE moon'}],knownForms:['dire-wolf'],seenForms:['dire-wolf'],customForms:[{id:'lower-undead',name:'Lower Undead',type:'undead',cr:1,size:'Medium',ac:12,hp:10,hitDice:'2d8',abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},saves:{},skills:{},speeds:{walk:30},senses:[],resistances:[],immunities:[],vulnerabilities:[],traits:[],actions:[],source:{ruleset:'Private',page:'Fixture',verified:'Test'}}]});
  assert.equal(c.classes[0]?.name,'Druid');assert.equal(c.species,'Goliath');assert.equal(c.customForms['lower-undead']?.type,'Undead');assert.equal(c.resources.some(resource=>resource.id==='wild-shape'),true);
});


test('adds executable SRD transformation resources and grants for Dragonborn and Draconic Sorcery',()=>{
  const dragonborn=parseCharacter({...base,species:'Dragonborn',classes:[{name:'Fighter',level:5}],knownForms:[],seenForms:[]});assert.equal(dragonborn.resources.find(resource=>resource.id==='dragonborn-draconic-flight')?.max,1);assert.equal(dragonborn.transformationGrants?.some(grant=>grant.id==='dragonborn-draconic-flight'),true);
  const sorcerer=parseCharacter({...base,classes:[{name:'Sorcerer',level:14,subclass:'Draconic Sorcery'}],knownForms:[],seenForms:[]});assert.equal(sorcerer.resources.find(resource=>resource.id==='sorcery-points')?.max,14);assert.equal(sorcerer.resources.find(resource=>resource.id==='sorcerer-dragon-wings')?.max,1);assert.equal(sorcerer.transformationGrants?.some(grant=>grant.id==='sorcerer-dragon-wings'),true);
});

test('validates dynamic speed links and incapacitation endings in private transformations',()=>{
  const c=parseCharacter({...base,transformationGrants:[{id:'winged',label:'Winged',profile:'overlay',formIds:[],source:'Fixture',actionCost:'bonus',effects:{speedEqualToWalk:['fly'],endsOnIncapacitated:true}}]});assert.deepEqual(c.transformationGrants?.[0]?.effects?.speedEqualToWalk,['fly']);assert.equal(c.transformationGrants?.[0]?.effects?.endsOnIncapacitated,true);
  assert.throws(()=>parseCharacter({...base,transformationGrants:[{id:'bad-speed',label:'Bad Speed',profile:'overlay',formIds:[],source:'Fixture',actionCost:'bonus',effects:{speedEqualToWalk:['teleport']}}]}),/speedEqualToWalk/);
});

test('rejects inverted recharge ranges in imported creature actions',()=>{
  const badForm={id:'bad-recharge',name:'Bad Recharge',type:'Beast',cr:1,size:'Medium',ac:12,hp:10,hitDice:'2d8',abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},saves:{},skills:{},speeds:{walk:30},senses:[],resistances:[],immunities:[],vulnerabilities:[],traits:[],actions:[{id:'burst',name:'Burst',type:'save',cost:'action',saveAbility:'dex',dc:12,recharge:{min:6,max:5}}],source:{ruleset:'Private',page:'Fixture',verified:'Test'}};
  assert.throws(()=>parseCharacter({...base,customForms:[badForm]}),/recharge\.min must not exceed recharge\.max/);
});

test('validates imported creature action-use limits',()=>{
  const limitedForm={id:'limited',name:'Limited',type:'Beast',cr:1,size:'Medium',ac:12,hp:10,hitDice:'2d8',abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},saves:{},skills:{},speeds:{walk:30},senses:[],resistances:[],immunities:[],vulnerabilities:[],traits:[],actions:[{id:'burst',name:'Burst',type:'automatic',cost:'action',uses:{max:1,recovery:'long'}}],source:{ruleset:'Private',page:'Fixture',verified:'Test'}};
  const parsed=parseCharacter({...base,customForms:[limitedForm]});const action=parsed.customForms.limited?.actions[0];assert.equal(action?.type,'automatic');if(action?.type==='automatic')assert.deepEqual(action.uses,{max:1,recovery:'long'});
  assert.throws(()=>parseCharacter({...base,customForms:[{...limitedForm,actions:[{...limitedForm.actions[0],uses:{max:1,recovery:'short'}}]}]}),/uses\.recovery must be long/);
});
