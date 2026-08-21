import test from 'node:test';
import assert from 'node:assert/strict';
import type {AttackAction,Character} from '../src/types.js';
import {CLASS_FEATURES,CREATURES,SPECIES_FEATURES,SUBCLASS_FEATURES} from '../src/content-registry.js';
import {parseCharacter} from '../src/schema.js';
import {
  applyCondition,applyDamage,attackBonuses,attackRollSources,availableSpellCastingOptions,availableSpellSlotLevels,availableTransformations,boundedWhole,castSpell,completeTruePolymorph,concentrationCheckDc,concentrationSaveMode,createInitialState,criticalDiceExpression,criticalHitThreshold,deathSaveMode,declareRecklessAttack,
  actionExecutionError,addReceivedEffect,clearConditions,declareAttack,endConcentration,endReceivedEffect,endSpellEffect,endTransformation,endTurn,extendRage,extraAttackCount,heal,longRest,markActionRechargeUsed,markLimitedActionUsed,pendingActionRecharge,proficiencyBonus,remainingActionUses,removeCondition,resolveConcentrationCheck,resolveDeathSave,resolveRelentlessRage,resolveSheet,resolveTempHpChoice,restoreDragonWings,rollAttackD20,selectedOptionalDamagePackets,shortRest,spendActionCost,spendActionExecution,startCombat,startNewTurn,startOffTurnReactionWindow,startRage,startTransformation,useActionSurge,useLayOnHands,useSecondWind,useUncannyMetabolism,useWildResurgence,wildResurgenceError,wildShapeLimits
} from '../src/engine.js';

function must<T>(value:T|undefined):T{if(value===undefined)throw new Error('Expected value was missing.');return value}
function character(overrides:Record<string,unknown>={}):Character{
  const base:Record<string,unknown>={
    schemaVersion:1,id:'test',name:'Test Druid',species:'Human',
    classes:[{name:'Druid',level:6,subclass:'Circle of the Moon'},{name:'Barbarian',level:2}],
    abilities:{str:12,dex:14,con:16,int:10,wis:18,cha:8},hp:{current:60,max:60},ac:15,speed:30,
    proficiencies:{saves:{wis:1,int:1},skills:{Perception:1,Athletics:1}},
    knownForms:['dire-wolf','brown-bear','giant-spider','giant-constrictor-snake','polar-bear','giant-toad'],
    seenForms:['dire-wolf','brown-bear','giant-spider','giant-constrictor-snake','polar-bear','giant-toad'],
    spells:[
      {name:'Moonbeam',level:2,slotLevel:2,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'magic-action',concentration:true,damage:[{expression:'2d10',type:'Radiant'}]},
      {name:'Polymorph',level:4,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'magic-action',concentration:true},
      {name:'Shapechange',level:9,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'magic-action',concentration:true}
    ],
    spellSlots:{'2':{current:2,max:2},'4':{current:1,max:1},'9':{current:1,max:1}},
    feats:[],features:[],equipment:{armorCategory:'none',shield:false,transformBehavior:'merge'},
    ...overrides
  };
  if(Object.hasOwn(overrides,'classes')&&!Object.hasOwn(overrides,'knownForms'))base.knownForms=[];
  return parseCharacter(base);
}

test('verified 2024 creature golden values are locked',()=>{
  assert.equal(must(CREATURES.cat).size,'Tiny');
  assert.equal(must(CREATURES.panther).skills.Stealth,7);
  assert.equal(must(CREATURES['dire-wolf']).hp,22);
  assert.equal(must(CREATURES['dire-wolf']).ac,14);
  assert.equal(must(CREATURES['brown-bear']).abilities.dex,12);
  assert.equal(must(CREATURES['giant-spider']).hp,26);
  const web=must(CREATURES['giant-spider']).actions.find(a=>a.id==='web');
  assert.equal(web?.type,'save');
  assert.equal(web?.type==='save'?web.dc:0,13);
  const constrict=must(CREATURES['giant-constrictor-snake']).actions.find(a=>a.id==='constrict');
  assert.equal(constrict?.type,'save');
  assert.equal(constrict?.type==='save'?constrict.dc:0,14);
  assert.deepEqual(
    ['giant-octopus','lion','tiger'].map(id=>{const form=must(CREATURES[id]);return [form.id,form.cr,form.ac,form.hp]}),
    [['giant-octopus',1,11,45],['lion',1,12,22],['tiger',1,13,30]],
  );
});

test('every supported class, SRD subclass, and species resolves without conflicting feature ids',()=>{
  const subclassParents:Record<string,string>={'Path of the Berserker':'Barbarian','College of Lore':'Bard','Life Domain':'Cleric','Circle of the Land':'Druid',Champion:'Fighter','Warrior of the Open Hand':'Monk','Oath of Devotion':'Paladin',Hunter:'Ranger',Thief:'Rogue','Draconic Sorcery':'Sorcerer','Fiend Patron':'Warlock',Evoker:'Wizard'};
  for(const name of Object.keys(CLASS_FEATURES)){const c=character({name:`${name} audit`,classes:[{name,level:20}],totalLevel:20});const sheet=resolveSheet(c,createInitialState(c));assert.ok(sheet.features.some(feature=>feature.source===name),`${name} has no evaluated features`);assert.equal(new Set(sheet.features.map(feature=>feature.id)).size,sheet.features.length,`${name} repeats a feature id`);}
  for(const [subclass,name] of Object.entries(subclassParents)){assert.ok(SUBCLASS_FEATURES[subclass],`${subclass} is missing from the registry`);const c=character({name:`${subclass} audit`,classes:[{name,level:20,subclass}],totalLevel:20});const sheet=resolveSheet(c,createInitialState(c));for(const feature of SUBCLASS_FEATURES[subclass]??[])assert.ok(sheet.features.some(entry=>entry.id===feature.id),`${subclass} omits ${feature.name}`);}
  for(const species of Object.keys(SPECIES_FEATURES)){const c=character({name:`${species} audit`,species,classes:[{name:'Fighter',level:20}],totalLevel:20});const sheet=resolveSheet(c,createInitialState(c));for(const feature of SPECIES_FEATURES[species]??[])assert.ok(sheet.features.some(entry=>entry.id===feature.id),`${species} omits ${feature.name}`);}
});

test('every bundled form resolves through the strict Moon Druid eligibility path',()=>{
  for(const id of Object.keys(CREATURES)){const c=character({classes:[{name:'Druid',level:20,subclass:'Circle of the Moon'}],totalLevel:20,knownForms:[id],seenForms:[id]});const state=createInitialState(c);const option=availableTransformations(c,state).find(entry=>entry.profile==='wildshape'&&entry.formId===id);assert.ok(option,`${id} was not offered to an eligible level 20 Moon Druid`);assert.equal(option.usable,true,`${id} was incorrectly locked`);const transition=startTransformation(c,state,option);assert.match(transition.message,/transformed/i);const sheet=resolveSheet(c,state);assert.equal(sheet.form?.id,id);assert.ok(sheet.ac>0);assert.ok(Object.values(sheet.speeds).some(speed=>(speed??0)>0));}
});

test('Moon Druid legal forms use Druid level and known forms',()=>{
  const c=character();
  assert.deepEqual(wildShapeLimits(c),{known:6,maxCr:2,fly:false,moon:true});
  const state=createInitialState(c);
  const forms=availableTransformations(c,state).filter(o=>o.profile==='wildshape');
  assert.equal(forms.length,6);
  assert.ok(forms.some(f=>f.formId==='polar-bear'));
});

test('recharge actions remain unavailable until a qualifying start-of-turn roll',()=>{
  const c=character();const state=createInitialState(c);const spider=must(CREATURES['giant-spider']);const web=spider.actions.find(action=>action.id==='web');
  assert.ok(web?.type==='save');if(web.type!=='save')return;
  assert.equal(pendingActionRecharge(state,web),undefined);markActionRechargeUsed(state,web);assert.equal(pendingActionRecharge(state,web)?.min,5);
  const failed=startNewTurn(state,()=>4);assert.match(failed.message,/needs 5–6/);assert.ok(pendingActionRecharge(state,web));
  const passed=startNewTurn(state,()=>5);assert.match(passed.message,/recharged on 5/);assert.equal(pendingActionRecharge(state,web),undefined);
});

test('entering a new replacement form resets its recharge actions',()=>{
  const c=character();const state=createInitialState(c);const spider=must(CREATURES['giant-spider']);const web=spider.actions.find(action=>action.id==='web');
  assert.ok(web?.type==='save');if(web.type!=='save')return;markActionRechargeUsed(state,web);
  const wolf=availableTransformations(c,state).find(option=>option.formId==='dire-wolf'&&option.profile==='wildshape');assert.ok(wolf);startTransformation(c,state,wolf);
  assert.deepEqual(state.recharges,{});
});

test('per-day creature actions remain spent across form changes and reset on a Long Rest',()=>{
  const c=character();const state=createInitialState(c);
  const ink={id:'ink-cloud',name:'Ink Cloud',type:'automatic' as const,cost:'reaction' as const,uses:{max:1,recovery:'long' as const}};
  assert.equal(remainingActionUses(state,ink),1);markLimitedActionUsed(state,ink);assert.equal(remainingActionUses(state,ink),0);
  const wolf=availableTransformations(c,state).find(option=>option.formId==='dire-wolf'&&option.profile==='wildshape');assert.ok(wolf);startTransformation(c,state,wolf);
  assert.equal(remainingActionUses(state,ink),1); // keyed to the currently active transformation
  endTransformation(state,false,c);assert.equal(remainingActionUses(state,ink),0);
  longRest(c,state);assert.equal(remainingActionUses(state,ink),1);
});

test('Land Druid level 6 rejects illegal known forms and lists legal ones',()=>{
  assert.throws(()=>character({classes:[{name:'Druid',level:6,subclass:'Circle of the Land'}],totalLevel:6,knownForms:['black-bear','dire-wolf']}),/not a legal known Wild Shape form/);
  const c=character({classes:[{name:'Druid',level:6,subclass:'Circle of the Land'}],totalLevel:6,knownForms:['black-bear','giant-goat']});
  const forms=availableTransformations(c,createInitialState(c)).filter(o=>o.profile==='wildshape');
  assert.deepEqual(forms.map(f=>f.formId).sort(),['black-bear','giant-goat']);
});

test('Wild Shape merges mental scores, skills, saves, Moon AC, and Moon THP',()=>{
  const c=character();const state=createInitialState(c);
  const wolf=availableTransformations(c,state).find(o=>o.formId==='dire-wolf'&&o.profile==='wildshape');
  assert.ok(wolf);startTransformation(c,state,wolf);
  const sheet=resolveSheet(c,state);
  assert.equal(sheet.abilities.str,17);assert.equal(sheet.abilities.wis,18);
  assert.equal(sheet.ac,17);assert.equal(sheet.acSource,'Circle Forms');assert.equal(state.tempHp,18);
  assert.equal(must(sheet.skills.Perception).modifier,7); // retained proficiency uses current Wisdom and character PB
  assert.equal(sheet.saves.con.modifier,6); // beast Con +2, then Improved Circle Forms +4
});

test('Rage cannot share the same Bonus Action turn with Wild Shape and ends Concentration',()=>{
  const c=character();const state=createInitialState(c);
  state.concentration={name:'Moonbeam',source:'Druid'};
  const result=startRage(c,state);assert.match(result.message,/Rage started/);assert.equal(state.concentration,undefined);
  const wolf=availableTransformations(c,state).find(o=>o.formId==='dire-wolf'&&o.profile==='wildshape');
  assert.ok(wolf);const blocked=startTransformation(c,state,wolf);assert.match(blocked.message,/Bonus Action already used/);
});

test('failed transformation does not spend action or resource',()=>{
  const c=character();const state=createInitialState(c);must(state.resources['wild-shape']).current=0;
  const option={id:'x',label:'Dire Wolf',profile:'wildshape' as const,formId:'dire-wolf',source:'Wild Shape',actionCost:'bonus' as const,usable:true};
  const result=startTransformation(c,state,option);assert.match(result.message,/No Wild Shape/);
  assert.equal(state.turn.bonusRemaining,1);assert.equal(must(state.resources['wild-shape']).current,0);
});

test('switching Wild Shape directly is legal and spends another use',()=>{
  const c=character();const state=createInitialState(c);
  const options=availableTransformations(c,state);const wolf=options.find(o=>o.formId==='dire-wolf'&&o.profile==='wildshape');assert.ok(wolf);
  startTransformation(c,state,wolf);assert.equal(must(state.resources['wild-shape']).current,2);
  state.turn.bonusRemaining=1;
  const bear=availableTransformations(c,state).find(o=>o.formId==='brown-bear'&&o.profile==='wildshape');assert.ok(bear);
  state.tempHp=5;state.tempHpSource='Dire Wolf';const result=startTransformation(c,state,bear);assert.equal(result.choice,undefined);assert.equal(state.tempHp,18);assert.equal(state.tempHpSource,'Brown Bear');assert.equal(state.activeTransform?.option.formId,'brown-bear');assert.equal(must(state.resources['wild-shape']).current,1);
});

test('voluntary Wild Shape exit costs a Bonus Action',()=>{
  const c=character();const state=createInitialState(c);const wolf=availableTransformations(c,state).find(o=>o.formId==='dire-wolf'&&o.profile==='wildshape');assert.ok(wolf);
  startTransformation(c,state,wolf);state.turn.bonusRemaining=0;
  assert.match(endTransformation(state,true).message,/Bonus Action already used/);
  assert.ok(state.activeTransform);
});

test('Polymorph ends automatically when transformation THP reaches zero',()=>{
  const c=character({classes:[{name:'Wizard',level:8}],totalLevel:8});const state=createInitialState(c);
  const option=availableTransformations(c,state).find(o=>o.profile==='polymorph'&&o.formId==='dire-wolf');assert.ok(option);
  startTransformation(c,state,option);assert.equal(state.tempHp,22);const sheet=resolveSheet(c,state);
  applyDamage(state,sheet,22,'Force');assert.equal(state.activeTransform,undefined);assert.equal(state.concentration,undefined);
});

test('Shapechange retains spellcasting but Polymorph does not',()=>{
  const c=character({classes:[{name:'Wizard',level:17}],totalLevel:17});
  const shapeState=createInitialState(c);const shape=availableTransformations(c,shapeState).find(o=>o.profile==='shapechange'&&o.formId==='polar-bear');assert.ok(shape);startTransformation(c,shapeState,shape);assert.equal(resolveSheet(c,shapeState).canCast,true);
  const polyState=createInitialState(c);const poly=availableTransformations(c,polyState).find(o=>o.profile==='polymorph'&&o.formId==='polar-bear');assert.ok(poly);startTransformation(c,polyState,poly);assert.equal(resolveSheet(c,polyState).canCast,false);
});

test('Rage resistance applies damage after resistance and before HP',()=>{
  const c=character();const state=createInitialState(c);startRage(c,state);const sheet=resolveSheet(c,state);
  applyDamage(state,sheet,9,'Slashing');assert.equal(state.hp,56);
});

test('non-finite numeric inputs cannot corrupt combat state',()=>{
  const c=character();const state=createInitialState(c);const sheet=resolveSheet(c,state);
  applyDamage(state,sheet,Number.NaN,'Fire',c);heal(state,c,Number.POSITIVE_INFINITY);
  assert.equal(state.hp,60);assert.equal(state.tempHp,0);assert.equal(concentrationCheckDc(Number.NaN),10);assert.equal(boundedWhole(Number.POSITIVE_INFINITY,7),7);
  const fighter=character({classes:[{name:'Fighter',level:1}],totalLevel:1,hp:{current:20,max:60}});const fighterState=createInitialState(fighter);useSecondWind(fighter,fighterState,Number.NaN);assert.equal(fighterState.hp,22);assert.equal(fighterState.resources['second-wind']?.current,1);
  const paladin=character({classes:[{name:'Paladin',level:1}],totalLevel:1,hp:{current:20,max:60}});const paladinState=createInitialState(paladin);useLayOnHands(paladin,paladinState,Number.NaN);assert.equal(paladinState.hp,21);assert.equal(paladinState.resources['lay-on-hands']?.current,4);
});

test('Reckless Attack must be declared and advantage/disadvantage can cancel',()=>{
  const c=character();const state=createInitialState(c);startRage(c,state);assert.match(declareRecklessAttack(c,state).message,/declared/);
  assert.equal(state.rage.recklessDeclared,true);
});

test('Moonbeam is visible and castable in Moon Wild Shape, but Rage blocks it',()=>{
  const c=character();const state=createInitialState(c);const wolf=availableTransformations(c,state).find(o=>o.formId==='dire-wolf'&&o.profile==='wildshape');assert.ok(wolf);startTransformation(c,state,wolf);
  const moonbeam=resolveSheet(c,state).spells.find(s=>s.name==='Moonbeam');assert.equal(moonbeam?.available,true);
  state.turn.bonusRemaining=1;startRage(c,state);assert.equal(resolveSheet(c,state).spells.find(s=>s.name==='Moonbeam')?.available,false);
});

test('castSpell consumes action, slot, and starts Concentration',()=>{
  const c=character();const state=createInitialState(c);const result=castSpell(c,state,'Moonbeam');assert.match(result.message,/Cast Moonbeam/);
  assert.equal(state.turn.actionsRemaining,0);assert.equal(state.turn.bonusRemaining,1);assert.equal(state.turn.slotSpellCast,true);assert.equal(must(state.spellSlots['2']).current,1);assert.equal(state.concentration?.name,'Moonbeam');
});

test('a feat-granted spell uses its own free cast without requiring a class spell slot',()=>{
  const c=character({classes:[{name:'Monk',level:6,subclass:'Way of the Astral Self (TCoE)'}],totalLevel:6,spells:[{name:'Entangle',level:1,sourceClass:'Feat',ability:'wis',prepared:true,castingTime:'magic-action',concentration:true,freeCastResourceId:'ddb-spell-use-entangle',freeCastResourceCost:1}],spellSlots:{},resources:[{id:'ddb-spell-use-entangle',name:'Entangle free cast',current:1,max:1,recovery:'long-all'}]});const state=createInitialState(c);
  assert.equal(resolveSheet(c,state).spells.find(spell=>spell.name==='Entangle')?.available,true);const result=castSpell(c,state,'Entangle');assert.match(result.message,/free cast/);assert.equal(state.resources['ddb-spell-use-entangle']?.current,0);assert.equal(state.turn.slotSpellCast,false);assert.equal(state.concentration?.name,'Entangle');assert.equal(resolveSheet(c,state).spells.find(spell=>spell.name==='Entangle')?.available,false);longRest(c,state);assert.equal(state.resources['ddb-spell-use-entangle']?.current,1);
});

test('Barkskin applies a persistent AC 17 minimum through Wild Shape and can be ended',()=>{
  const c=character({ac:14,abilities:{str:12,dex:14,con:16,int:10,wis:16,cha:8},spells:[
    {name:'Barkskin',level:2,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'bonus'},
    {name:'Starry Wisp',level:0,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'magic-action'},
  ]});const state=createInitialState(c);
  assert.match(castSpell(c,state,'Barkskin').message,/Bonus Action spent; your Action remains available.*Wild Shape and Rage.*later turn/);assert.equal(state.turn.actionsRemaining,1);assert.equal(state.turn.bonusRemaining,0);assert.equal(state.concentration,undefined);assert.equal(resolveSheet(c,state).ac,17);
  startNewTurn(state);const wolf=availableTransformations(c,state).find(option=>option.profile==='wildshape'&&option.formId==='dire-wolf');assert.ok(wolf);startTransformation(c,state,wolf);assert.equal(resolveSheet(c,state).ac,17);assert.equal(resolveSheet(c,state).acSource,'Barkskin minimum');
  assert.match(endSpellEffect(state,'barkskin').message,/Barkskin ended/);assert.equal(resolveSheet(c,state).ac,16);
});

test('an Action and Bonus Action remain independent while 2024 limits slot spells to one per turn',()=>{
  const c=character({spells:[
    {name:'Barkskin',level:2,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'bonus'},
    {name:'Healing Word',level:1,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'bonus',healing:'1d4+4'},
    {name:'Starry Wisp',level:0,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'magic-action'},
  ],spellSlots:{'1':{current:2,max:2},'2':{current:2,max:2}}});const state=createInitialState(c);
  assert.match(castSpell(c,state,'Barkskin').message,/Cast Barkskin/);assert.equal(resolveSheet(c,state).spells.find(spell=>spell.name==='Starry Wisp')?.available,true);assert.equal(resolveSheet(c,state).spells.find(spell=>spell.name==='Healing Word')?.available,false);
  assert.match(castSpell(c,state,'Starry Wisp').message,/Cast Starry Wisp/);assert.equal(state.turn.actionsRemaining,0);assert.equal(state.turn.bonusRemaining,0);
  startNewTurn(state);assert.equal(state.turn.slotSpellCast,false);assert.equal(resolveSheet(c,state).spells.find(spell=>spell.name==='Healing Word')?.available,true);
});

test('same-turn slot spells remain blocked while an off-turn Reaction window resets only that turn gate',()=>{
  const c=character({classes:[{name:'Wizard',level:5}],totalLevel:5,spells:[
    {name:'Moonbeam',level:2,sourceClass:'Wizard',ability:'int',prepared:true,castingTime:'magic-action',concentration:true},
    {name:'Shield',level:1,sourceClass:'Wizard',ability:'int',prepared:true,castingTime:'reaction'},
  ],spellSlots:{'1':{current:1,max:1},'2':{current:1,max:1}}});const state=createInitialState(c);
  assert.match(castSpell(c,state,'Moonbeam').message,/Cast Moonbeam/);const sameTurn=castSpell(c,state,'Shield');assert.match(sameTurn.message,/already been expended/);assert.equal(state.turn.reactionRemaining,1);assert.equal(state.spellSlots['1']?.current,1);
  const economy={actionsRemaining:state.turn.actionsRemaining,surgeActionsRemaining:state.turn.surgeActionsRemaining,bonusRemaining:state.turn.bonusRemaining,reactionRemaining:state.turn.reactionRemaining};endTurn(c,state);assert.equal(state.turn.slotSpellCast,false);assert.deepEqual({actionsRemaining:state.turn.actionsRemaining,surgeActionsRemaining:state.turn.surgeActionsRemaining,bonusRemaining:state.turn.bonusRemaining,reactionRemaining:state.turn.reactionRemaining},economy);
  assert.match(castSpell(c,state,'Shield').message,/Cast Shield/);assert.equal(state.turn.reactionRemaining,0);assert.equal(state.turn.slotSpellCast,true);assert.equal(state.spellSlots['1']?.current,0);
});

test('opening an off-turn Reaction window directly preserves every action-economy counter',()=>{
  const state=createInitialState(character());state.turn.actionsRemaining=0;state.turn.surgeActionsRemaining=1;state.turn.bonusRemaining=0;state.turn.reactionRemaining=1;state.turn.slotSpellCast=true;const before={...state.turn,oncePerTurn:{...state.turn.oncePerTurn}};
  assert.match(startOffTurnReactionWindow(state).message,/Off-turn Reaction window/);assert.equal(state.turn.slotSpellCast,false);assert.deepEqual({...state.turn,slotSpellCast:true},before);
});

test('Fount of Moonlight is a Magic Action and powers melee beast attacks while concentrated',()=>{
  const c=character({classes:[{name:'Druid',level:7,subclass:'Circle of the Moon'}],totalLevel:7,knownForms:['dire-wolf'],spells:[
    {name:'Fount of Moonlight',level:4,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'magic-action',concentration:true},
  ],spellSlots:{'4':{current:1,max:1}}});const state=createInitialState(c);const wolf=availableTransformations(c,state).find(option=>option.profile==='wildshape'&&option.formId==='dire-wolf');assert.ok(wolf);startTransformation(c,state,wolf);
  const spell=resolveSheet(c,state).spells.find(entry=>entry.name==='Fount of Moonlight');assert.equal(spell?.available,true);assert.equal(spell?.castingTime,'magic-action');assert.match(castSpell(c,state,'Fount of Moonlight').message,/Cast Fount/);
  const sheet=resolveSheet(c,state);const bite=sheet.actions.find(action=>action.type==='attack');assert.ok(bite);assert.ok(sheet.resistances.includes('Radiant'));assert.ok(attackBonuses(c,state,sheet,bite).some(packet=>packet.label==='Fount of Moonlight'&&packet.expression==='2d6'));
  const rangedSpell:AttackAction={id:'starry-wisp',name:'Starry Wisp',type:'attack',cost:'none',attackBonus:7,ability:'wis',kind:'spell',range:'60 feet',damage:[{expression:'2d8',type:'Radiant'}]};assert.equal(attackBonuses(c,state,sheet,rangedSpell).some(packet=>packet.label==='Fount of Moonlight'),false);
});

test('a spell can use a higher-level slot when its base slot is empty',()=>{
  const c=character({spellSlots:{'2':{current:0,max:2},'3':{current:1,max:1},'4':{current:1,max:1},'9':{current:1,max:1}}});const state=createInitialState(c);
  assert.deepEqual(availableSpellSlotLevels(c,state,2),[3,4,9]);
  assert.equal(resolveSheet(c,state).spells.find(spell=>spell.name==='Moonbeam')?.available,true);
  const result=castSpell(c,state,'Moonbeam');assert.match(result.message,/level 3 slot/);assert.equal(must(state.spellSlots['3']).current,0);
});

test('an explicitly selected higher-level slot is consumed',()=>{
  const c=character({spellSlots:{'2':{current:1,max:1},'3':{current:1,max:1},'4':{current:1,max:1},'9':{current:1,max:1}}});const state=createInitialState(c);
  const result=castSpell(c,state,'Moonbeam',3);assert.match(result.message,/level 3 slot/);assert.equal(must(state.spellSlots['2']).current,1);assert.equal(must(state.spellSlots['3']).current,0);assert.equal(state.concentration?.castLevel,3);
});

test('Pact Magic is a separate exact-level casting choice and recovers on a Short Rest',()=>{
  const c=character({classes:[{name:'Warlock',level:5}],totalLevel:5,spells:[{name:'Hex',level:1,sourceClass:'Pact Magic',ability:'cha',prepared:true,castingTime:'bonus',concentration:true}],spellSlots:{},resources:[{id:'pact-magic-slots',name:'Pact Magic Slots (Level 3)',current:2,max:2,recovery:'short-all',kind:'pact-magic-slots',slotLevel:3,source:'fixture'}]});const state=createInitialState(c);
  assert.deepEqual(availableSpellSlotLevels(c,state,1),[]);assert.deepEqual(availableSpellCastingOptions(c,state,1),[{id:'pact-magic-slots',kind:'pact-magic',level:3,label:'Pact Magic · Level 3',resourceId:'pact-magic-slots'}]);
  assert.equal(resolveSheet(c,state).spells.find(spell=>spell.name==='Hex')?.available,true);const cast=castSpell(c,state,'Hex');assert.match(cast.message,/using Pact Magic at level 3/);assert.equal(state.resources['pact-magic-slots']?.current,1);assert.equal(state.turn.slotSpellCast,true);assert.equal(state.concentration?.castLevel,3);
  shortRest(state);assert.equal(state.resources['pact-magic-slots']?.current,2);
});

test('ordinary and Pact Magic slots remain distinct and invalid Pact choices do not spend anything',()=>{
  const c=character({classes:[{name:'Wizard',level:3},{name:'Warlock',level:5}],totalLevel:8,spells:[{name:'Shield',level:1,sourceClass:'Wizard',ability:'int',prepared:true,castingTime:'reaction'}],spellSlots:{'1':{current:1,max:1}},resources:[{id:'pact-magic-slots',name:'Pact Magic Slots (Level 3)',current:2,max:2,recovery:'short-all',kind:'pact-magic-slots',slotLevel:3,source:'fixture'}]});
  const invalid=createInitialState(c),before={reaction:invalid.turn.reactionRemaining,pact:invalid.resources['pact-magic-slots']?.current};assert.match(castSpell(c,invalid,'Shield',2,'pact-magic-slots').message,/selected Pact Magic slot is not available/);assert.equal(invalid.turn.reactionRemaining,before.reaction);assert.equal(invalid.resources['pact-magic-slots']?.current,before.pact);
  const ordinary=createInitialState(c);assert.deepEqual(availableSpellCastingOptions(c,ordinary,1).map(choice=>[choice.kind,choice.level]),[['ordinary',1],['pact-magic',3]]);assert.match(castSpell(c,ordinary,'Shield',1).message,/level 1 slot/);assert.equal(ordinary.spellSlots['1']?.current,0);assert.equal(ordinary.resources['pact-magic-slots']?.current,2);
  const pact=createInitialState(c);assert.match(castSpell(c,pact,'Shield',3,'pact-magic-slots').message,/Pact Magic at level 3/);assert.equal(pact.spellSlots['1']?.current,1);assert.equal(pact.resources['pact-magic-slots']?.current,1);
});

test('transformation spells honor the explicitly selected ordinary or Pact Magic pool',()=>{
  const c=character({classes:[{name:'Wizard',level:3},{name:'Warlock',level:5}],totalLevel:8,spells:[{name:'Alter Self',level:2,sourceClass:'Wizard',ability:'int',prepared:true,castingTime:'magic-action',concentration:true}],spellSlots:{'2':{current:1,max:1}},resources:[{id:'pact-magic-slots',name:'Pact Magic Slots (Level 3)',current:2,max:2,recovery:'short-all',kind:'pact-magic-slots',slotLevel:3,source:'fixture'}]});
  const pact=createInitialState(c),pactOption=availableTransformations(c,pact).find(option=>option.id==='spell:alter-self:appearance');assert.ok(pactOption);assert.match(startTransformation(c,pact,pactOption,{level:3,resourceId:'pact-magic-slots'}).message,/activated/);assert.equal(pact.resources['pact-magic-slots']?.current,1);assert.equal(pact.spellSlots['2']?.current,1);assert.equal(pact.concentration?.castLevel,3);
  const ordinary=createInitialState(c),ordinaryOption=availableTransformations(c,ordinary).find(option=>option.id==='spell:alter-self:appearance');assert.ok(ordinaryOption);startTransformation(c,ordinary,ordinaryOption,{level:2});assert.equal(ordinary.spellSlots['2']?.current,0);assert.equal(ordinary.resources['pact-magic-slots']?.current,2);assert.equal(ordinary.concentration?.castLevel,2);
});

test('spells clearly become unavailable after their Magic Action is spent',()=>{
  const c=character();const state=createInitialState(c);state.turn.actionsRemaining=0;
  const spell=resolveSheet(c,state).spells.find(entry=>entry.name==='Moonbeam');assert.equal(spell?.available,false);assert.match(spell?.reason??'',/Action remains/);
});

test('Altered table rule classifies beast-form physical attacks as Unarmed Strikes for Rage Damage',()=>{
  const c=character();const state=createInitialState(c);const bear=availableTransformations(c,state).find(option=>option.profile==='wildshape'&&option.formId==='brown-bear');assert.ok(bear);startTransformation(c,state,bear);state.turn.bonusRemaining=1;startRage(c,state);
  const sheet=resolveSheet(c,state);const bite=sheet.actions.find(action=>action.type==='attack');assert.ok(bite);assert.ok(sheet.resistances.includes('Slashing'));assert.equal(bite?attackBonuses(c,state,sheet,bite).some(packet=>packet.label==='Rage Damage'&&packet.expression==='2'):false,true);assert.match(bite?.notes??'',/counts as an Unarmed Strike/);
});


test('Reckless Attack can be declared without Rage',()=>{
  const c=character();const state=createInitialState(c);const result=declareRecklessAttack(c,state);assert.match(result.message,/declared/);assert.equal(state.rage.recklessDeclared,true);
});

test('Reckless Attack is blocked when a replacement transformation does not retain class features',()=>{
  const c=character({classes:[{name:'Barbarian',level:2}],totalLevel:2});const state=createInitialState(c);const option=availableTransformations(c,state).find(entry=>entry.profile==='polymorph'&&entry.formId==='polar-bear');assert.ok(option);assert.match(startTransformation(c,state,option).message,/transformed/i);assert.match(declareRecklessAttack(c,state).message,/does not retain Reckless Attack/);assert.equal(state.rage.recklessDeclared,false);
});

test('Action Surge is limited to once per turn',()=>{
  const c=character({classes:[{name:'Fighter',level:17}],totalLevel:17});const state=createInitialState(c);assert.match(useActionSurge(c,state).message,/added one action/);assert.match(useActionSurge(c,state).message,/only once/);assert.equal(state.turn.surgeActionsRemaining,1);
});

test('Extra Attack spends one Attack action and preserves every granted attack',()=>{
  const c=character({classes:[{name:'Fighter',level:11}],totalLevel:11});const state=createInitialState(c);const action=resolveSheet(c,state).actions.find(entry=>entry.id==='unarmed');assert.ok(action);
  assert.equal(extraAttackCount(c),3);assert.equal(spendActionExecution(c,state,action),null);assert.equal(state.turn.actionsRemaining,0);assert.deepEqual(state.turn.attackAction,{remaining:2,total:3,source:'Fighter Extra Attack'});
  assert.equal(actionExecutionError(c,state,action),null);assert.equal(spendActionExecution(c,state,action),null);assert.equal(state.turn.attackAction?.remaining,1);
  assert.equal(spendActionExecution(c,state,action),null);assert.equal(state.turn.attackAction,undefined);assert.match(actionExecutionError(c,state,action)??'',/Action already used/);
});

test('Extra Attack features do not stack across multiclass levels',()=>{
  const c=character({classes:[{name:'Barbarian',level:5},{name:'Monk',level:5},{name:'Paladin',level:5},{name:'Ranger',level:5}],totalLevel:20});assert.equal(extraAttackCount(c),2);
});

test('Grapple or Shove can replace one attack granted by Extra Attack',()=>{
  const c=character({classes:[{name:'Monk',level:5}],totalLevel:5});const state=createInitialState(c);const actions=resolveSheet(c,state).actions;const damage=actions.find(entry=>entry.id==='unarmed'),grapple=actions.find(entry=>entry.id==='unarmed-grapple');assert.ok(damage);assert.ok(grapple);
  assert.equal(spendActionExecution(c,state,damage),null);assert.equal(state.turn.attackAction?.remaining,1);assert.equal(spendActionExecution(c,state,grapple),null);assert.equal(state.turn.attackAction,undefined);
});

test('Extra Attack never bypasses incapacitation or other action blockers',()=>{
  const c=character({classes:[{name:'Monk',level:5}],totalLevel:5});const state=createInitialState(c);const action=resolveSheet(c,state).actions.find(entry=>entry.id==='unarmed');assert.ok(action);spendActionExecution(c,state,action);applyCondition(c,state,'Stunned');assert.match(actionExecutionError(c,state,action)??'',/Incapacitated condition/);
});

test('Multiattack remains one stat-block action and never receives Extra Attack',()=>{
  const c=character({classes:[{name:'Fighter',level:11},{name:'Druid',level:6,subclass:'Circle of the Moon'}],totalLevel:17,knownForms:['brown-bear'],seenForms:['brown-bear']});const state=createInitialState(c);const bear=availableTransformations(c,state).find(option=>option.profile==='wildshape'&&option.formId==='brown-bear');assert.ok(bear);startTransformation(c,state,bear);state.turn.actionsRemaining=1;const multi=resolveSheet(c,state).actions.find(entry=>entry.type==='multiattack');assert.ok(multi);
  assert.equal(spendActionExecution(c,state,multi),null);assert.equal(state.turn.actionsRemaining,0);assert.equal(state.turn.attackAction,undefined);
});

test('a retained Extra Attack can use individual Beast-form attacks instead of Multiattack',()=>{
  const c=character({classes:[{name:'Fighter',level:5},{name:'Druid',level:6,subclass:'Circle of the Moon'}],totalLevel:11,knownForms:['brown-bear'],seenForms:['brown-bear']});const state=createInitialState(c);const bear=availableTransformations(c,state).find(option=>option.profile==='wildshape'&&option.formId==='brown-bear');assert.ok(bear);startTransformation(c,state,bear);state.turn.actionsRemaining=1;const bite=resolveSheet(c,state).actions.find(entry=>entry.type==='attack'&&entry.id==='bite');assert.ok(bite);
  assert.equal(spendActionExecution(c,state,bite),null);assert.equal(state.turn.attackAction?.remaining,1);assert.equal(spendActionExecution(c,state,bite),null);assert.equal(state.turn.attackAction,undefined);assert.match(actionExecutionError(c,state,bite)??'',/Action already used/);
});

test('Action Surge grants a fresh complete Extra Attack sequence',()=>{
  const c=character({classes:[{name:'Fighter',level:5}],totalLevel:5});const state=createInitialState(c);const action=resolveSheet(c,state).actions.find(entry=>entry.id==='unarmed');assert.ok(action);
  spendActionExecution(c,state,action);spendActionExecution(c,state,action);assert.equal(state.turn.attackAction,undefined);useActionSurge(c,state);assert.equal(spendActionExecution(c,state,action),null);assert.equal(state.turn.surgeActionsRemaining,0);assert.equal(state.turn.attackAction?.remaining,1);assert.equal(spendActionExecution(c,state,action),null);assert.match(actionExecutionError(c,state,action)??'',/Action already used/);
});

test('ending Polymorph clears its transformation THP',()=>{
  const c=character({classes:[{name:'Wizard',level:8}],totalLevel:8});const state=createInitialState(c);const option=availableTransformations(c,state).find(o=>o.profile==='polymorph'&&o.formId==='dire-wolf');assert.ok(option);startTransformation(c,state,option);assert.equal(state.tempHp,22);const result=endTransformation(state,true);assert.match(result.message,/Base Form/);assert.equal(state.tempHp,0);
});


test('ordinary Bonus Actions do not extend Rage; the explicit extend action does',()=>{
  const c=character();const state=createInitialState(c);startRage(c,state);startNewTurn(state);
  spendActionCost(state,'bonus');assert.equal(state.rage.extendedThisTurn,false);
  assert.match(endTurn(c,state).message,/not extended/);assert.equal(state.rage.active,false);
  const next=createInitialState(c);startRage(c,next);startNewTurn(next);assert.match(extendRage(c,next).message,/extended/);assert.equal(next.rage.extendedThisTurn,true);assert.match(endTurn(c,next).message,/ended\./);assert.equal(next.rage.active,true);
});

test('Persistent Rage does not require round-by-round extension and ends on Unconscious',()=>{
  const c=character({classes:[{name:'Barbarian',level:15}],totalLevel:15});const state=createInitialState(c);startRage(c,state);startNewTurn(state);assert.equal(endTurn(c,state).message,'Turn 2 ended.');assert.equal(state.rage.active,true);
  applyCondition(c,state,'Incapacitated');assert.equal(state.rage.active,true);
  applyCondition(c,state,'Unconscious');assert.equal(state.rage.active,false);
});

test('Rage and Persistent Rage both stop at the 2024 ten-minute maximum',()=>{
  const ordinary=character();const ordinaryState=createInitialState(ordinary);startRage(ordinary,ordinaryState);ordinaryState.rage.endsAtTurn=ordinaryState.rage.startedAtTurn+100;ordinaryState.turn.number=ordinaryState.rage.startedAtTurn+100;assert.match(endTurn(ordinary,ordinaryState).message,/maximum duration of 10 minutes/);assert.equal(ordinaryState.rage.active,false);
  const persistent=character({classes:[{name:'Barbarian',level:15}],totalLevel:15});const persistentState=createInitialState(persistent);startRage(persistent,persistentState);assert.equal(persistentState.rage.endsAtTurn,persistentState.rage.startedAtTurn+100);persistentState.turn.number=persistentState.rage.startedAtTurn+99;assert.equal(endTurn(persistent,persistentState).message,`Turn ${persistentState.turn.number} ended.`);persistentState.turn.number++;assert.match(endTurn(persistent,persistentState).message,/100 rounds/);assert.equal(persistentState.rage.active,false);
});

test('Incapacitated ends Wild Shape and Concentration',()=>{
  const c=character();const state=createInitialState(c);const wolf=availableTransformations(c,state).find(o=>o.profile==='wildshape'&&o.formId==='dire-wolf');assert.ok(wolf);startTransformation(c,state,wolf);state.concentration={name:'Moonbeam',source:'Druid'};
  applyCondition(c,state,'Incapacitated');assert.equal(state.activeTransform,undefined);assert.equal(state.concentration,undefined);
});

test('damage queues separate Concentration checks and failure ends the effect',()=>{
  const c=character();const state=createInitialState(c);state.concentration={name:'Moonbeam',source:'Druid'};const sheet=resolveSheet(c,state);
  applyDamage(state,sheet,5,'Force');applyDamage(state,sheet,22,'Fire');assert.deepEqual(state.concentrationChecks.map(x=>x.dc),[10,11]);
  assert.match(resolveConcentrationCheck(state,15).message,/maintained/);assert.equal(state.concentrationChecks.length,1);assert.ok(state.concentration);
  assert.match(resolveConcentrationCheck(state,3).message,/failed/);assert.equal(state.concentration,undefined);assert.equal(state.concentrationChecks.length,0);
});

test('War Caster and imported Eldritch Mind affect Concentration roll mode',()=>{
  const c=character({feats:['War Caster'],features:[{id:'eldritch-mind',name:'Eldritch Mind',source:'Invocation',summary:'Advantage on Concentration saves.'}]});const state=createInitialState(c);
  assert.equal(concentrationSaveMode(c,state).mode,'advantage');state.conditions.push('Poisoned');assert.equal(concentrationSaveMode(c,state).mode,'advantage');
});

test('owned imported feats are references, not falsely reported as missing requirements',()=>{
  const c=character({feats:['Magic Initiate (Druid)']});const state=createInitialState(c);
  const baseFeat=must(resolveSheet(c,state).features.find(feature=>feature.id==='feat:Magic Initiate (Druid)'));
  assert.equal(baseFeat.status,'ruling');assert.match(baseFeat.reason,/Owned by this character/);
  const polymorph=must(availableTransformations(c,state).find(option=>option.profile==='polymorph'));
  startTransformation(c,state,polymorph);const transformedFeat=must(resolveSheet(c,state).features.find(feature=>feature.id==='feat:Magic Initiate (Druid)'));
  assert.equal(transformedFeat.status,'inactive');assert.match(transformedFeat.reason,/does not retain feats/);
});

test('activatable features are not labeled as already applied before activation',()=>{
  const c=character({species:'Goliath'});const state=createInitialState(c);const features=resolveSheet(c,state).features;
  assert.equal(must(features.find(feature=>feature.id==='rage')).status,'conditional');
  assert.equal(must(features.find(feature=>feature.id==='wild-shape')).status,'conditional');
  assert.equal(must(features.find(feature=>feature.id==='wild-resurgence')).status,'conditional');
  assert.equal(must(features.find(feature=>feature.id==='large-form')).status,'conditional');
  startRage(c,state);assert.equal(must(resolveSheet(c,state).features.find(feature=>feature.id==='rage')).status,'active');
});

test('supported instant and declared class features report ready, active, and spent states truthfully',()=>{
  const barbarian=character({classes:[{name:'Barbarian',level:2}],totalLevel:2});const barbarianState=createInitialState(barbarian);
  assert.equal(must(resolveSheet(barbarian,barbarianState).features.find(feature=>feature.id==='reckless-attack')).status,'conditional');
  declareRecklessAttack(barbarian,barbarianState);assert.equal(must(resolveSheet(barbarian,barbarianState).features.find(feature=>feature.id==='reckless-attack')).status,'active');

  const fighter=character({classes:[{name:'Fighter',level:2}],totalLevel:2,hp:{current:10,max:30}});const fighterState=createInitialState(fighter);let fighterFeatures=resolveSheet(fighter,fighterState).features;
  assert.equal(must(fighterFeatures.find(feature=>feature.id==='second-wind')).status,'conditional');assert.equal(must(fighterFeatures.find(feature=>feature.id==='action-surge')).status,'conditional');
  useActionSurge(fighter,fighterState);fighterFeatures=resolveSheet(fighter,fighterState).features;assert.equal(must(fighterFeatures.find(feature=>feature.id==='action-surge')).status,'active');
  useSecondWind(fighter,fighterState,5);assert.equal(must(resolveSheet(fighter,fighterState).features.find(feature=>feature.id==='second-wind')).status,'inactive');

  const paladin=character({classes:[{name:'Paladin',level:1}],totalLevel:1,hp:{current:5,max:20}});const paladinState=createInitialState(paladin);
  assert.equal(must(resolveSheet(paladin,paladinState).features.find(feature=>feature.id==='lay-on-hands')).status,'conditional');
  useLayOnHands(paladin,paladinState,2);assert.equal(must(resolveSheet(paladin,paladinState).features.find(feature=>feature.id==='lay-on-hands')).status,'inactive');
});

test('unarmored defense eligibility uses actual armor and equipped weapons become attacks',()=>{
  const c=character({items:[{id:'axe',name:'Greataxe',type:'Weapon',equipped:true,attuned:false,requiresAttunement:false,ruleset:'2024',sourceIds:[],mechanics:'included-in-imported-totals',attack:{ability:'str',damage:'1d12',damageType:'Slashing',proficient:true,properties:['Heavy','Two-Handed'],magicBonus:0}}]});const state=createInitialState(c);const sheet=resolveSheet(c,state);
  assert.equal(must(sheet.acCandidates.find(candidate=>candidate.name==='Barbarian Unarmored Defense')).legal,true);
  assert.equal(must(sheet.features.find(feature=>feature.id==='barbarian-unarmored-defense')).status,'active');
  const axe=must(sheet.actions.find(action=>action.id==='item-attack-axe'));assert.equal(axe.type,'attack');if(axe.type==='attack'){assert.equal(axe.attackBonus,4);assert.equal(axe.damage[0]?.expression,'1d12+1');}
});

test('a proven Pact Weapon uses its structured ability while retaining Monk die and magic bonus, and Eldritch Smite spends Pact Magic only after confirmation',()=>{
  const c=character({classes:[{name:'Monk',level:6},{name:'Warlock',level:5}],totalLevel:11,abilities:{str:8,dex:16,con:12,int:10,wis:16,cha:18},spellSlots:{},resources:[{id:'pact-magic-slots',name:'Pact Magic Slots (Level 3)',current:2,max:2,recovery:'short-all',kind:'pact-magic-slots',slotLevel:3,source:'fixture'}],features:[{id:'ddb-invocation-smite',name:'Eldritch Smite',source:'D&D Beyond selected Eldritch Invocation',summary:'Name-only fixture.',automation:'reference',origin:{provider:'dndbeyond',kind:'eldritch-invocation',sourceIds:['definition:9101']}}],items:[{id:'hammer',name:'Light Hammer, +1',type:'Weapon',equipped:true,attuned:true,requiresAttunement:true,ruleset:'2024',sourceIds:['701'],mechanics:'included-in-imported-totals',pactWeapon:{provider:'dndbeyond',evidence:['enable-feature:enable-pact-weapon','characterValues:typeId=28'],attackAbility:'cha'},attack:{ability:'str',damage:'1d4',damageType:'Bludgeoning',proficient:true,properties:['Light','Thrown'],magicBonus:1}}]});const state=createInitialState(c),sheet=resolveSheet(c,state);
  const hammer=must(sheet.actions.find(action=>action.id==='item-attack-hammer'));assert.equal(hammer.type,'attack');if(hammer.type==='attack'){assert.equal(hammer.ability,'cha');assert.equal(hammer.attackBonus,9);assert.equal(hammer.damage[0]?.expression,'1d8+5');assert.match(hammer.notes??'',/Proven Pact Weapon.*CHA/);assert.match(hammer.notes??'',/Martial Arts 1d8 damage die retained/);}
  const smite=must(sheet.actions.find(action=>action.id==='eldritch-smite-hammer'));assert.equal(smite.type,'automatic');if(smite.type==='automatic'){assert.deepEqual(smite.damage,[{expression:'4d8',type:'Force'}]);assert.match(smite.prerequisite??'',/after Light Hammer, \+1.*hits/);assert.equal(spendActionExecution(c,state,smite),null);assert.equal(state.resources['pact-magic-slots']?.current,1);assert.equal(state.turn.oncePerTurn['eldritch-smite'],true);assert.match(actionExecutionError(c,state,smite)??'',/only once/);}
  shortRest(state);assert.equal(state.resources['pact-magic-slots']?.current,2);
});

test('Pact Weapon ability and Eldritch Smite are not inferred without structured item and invocation evidence',()=>{
  const c=character({classes:[{name:'Monk',level:6},{name:'Warlock',level:5}],totalLevel:11,abilities:{str:8,dex:16,con:12,int:10,wis:16,cha:18},spellSlots:{},resources:[{id:'pact-magic-slots',name:'Pact Magic Slots (Level 3)',current:2,max:2,recovery:'short-all',kind:'pact-magic-slots',slotLevel:3}],features:[{id:'manual-smite',name:'Eldritch Smite',source:'Manual text',summary:'Unproven name only.',automation:'reference'}],items:[{id:'hammer',name:'Light Hammer, +1',type:'Weapon',equipped:true,attuned:false,requiresAttunement:false,ruleset:'2024',sourceIds:[],mechanics:'included-in-imported-totals',attack:{ability:'str',damage:'1d4',damageType:'Bludgeoning',proficient:true,properties:['Light','Thrown'],magicBonus:1}}]});const sheet=resolveSheet(c,createInitialState(c)),hammer=must(sheet.actions.find(action=>action.id==='item-attack-hammer'));assert.equal(hammer.type,'attack');if(hammer.type==='attack')assert.equal(hammer.ability,'dex');assert.equal(sheet.actions.some(action=>action.id.startsWith('eldritch-smite-')),false);
});

test('structured equipment effects are visible in calculations once and respect form retention',()=>{
  const c=character({ac:15,items:[
    {id:'cloak',name:'Cloak',type:'Wondrous item',equipped:true,attuned:true,requiresAttunement:true,ruleset:'2024',sourceIds:[],mechanics:'included-in-imported-totals',effects:[{kind:'armor-class',value:1,includedInImportedTotals:true},{kind:'saving-throws',value:1,includedInImportedTotals:true}]},
    {id:'claws',name:'Claws',type:'Wondrous item',equipped:true,attuned:false,requiresAttunement:false,ruleset:'2024',sourceIds:[],mechanics:'included-in-imported-totals',effects:[{kind:'natural-attack-rolls',value:1,includedInImportedTotals:false},{kind:'natural-attack-damage',value:1,includedInImportedTotals:false}]},
  ]});const state=createInitialState(c);let sheet=resolveSheet(c,state);
  assert.equal(sheet.ac,15,'base imported AC must not receive its included item bonus twice');const unarmed=must(sheet.actions.find(action=>action.id==='unarmed'));assert.equal(unarmed.type,'attack');if(unarmed.type==='attack'){assert.equal(unarmed.attackBonus,5);assert.equal(unarmed.damage[0]?.expression,'3');}
  const wolf=must(availableTransformations(c,state).find(option=>option.formId==='dire-wolf'));startTransformation(c,state,wolf);sheet=resolveSheet(c,state);const mergedBite=must(sheet.actions.find(action=>action.id==='bite'));assert.equal(mergedBite.type,'attack');if(mergedBite.type==='attack')assert.equal(mergedBite.attackBonus,5,'merged item effects must be inactive');
  state.equipment.transformBehavior='wear';state.equipment.formCanWear=true;sheet=resolveSheet(c,state);assert.equal(sheet.ac,18,'retained Cloak adds to the selected Circle Forms AC');const bite=must(sheet.actions.find(action=>action.id==='bite'));assert.equal(bite.type,'attack');if(bite.type==='attack'){assert.equal(bite.attackBonus,6);assert.equal(bite.damage[0]?.expression,'1d10+4');}
});

test('Beast Spells does not make an unprepared spell available',()=>{
  const c=character({classes:[{name:'Druid',level:18,subclass:'Circle of the Land'}],totalLevel:18,knownForms:['dire-wolf'],spells:[{name:'Cure Wounds',level:1,sourceClass:'Druid',ability:'wis',prepared:false,castingTime:'magic-action'}]});const state=createInitialState(c);const wolf=availableTransformations(c,state).find(o=>o.profile==='wildshape');assert.ok(wolf);startTransformation(c,state,wolf);assert.equal(resolveSheet(c,state).spells[0]?.available,false);
});

test('Rage and Danger Sense add save advantages and Primal Knowledge adds Strength alternatives',()=>{
  const c=character({classes:[{name:'Barbarian',level:3},{name:'Druid',level:2,subclass:'Circle of the Land'}],totalLevel:5,knownForms:['constrictor-snake']});const state=createInitialState(c);startRage(c,state);const sheet=resolveSheet(c,state);
  assert.ok(sheet.saves.str.advantageSources?.includes('Rage'));assert.ok(sheet.saves.dex.advantageSources?.includes('Danger Sense'));assert.ok(must(sheet.skills.Perception).alternate);
});

test('Wild Resurgence enforces once-per-turn and once-per-long-rest exchanges',()=>{
  const c=character();const state=createInitialState(c);must(state.resources['wild-shape']).current=0;
  assert.equal(wildResurgenceError(c,state,'slot-to-shape'),null);assert.match(wildResurgenceError(c,state,'shape-to-slot')??'',/No Wild Shape/);
  assert.match(useWildResurgence(c,state,'slot-to-shape').message,/regain one Wild Shape/);must(state.resources['wild-shape']).current=0;assert.match(useWildResurgence(c,state,'slot-to-shape').message,/only once on a turn/);
  startNewTurn(state);must(state.resources['wild-shape']).current=1;must(state.spellSlots['1']??(state.spellSlots['1']={current:0,max:1})).current=0;assert.match(useWildResurgence(c,state,'shape-to-slot').message,/regain a level 1/);must(state.resources['wild-shape']).current=1;assert.match(useWildResurgence(c,state,'shape-to-slot').message,/Long Rest/);
});

test('Second Wind and Lay On Hands spend resources and respect Bonus Actions',()=>{
  const fighter=character({classes:[{name:'Fighter',level:5}],totalLevel:5,hp:{current:20,max:50}});const fs=createInitialState(fighter);assert.match(useSecondWind(fighter,fs,6).message,/restored 11/);assert.equal(fs.hp,31);assert.equal(fs.turn.bonusRemaining,0);
  const paladin=character({classes:[{name:'Paladin',level:4}],totalLevel:4,hp:{current:10,max:40}});const ps=createInitialState(paladin);assert.match(useLayOnHands(paladin,ps,12).message,/restored 12/);assert.equal(ps.hp,22);assert.equal(must(ps.resources['lay-on-hands']).current,8);
});

test('conditions block actions, zero speed, and apply automatic save effects',()=>{
  const c=character();const state=createInitialState(c);applyCondition(c,state,'Stunned');const sheet=resolveSheet(c,state);
  assert.equal(sheet.speeds.walk,0);assert.ok(sheet.saves.str.automaticFailure);assert.ok(sheet.saves.dex.automaticFailure);
  assert.match(startRage(c,state).message,/Incapacitated/);
});

test('Restrained affects Dexterity saves while Poisoned affects checks and attacks, not Concentration saves',()=>{
  const c=character();const state=createInitialState(c);state.conditions.push('Restrained','Poisoned','Blinded','Prone');const sheet=resolveSheet(c,state);
  assert.ok(sheet.saves.dex.disadvantageSources?.includes('Restrained'));
  assert.ok(must(sheet.skills.Perception).disadvantageSources?.includes('Poisoned'));
  const bite=must(CREATURES['dire-wolf']).actions.find(a=>a.id==='bite');assert.ok(bite);assert.deepEqual(attackRollSources(c,state,bite).mode,'disadvantage');
  assert.equal(concentrationSaveMode(c,state).mode,'normal');
});

test('Concentration DC is capped at 30',()=>{assert.equal(concentrationCheckDc(200),30);assert.equal(concentrationCheckDc(21),10);assert.equal(concentrationCheckDc(22),11);});

test('Polymorph lists bundled legal Beasts without requiring seenForms',()=>{
  const c=character({classes:[{name:'Wizard',level:8}],totalLevel:8,seenForms:[]});const forms=availableTransformations(c,createInitialState(c)).filter(o=>o.profile==='polymorph');assert.ok(forms.some(o=>o.formId==='dire-wolf'));
});

test('Shapechange lists eligible known content without requiring seenForms',()=>{
  const c=character({classes:[{name:'Wizard',level:17}],totalLevel:17,seenForms:[],spells:[{name:'Shapechange',level:9,sourceClass:'Wizard',ability:'int',prepared:true,castingTime:'magic-action',concentration:true}],spellSlots:{'9':{current:1,max:1}}});
  const forms=availableTransformations(c,createInitialState(c)).filter(o=>o.profile==='shapechange');
  assert.ok(forms.some(o=>o.formId==='dire-wolf'));
  assert.ok(forms.every(o=>o.source.includes('choose only a creature your character has seen')));
});

test('Rests restore a usable turn budget while Long Rest preserves unresolved conditions',()=>{
  const c=character();const state=createInitialState(c);startRage(c,state);state.conditions.push('Poisoned');
  state.turn.actionsRemaining=0;state.turn.surgeActionsRemaining=1;state.turn.bonusRemaining=0;state.turn.reactionRemaining=0;state.turn.attackRollsMade=2;state.turn.oncePerTurn.test=true;
  shortRest(state);assert.equal(state.rage.active,false);assert.deepEqual(state.turn,{number:1,actionsRemaining:1,surgeActionsRemaining:0,bonusRemaining:1,reactionRemaining:1,slotSpellCast:false,attackRollsMade:0,oncePerTurn:{}});
  state.turn.actionsRemaining=0;state.turn.bonusRemaining=0;state.turn.reactionRemaining=0;state.turn.oncePerTurn.test=true;
  longRest(c,state);assert.ok(state.conditions.includes('Poisoned'));assert.deepEqual(state.turn,{number:1,actionsRemaining:1,surgeActionsRemaining:0,bonusRemaining:1,reactionRemaining:1,slotSpellCast:false,attackRollsMade:0,oncePerTurn:{}});
});

test('new Temporary Hit Points always require a choice when a pool already exists',()=>{
  const c=character();const state=createInitialState(c);state.tempHp=30;state.tempHpSource='Aid-like effect';const wolf=availableTransformations(c,state).find(o=>o.profile==='wildshape'&&o.formId==='dire-wolf');assert.ok(wolf);const result=startTransformation(c,state,wolf);assert.equal(result.choice?.current,30);assert.equal(result.choice?.incoming,18);assert.equal(state.tempHp,30);
});

test('Primal Strike is not invented unless selected on the imported sheet',()=>{
  const base=character({classes:[{name:'Druid',level:8,subclass:'Circle of the Land'}],totalLevel:8,knownForms:['dire-wolf']});const state=createInitialState(base);const wolf=availableTransformations(base,state).find(o=>o.profile==='wildshape');assert.ok(wolf);startTransformation(base,state,wolf);const bite=resolveSheet(base,state).actions.find(a=>a.id==='bite');assert.ok(bite);assert.equal(attackBonuses(base,state,resolveSheet(base,state),bite).some(p=>p.label?.includes('Primal Strike')),false);
});

test('Primal Strike exposes one mutually exclusive elemental damage choice',()=>{
  const c=character({classes:[{name:'Druid',level:7,subclass:'Circle of the Moon'}],totalLevel:7,knownForms:['dire-wolf'],seenForms:['dire-wolf'],features:[{id:'primal-strike',name:'Primal Strike',source:'Druid 7',summary:'Once per turn, choose one elemental damage type.'}]});const state=createInitialState(c);const wolf=availableTransformations(c,state).find(option=>option.profile==='wildshape'&&option.formId==='dire-wolf');assert.ok(wolf);startTransformation(c,state,wolf);const sheet=resolveSheet(c,state),bite=sheet.actions.find(action=>action.id==='bite');assert.ok(bite);const choices=attackBonuses(c,state,sheet,bite).filter(packet=>packet.choiceGroup==='primal-strike');assert.equal(choices.length,4);assert.deepEqual(choices.map(packet=>packet.type),['Cold','Fire','Lightning','Thunder']);const selected=selectedOptionalDamagePackets(choices,choices.flatMap(packet=>packet.label?[packet.label]:[]));assert.equal(selected.length,1);assert.equal(selected[0]?.choiceGroup,'primal-strike');
});

test('Wild Shape Temporary Hit Points vanish when the form ends or Incapacitation ends it',()=>{
  const c=character();const state=createInitialState(c);const wolf=availableTransformations(c,state).find(o=>o.profile==='wildshape'&&o.formId==='dire-wolf');assert.ok(wolf);
  startTransformation(c,state,wolf);assert.equal(state.tempHp,18);state.turn.bonusRemaining=1;endTransformation(state,true,c);assert.equal(state.tempHp,0);assert.equal(state.tempHpSource,undefined);
  state.turn.bonusRemaining=1;const again=availableTransformations(c,state).find(o=>o.profile==='wildshape'&&o.formId==='dire-wolf');assert.ok(again);startTransformation(c,state,again);applyCondition(c,state,'Stunned');assert.equal(state.activeTransform,undefined);assert.equal(state.tempHp,0);
});

test('Shapechange grants form HP as Temporary HP only for the first form and does not end at zero',()=>{
  const c=character({classes:[{name:'Wizard',level:17}],totalLevel:17});const state=createInitialState(c);
  const first=availableTransformations(c,state).find(o=>o.profile==='shapechange'&&o.formId==='polar-bear');assert.ok(first);startTransformation(c,state,first);assert.equal(state.tempHp,42);
  startNewTurn(state);const second=availableTransformations(c,state).find(o=>o.profile==='shapechange'&&o.formId==='dire-wolf');assert.ok(second);startTransformation(c,state,second);assert.equal(state.tempHp,42);assert.equal(state.activeTransform?.startedTurn,1);
  applyDamage(state,resolveSheet(c,state),42,'Force',c);assert.ok(state.activeTransform);assert.equal(state.tempHp,0);assert.ok(state.concentration);
  endConcentration(state,'Test ended.',c);assert.equal(state.activeTransform,undefined);assert.equal(state.tempHp,0);
});

test('Animal Shapes switches forms without refreshing Temporary HP and zero THP does not end it',()=>{
  const c=character({classes:[{name:'Druid',level:15}],totalLevel:15,spells:[{name:'Animal Shapes',level:8,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'magic-action'}],spellSlots:{'8':{current:1,max:1}}});const state=createInitialState(c);
  const first=availableTransformations(c,state).find(o=>o.profile==='animal-shapes'&&o.formId==='polar-bear');assert.ok(first);startTransformation(c,state,first);assert.equal(state.tempHp,42);assert.equal(state.concentration,undefined);
  startNewTurn(state);const second=availableTransformations(c,state).find(o=>o.profile==='animal-shapes'&&o.formId==='dire-wolf');assert.ok(second);startTransformation(c,state,second);assert.equal(state.tempHp,42);assert.equal(state.activeTransform?.startedTurn,1);
  applyDamage(state,resolveSheet(c,state),42,'Force',c);assert.ok(state.activeTransform);assert.equal(state.activeTransform?.option.profile,'animal-shapes');
});

test('True Polymorph supports non-Beast private forms and does not end when THP reaches zero',()=>{
  const c=character({classes:[{name:'Wizard',level:17}],totalLevel:17,spells:[{name:'True Polymorph',level:9,sourceClass:'Wizard',ability:'int',prepared:true,castingTime:'magic-action',concentration:true}],spellSlots:{'9':{current:1,max:1}},customForms:[{id:'private-fiend',name:'Private Fiend',type:'Fiend',cr:10,size:'Large',ac:17,hp:95,hitDice:'10d10+40',abilities:{str:20,dex:14,con:18,int:12,wis:14,cha:16},saves:{},skills:{},speeds:{walk:40},senses:['Darkvision 120 ft.'],resistances:['Fire'],immunities:[],vulnerabilities:[],traits:[],actions:[],source:{ruleset:'Private',page:'Owned content',verified:'User-entered'}}]});const state=createInitialState(c);
  const option=availableTransformations(c,state).find(o=>o.profile==='true-polymorph'&&o.formId==='private-fiend');assert.ok(option);startTransformation(c,state,option);assert.equal(state.tempHp,95);assert.equal(resolveSheet(c,state).canCast,false);
  applyDamage(state,resolveSheet(c,state),95,'Force',c);assert.ok(state.activeTransform);assert.equal(state.tempHp,0);
});

test('Alter Self exposes all natural-weapon damage choices and switches without another slot',()=>{
  const c=character({classes:[{name:'Wizard',level:5}],totalLevel:5,spells:[{name:'alter self',level:2,sourceClass:'Wizard',ability:'int',prepared:true,castingTime:'magic-action',concentration:true}],spellSlots:{'2':{current:1,max:1}}});const state=createInitialState(c);
  const options=availableTransformations(c,state);assert.ok(options.some(o=>o.id==='spell:alter-self:weapons-slashing'));assert.ok(options.some(o=>o.id==='spell:alter-self:weapons-piercing'));assert.ok(options.some(o=>o.id==='spell:alter-self:weapons-bludgeoning'));
  const slash=options.find(o=>o.id==='spell:alter-self:weapons-slashing');assert.ok(slash);startTransformation(c,state,slash);assert.equal(state.spellSlots['2']?.current,0);startNewTurn(state);
  const pierce=availableTransformations(c,state).find(o=>o.id==='spell:alter-self:weapons-piercing');assert.ok(pierce);startTransformation(c,state,pierce);assert.equal(state.spellSlots['2']?.current,0);assert.ok(resolveSheet(c,state).actions.some(a=>a.id.includes('piercing')));
});

test('Enlarge and Reduce apply size, Strength modes, and attack-damage modifiers',()=>{
  const c=character({classes:[{name:'Wizard',level:5}],totalLevel:5,spells:[{name:'Enlarge/Reduce',level:2,sourceClass:'Wizard',ability:'int',prepared:true,castingTime:'magic-action',concentration:true}],spellSlots:{'2':{current:2,max:2}}});const enlargeState=createInitialState(c);const enlarge=availableTransformations(c,enlargeState).find(o=>o.id==='spell:enlarge-reduce:enlarge');assert.ok(enlarge);startTransformation(c,enlargeState,enlarge);let sheet=resolveSheet(c,enlargeState);assert.equal(sheet.size,'Large');assert.ok(sheet.saves.str.advantageSources?.length);const unarmed=sheet.actions.find(a=>a.type==='attack'&&a.kind==='unarmed');assert.ok(unarmed);assert.ok(attackBonuses(c,enlargeState,sheet,unarmed).some(p=>p.expression==='1d4'));
  const reduceState=createInitialState(c);const reduce=availableTransformations(c,reduceState).find(o=>o.id==='spell:enlarge-reduce:reduce');assert.ok(reduce);startTransformation(c,reduceState,reduce);sheet=resolveSheet(c,reduceState);assert.equal(sheet.size,'Small');assert.ok(sheet.saves.str.disadvantageSources?.length);const reduced=sheet.actions.find(a=>a.type==='attack'&&a.kind==='unarmed');assert.ok(reduced);const penalty=attackBonuses(c,reduceState,sheet,reduced).find(p=>p.label?.startsWith('Reduce'));assert.equal(penalty?.expression,'-1d4');assert.equal(penalty?.doubleOnCritical,false);
});

test('Gaseous Form blocks ordinary actions, grants immunity to Prone, and ends at 0 HP',()=>{
  const c=character({classes:[{name:'Wizard',level:5}],totalLevel:5,hp:{current:8,max:8},spells:[{name:'Gaseous Form',level:3,sourceClass:'Wizard',ability:'int',prepared:true,castingTime:'magic-action',concentration:true}],spellSlots:{'3':{current:1,max:1}}});const state=createInitialState(c);const gaseous=availableTransformations(c,state).find(o=>o.id==='spell:gaseous-form');assert.ok(gaseous);startTransformation(c,state,gaseous);let sheet=resolveSheet(c,state);assert.equal(sheet.canAttack,false);assert.equal(sheet.canCast,false);assert.equal(sheet.canSpeak,false);assert.equal(sheet.speeds.fly,10);assert.equal(sheet.actions.length,1);assert.equal(sheet.actions[0]?.id,'gaseous-form-dash');assert.match(applyCondition(c,state,'Prone').message,/immune/);assert.equal(state.conditions.includes('Prone'),false);
  applyDamage(state,sheet,8,'Force',c);sheet=resolveSheet(c,state);assert.equal(state.overlays.includes('spell:gaseous-form'),false);assert.equal(state.concentration,undefined);assert.equal(sheet.canAttack,false);assert.ok(state.conditions.includes('Unconscious'));
});

test('private overlay mechanics can end at zero HP without hard-coded spell identifiers',()=>{
  const c=character({transformationGrants:[{id:'private-mist',label:'Private Mist',profile:'overlay',formIds:[],source:'Owned content',actionCost:'bonus',endActionCost:'none',effects:{canAttack:false,endsAtZeroHp:true}}]});const state=createInitialState(c);state.hp=1;const option=availableTransformations(c,state).find(o=>o.grantId==='private-mist');assert.ok(option);startTransformation(c,state,option);assert.ok(state.overlays.includes('private-mist'));applyDamage(state,resolveSheet(c,state),1,'Force',c);assert.equal(state.overlays.includes('private-mist'),false);
});


test('a spellcasting-valid transformed form can replace Shapechange with Polymorph',()=>{
  const c=character({classes:[{name:'Wizard',level:17}],totalLevel:17,spells:[
    {name:'Polymorph',level:4,sourceClass:'Wizard',ability:'int',prepared:true,castingTime:'magic-action',concentration:true},
    {name:'Shapechange',level:9,sourceClass:'Wizard',ability:'int',prepared:true,castingTime:'magic-action',concentration:true}
  ],spellSlots:{'4':{current:1,max:1},'9':{current:1,max:1}}});
  const state=createInitialState(c);const shape=availableTransformations(c,state).find(o=>o.profile==='shapechange'&&o.formId==='polar-bear');assert.ok(shape);startTransformation(c,state,shape);assert.equal(state.concentration?.name,'Shapechange');
  startNewTurn(state);const poly=availableTransformations(c,state).find(o=>o.profile==='polymorph'&&o.formId==='dire-wolf');assert.ok(poly);assert.equal(poly.usable,true);const result=startTransformation(c,state,poly);assert.equal(result.choice,undefined);assert.equal(state.activeTransform?.option.profile,'polymorph');assert.equal(state.concentration?.name,'Polymorph');assert.equal(state.tempHp,22);
});

test('True Polymorph can complete its full hour without ending the transformed state',()=>{
  const privateForm={id:'private-undead',name:'Private Undead',type:'undead',cr:10,size:'Medium',ac:16,hp:80,hitDice:'10d8+30',abilities:{str:16,dex:14,con:16,int:10,wis:12,cha:14},saves:{},skills:{},speeds:{walk:30},senses:['Darkvision 60 ft.'],resistances:['Necrotic'],immunities:[],vulnerabilities:[],traits:[],actions:[],artKey:'base',source:{ruleset:'Private',page:'Owned content',verified:'User-entered'}};
  const c=character({classes:[{name:'Wizard',level:17}],totalLevel:17,customForms:[privateForm],seenForms:['private-undead'],spells:[{name:'True Polymorph',level:9,sourceClass:'Wizard',ability:'int',prepared:true,castingTime:'magic-action',concentration:true}],spellSlots:{'9':{current:1,max:1}}});
  const state=createInitialState(c);const option=availableTransformations(c,state).find(o=>o.profile==='true-polymorph'&&o.formId==='private-undead');assert.ok(option);startTransformation(c,state,option);assert.equal(resolveSheet(c,state).creatureType,'Undead');const result=completeTruePolymorph(state);assert.match(result.message,/lasts until dispelled/);assert.equal(state.concentration,undefined);assert.equal(state.activeTransform?.permanentUntilDispelled,true);assert.equal(state.activeTransform?.duration,'Until dispelled');assert.equal(state.activeTransform?.option.formId,'private-undead');
});

test('official replacement profiles retain or replace creature type correctly',()=>{
  const c=character({creatureType:'Humanoid'});const wildState=createInitialState(c);const wolf=availableTransformations(c,wildState).find(o=>o.profile==='wildshape'&&o.formId==='dire-wolf');assert.ok(wolf);startTransformation(c,wildState,wolf);assert.equal(resolveSheet(c,wildState).creatureType,'Humanoid');
  const wizard=character({classes:[{name:'Wizard',level:17}],totalLevel:17,creatureType:'Humanoid'});const polyState=createInitialState(wizard);const poly=availableTransformations(wizard,polyState).find(o=>o.profile==='polymorph'&&o.formId==='dire-wolf');assert.ok(poly);startTransformation(wizard,polyState,poly);assert.equal(resolveSheet(wizard,polyState).creatureType,'Humanoid');
  const shapeState=createInitialState(wizard);const shape=availableTransformations(wizard,shapeState).find(o=>o.profile==='shapechange'&&o.formId==='dire-wolf');assert.ok(shape);startTransformation(wizard,shapeState,shape);assert.equal(resolveSheet(wizard,shapeState).creatureType,'Humanoid');
  const druid=character({classes:[{name:'Druid',level:15}],totalLevel:15,creatureType:'Humanoid',spells:[{name:'Animal Shapes',level:8,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'magic-action'}],spellSlots:{'8':{current:1,max:1}}});const animalState=createInitialState(druid);const animal=availableTransformations(druid,animalState).find(o=>o.profile==='animal-shapes'&&o.formId==='dire-wolf');assert.ok(animal);startTransformation(druid,animalState,animal);assert.equal(resolveSheet(druid,animalState).creatureType,'Humanoid');
});

test('Animal Shapes can be cast from a form that validly retains spellcasting',()=>{
  const c=character({classes:[{name:'Druid',level:18,subclass:'Circle of the Land'}],totalLevel:18,knownForms:['dire-wolf'],spells:[{name:'Animal Shapes',level:8,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'magic-action'}],spellSlots:{'8':{current:1,max:1}}});const state=createInitialState(c);
  const wolf=availableTransformations(c,state).find(o=>o.profile==='wildshape'&&o.formId==='dire-wolf');assert.ok(wolf);startTransformation(c,state,wolf);
  const animal=availableTransformations(c,state).find(o=>o.profile==='animal-shapes'&&o.formId==='brown-bear');assert.ok(animal);assert.equal(animal.usable,true);startTransformation(c,state,animal);assert.equal(state.activeTransform?.option.profile,'animal-shapes');assert.equal(state.spellSlots['8']?.current,0);
});

test('permanent True Polymorph requires an external ending event',()=>{
  const privateForm={id:'private-fiend-external',name:'Private Fiend',type:'Fiend',cr:10,size:'Medium',ac:16,hp:80,hitDice:'10d8+30',abilities:{str:16,dex:14,con:16,int:10,wis:12,cha:14},saves:{},skills:{},speeds:{walk:30},senses:[],resistances:[],immunities:[],vulnerabilities:[],traits:[],actions:[],source:{ruleset:'Private',page:'Owned content',verified:'User-entered'}};
  const c=character({classes:[{name:'Wizard',level:17}],totalLevel:17,customForms:[privateForm],spells:[{name:'True Polymorph',level:9,sourceClass:'Wizard',ability:'int',prepared:true,castingTime:'magic-action',concentration:true}],spellSlots:{'9':{current:1,max:1}}});const state=createInitialState(c);const option=availableTransformations(c,state).find(o=>o.profile==='true-polymorph'&&o.formId==='private-fiend-external');assert.ok(option);startTransformation(c,state,option);completeTruePolymorph(state);
  assert.match(endTransformation(state,true,c).message,/cannot be ended voluntarily/);assert.ok(state.activeTransform);assert.match(endTransformation(state,false,c).message,/Base Form restored/);assert.equal(state.activeTransform,undefined);
});


test('Long Rest preserves only transformations whose rules can outlast the rest',()=>{
  const animalCharacter=character({classes:[{name:'Druid',level:15}],totalLevel:15,hp:{current:20,max:80},spells:[{name:'Animal Shapes',level:8,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'magic-action'}],spellSlots:{'8':{current:1,max:1}}});const animalState=createInitialState(animalCharacter);const animal=availableTransformations(animalCharacter,animalState).find(o=>o.profile==='animal-shapes'&&o.formId==='dire-wolf');assert.ok(animal);startTransformation(animalCharacter,animalState,animal);assert.equal(animalState.tempHp,22);longRest(animalCharacter,animalState);assert.equal(animalState.activeTransform?.option.profile,'animal-shapes');assert.equal(animalState.tempHp,0);assert.equal(animalState.hp,80);
  const wildCharacter=character();const wildState=createInitialState(wildCharacter);const wolf=availableTransformations(wildCharacter,wildState).find(o=>o.profile==='wildshape'&&o.formId==='dire-wolf');assert.ok(wolf);startTransformation(wildCharacter,wildState,wolf);longRest(wildCharacter,wildState);assert.equal(wildState.activeTransform,undefined);assert.equal(wildState.tempHp,0);
});

test('Long Rest does not erase permanent True Polymorph',()=>{
  const form={id:'lasting-fiend',name:'Lasting Fiend',type:'Fiend',cr:10,size:'Medium',ac:16,hp:80,hitDice:'10d8+30',abilities:{str:16,dex:14,con:16,int:10,wis:12,cha:14},saves:{},skills:{},speeds:{walk:30},senses:[],resistances:[],immunities:[],vulnerabilities:[],traits:[],actions:[],source:{ruleset:'Private',page:'Owned content',verified:'User-entered'}};
  const c=character({classes:[{name:'Wizard',level:17}],totalLevel:17,hp:{current:50,max:100},customForms:[form],spells:[{name:'True Polymorph',level:9,sourceClass:'Wizard',ability:'int',prepared:true,castingTime:'magic-action',concentration:true}],spellSlots:{'9':{current:1,max:1}}});const state=createInitialState(c);const option=availableTransformations(c,state).find(o=>o.profile==='true-polymorph'&&o.formId==='lasting-fiend');assert.ok(option);startTransformation(c,state,option);completeTruePolymorph(state);longRest(c,state);assert.equal(state.activeTransform?.permanentUntilDispelled,true);assert.equal(state.activeTransform?.option.formId,'lasting-fiend');assert.equal(state.tempHp,0);assert.equal(state.hp,100);
});


test('Dragonborn Draconic Flight uses a species resource, matches current Speed, and ends on Incapacitation',()=>{
  const c=character({species:'Dragonborn',classes:[{name:'Fighter',level:5}],totalLevel:5,knownForms:[],seenForms:[],spells:[],spellSlots:{},speed:35});const state=createInitialState(c);
  const flight=availableTransformations(c,state).find(option=>option.grantId==='dragonborn-draconic-flight');assert.ok(flight);assert.equal(flight.actionCost,'bonus');startTransformation(c,state,flight);assert.equal(resolveSheet(c,state).speeds.fly,35);assert.equal(state.resources['dragonborn-draconic-flight']?.current,0);
  applyCondition(c,state,'Incapacitated');assert.equal(state.overlays.includes('dragonborn-draconic-flight'),false);
});

test('Goliath Large Form can continue through Wild Shape but cannot be activated after transforming',()=>{
  const c=character({species:'Goliath'});const state=createInitialState(c);const large=availableTransformations(c,state).find(option=>option.grantId==='goliath-large-form');assert.ok(large);startTransformation(c,state,large);state.turn.bonusRemaining=1;const wolf=availableTransformations(c,state).find(option=>option.profile==='wildshape'&&option.formId==='dire-wolf');assert.ok(wolf);startTransformation(c,state,wolf);assert.equal(resolveSheet(c,state).size,'Large');
  const fresh=createInitialState(c);const wolfFirst=availableTransformations(c,fresh).find(option=>option.profile==='wildshape'&&option.formId==='dire-wolf');assert.ok(wolfFirst);startTransformation(c,fresh,wolfFirst);assert.equal(availableTransformations(c,fresh).some(option=>option.grantId==='goliath-large-form'&&!option.deactivate),false);
});

test('Draconic Sorcery Dragon Wings can be restored with 3 Sorcery Points',()=>{
  const c=character({classes:[{name:'Sorcerer',level:14,subclass:'Draconic Sorcery'}],totalLevel:14,knownForms:[],seenForms:[],spells:[],spellSlots:{}});const state=createInitialState(c);const wings=availableTransformations(c,state).find(option=>option.grantId==='sorcerer-dragon-wings');assert.ok(wings);startTransformation(c,state,wings);assert.equal(resolveSheet(c,state).speeds.fly,60);assert.equal(state.resources['sorcerer-dragon-wings']?.current,0);assert.equal(state.resources['sorcery-points']?.current,14);
  restoreDragonWings(c,state);assert.equal(state.resources['sorcerer-dragon-wings']?.current,1);assert.equal(state.resources['sorcery-points']?.current,11);
});

test('overlay forms preserve imported save and skill totals while adjusting for changed abilities',()=>{
  const c=character({classes:[{name:'Wizard',level:5}],totalLevel:5,knownForms:[],seenForms:[],spells:[],spellSlots:{},abilities:{str:10,dex:14,con:12,int:18,wis:10,cha:10},saveBonuses:{str:3,dex:7},skillBonuses:{Athletics:4,Stealth:8},transformationGrants:[{id:'strength-overlay',label:'Strength Overlay',profile:'overlay',formIds:[],source:'Fixture',actionCost:'bonus',effects:{abilitySet:{str:18,dex:10}}}]});const state=createInitialState(c);const option=availableTransformations(c,state).find(entry=>entry.grantId==='strength-overlay');assert.ok(option);startTransformation(c,state,option);const sheet=resolveSheet(c,state);
  assert.equal(sheet.saves.str.modifier,7);assert.equal(sheet.saves.dex.modifier,5);assert.equal(sheet.skills.Athletics?.modifier,8);assert.equal(sheet.skills.Stealth?.modifier,6);
});

test('condition immunity suppresses condition penalties and Frightened is surfaced without guessing line of sight',()=>{
  const c=character({classes:[{name:'Fighter',level:5}],totalLevel:5,knownForms:[],seenForms:[],spells:[],spellSlots:{},transformationGrants:[{id:'fearless',label:'Fearless Form',profile:'overlay',formIds:[],source:'Fixture',actionCost:'bonus',effects:{conditionImmunities:['Frightened']}}]});const state=createInitialState(c);state.conditions.push('Frightened');let sheet=resolveSheet(c,state);const attack=sheet.actions.find(action=>action.type==='attack');assert.ok(attack);const baseRules=attackRollSources(c,state,attack,sheet);assert.equal(baseRules.mode,'normal');assert.equal(baseRules.conditional.length,1);assert.equal(sheet.skills.Athletics?.conditionalSources?.length,1);
  const option=availableTransformations(c,state).find(entry=>entry.grantId==='fearless');assert.ok(option);startTransformation(c,state,option);sheet=resolveSheet(c,state);const transformedAttack=sheet.actions.find(action=>action.type==='attack');assert.ok(transformedAttack);assert.equal(attackRollSources(c,state,transformedAttack,sheet).conditional.length,0);assert.equal(sheet.skills.Athletics?.conditionalSources?.length??0,0);
});

test('2024 Unarmed Strike exposes damage, Grapple, and Shove with the correct save DC',()=>{
  const c=character({classes:[{name:'Fighter',level:5}],totalLevel:5,knownForms:[],seenForms:[],abilities:{str:16,dex:12,con:14,int:10,wis:10,cha:10}});const state=createInitialState(c);const actions=resolveSheet(c,state).actions;
  const damage=actions.find(action=>action.id==='unarmed');assert.equal(damage?.type,'attack');if(damage?.type==='attack'){assert.equal(damage.attackBonus,6);assert.equal(damage.damage[0]?.expression,'4');}
  const grapple=actions.find(action=>action.id==='unarmed-grapple');assert.equal(grapple?.type,'save');if(grapple?.type==='save'){assert.equal(grapple.dc,14);assert.deepEqual(grapple.saveAbilityOptions,['str','dex']);assert.equal(grapple.effectsOnFail?.[0]?.condition,'Grappled');assert.equal(grapple.effectsOnFail?.[0]?.targetSizeMax,'Large');}
  const shove=actions.find(action=>action.id==='unarmed-shove');assert.equal(shove?.type,'save');if(shove?.type==='save')assert.match(shove.effectsOnFail?.[0]?.note??'',/push the target 5 feet/);
});

test('Initiative uses the current form Dexterity and retains 2024 Initiative features',()=>{
  const c=character();const state=createInitialState(c);
  assert.equal(resolveSheet(c,state).initiative.modifier,2);
  const bear=availableTransformations(c,state).find(option=>option.profile==='wildshape'&&option.formId==='brown-bear');assert.ok(bear);startTransformation(c,state,bear);
  let initiative=resolveSheet(c,state).initiative;assert.equal(initiative.modifier,1);assert.match(initiative.source,/Brown Bear Dexterity/);
  applyCondition(c,state,'Poisoned');initiative=resolveSheet(c,state).initiative;assert.ok(initiative.disadvantageSources?.includes('Poisoned'));

  const champion=character({classes:[{name:'Fighter',level:3,subclass:'Champion'}],knownForms:[],seenForms:[],feats:['Alert']});const championInitiative=resolveSheet(champion,createInitialState(champion)).initiative;
  assert.equal(championInitiative.modifier,4);assert.ok(championInitiative.advantageSources?.includes('Remarkable Athlete'));assert.match(championInitiative.source,/Alert proficiency/);
});

test('Champion critical range applies only to weapon and Unarmed Strike attacks',()=>{
  const c=character({classes:[{name:'Fighter',level:15,subclass:'Champion'}],totalLevel:15,knownForms:[],seenForms:[]});const state=createInitialState(c);const unarmed=resolveSheet(c,state).actions.find(action=>action.id==='unarmed');assert.ok(unarmed);assert.equal(criticalHitThreshold(c,must(unarmed)),18);
  const beast:AttackAction={id:'bite',name:'Bite',type:'attack',cost:'action',attackBonus:5,ability:'str',kind:'beast',damage:[{expression:'1d8+3',type:'Piercing'}]};assert.equal(criticalHitThreshold(c,beast),20);
  const level3=character({classes:[{name:'Fighter',level:3,subclass:'Champion'}],totalLevel:3,knownForms:[],seenForms:[]});assert.equal(criticalHitThreshold(level3,must(resolveSheet(level3,createInitialState(level3)).actions.find(action=>action.id==='unarmed'))),19);
});

test('attack d20 resolution is deterministic for Advantage, Disadvantage, natural 1, and expanded criticals',()=>{
  const sequence=(...values:number[])=>{let index=0;return ()=>values[index++]??values.at(-1)??0};
  const advantage=rollAttackD20(5,'advantage',20,sequence(0,.95));assert.deepEqual({first:advantage.first,second:advantage.second,kept:advantage.kept,total:advantage.total,naturalTwenty:advantage.naturalTwenty},{first:1,second:20,kept:20,total:25,naturalTwenty:true});
  const disadvantage=rollAttackD20(5,'disadvantage',20,sequence(0,.95));assert.equal(disadvantage.kept,1);assert.equal(disadvantage.naturalOne,true);assert.equal(disadvantage.critical,false);
  const champion=rollAttackD20(7,'normal',19,sequence(.9));assert.equal(champion.kept,19);assert.equal(champion.critical,true);assert.equal(champion.naturalTwenty,false);
  assert.equal(criticalDiceExpression('1d8+2d6+3'),'2d8+4d6+3');
  assert.equal(criticalDiceExpression('4'),'4');
});

test('conditional attack modifiers for Grappled and Pack Tactics are surfaced without guessing the target',()=>{
  const c=character();const state=createInitialState(c);state.conditions.push('Grappled');let sheet=resolveSheet(c,state);let attack=sheet.actions.find(action=>action.type==='attack');assert.ok(attack);assert.match(attackRollSources(c,state,must(attack),sheet).conditional.join(' '),/other than the grappler/);
  state.conditions=[];const wolf=availableTransformations(c,state).find(option=>option.formId==='dire-wolf'&&option.profile==='wildshape');assert.ok(wolf);startTransformation(c,state,must(wolf));sheet=resolveSheet(c,state);attack=sheet.actions.find(action=>action.type==='attack');assert.ok(attack);assert.match(attackRollSources(c,state,must(attack),sheet).conditional.join(' '),/Pack Tactics/);
});

test('choice-bearing actions are structured for beasts, rogues, multiclass characters, and Thief Fast Hands',()=>{
  const tiger=must(CREATURES.tiger).actions.find(action=>action.id==='nimble-escape');assert.equal(tiger?.type,'automatic');if(tiger?.type==='automatic')assert.deepEqual(tiger.choices?.map(choice=>choice.resolution),['disengage','hide']);
  const rogue=character({classes:[{name:'Rogue',level:3,subclass:'Thief'},{name:'Druid',level:2}],totalLevel:5,knownForms:['panther'],seenForms:['panther']});const state=createInitialState(rogue);const baseAction=resolveSheet(rogue,state).actions.find(action=>action.id==='cunning-action');assert.equal(baseAction?.type,'automatic');if(baseAction?.type==='automatic')assert.deepEqual(baseAction.choices?.map(choice=>choice.resolution),['dash','disengage','hide','skill-check','utilize','magic-item']);
  const panther=availableTransformations(rogue,state).find(option=>option.formId==='panther'&&option.profile==='wildshape');assert.ok(panther);startTransformation(rogue,state,must(panther));assert.ok(resolveSheet(rogue,state).actions.some(action=>action.id==='cunning-action'),'retained multiclass choice action remains available in Wild Shape');
});

test('Hidden grants attack Advantage and ends immediately after the attack roll is made',()=>{
  const c=character({classes:[{name:'Rogue',level:2}],totalLevel:2,knownForms:[],seenForms:[]});const state=createInitialState(c);state.conditions.push('Hidden');const attack=must(resolveSheet(c,state).actions.find(action=>action.type==='attack'));assert.ok(attackRollSources(c,state,attack).sources.advantage.includes('Hidden'));declareAttack(state,attack);assert.equal(state.conditions.includes('Hidden'),false);
});

test('Invisible grants attack Advantage and transformed condition immunity can suppress an existing incapacitating condition',()=>{
  const form={id:'unstunnable-form',name:'Unstunnable Form',type:'Construct',cr:2,size:'Medium',ac:15,hp:30,hitDice:'4d8+12',abilities:{str:16,dex:12,con:16,int:8,wis:10,cha:6},saves:{},skills:{},speeds:{walk:30},senses:[],resistances:[],immunities:[],vulnerabilities:[],conditionImmunities:['Stunned'],traits:[],actions:[{id:'slam',name:'Slam',type:'attack',cost:'action',attackBonus:5,ability:'str',kind:'beast',damage:[{expression:'1d8+3',type:'Bludgeoning'}]}],artKey:'base',source:{ruleset:'Private',page:'Fixture',verified:'Test'}};
  const c=character({classes:[{name:'Fighter',level:5}],totalLevel:5,knownForms:[],seenForms:[],spells:[],spellSlots:{},customForms:[form],transformationGrants:[{id:'unstunnable',label:'Unstunnable Form',profile:'custom',formIds:['unstunnable-form'],source:'Fixture',actionCost:'free',retention:{hp:true,hitDice:true,mentalAbilities:false,proficiencies:false,creatureType:false,classFeatures:false,feats:false,spellcasting:false,speech:false}}]});
  const invisible=createInitialState(c);invisible.conditions.push('Invisible');let sheet=resolveSheet(c,invisible);const attack=sheet.actions.find(action=>action.type==='attack');assert.ok(attack);assert.equal(attackRollSources(c,invisible,attack,sheet).mode,'advantage');
  const state=createInitialState(c);state.conditions.push('Stunned');const option=availableTransformations(c,state).find(entry=>entry.grantId==='unstunnable');assert.ok(option);startTransformation(c,state,option);sheet=resolveSheet(c,state);assert.equal(sheet.canAttack,true);assert.ok(sheet.conditionImmunities.includes('Stunned'));assert.equal(spendActionCost(state,'action',sheet.conditionImmunities),null);
});

test('overlay ability changes update base-form attack calculations',()=>{
  const c=character({classes:[{name:'Fighter',level:5}],totalLevel:5,knownForms:[],seenForms:[],spells:[],spellSlots:{},abilities:{str:10,dex:12,con:12,int:10,wis:10,cha:10},transformationGrants:[{id:'mighty',label:'Mighty Form',profile:'overlay',formIds:[],source:'Fixture',actionCost:'bonus',effects:{abilitySet:{str:18}}}]});const state=createInitialState(c);const option=availableTransformations(c,state).find(entry=>entry.grantId==='mighty');assert.ok(option);startTransformation(c,state,option);const unarmed=resolveSheet(c,state).actions.find(action=>action.id==='unarmed');assert.ok(unarmed&&unarmed.type==='attack');assert.equal(unarmed.attackBonus,7);assert.equal(unarmed.damage[0]?.expression,'5');
});

test('Exhaustion levels reduce every D20 Test and Speed, recover one per Long Rest, and cause death at level 6',()=>{
  const c=character({classes:[{name:'Fighter',level:5}],totalLevel:5,knownForms:[],seenForms:[],spells:[],spellSlots:{}});
  const state=createInitialState(c);const base=resolveSheet(c,state);const baseAttack=base.actions.find(action=>action.type==='attack');assert.ok(baseAttack?.type==='attack');
  applyCondition(c,state,'Exhaustion');applyCondition(c,state,'Exhaustion');
  let sheet=resolveSheet(c,state);const tiredAttack=sheet.actions.find(action=>action.id===baseAttack.id);assert.ok(tiredAttack?.type==='attack');
  assert.equal(state.exhaustionLevel,2);assert.equal(tiredAttack.attackBonus,baseAttack.attackBonus-4);
  assert.equal(sheet.saves.wis.modifier,base.saves.wis.modifier-4);
  assert.equal(sheet.skills.Perception?.modifier,(base.skills.Perception?.modifier??0)-4);
  assert.equal(sheet.initiative.modifier,base.initiative.modifier-4);
  assert.equal(sheet.speeds.walk,(base.speeds.walk??0)-10);
  removeCondition(state,'Exhaustion');assert.equal(state.exhaustionLevel,1);
  longRest(c,state);assert.equal(state.exhaustionLevel,0);assert.ok(!state.conditions.includes('Exhaustion'));
  for(let level=0;level<6;level++)applyCondition(c,state,'Exhaustion');
  sheet=resolveSheet(c,state);assert.equal(state.hp,0);assert.equal(sheet.canAttack,false);assert.match(heal(state,c,10).message,/cannot restore/i);assert.match(spendActionCost(state,'action')??'',/dead/);
  assert.match(longRest(c,state).message,/cannot start/);
  clearConditions(state);assert.equal(state.exhaustionLevel,0);assert.deepEqual(state.conditions,[]);
});

test('transformation spells obey the one-slot-spell-per-turn rule and mark their slot expenditure',()=>{
  const c=character({spells:[
    {name:'Barkskin',level:2,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'bonus'},
    {name:'Polymorph',level:4,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'magic-action',concentration:true}
  ],spellSlots:{'2':{current:1,max:1},'4':{current:1,max:1}}});const state=createInitialState(c);
  const polymorph=availableTransformations(c,state).find(option=>option.profile==='polymorph');assert.ok(polymorph);
  const barkskin=castSpell(c,state,'Barkskin');assert.match(barkskin.message,/Cast Barkskin/);assert.equal(state.turn.slotSpellCast,true);assert.equal(state.turn.actionsRemaining,1);
  const blocked=availableTransformations(c,state).find(option=>option.id===polymorph.id);assert.ok(blocked);assert.equal(blocked.usable,false);assert.match(blocked.reason??'',/already been expended/);
  const beforeSlot=state.spellSlots['4']?.current;const beforeActions=state.turn.actionsRemaining;const result=startTransformation(c,state,polymorph);
  assert.match(result.message,/already been expended/);assert.equal(state.spellSlots['4']?.current,beforeSlot);assert.equal(state.turn.actionsRemaining,beforeActions);
  startNewTurn(state);const ready=availableTransformations(c,state).find(option=>option.id===polymorph.id);assert.ok(ready?.usable);startTransformation(c,state,ready);
  assert.equal(state.spellSlots['4']?.current,0);assert.equal(state.turn.slotSpellCast,true);
});

test('2024 Relentless Rage queues its save, restores twice Barbarian level, and raises then resets its DC',()=>{
  const c=character({classes:[{name:'Barbarian',level:11}],totalLevel:11,knownForms:[],seenForms:[],spells:[],spellSlots:{},hp:{current:60,max:60}});
  const state=createInitialState(c);startRage(c,state);applyDamage(state,resolveSheet(c,state),60,'Force',c);
  assert.equal(state.hp,0);assert.equal(state.pendingRelentlessRage?.dc,10);assert.ok(!state.conditions.includes('Unconscious'));
  resolveRelentlessRage(c,state,10);assert.equal(state.hp,22);assert.equal(state.relentlessRageDc,15);assert.ok(!state.conditions.includes('Unconscious'));
  applyDamage(state,resolveSheet(c,state),22,'Force',c);assert.equal(state.pendingRelentlessRage?.dc,15);
  resolveRelentlessRage(c,state,14);assert.equal(state.hp,0);assert.equal(state.relentlessRageDc,20);assert.ok(state.conditions.includes('Unconscious'));assert.equal(state.rage.active,false);
  heal(state,c,1);shortRest(state);assert.equal(state.relentlessRageDc,10);
});

test('0 HP, massive damage, damage at 0, healing, and Death Saving Throws follow the 2024 life-state rules',()=>{
  const c=character({classes:[{name:'Fighter',level:1}],totalLevel:1,knownForms:[],seenForms:[],spells:[],spellSlots:{},hp:{current:10,max:10}});
  const state=createInitialState(c);applyDamage(state,resolveSheet(c,state),10,'Force',c);
  assert.equal(state.hp,0);assert.ok(state.conditions.includes('Unconscious'));assert.equal(state.life.dead,false);
  applyDamage(state,resolveSheet(c,state),1,'Force',c);assert.equal(state.life.deathSaveFailures,1);
  resolveDeathSave(c,state,1);assert.equal(state.life.dead,true);assert.match(heal(state,c,5).message,/dead/);
  const healed=createInitialState(c);applyDamage(healed,resolveSheet(c,healed),10,'Force',c);heal(healed,c,3);
  assert.equal(healed.hp,3);assert.ok(!healed.conditions.includes('Unconscious'));assert.deepEqual(healed.life,{dead:false,stable:false,deathSaveSuccesses:0,deathSaveFailures:0});
  const critical=createInitialState(c);applyDamage(critical,resolveSheet(c,critical),20,'Force',c);assert.equal(critical.life.dead,true);
  const saves=createInitialState(c);applyDamage(saves,resolveSheet(c,saves),10,'Force',c);
  resolveDeathSave(c,saves,10);resolveDeathSave(c,saves,12);resolveDeathSave(c,saves,15);assert.equal(saves.life.stable,true);
  const naturalTwenty=createInitialState(c);applyDamage(naturalTwenty,resolveSheet(c,naturalTwenty),10,'Force',c);resolveDeathSave(c,naturalTwenty,20);assert.equal(naturalTwenty.hp,1);assert.ok(!naturalTwenty.conditions.includes('Unconscious'));
});

test('retained class features govern Feral Senses, Champion criticals, Rage Damage, Radiant Strikes, and Petrified immunity',()=>{
  const ranger=character({classes:[{name:'Ranger',level:18}],totalLevel:18,knownForms:[],seenForms:[],spells:[],spellSlots:{}});const rangerState=createInitialState(ranger);
  assert.ok(resolveSheet(ranger,rangerState).senses.includes('Blindsight 30 ft. (Feral Senses)'));
  applyCondition(ranger,rangerState,'Petrified');assert.ok(resolveSheet(ranger,rangerState).conditionImmunities.includes('Poisoned'));
  const form={id:'featureless',name:'Featureless Form',type:'Construct',cr:1,size:'Medium',ac:13,hp:20,hitDice:'3d8+6',abilities:{str:16,dex:12,con:14,int:8,wis:10,cha:8},saves:{},skills:{},speeds:{walk:30},senses:[],resistances:[],immunities:[],vulnerabilities:[],traits:[],actions:[{id:'blade',name:'Blade',type:'attack',cost:'action',attackBonus:5,ability:'str',kind:'weapon',reach:5,damage:[{expression:'1d8+3',type:'Slashing'}]}],source:{ruleset:'Private',page:'Fixture',verified:'Test'}};
  const grant={id:'featureless-form',label:'Featureless Form',profile:'custom' as const,formIds:['featureless'],source:'Fixture',actionCost:'free' as const,retention:{hp:true,hitDice:true,mentalAbilities:false,proficiencies:false,creatureType:false,classFeatures:false,feats:false,spellcasting:false,speech:false}};
  const c=character({classes:[{name:'Barbarian',level:1},{name:'Paladin',level:11}],totalLevel:12,knownForms:[],seenForms:[],spells:[],spellSlots:{},customForms:[form],transformationGrants:[grant]});
  const state=createInitialState(c);startRage(c,state);const option=availableTransformations(c,state).find(entry=>entry.formId==='featureless');assert.ok(option);startTransformation(c,state,option);const sheet=resolveSheet(c,state);const attack=sheet.actions.find(entry=>entry.id==='blade');assert.ok(attack?.type==='attack');
  assert.equal(attackBonuses(c,state,sheet,attack).some(packet=>packet.label==='Rage Damage'||packet.label==='Radiant Strikes'),false);assert.equal(sheet.senses.includes('Blindsight 30 ft. (Feral Senses)'),false);
  const champion=character({classes:[{name:'Fighter',level:15,subclass:'Champion'}],totalLevel:15,knownForms:[],seenForms:[],spells:[],spellSlots:{},customForms:[form],transformationGrants:[grant]});const championState=createInitialState(champion);const championOption=availableTransformations(champion,championState).find(entry=>entry.formId==='featureless');assert.ok(championOption);startTransformation(champion,championState,championOption);const championAttack=resolveSheet(champion,championState).actions.find(entry=>entry.id==='blade');assert.ok(championAttack);assert.equal(criticalHitThreshold(champion,championAttack,championState),20);
});

test('2024 Jack of All Trades, Reliable Talent, Slippery Mind, and Indomitable Might alter only eligible rolls',()=>{
  const bard=character({classes:[{name:'Bard',level:2}],totalLevel:2,knownForms:[],seenForms:[],spells:[],spellSlots:{},proficiencies:{saves:{dex:1,cha:1},skills:{Performance:1}}});const bardSheet=resolveSheet(bard,createInitialState(bard));
  assert.equal(bardSheet.skills.Athletics?.modifier,Math.floor((bard.abilities.str-10)/2)+1);assert.equal(bardSheet.skills.Performance?.modifier,Math.floor((bard.abilities.cha-10)/2)+2);
  const rogue=character({classes:[{name:'Rogue',level:15}],totalLevel:15,knownForms:[],seenForms:[],spells:[],spellSlots:{},proficiencies:{saves:{dex:1,int:1},skills:{Stealth:2,Perception:1}}});const rogueSheet=resolveSheet(rogue,createInitialState(rogue));
  assert.equal(rogueSheet.skills.Stealth?.minimumD20,10);assert.equal(rogueSheet.skills.Athletics?.minimumD20,undefined);assert.equal(rogueSheet.saves.wis.proficiency,1);assert.equal(rogueSheet.saves.cha.proficiency,1);
  const barbarian=character({classes:[{name:'Barbarian',level:18}],totalLevel:18,knownForms:[],seenForms:[],spells:[],spellSlots:{},abilities:{str:22,dex:14,con:18,int:8,wis:10,cha:8},proficiencies:{saves:{str:1,con:1},skills:{Athletics:1}}});const barbSheet=resolveSheet(barbarian,createInitialState(barbarian));
  assert.equal(barbSheet.saves.str.minimumTotal,22);assert.equal(barbSheet.skills.Athletics?.minimumTotal,22);assert.equal(barbSheet.skills.Perception?.minimumTotal,undefined);
});

test('SRD subclass features are classified honestly and Berserker Mindless Rage and Champion Survivor execute',()=>{
  const berserker=character({classes:[{name:'Barbarian',level:6,subclass:'Path of the Berserker'}],totalLevel:6,knownForms:[],seenForms:[],spells:[],spellSlots:{}});const berserkerState=createInitialState(berserker);applyCondition(berserker,berserkerState,'Frightened');startRage(berserker,berserkerState);const berserkerSheet=resolveSheet(berserker,berserkerState);
  assert.ok(!berserkerState.conditions.includes('Frightened'));assert.ok(berserkerSheet.conditionImmunities.includes('Frightened'));assert.equal(berserkerSheet.features.find(feature=>feature.id==='mindless-rage')?.status,'active');assert.equal(berserkerSheet.features.find(feature=>feature.id==='berserker-frenzy')?.status,'conditional');
  const champion=character({classes:[{name:'Fighter',level:18,subclass:'Champion'}],totalLevel:18,knownForms:[],seenForms:[],spells:[],spellSlots:{},hp:{current:10,max:100}});const state=createInitialState(champion);applyDamage(state,resolveSheet(champion,state),10,'Force',champion);
  assert.equal(deathSaveMode(champion,state).mode,'advantage');resolveDeathSave(champion,state,18);assert.equal(state.hp,1);
});

test('legacy Astral Arms compatibility exposes stable WIS Damage, Grapple, Shove, and Flurry choices without duplicate limits',()=>{
  const c=character({classes:[{name:'Monk',level:5,subclass:'Warrior of the Elements'}],totalLevel:5,abilities:{str:8,dex:14,con:12,int:10,wis:18,cha:10},proficiencies:{saves:{str:1,dex:1},skills:{Athletics:1}},transformationGrants:[{id:'astral-test',label:'Astral Arms',profile:'overlay',formIds:[],source:'Owned content',actionCost:'bonus',endActionCost:'none',effects:{checkAbilitySubstitution:{str:'wis'},saveAbilitySubstitution:{str:'wis'},activationActions:[{id:'astral-summon',name:'Astral Arms summon',type:'save',cost:'none',saveAbility:'dex',dc:15,damageOnFail:[{expression:'2d8',type:'Force'}]}],actions:[{id:'astral-strike',name:'Astral Arms Unarmed Strike',type:'attack',cost:'action',attackBonus:7,ability:'wis',kind:'unarmed',reach:10,damage:[{expression:'1d8+4',type:'Force'}]}]}}]});
  const state=createInitialState(c);const option=availableTransformations(c,state).find(entry=>entry.grantId==='astral-test');assert.ok(option);const started=startTransformation(c,state,option);assert.equal(started.activationActions?.[0]?.id,'astral-summon');let sheet=resolveSheet(c,state);assert.equal(sheet.skills.Athletics?.modifier,7);assert.equal(sheet.saves.str.modifier,7);const ordinary=sheet.actions.find(action=>action.id==='monk-unarmed'),strike=sheet.actions.find(action=>action.id==='astral-arms-unarmed-strike'),grapple=sheet.actions.find(action=>action.id==='astral-arms-unarmed-grapple'),shove=sheet.actions.find(action=>action.id==='astral-arms-unarmed-shove');assert.ok(ordinary?.type==='attack');assert.equal(ordinary.ability,'dex');assert.equal(ordinary.damage[0]?.type,'Bludgeoning');assert.ok(strike?.type==='attack');assert.equal(strike.ability,'wis');assert.equal(strike.reach,10);assert.deepEqual(strike.damage,[{expression:'1d8+4',type:'Force'}]);assert.match(strike.notes??'',/Legacy Astral Self compatibility/);assert.match(strike.notes??'',/table rule/);assert.ok(grapple?.type==='save');assert.equal(grapple.dc,15);assert.deepEqual(grapple.saveAbilityOptions,['str','dex']);assert.equal(grapple.range,'10 ft.');assert.ok(shove?.type==='save');assert.equal(shove.dc,15);assert.equal(shove.range,'10 ft.');assert.equal(sheet.actions.some(action=>action.id==='astral-strike'),false);assert.equal(sheet.actions.some(action=>action.id==='astral-summon'),false);
  const flurry=sheet.actions.find(action=>action.id==='monk-flurry-of-blows');assert.ok(flurry?.type==='multiattack');if(flurry.type==='multiattack'){const allAstral=flurry.variants?.find(variant=>variant.id==='astral');assert.deepEqual(allAstral?.sequence,['astral-arms-unarmed-strike','astral-arms-unarmed-strike']);for(const id of allAstral?.sequence??[]){const child=sheet.actions.find(action=>action.id===id);assert.ok(child?.type==='attack');assert.equal(child.ability,'wis');assert.deepEqual(child.damage,[{expression:'1d8+4',type:'Force'}]);assert.equal(child.uses,undefined);}assert.deepEqual(flurry.variants?.find(variant=>variant.id==='astral-grapple')?.sequence,['astral-arms-unarmed-grapple','astral-arms-unarmed-grapple']);assert.deepEqual(flurry.variants?.find(variant=>variant.id==='astral-shove')?.sequence,['astral-arms-unarmed-shove','astral-arms-unarmed-shove']);}
  startNewTurn(state);sheet=resolveSheet(c,state);const astralBonuses=sheet.actions.filter(action=>action.id==='monk-bonus-astral-arms-unarmed-strike'),astralBonus=astralBonuses[0];assert.equal(astralBonuses.length,1);assert.ok(astralBonus?.type==='attack');assert.equal(astralBonus.cost,'bonus');assert.equal(astralBonus.ability,'wis');assert.equal(astralBonus.damage[0]?.type,'Force');assert.equal(resolveSheet(c,state).actions.filter(action=>action.id==='monk-bonus-astral-arms-unarmed-strike').length,1);state.equipment.armorCategory='medium';assert.equal(resolveSheet(c,state).actions.some(action=>action.id==='monk-bonus-astral-arms-unarmed-strike'),false);state.equipment.armorCategory='none';state.equipment.shield=true;assert.equal(resolveSheet(c,state).actions.some(action=>action.id==='monk-bonus-astral-arms-unarmed-strike'),false);state.equipment.shield=false;
  const end=availableTransformations(c,state).find(entry=>entry.grantId==='astral-test'&&entry.deactivate);assert.ok(end);startTransformation(c,state,end);assert.equal(state.overlays.includes('astral-test'),false);
});

test('2024 Martial Arts supplies a Bonus Action Unarmed Strike only with eligible armor, Shield, and weapon state',()=>{
  const makeMonk=(equipment:Character['equipment'],items:Character['items']=[])=>character({classes:[{name:'Monk',level:5}],totalLevel:5,abilities:{str:10,dex:16,con:12,int:10,wis:16,cha:8},knownForms:[],seenForms:[],spells:[],spellSlots:{},equipment,items});
  const monk=makeMonk({armorCategory:'none',shield:false,transformBehavior:'merge'}),state=createInitialState(monk);const bonus=resolveSheet(monk,state).actions.find(action=>action.id==='monk-bonus-unarmed');assert.ok(bonus?.type==='attack');assert.equal(bonus.cost,'bonus');assert.equal(bonus.ability,'dex');assert.equal(bonus.damage[0]?.expression,'1d8+3');assert.equal(spendActionExecution(monk,state,bonus),null);assert.equal(state.turn.bonusRemaining,0);assert.equal(state.turn.actionsRemaining,1);
  const armored=makeMonk({armorCategory:'medium',shield:false,transformBehavior:'merge'});assert.equal(resolveSheet(armored,createInitialState(armored)).actions.some(action=>action.id==='monk-bonus-unarmed'),false);
  const shielded=makeMonk({armorCategory:'none',shield:true,transformBehavior:'merge'});assert.equal(resolveSheet(shielded,createInitialState(shielded)).actions.some(action=>action.id==='monk-bonus-unarmed'),false);
  const weapon=(id:string,name:string,properties:string[],range?:number):Character['items'][number]=>({id,name,type:'Weapon',equipped:true,attuned:false,requiresAttunement:false,ruleset:'2024',sourceIds:[],mechanics:'included-in-imported-totals',attack:{ability:'str',damage:'1d6',damageType:'Piercing',proficient:true,properties,magicBonus:0,...(range===undefined?{}:{range,longRange:range*4})}});
  const greataxe=makeMonk({armorCategory:'none',shield:false,transformBehavior:'merge'},[weapon('greataxe','Greataxe',['Heavy','Two-Handed'])]);assert.equal(resolveSheet(greataxe,createInitialState(greataxe)).actions.some(action=>action.id==='monk-bonus-unarmed'),false);
  const thrownJavelin=makeMonk({armorCategory:'none',shield:false,transformBehavior:'merge'},[weapon('javelin','Javelin',['Thrown'],30)]);const thrownSheet=resolveSheet(thrownJavelin,createInitialState(thrownJavelin));assert.equal(thrownSheet.actions.some(action=>action.id==='monk-bonus-unarmed'),true);const javelin=thrownSheet.actions.find(action=>action.id==='item-attack-javelin');assert.ok(javelin?.type==='attack');assert.equal(javelin.ability,'dex');assert.equal(javelin.damage[0]?.expression,'1d8+3');
});

test('2024 Monk Focus actions share one pool and work with retained transformations',()=>{
  const monk=character({classes:[{name:'Monk',level:6,subclass:'Way of the Astral Self (TCoE)'},{name:'Druid',level:2}],totalLevel:8,abilities:{str:10,dex:16,con:12,int:10,wis:16,cha:8},knownForms:['cat'],seenForms:['cat'],spells:[],spellSlots:{},resources:[{id:'focus',name:'Focus Points',current:4,max:6,recovery:'short-all'}]});
  const state=createInitialState(monk);const base=resolveSheet(monk,state);const focus=monk.resources.filter(resource=>resource.id==='focus-points');
  assert.equal(focus.length,1);assert.equal(focus[0]?.current,4);assert.equal(focus[0]?.max,6);
  const flurry=base.actions.find(action=>action.id==='monk-flurry-of-blows');const patient=base.actions.find(action=>action.id==='monk-patient-defense');const step=base.actions.find(action=>action.id==='monk-step-of-the-wind');
  assert.ok(flurry?.type==='multiattack');if(flurry.type==='multiattack'){assert.equal(flurry.cost,'bonus');assert.equal(flurry.resourceId,'focus-points');assert.equal(flurry.resourceCost,1);assert.deepEqual(flurry.sequence,['monk-unarmed','monk-unarmed']);}
  assert.ok(patient?.type==='automatic');if(patient.type==='automatic'){assert.equal(patient.cost,'bonus');assert.equal(patient.choices?.find(choice=>choice.id==='focused-defense')?.resourceCost,1);assert.deepEqual(patient.choices?.find(choice=>choice.id==='focused-defense')?.grants,['disengage','dodge']);}
  assert.ok(step?.type==='automatic');if(step.type==='automatic'){assert.equal(step.cost,'bonus');assert.equal(step.choices?.find(choice=>choice.id==='focused-step')?.resourceCost,1);assert.deepEqual(step.choices?.find(choice=>choice.id==='focused-step')?.grants,['dash','disengage','double-jump']);}
  assert.equal(spendActionExecution(monk,state,flurry),null);assert.equal(state.resources['focus-points']?.current,3);assert.equal(state.turn.bonusRemaining,0);
  startNewTurn(state);const cat=availableTransformations(monk,state).find(option=>option.formId==='cat');assert.ok(cat);startTransformation(monk,state,cat);const transformed=resolveSheet(monk,state);
  assert.ok(transformed.actions.some(action=>action.id==='monk-flurry-of-blows'));assert.ok(transformed.actions.some(action=>action.id==='monk-patient-defense'));assert.ok(transformed.actions.some(action=>action.id==='monk-step-of-the-wind'));
});

test('received effects initialize safely, replace duplicates, and end explicitly',()=>{
  const state=createInitialState(character());assert.deepEqual(state.receivedEffects,[]);
  addReceivedEffect(state,{id:'guidance-1',kind:'guidance',name:'Guidance',source:'Cleric',addedTurn:1,duration:'Up to 1 minute',skill:'Perception'});
  assert.equal(state.receivedEffects.length,1);assert.equal(state.receivedEffects[0]?.skill,undefined);assert.equal(state.receivedEffects[0]?.autoChooseSkill,true);
  const replaced=addReceivedEffect(state,{id:'guidance-2',kind:'guidance',name:'Guidance',source:'Druid',addedTurn:2,duration:'Up to 1 minute',skill:'Stealth'});
  assert.equal(state.receivedEffects.length,1);assert.equal(state.receivedEffects[0]?.source,'Druid');assert.equal(state.receivedEffects[0]?.skill,undefined);assert.equal(state.receivedEffects[0]?.autoChooseSkill,true);assert.match(replaced.message,/do not stack/);
  assert.match(endReceivedEffect(state,'guidance-2').message,/ended/);assert.deepEqual(state.receivedEffects,[]);
});

test('2024 Monk weapons use the Martial Arts die and magic bonus for attack and damage',()=>{
  const monk=character({classes:[{name:'Monk',level:6,subclass:'Warrior of the Elements'}],totalLevel:6,abilities:{str:10,dex:16,con:12,int:10,wis:16,cha:8},knownForms:[],seenForms:[],spells:[],spellSlots:{},equipment:{armorCategory:'none',shield:false,transformBehavior:'merge'},items:[{id:'staff-plus-one',name:'Quarterstaff, +1',type:'Weapon',equipped:true,attuned:false,requiresAttunement:false,ruleset:'2024',sourceIds:[],mechanics:'included-in-imported-totals',attack:{ability:'str',damage:'1d6',damageType:'Bludgeoning',proficient:true,properties:['Versatile'],magicBonus:1}}]});
  const staff=resolveSheet(monk,createInitialState(monk)).actions.find(action=>action.id==='item-attack-staff-plus-one');assert.ok(staff?.type==='attack');if(staff.type==='attack'){assert.equal(staff.ability,'dex');assert.equal(staff.attackBonus,7);assert.equal(staff.damage[0]?.expression,'1d8+4');assert.match(staff.notes??'',/magic weapon bonus to attack and damage/);assert.match(staff.notes??'',/Martial Arts 1d8/);}
});

test('active 2024 Shillelagh uses its imported spell ability, total-character-level die, and exclusive normal or Force actions',()=>{
  const expected=new Map([[1,'1d8'],[5,'1d10'],[11,'1d12'],[17,'2d6']]);for(const [level,die] of expected){const c=character({classes:[{name:'Druid',level}],totalLevel:level,abilities:{str:8,dex:16,con:12,int:10,wis:18,cha:14},knownForms:[],seenForms:[],spells:[{name:'Shillelagh',level:0,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'bonus'}],spellSlots:{},items:[{id:'staff',name:'Quarterstaff',type:'Weapon',equipped:true,attuned:false,requiresAttunement:false,ruleset:'2024',sourceIds:[],mechanics:'included-in-imported-totals',attack:{ability:'str',damage:'1d6',damageType:'Bludgeoning',proficient:true,properties:['Versatile'],magicBonus:0}}]});const state=createInitialState(c);assert.match(castSpell(c,state,'Shillelagh').message,/Cast Shillelagh/);const sheet=resolveSheet(c,state),normal=sheet.actions.find(action=>action.id==='item-attack-staff'),force=sheet.actions.find(action=>action.id==='item-attack-staff-shillelagh-force');assert.ok(normal?.type==='attack');assert.ok(force?.type==='attack');assert.equal(normal.ability,'wis');assert.equal(force.ability,'wis');assert.equal(normal.attackBonus,proficiencyBonus(level)+4);assert.deepEqual(normal.damage,[{expression:`${die}+4`,type:'Bludgeoning'}]);assert.deepEqual(force.damage,[{expression:`${die}+4`,type:'Force'}]);assert.equal(normal.damage.length,1);assert.equal(force.damage.length,1);assert.match(normal.notes??'',/choose this normal-damage action or the Force action.*never both/);assert.match(normal.notes??'',/WIS from the imported Druid spell/);endSpellEffect(state,'shillelagh');assert.equal(resolveSheet(c,state).actions.some(action=>action.id==='item-attack-staff-shillelagh-force'),false);}
  const multiclass=character({classes:[{name:'Druid',level:1},{name:'Warlock',level:4}],totalLevel:5,abilities:{str:8,dex:16,con:12,int:10,wis:18,cha:16},knownForms:[],seenForms:[],spells:[{name:'Shillelagh',level:0,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'bonus'},{name:'Shillelagh',level:0,sourceClass:'Pact Magic',ability:'cha',prepared:true,castingTime:'bonus'}],spellSlots:{},items:[{id:'club',name:'Club',type:'Weapon',equipped:true,attuned:false,requiresAttunement:false,ruleset:'2024',sourceIds:[],mechanics:'included-in-imported-totals',attack:{ability:'str',damage:'1d4',damageType:'Bludgeoning',proficient:true,properties:['Light'],magicBonus:0}}]}),state=createInitialState(multiclass);state.activeSpellEffects.push({id:'shillelagh',name:'Shillelagh',source:'Pact Magic',duration:'1 minute',summary:'Fixture',startedTurn:1});const pactClub=resolveSheet(multiclass,state).actions.find(action=>action.id==='item-attack-club');assert.ok(pactClub?.type==='attack');assert.equal(pactClub.ability,'cha');assert.deepEqual(pactClub.damage,[{expression:'1d10+3',type:'Bludgeoning'}]);assert.match(pactClub.notes??'',/CHA from the imported Pact Magic spell/);
});

test('2024 Stunning Strike is a structured post-hit CON save that spends one Focus and gates once per turn',()=>{
  const c=character({classes:[{name:'Monk',level:5}],totalLevel:5,abilities:{str:10,dex:16,con:12,int:10,wis:18,cha:8},knownForms:[],seenForms:[],spells:[],spellSlots:{}}),state=createInitialState(c);const stunning=resolveSheet(c,state).actions.find(action=>action.id==='monk-stunning-strike');assert.ok(stunning?.type==='save');assert.equal(stunning.saveAbility,'con');assert.equal(stunning.dc,15);assert.equal(stunning.cost,'none');assert.equal(stunning.resourceId,'focus-points');assert.equal(stunning.resourceCost,1);assert.equal(stunning.oncePerTurnId,'stunning-strike');assert.match(stunning.prerequisite??'',/after you hit.*Monk weapon or Unarmed Strike/i);assert.deepEqual(stunning.effectsOnFail,[{condition:'Stunned',duration:'Until the start of your next turn'}]);const before=state.resources['focus-points']?.current;assert.equal(spendActionExecution(c,state,stunning),null);assert.equal(state.resources['focus-points']?.current,(before??0)-1);assert.equal(state.turn.actionsRemaining,1);assert.match(actionExecutionError(c,state,stunning)??'',/only once on a turn/);startNewTurn(state);assert.equal(actionExecutionError(c,state,stunning),null);
  const levelFour=character({classes:[{name:'Monk',level:4}],totalLevel:4,knownForms:[],seenForms:[],spells:[],spellSlots:{}});assert.equal(resolveSheet(levelFour,createInitialState(levelFour)).actions.some(action=>action.id==='monk-stunning-strike'),false);
});

test('2024 Uncanny Metabolism is an optional Initiative trigger with expended Focus and a Long Rest use',()=>{
  const c=character({classes:[{name:'Monk',level:6}],totalLevel:6,abilities:{str:10,dex:16,con:12,int:10,wis:18,cha:8},hp:{current:20,max:60},knownForms:[],seenForms:[],spells:[],spellSlots:{}}),state=createInitialState(c),focus=must(state.resources['focus-points']),use=must(state.resources['uncanny-metabolism']);assert.equal(use.recovery,'long-all');assert.equal(use.current,1);assert.equal(/is available as an optional recovery/.test(startCombat(state).message),false);assert.equal(state.pendingUncannyMetabolism,false);
  focus.current=2;const before={focus:focus.current,hp:state.hp,use:use.current};const initiative=startCombat(state);assert.match(initiative.message,/available as an optional recovery/);assert.deepEqual({focus:focus.current,hp:state.hp,use:use.current},before);assert.equal(state.pendingUncannyMetabolism,true);assert.ok(resolveSheet(c,state).actions.some(action=>action.id==='monk-uncanny-metabolism'));const recovered=useUncannyMetabolism(c,state,()=>0);assert.match(recovered.message,/regained 4 Focus Points and 7 Hit Points \(1d8 rolled 1 \+ Monk level 6\)/);assert.equal(focus.current,6);assert.equal(state.hp,27);assert.equal(use.current,0);assert.equal(state.pendingUncannyMetabolism,undefined);
  focus.current=5;state.hp=20;assert.equal(/optional recovery/.test(startCombat(state).message),false);assert.equal(resolveSheet(c,state).actions.some(action=>action.id==='monk-uncanny-metabolism'),false);longRest(c,state);focus.current=4;state.hp=20;assert.match(startCombat(state).message,/optional recovery/);startNewTurn(state);assert.equal(state.pendingUncannyMetabolism,undefined);assert.equal(use.current,1);assert.equal(focus.current,4);assert.equal(state.hp,20);
});

test('initiative starts turn one and finite tracked effects expire at their turn duration',()=>{
  const state=createInitialState(character());state.turn.number=8;state.turn.actionsRemaining=0;state.turn.bonusRemaining=0;
  startCombat(state);assert.equal(state.turn.number,1);assert.equal(state.turn.actionsRemaining,1);assert.equal(state.turn.bonusRemaining,1);
  state.activeSpellEffects.push({id:'minute-effect',name:'Minute Effect',source:'Test',duration:'Up to 1 minute',summary:'Test',startedTurn:1});
  addReceivedEffect(state,{id:'round-effect',kind:'guidance',name:'Round Effect',source:'Test',addedTurn:1,duration:'1 round',skill:'Perception'});
  const second=startNewTurn(state);assert.match(second.message,/Round Effect expired/);assert.equal(state.receivedEffects.length,0);assert.equal(state.activeSpellEffects.length,1);
  for(let turn=0;turn<9;turn++)startNewTurn(state);assert.equal(state.turn.number,11);assert.equal(state.activeSpellEffects.length,0);
});

test('finite replacement transformations and overlays expire from persisted turn metadata',()=>{
  const c=character({transformationGrants:[
    {id:'minute-aura',label:'Minute Aura',profile:'overlay',formIds:[],source:'Fixture',actionCost:'bonus',endActionCost:'none',duration:'1 minute',concentration:true,effects:{temporaryHp:{mode:'fixed',value:5}}},
    {id:'astral-arms-timer',label:'Astral Arms',profile:'overlay',formIds:[],source:'Fixture',actionCost:'bonus',endActionCost:'none',duration:'10 minutes',effects:{}},
    {id:'manual-aura',label:'Manual Aura',profile:'overlay',formIds:[],source:'Fixture',actionCost:'bonus',endActionCost:'none',effects:{}}
  ]});
  const replacement=createInitialState(c),wolf=availableTransformations(c,replacement).find(option=>option.profile==='wildshape'&&option.formId==='dire-wolf');assert.ok(wolf);startTransformation(c,replacement,wolf);assert.ok(replacement.activeTransform);replacement.activeTransform.duration='1 minute';replacement.turn.number=10;const replacementExpiry=startNewTurn(replacement);assert.match(replacementExpiry.message,/Dire Wolf expired/);assert.equal(replacement.activeTransform,undefined);assert.equal(replacement.tempHp,0);

  const minute=createInitialState(c),minuteOption=availableTransformations(c,minute).find(option=>option.grantId==='minute-aura');assert.ok(minuteOption);startTransformation(c,minute,minuteOption);assert.deepEqual(minute.overlayTimings?.['minute-aura'],{startedTurn:1,duration:'1 minute',label:'Minute Aura',tempHpSource:'Minute Aura',concentrationName:'Minute Aura'});assert.equal(minute.tempHp,5);assert.equal(minute.concentration?.name,'Minute Aura');minute.turn.number=10;const minuteExpiry=startNewTurn(minute);assert.match(minuteExpiry.message,/Minute Aura expired/);assert.equal(minute.overlays.includes('minute-aura'),false);assert.equal(minute.overlayTimings?.['minute-aura'],undefined);assert.equal(minute.tempHp,0);assert.equal(minute.concentration,undefined);

  const astral=createInitialState(c),astralOption=availableTransformations(c,astral).find(option=>option.grantId==='astral-arms-timer');assert.ok(astralOption);startTransformation(c,astral,astralOption);astral.turn.number=100;startNewTurn(astral);assert.equal(astral.overlays.includes('astral-arms-timer'),false);

  const manual=createInitialState(c),manualOption=availableTransformations(c,manual).find(option=>option.grantId==='manual-aura');assert.ok(manualOption);startTransformation(c,manual,manualOption);manual.turn.number=10_000;startNewTurn(manual);assert.equal(manual.overlays.includes('manual-aura'),true);const manualEnd=availableTransformations(c,manual).find(option=>option.grantId==='manual-aura'&&option.deactivate);assert.ok(manualEnd);startTransformation(c,manual,manualEnd);assert.equal(manual.overlayTimings?.['manual-aura'],undefined);
});

test('older saves without overlay timing metadata remain active instead of being expired speculatively',()=>{
  const c=character({transformationGrants:[{id:'legacy-timed-aura',label:'Legacy Timed Aura',profile:'overlay',formIds:[],source:'Fixture',actionCost:'bonus',endActionCost:'none',duration:'1 minute',effects:{}}]}),state=createInitialState(c),option=availableTransformations(c,state).find(entry=>entry.grantId==='legacy-timed-aura');assert.ok(option);startTransformation(c,state,option);delete state.overlayTimings;state.turn.number=100;startNewTurn(state);assert.equal(state.overlays.includes('legacy-timed-aura'),true);
});
