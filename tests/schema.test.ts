import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCharacter,safeJsonParse} from '../src/schema.js';

const base={name:'Safe',species:'Human',classes:[{name:'Druid',level:2}],abilities:{str:10,dex:10,con:10,int:10,wis:16,cha:10},hp:{current:12,max:12},ac:13,speed:30,proficiencies:{saves:['int','wis'],skills:['Perception']},knownForms:['cat'],seenForms:['cat'],spells:[],spellSlots:{},feats:[],features:[],equipment:{armorCategory:'none',shield:false,transformBehavior:'merge'}};

test('normalizes a valid character and adds core resources',()=>{const c=parseCharacter(base);assert.equal(c.totalLevel,2);assert.equal(c.resources.find(r=>r.id==='wild-shape')?.max,2)});
test('merges legacy Monk Focus aliases into one authoritative resource without restoring spent points',()=>{const c=parseCharacter({...base,classes:[{name:'Monk',level:6}],knownForms:[],seenForms:[],resources:[{id:'focus',name:'Focus Points',current:6,max:6,recovery:'short-all'},{id:'focus-points',name:'Focus Points',current:4,max:6,recovery:'short-all'}]});assert.deepEqual(c.resources.filter(resource=>resource.name==='Focus Points'),[{id:'focus-points',name:'Focus Points',current:4,max:6,recovery:'short-all'}]);});
test('preserves validated Pact Magic tracking metadata and rejects incomplete or unsafe slot metadata',()=>{
  const c=parseCharacter({...base,classes:[{name:'Warlock',level:5}],knownForms:[],seenForms:[],resources:[{id:'pact-slots',name:'Pact Magic Slots (Level 3)',current:1,max:2,recovery:'short-all',kind:'pact-magic-slots',slotLevel:3,source:'data.pactMagic[2]'}]});
  assert.deepEqual(c.resources.find(resource=>resource.id==='pact-magic-slots'),{id:'pact-magic-slots',name:'Pact Magic Slots (Level 3)',current:1,max:2,recovery:'short-all',kind:'pact-magic-slots',slotLevel:3,source:'data.pactMagic[2]'});
  assert.throws(()=>parseCharacter({...base,resources:[{id:'pact-magic-slots',name:'Pact Magic',current:1,max:2,recovery:'short-all',kind:'pact-magic-slots'}]}),/slotLevel/);
  assert.throws(()=>parseCharacter({...base,resources:[{id:'pact-magic-slots',name:'Pact Magic',current:1,max:2,recovery:'long-all',kind:'pact-magic-slots',slotLevel:3}]}),/short-all/);
});
test('rejects mismatched total level',()=>assert.throws(()=>parseCharacter({...base,totalLevel:3}),/does not equal/));
test('rejects unsafe damage expressions',()=>assert.throws(()=>parseCharacter({...base,spells:[{name:'Bad',level:1,sourceClass:'Druid',ability:'wis',castingTime:'magic-action',damage:[{expression:'1d6;alert(1)',type:'Fire'}]}]}),/safe dice expression/));
test('rejects unknown damage types',()=>assert.throws(()=>parseCharacter({...base,spells:[{name:'Bad',level:1,sourceClass:'Druid',ability:'wis',castingTime:'magic-action',damage:[{expression:'1d6',type:'Laser'}]}]}),/supported damage type/));
test('safeJsonParse enforces size limit',()=>assert.throws(()=>safeJsonParse(' '.repeat(1_000_001)),/1 MB/));

test('preserves validated automatic-action choices and rejects invented resolution modes',()=>{
  const form={id:'choice-form',name:'Choice Form',type:'Beast',cr:1,size:'Medium',ac:12,hp:10,hitDice:'2d8',abilities:{str:10,dex:14,con:10,int:3,wis:12,cha:6},saves:{},skills:{Stealth:4},speeds:{walk:30},senses:[],resistances:[],immunities:[],vulnerabilities:[],traits:[],actions:[{id:'escape',name:'Escape',type:'automatic',cost:'bonus',choices:[{id:'hide',label:'Hide',resolution:'hide',skill:'Stealth',prerequisite:'Out of sight.'}]}],source:{ruleset:'Private',page:'Fixture',verified:'Test'}};
  const parsed=parseCharacter({...base,customForms:[form]});const action=parsed.customForms['choice-form']?.actions[0];assert.equal(action?.type,'automatic');if(action?.type==='automatic')assert.equal(action.choices?.[0]?.resolution,'hide');
  assert.throws(()=>parseCharacter({...base,customForms:[{...form,actions:[{...form.actions[0],choices:[{id:'bad',label:'Bad',resolution:'teleport-anywhere'}]}]}]}),/resolution is unsupported/);
});

test('preserves structured item effects without accepting arbitrary effect kinds',()=>{
  const c=parseCharacter({...base,items:[{id:'cloak',name:'Cloak',type:'Wondrous item',equipped:true,attuned:true,requiresAttunement:true,ruleset:'2024',sourceIds:[],mechanics:'included-in-imported-totals',effects:[{kind:'armor-class',value:1,includedInImportedTotals:true}]}]});
  assert.deepEqual(c.items[0]?.effects,[{kind:'armor-class',value:1,includedInImportedTotals:true}]);
  assert.throws(()=>parseCharacter({...base,items:[{id:'bad',name:'Bad',type:'Item',equipped:true,attuned:false,requiresAttunement:false,ruleset:'2024',sourceIds:[],mechanics:'reference-only',effects:[{kind:'execute-code',value:1}]}]}),/unsupported/);
});

test('preserves name-only D&D Beyond feature origins and pact-weapon evidence without inferring an attack ability',()=>{
  const c=parseCharacter({...base,features:[{id:'ddb-invocation-1',name:'Owned Invocation',source:'D&D Beyond selected Eldritch Invocation',summary:'Name only.',automation:'reference',origin:{provider:'dndbeyond',kind:'eldritch-invocation',sourceIds:['definition:1']}}],items:[{id:'hammer',name:'Light Hammer',type:'Weapon',equipped:true,attuned:false,requiresAttunement:false,ruleset:'2024',sourceIds:['701'],mechanics:'reference-only',pactWeapon:{provider:'dndbeyond',evidence:['data.characterValues[0].typeId=28']}}]});
  assert.deepEqual(c.features[0]?.origin,{provider:'dndbeyond',kind:'eldritch-invocation',sourceIds:['definition:1']});
  assert.deepEqual(c.items[0]?.pactWeapon,{provider:'dndbeyond',evidence:['data.characterValues[0].typeId=28']});
  assert.equal(c.items[0]?.pactWeapon?.attackAbility,undefined);
  assert.throws(()=>parseCharacter({...base,items:[{id:'bad',name:'Bad',type:'Weapon',equipped:true,attuned:false,requiresAttunement:false,ruleset:'2024',sourceIds:[],mechanics:'reference-only',pactWeapon:{provider:'local',evidence:['guess']}}]}),/pactWeapon is unsupported/);
});

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

test('validates guided roll substitutions and activation save actions',()=>{
  const c=parseCharacter({...base,transformationGrants:[{id:'astral',label:'Astral Arms',profile:'overlay',formIds:[],source:'Fixture',actionCost:'bonus',effects:{checkAbilitySubstitution:{str:'wis'},saveAbilitySubstitution:{str:'wis'},skillAdvantage:['Insight'],activationActions:[{id:'summon',name:'Summon effect',type:'save',cost:'none',saveAbility:'dex',dc:14,damageOnFail:[{expression:'2d8',type:'Force'}]}]}}]});const effects=c.transformationGrants?.[0]?.effects;assert.deepEqual(effects?.checkAbilitySubstitution,{str:'wis'});assert.deepEqual(effects?.skillAdvantage,['Insight']);assert.equal(effects?.activationActions?.[0]?.type,'save');
  assert.throws(()=>parseCharacter({...base,transformationGrants:[{id:'bad-override',label:'Bad Override',profile:'overlay',formIds:[],source:'Fixture',actionCost:'bonus',effects:{attackAbilityOverride:{ability:'wis',appliesTo:['spell']}}}]}),/attackAbilityOverride\.appliesTo/);
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

test('validates attack riders, save choices, and Multiattack variants in private forms',()=>{
  const form={id:'tactical',name:'Tactical Beast',type:'Beast',cr:1,size:'Large',ac:12,hp:20,hitDice:'3d10+3',abilities:{str:16,dex:12,con:12,int:4,wis:10,cha:6},saves:{},skills:{},speeds:{walk:40},senses:[],resistances:[],immunities:[],vulnerabilities:[],traits:[],actions:[
    {id:'multiattack',name:'Multiattack',type:'multiattack',cost:'action',sequence:['ram','ram'],variants:[{id:'ram-shove',label:'Ram + Shove',sequence:['ram','shove']}]},
    {id:'ram',name:'Ram',type:'attack',cost:'action',attackBonus:5,ability:'str',kind:'beast',damage:[{expression:'1d6+3',type:'Bludgeoning'}],riders:[{id:'charge',label:'Charge',prerequisite:'Moved 20 feet straight.',damage:[{expression:'2d4',type:'Bludgeoning'}],effects:[{condition:'Prone',targetSizeMax:'Large'}]}]},
    {id:'shove',name:'Shove',type:'save',cost:'action',saveAbility:'str',saveAbilityOptions:['str','dex'],dc:13,effectsOnFail:[{condition:'Prone'}]},
  ],source:{ruleset:'Private',page:'Fixture',verified:'Test'}};
  const parsed=parseCharacter({...base,customForms:[form]});const actions=parsed.customForms.tactical?.actions??[];
  const ram=actions.find(action=>action.id==='ram');assert.equal(ram?.type,'attack');if(ram?.type==='attack')assert.equal(ram.riders?.[0]?.damage?.[0]?.expression,'2d4');
  const shove=actions.find(action=>action.id==='shove');assert.equal(shove?.type,'save');if(shove?.type==='save')assert.deepEqual(shove.saveAbilityOptions,['str','dex']);
  const multi=actions.find(action=>action.id==='multiattack');assert.equal(multi?.type,'multiattack');if(multi?.type==='multiattack')assert.deepEqual(multi.variants?.[0]?.sequence,['ram','shove']);
});
