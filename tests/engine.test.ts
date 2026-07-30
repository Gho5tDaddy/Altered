import test from 'node:test';
import assert from 'node:assert/strict';
import type {AttackAction,Character} from '../src/types.js';
import {CREATURES} from '../src/content-registry.js';
import {parseCharacter} from '../src/schema.js';
import {
  applyCondition,applyDamage,attackBonuses,attackRollSources,availableSpellSlotLevels,availableTransformations,boundedWhole,castSpell,completeTruePolymorph,concentrationCheckDc,concentrationSaveMode,createInitialState,criticalDiceExpression,criticalHitThreshold,deathSaveMode,declareRecklessAttack,
  clearConditions,endConcentration,endSpellEffect,endTransformation,endTurn,extendRage,heal,longRest,markActionRechargeUsed,markLimitedActionUsed,pendingActionRecharge,remainingActionUses,removeCondition,resolveConcentrationCheck,resolveDeathSave,resolveRelentlessRage,resolveSheet,resolveTempHpChoice,restoreDragonWings,rollAttackD20,shortRest,spendActionCost,startNewTurn,startRage,startTransformation,useActionSurge,useLayOnHands,useSecondWind,useWildResurgence,wildResurgenceError,wildShapeLimits
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

test('spells clearly become unavailable after their Magic Action is spent',()=>{
  const c=character();const state=createInitialState(c);state.turn.actionsRemaining=0;
  const spell=resolveSheet(c,state).spells.find(entry=>entry.name==='Moonbeam');assert.equal(spell?.available,false);assert.match(spell?.reason??'',/Action remains/);
});

test('Rage benefits a beast form but does not add Rage Damage to beast stat-block attacks',()=>{
  const c=character();const state=createInitialState(c);const bear=availableTransformations(c,state).find(option=>option.profile==='wildshape'&&option.formId==='brown-bear');assert.ok(bear);startTransformation(c,state,bear);state.turn.bonusRemaining=1;startRage(c,state);
  const sheet=resolveSheet(c,state);const bite=sheet.actions.find(action=>action.type==='attack');assert.ok(bite);assert.ok(sheet.resistances.includes('Slashing'));assert.equal(bite?attackBonuses(c,state,sheet,bite).some(packet=>packet.label==='Rage Damage'):true,false);
});


test('Reckless Attack can be declared without Rage',()=>{
  const c=character();const state=createInitialState(c);const result=declareRecklessAttack(c,state);assert.match(result.message,/declared/);assert.equal(state.rage.recklessDeclared,true);
});

test('Action Surge is limited to once per turn',()=>{
  const c=character({classes:[{name:'Fighter',level:17}],totalLevel:17});const state=createInitialState(c);assert.match(useActionSurge(c,state).message,/added one action/);assert.match(useActionSurge(c,state).message,/only once/);assert.equal(state.turn.surgeActionsRemaining,1);
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

test('Wild Shape Temporary Hit Points vanish when the form ends or Incapacitation ends it',()=>{
  const c=character();const state=createInitialState(c);const wolf=availableTransformations(c,state).find(o=>o.profile==='wildshape'&&o.formId==='dire-wolf');assert.ok(wolf);
  startTransformation(c,state,wolf);assert.equal(state.tempHp,18);state.turn.bonusRemaining=1;endTransformation(state,true,c);assert.equal(state.tempHp,0);assert.equal(state.tempHpSource,undefined);
  state.turn.bonusRemaining=1;const again=availableTransformations(c,state).find(o=>o.profile==='wildshape'&&o.formId==='dire-wolf');assert.ok(again);startTransformation(c,state,again);applyCondition(c,state,'Stunned');assert.equal(state.activeTransform,undefined);assert.equal(state.tempHp,0);
});

test('Shapechange grants form HP as Temporary HP only for the first form and does not end at zero',()=>{
  const c=character({classes:[{name:'Wizard',level:17}],totalLevel:17});const state=createInitialState(c);
  const first=availableTransformations(c,state).find(o=>o.profile==='shapechange'&&o.formId==='polar-bear');assert.ok(first);startTransformation(c,state,first);assert.equal(state.tempHp,42);
  startNewTurn(state);const second=availableTransformations(c,state).find(o=>o.profile==='shapechange'&&o.formId==='dire-wolf');assert.ok(second);startTransformation(c,state,second);assert.equal(state.tempHp,42);
  applyDamage(state,resolveSheet(c,state),42,'Force',c);assert.ok(state.activeTransform);assert.equal(state.tempHp,0);assert.ok(state.concentration);
  endConcentration(state,'Test ended.',c);assert.equal(state.activeTransform,undefined);assert.equal(state.tempHp,0);
});

test('Animal Shapes switches forms without refreshing Temporary HP and zero THP does not end it',()=>{
  const c=character({classes:[{name:'Druid',level:15}],totalLevel:15,spells:[{name:'Animal Shapes',level:8,sourceClass:'Druid',ability:'wis',prepared:true,castingTime:'magic-action'}],spellSlots:{'8':{current:1,max:1}}});const state=createInitialState(c);
  const first=availableTransformations(c,state).find(o=>o.profile==='animal-shapes'&&o.formId==='polar-bear');assert.ok(first);startTransformation(c,state,first);assert.equal(state.tempHp,42);assert.equal(state.concentration,undefined);
  startNewTurn(state);const second=availableTransformations(c,state).find(o=>o.profile==='animal-shapes'&&o.formId==='dire-wolf');assert.ok(second);startTransformation(c,state,second);assert.equal(state.tempHp,42);
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
