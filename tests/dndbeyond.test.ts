import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDdbSrdCreatures,ddbSetupPackId,extractDdbCharacterId,importDdbCharacter} from '../src/dndbeyond.js';
import {availableTransformations,createInitialState} from '../src/engine.js';

const spell=(id:number,name:string,level:number,extra:Record<string,unknown>={})=>({
  definition:{id,name,level,concentration:false,components:[1,2],modifiers:[],...extra},
  prepared:true,alwaysPrepared:false,countsAsKnownSpell:false,activation:{activationType:1},spellCastingAbilityId:5,
});
const pactSpellRules=(classLevel:number,slotLevel:number,max:number)=>({levelSpellSlots:Array.from({length:classLevel+1},(_,level)=>Array.from({length:9},(_entry,index)=>level===classLevel&&index===slotLevel-1?max:0))});

const ferocitusPayload={
  id:152187683,
  success:true,
  message:null,
  data:{
    id:152187683,
    name:'Ferocitus',
    baseHitPoints:23,
    bonusHitPoints:5,
    overrideHitPoints:80,
    removedHitPoints:0,
    stats:[
      {id:1,value:15},{id:2,value:14},{id:3,value:15},
      {id:4,value:12},{id:5,value:14},{id:6,value:12},
    ],
    bonusStats:[],
    overrideStats:[],
    race:{fullName:'Goliath',sizeId:4,weightSpeeds:{normal:{walk:35,fly:0,swim:0,climb:0,burrow:0}}},
    classes:[
      {id:1100,level:1,isStartingClass:true,definition:{id:11,name:'Barbarian',isLegacy:false,is2024:true,spellCastingAbilityId:0,classFeatures:[{id:111,name:'Core Barbarian Traits'}]},subclassDefinition:null},
      {id:2200,level:5,isStartingClass:false,definition:{id:22,name:'Druid',isLegacy:false,is2024:true,spellCastingAbilityId:5,classFeatures:[{id:222,name:'Core Druid Traits'}]},subclassDefinition:{name:'Circle of the Moon'}},
    ],
    choices:{
      race:[],
      class:[
        {componentId:11,componentTypeId:0,optionValue:1},
        {componentId:22,componentTypeId:0,optionValue:2},
      ],
      background:[],
      feat:[
        {componentId:44,componentTypeId:0,optionValue:6226},
        {componentId:44,componentTypeId:0,optionValue:6228},
      ],
    },
    modifiers:{
      race:[
        {type:'bonus',subType:'strength-score',fixedValue:1,value:1,componentId:33,componentTypeId:0,isGranted:false,restriction:''},
        {type:'bonus',subType:'constitution-score',fixedValue:1,value:1,componentId:33,componentTypeId:0,isGranted:false,restriction:''},
        {type:'bonus',subType:'wisdom-score',fixedValue:1,value:1,componentId:33,componentTypeId:0,isGranted:false,restriction:''},
      ],
      class:[
        {type:'proficiency',subType:'strength-saving-throws',componentId:111,isGranted:true},
        {type:'proficiency',subType:'constitution-saving-throws',componentId:111,isGranted:true},
        {type:'proficiency',subType:'intelligence-saving-throws',componentId:222,isGranted:true},
        {type:'proficiency',subType:'wisdom-saving-throws',componentId:222,isGranted:true},
        {type:'proficiency',subType:'athletics',componentId:11,entityId:2,isGranted:false},
        {type:'proficiency',subType:'animal-handling',componentId:22,entityId:11,isGranted:false},
        {type:'proficiency',subType:'intimidation',componentId:11,entityId:12,isGranted:false},
        {type:'proficiency',subType:'nature',componentId:22,entityId:13,isGranted:false},
      ],
      background:[],
      item:[
        {type:'bonus',subType:'armor-class',fixedValue:1,value:1,componentId:100,requiresAttunement:true,isGranted:true,restriction:''},
        {type:'bonus',subType:'saving-throws',fixedValue:1,value:1,componentId:100,requiresAttunement:true,isGranted:true,restriction:''},
        {type:'bonus',subType:'magic',fixedValue:1,value:1,componentId:101,requiresAttunement:true,isGranted:true,restriction:'Unarmed attack and damage rolls'},
      ],
      feat:[
        {type:'bonus',subType:'wisdom-score',fixedValue:2,value:2,componentId:44,componentTypeId:0,isGranted:false,restriction:''},
        {type:'bonus',subType:'constitution-score',fixedValue:1,value:1,componentId:44,componentTypeId:0,isGranted:false,restriction:''},
        {type:'bonus',subType:'hit-points-per-level',fixedValue:2,value:2,componentId:300,isGranted:true,restriction:''},
      ],
      condition:[],
    },
    inventory:[
      {equipped:true,isAttuned:true,definition:{id:100,name:'Cloak of Protection',type:'Wondrous item',canAttune:true,armorClass:null,armorTypeId:null}},
      {equipped:true,isAttuned:true,definition:{id:101,name:'Insignia of Claws',type:'Wondrous item',requiresAttunement:true,armorClass:null,armorTypeId:null}},
    ],
    feats:[
      {definition:{name:'Sentinel',isHomebrew:false}},
      {definition:{name:'Tough',isHomebrew:false}},
    ],
    creatures:[
      {groupId:1,definition:{name:'Dire Wolf'}},
      {groupId:1,definition:{name:'Brown Bear'}},
      {groupId:1,definition:{name:'Giant Spider'}},
      {groupId:1,definition:{name:'Giant Toad'}},
      {groupId:1,definition:{name:'Black Bear'}},
      {groupId:1,definition:{name:'Panther'}},
    ],
    spellSlots:[
      {level:1,used:0,available:0},
      {level:2,used:0,available:0},
      {level:3,used:0,available:0},
    ],
    spells:{race:[],class:[],background:[],item:[],feat:[]},
    classSpells:[{
      characterClassId:22,
      spells:[
        spell(1,'Guidance',0),
        spell(2,'Thorn Whip',0,{attackType:1,modifiers:[{type:'damage',subType:'piercing',die:{diceString:'2d6'}}]}),
        spell(3,'Starry Wisp',0,{attackType:1,modifiers:[{type:'damage',subType:'radiant',die:{diceString:'2d8'}}]}),
        spell(4,'Cure Wounds',1),
        spell(5,'Moonbeam',2,{concentration:true,saveDcAbilityId:3,modifiers:[{type:'damage',subType:'radiant',die:{diceString:'2d10'}}]}),
        {...spell(7,'Barkskin',2),activation:{activationType:3}},
        {...spell(6,'Unprepared Spell',1),prepared:false,countsAsKnownSpell:false},
      ],
    }],
    actions:{
      race:[
        {name:'Activate Large Form',limitedUse:{resetType:2,numberUsed:1,maxUses:1,useProficiencyBonus:false}},
        {name:'Stone’s Endurance (Stone Giant)',limitedUse:{resetType:2,numberUsed:0,maxUses:0,useProficiencyBonus:true}},
      ],
      class:[
        {name:'Rage (Enter)',limitedUse:{resetType:2,numberUsed:1,maxUses:2,useProficiencyBonus:false}},
        {name:'Wild Shape',limitedUse:{resetType:1,numberUsed:1,maxUses:2,useProficiencyBonus:false}},
        {name:'Wild Resurgence: Regain Spell Slot',limitedUse:{resetType:2,numberUsed:0,maxUses:1,useProficiencyBonus:false}},
      ],
      background:[],item:[],feat:[],
    },
    customDefenseAdjustments:[],
  },
};

test('extracts D&D Beyond IDs from links, API URLs, raw IDs, and exported PDF names',()=>{
  assert.equal(extractDdbCharacterId('152187683'),'152187683');
  assert.equal(extractDdbCharacterId('https://www.dndbeyond.com/characters/152187683'),'152187683');
  assert.equal(extractDdbCharacterId('https://character-service.dndbeyond.com/character/v5/character/152187683'),'152187683');
  assert.equal(extractDdbCharacterId('Ferocitus_152187683.pdf'),'152187683');
  assert.equal(extractDdbCharacterId('renamed-sheet.pdf'),null);
});

test('normalizes a Ferocitus-shaped multiclass character without guessing core values',()=>{
  const report=importDdbCharacter(ferocitusPayload,'152187683');
  const character=report.character;
  assert.equal(character.id,'ddb-152187683');
  assert.equal(character.name,'Ferocitus');
  assert.deepEqual(character.classes,[
    {name:'Barbarian',level:1,subclass:null},
    {name:'Druid',level:5,subclass:'Circle of the Moon'},
  ]);
  assert.deepEqual(character.abilities,{str:15,dex:14,con:16,int:12,wis:16,cha:12});
  assert.deepEqual(character.hp,{current:80,max:80});
  assert.equal(character.ac,16);
  assert.equal(character.speed,35);
  assert.deepEqual(character.saveBonuses,{str:6,dex:3,con:7,int:2,wis:4,cha:2});
  assert.equal(character.skillBonuses?.['Animal Handling'],6);
  assert.equal(character.skillBonuses?.Athletics,5);
  assert.equal(character.skillBonuses?.Intimidation,4);
  assert.equal(character.skillBonuses?.Nature,4);
  assert.deepEqual(character.knownForms,['dire-wolf','brown-bear','giant-spider','giant-toad','black-bear','panther']);
  assert.equal(character.spells.length,7);
  assert.deepEqual(character.spells.find(spell=>spell.name==='Barkskin')?.activeEffect,{id:'barkskin',duration:'1 hour',acMinimum:17,summary:'The target has Armor Class 17 if its AC would otherwise be lower.'});
  assert.equal(character.spells.find(spell=>spell.name==='Barkskin')?.castingTime,'bonus');
  assert.ok(character.spells.some(spell=>spell.name==='Conjure Animals'&&spell.specialAccess==='circle-of-the-moon'));
  assert.equal(character.spells.filter(spell=>spell.name==='Moonbeam').length,1);
  assert.deepEqual(character.spellSlots,{
    '1':{current:4,max:4},
    '2':{current:3,max:3},
    '3':{current:2,max:2},
  });
  assert.equal(character.resources.find(resource=>resource.id==='rage')?.current,1);
  assert.equal(character.resources.find(resource=>resource.id==='wild-shape')?.current,1);
  assert.equal(character.resources.find(resource=>resource.id==='goliath-large-form')?.current,0);
  assert.equal(character.resources.find(resource=>resource.id==='wild-resurgence-slot')?.current,1);
  assert.equal(character.resources.find(resource=>resource.id==='stone-s-endurance-stone-giant')?.current,3);
  assert.equal(character.resources.find(resource=>resource.id==='rage')?.name,'Rage');
  assert.equal(character.resources.find(resource=>resource.id==='goliath-large-form')?.name,'Large Form');
  assert.equal(character.resources.find(resource=>resource.id==='wild-resurgence-slot')?.name,'Wild Resurgence Slot Exchange');
  assert.equal(character.resources.some(resource=>['rage-enter','activate-large-form','wild-resurgence-regain-spell-slot'].includes(resource.id)),false);
  assert.ok(character.transformationGrants?.some(grant=>grant.id==='goliath-large-form'));
  assert.equal(report.blocked,false);
  assert.equal(character.provenance.provider,'dndbeyond');assert.equal(character.provenance.ruleset,'2024');
  assert.equal(character.provenance.reviewRequired,true);
  assert.deepEqual(character.items.map(item=>({name:item.name,equipped:item.equipped,attuned:item.attuned,mechanics:item.mechanics})),[
    {name:'Cloak of Protection',equipped:true,attuned:true,mechanics:'included-in-imported-totals'},
    {name:'Insignia of Claws',equipped:true,attuned:true,mechanics:'included-in-imported-totals'},
  ]);
  assert.equal(character.items[0]?.requiresAttunement,true);
  assert.deepEqual(character.items[0]?.effects,[{kind:'armor-class',value:1,includedInImportedTotals:true},{kind:'saving-throws',value:1,includedInImportedTotals:true}]);
  assert.ok(report.coverage.every(item=>item.status!=='review'||['2024 ruleset','Items and homebrew'].includes(item.label)));
  assert.ok(report.warnings.some(item=>item.code==='ruleset-review'));
  assert.ok(report.warnings.some(item=>item.code==='item-text-review'));
  assert.ok(report.warnings.some(item=>item.code==='circle-moon-spells-restored'));
  assert.deepEqual(report.setupNeeds.map(need=>[need.kind,need.label]),[
    ['feat','Sentinel'],['item','Cloak of Protection'],['item','Insignia of Claws'],
  ]);
  assert.equal(ddbSetupPackId(report.sourceId,report.setupNeeds[0]!.id),'ddb-152187683-feat-sentinel');
});

test('keeps leveled spells granted by feats even when D&D Beyond omits prepared flags',()=>{
  const payload=structuredClone(ferocitusPayload);
  (payload.data.spells.feat as unknown[]).push({
    definition:{id:901,name:'Magic Initiate Choice',level:1,concentration:false,components:[1,2],modifiers:[]},
    activation:{activationType:1},spellCastingAbilityId:5,usesSpellSlot:false,limitedUse:{maxUses:1,numberUsed:0,resetType:2},
  });
  payload.data.classSpells[0]!.spells.push({...spell(902,'Ordinary Unprepared Spell',1),prepared:false,alwaysPrepared:false,countsAsKnownSpell:false});
  const character=importDdbCharacter(payload,'152187683').character;
  assert.ok(character.spells.some(entry=>entry.name==='Magic Initiate Choice'&&entry.level===1));
  const granted=character.spells.find(entry=>entry.name==='Magic Initiate Choice');assert.ok(granted?.freeCastResourceId);assert.equal(character.resources.find(entry=>entry.id===granted.freeCastResourceId)?.current,1);assert.equal(character.resources.find(entry=>entry.id===granted.freeCastResourceId)?.recovery,'long-all');
  assert.equal(character.spells.some(entry=>entry.name==='Ordinary Unprepared Spell'),false);
});

test('imports Astral Arms as an activatable enhancement instead of guessing live state',()=>{
  const payload=structuredClone(ferocitusPayload) as any;payload.data.classes=[{id:3300,level:6,isStartingClass:true,definition:{id:33,name:'Monk',isLegacy:false,spellCastingAbilityId:0,classFeatures:[]},subclassDefinition:{name:'Way of the Astral Self (TCoE)',classFeatures:[{name:'Arms of the Astral Self',requiredLevel:3},{name:'Visage of the Astral Self',requiredLevel:6}]}}];payload.data.actions.class=[{id:'focus',name:'Focus Points',limitedUse:{resetType:1,numberUsed:5,maxUses:6,useProficiencyBonus:false}},{id:'astral-summon',name:'Arms of the Astral Self: Summon',saveStatId:2,dice:{diceString:'2d6'}},{id:'astral-strike',name:'Arms of the Astral Self (WIS)'},{id:'astral-visage',name:'Visage of the Astral Self'}];
  const report=importDdbCharacter(payload,'152187683'),grant=report.character.transformationGrants?.find(entry=>entry.id==='ddb-astral-arms'),visage=report.character.transformationGrants?.find(entry=>entry.id==='ddb-astral-visage');assert.ok(grant);assert.equal(grant.profile,'overlay');assert.equal(grant.resourceId,'focus-points');assert.equal(report.character.resources.find(entry=>entry.id==='focus-points')?.current,1);assert.equal(report.character.resources.filter(entry=>entry.name==='Focus Points').length,1);assert.equal(grant.effects?.activationActions?.[0]?.damageOnFail?.[0]?.expression,'2d8');const strike=grant.effects?.actions?.find(entry=>entry.id==='astral-arms-unarmed-strike');assert.ok(strike?.type==='attack');assert.equal(strike.ability,'wis');assert.equal(strike.reach,10);assert.equal(strike.damage[0]?.type,'Force');assert.match(strike.damage[0]?.expression??'',/^1d8/);assert.equal(grant.effects?.attackAbilityOverride,undefined);assert.ok(visage);assert.deepEqual(visage.effects?.skillAdvantage,['Insight','Intimidation']);assert.equal(report.character.transformationGrants?.some(entry=>entry.id==='ddb-astral-arms-visage'),false);const options=availableTransformations(report.character,createInitialState(report.character));assert.equal(options.find(option=>option.grantId==='ddb-astral-arms')?.usable,true);assert.equal(options.find(option=>option.grantId==='ddb-astral-visage')?.usable,true);assert.equal(options.some(option=>option.grantId==='ddb-astral-arms-visage'),false);assert.equal(report.setupNeeds.some(entry=>/arms of the astral self|visage of the astral self/i.test(entry.label)),false);
});

test('ignores unfinished D&D Beyond feat choosers without dropping selected or granted feats',()=>{
  const payload=structuredClone(ferocitusPayload);
  payload.data.feats.push({definition:{id:2048517,name:'Dark Bargain',isHomebrew:false,isLegacy:false}} as any);
  payload.data.choices.feat.push({componentId:2048517,componentTypeId:1088085227,optionValue:null} as any);
  const report=importDdbCharacter(payload,'152187683');
  assert.deepEqual(report.character.feats,['Sentinel','Tough']);
  assert.equal(report.setupNeeds.some(need=>need.label==='Dark Bargain'),false);
  assert.ok(report.warnings.some(warning=>warning.code==='incomplete-feat-choice'&&warning.message.includes('Dark Bargain')));
  assert.ok(report.character.provenance.rulesetEvidence.includes('Altered verified D&D Beyond feat selections'));
});

test('imports equipped weapon structure into executable base-form attacks',()=>{
  const payload=structuredClone(ferocitusPayload);
  payload.data.modifiers.class.push({type:'proficiency',subType:'martial-weapons',componentId:111,isGranted:true} as any);
  payload.data.inventory.push({id:501,equipped:true,isAttuned:false,definition:{id:201,name:'Greataxe',type:'Greataxe',filterType:'Weapon',categoryId:2,attackType:1,damage:{diceString:'1d12'},damageType:'Slashing',range:5,longRange:5,properties:[{name:'Heavy'},{name:'Two-Handed'},{name:'Cleave'}]}} as any);
  const report=importDdbCharacter(payload,'152187683');const item=report.character.items.find(entry=>entry.name==='Greataxe');
  assert.ok(item?.attack);assert.equal(item.attack.damage,'1d12');assert.equal(item.attack.damageType,'Slashing');assert.equal(item.attack.proficient,true);
});

test('infers an explicit magic weapon bonus from a D&D Beyond item name when numeric fields are absent',()=>{
  const payload=structuredClone(ferocitusPayload) as any;payload.data.modifiers.class.push({type:'proficiency',subType:'simple-weapons',componentId:112,isGranted:true});
  payload.data.inventory.push({id:502,equipped:true,isAttuned:false,definition:{id:202,name:'Quarterstaff, +1',type:'Quarterstaff',filterType:'Weapon',categoryId:1,attackType:1,damage:{diceString:'1d6'},damageType:'Bludgeoning',properties:[{name:'Versatile'}]}});
  const item=importDdbCharacter(payload,'152187683').character.items.find(entry=>entry.name==='Quarterstaff, +1');assert.equal(item?.attack?.magicBonus,1);
});

test('identifies unsupported paid subclass features without copying descriptions',()=>{
  const payload=JSON.parse(JSON.stringify(ferocitusPayload)) as any;const druid=payload.data.classes[1];assert.ok(druid);
  druid.subclassDefinition={name:'Circle of Stars',classFeatures:[{name:'Starry Form',requiredLevel:3},{name:'Cosmic Omen',requiredLevel:6}]};
  const report=importDdbCharacter(payload,'152187683');const setup=report.setupNeeds.filter(need=>need.kind==='subclass');
  assert.deepEqual(setup.map(need=>need.label),['Starry Form']);
  assert.ok(setup[0]?.detail.includes('Circle of Stars Druid feature'));
  assert.ok(!JSON.stringify(setup).includes('description'));
});

test('identifies only level-eligible traits for a non-SRD species',()=>{
  const payload=structuredClone(ferocitusPayload) as any;payload.data.race={fullName:'Astral Wanderer',sizeId:4,weightSpeeds:{normal:{walk:30}},racialTraits:[{definition:{name:'Astral Arms',requiredLevel:1}},{definition:{name:'Astral Flight',requiredLevel:10}}]};
  const report=importDdbCharacter(payload,'152187683');const setup=report.setupNeeds.filter(need=>need.kind==='species');
  assert.deepEqual(setup.map(need=>need.label),['Astral Arms']);assert.ok(setup[0]?.detail.includes('Astral Wanderer'));
});

test('blocks clearly legacy or mixed D&D Beyond characters from the 2024-only engine',()=>{
  const payload=structuredClone(ferocitusPayload);const first=payload.data.classes[0];assert.ok(first);first.definition.isLegacy=true;
  const report=importDdbCharacter(payload,'152187683');assert.equal(report.blocked,true);assert.equal(report.character.provenance.ruleset,'mixed');assert.match(report.blockReason??'',/2024 rules only/);assert.ok(report.warnings.some(item=>item.code==='non-2024-ruleset'));
});

test('does not treat isLegacy false as affirmative 2024 provenance',()=>{
  const payload=structuredClone(ferocitusPayload) as any;
  for(const entry of payload.data.classes)delete entry.definition.is2024;
  const report=importDdbCharacter(payload,'152187683');
  assert.equal(report.blocked,false);assert.equal(report.character.provenance.ruleset,'unknown');assert.equal(report.character.provenance.reviewRequired,true);
  assert.ok(report.warnings.some(item=>item.code==='ruleset-review'));
});

test('flags exact unresolved Pact Magic fields instead of importing verified zero slots',()=>{
  const payload=structuredClone(ferocitusPayload) as any;
  payload.data.classes=[{id:4400,level:5,isStartingClass:true,definition:{id:44,name:'Warlock',is2024:true,isLegacy:false,spellCastingAbilityId:6,classFeatures:[]},subclassDefinition:null}];
  const report=importDdbCharacter(payload,'152187683');
  assert.equal(report.character.provenance.reviewRequired,true);
  const warning=report.warnings.find(item=>item.code==='pact-magic-review');assert.ok(warning);assert.deepEqual(warning.fields,['data.classes[0].definition.spellRules.levelSpellSlots[5]','data.pactMagic']);
  assert.equal(report.character.resources.some(resource=>resource.id==='pact-magic-slots'),false);
  assert.deepEqual(report.character.spellSlots,{});
  assert.equal(report.coverage.find(item=>item.label==='Prepared and known spells')?.status,'review');
  assert.match(report.coverage.find(item=>item.label==='Pact Magic')?.detail??'',/no count or slot level guessed/i);
  assert.ok(report.character.provenance.rulesetEvidence.some(item=>item.includes('Pact Magic unresolved: data.classes[0].definition.spellRules')));
});

test('normalizes one authoritative D&D Beyond Pact Magic row into a short-rest resource without merging ordinary slots',()=>{
  const payload=structuredClone(ferocitusPayload) as any;
  payload.data.classes=[{id:4400,level:5,isStartingClass:true,definition:{id:44,name:'Warlock',is2024:true,isLegacy:false,spellCastingAbilityId:6,spellRules:pactSpellRules(5,3,2),classFeatures:[{id:4401,name:'Eldritch Invocations',requiredLevel:1}]},subclassDefinition:null}];
  payload.data.options={class:[{componentId:4401,componentTypeId:12168134,definition:{id:8801,name:'Eldritch Mind',is2024:true}}]};
  payload.data.pactMagic=[{level:1,used:0,available:0},{level:2,used:0,available:0},{level:3,used:1,available:0},{level:4,used:0,available:0},{level:5,used:0,available:0}];
  payload.data.actions.class=[];
  const report=importDdbCharacter(payload,'152187683');const pools=report.character.resources.filter(resource=>resource.id==='pact-magic-slots');
  assert.deepEqual(pools,[{id:'pact-magic-slots',name:'Pact Magic Slots (Level 3)',current:1,max:2,recovery:'short-all',kind:'pact-magic-slots',slotLevel:3,source:'data.classes[0].definition.spellRules.levelSpellSlots[5]; data.pactMagic[2].used'}]);
  assert.deepEqual(report.character.spellSlots,{});
  assert.match(report.warnings.find(item=>item.code==='pact-magic-review')?.message??'',/separate casting choice, spends it only after a valid cast/);
  assert.match(report.coverage.find(item=>item.label==='Pact Magic')?.detail??'',/separate casting choice/);
  assert.ok(report.character.provenance.rulesetEvidence.some(item=>item.includes('levelSpellSlots[5]: level 3, max 2')));
  assert.ok(report.character.provenance.rulesetEvidence.some(item=>item.includes('data.pactMagic[2].used: 1')));
});

test('uses the imported D&D Beyond Warlock slot rule when pactMagic available remains zero',()=>{
  const payload=structuredClone(ferocitusPayload) as any;
  payload.data.classes=[{id:4400,level:2,isStartingClass:true,definition:{id:44,name:'Warlock',is2024:true,isLegacy:false,spellCastingAbilityId:6,spellRules:pactSpellRules(2,1,2),classFeatures:[]},subclassDefinition:null}];
  payload.data.pactMagic=[1,2,3,4,5].map(level=>({level,used:0,available:0}));
  const report=importDdbCharacter(payload,'152187683');const pool=report.character.resources.find(resource=>resource.id==='pact-magic-slots');
  assert.deepEqual({current:pool?.current,max:pool?.max,slotLevel:pool?.slotLevel},{current:2,max:2,slotLevel:1});
  assert.match(report.warnings.find(item=>item.code==='pact-magic-review')?.message??'',/Imported 2\/2 level 1 Pact Magic slots/);
});

test('imports name-only invocation and owned Warlock feature evidence and retains a proven pact-weapon link',()=>{
  const payload=structuredClone(ferocitusPayload) as any;
  payload.data.classes=[{id:4400,level:5,isStartingClass:true,definition:{id:44,name:'Warlock',is2024:true,isLegacy:false,spellCastingAbilityId:6,spellRules:pactSpellRules(5,3,2),classFeatures:[{id:4401,name:'Eldritch Invocations',requiredLevel:1},{id:4402,name:'Pact Magic',requiredLevel:1},{id:4403,name:'Magical Cunning',requiredLevel:2}]},subclassDefinition:{id:5500,name:'Private Patron',classFeatures:[{id:5501,name:'Owned Patron Ward',requiredLevel:3,description:'PAID DESCRIPTION MUST NOT BE COPIED'},{id:5502,name:'Future Patron Secret',requiredLevel:10}]}}];
  payload.data.options={class:[
    {componentId:4401,componentTypeId:12168134,definition:{id:9100,name:'Pact of the Blade',is2024:true,description:'PAID BLADE TEXT'}},
    {componentId:4401,componentTypeId:12168134,definition:{id:9101,name:'Eldritch Smite',is2024:true,description:'PAID SMITE TEXT'}},
    {componentId:4401,componentTypeId:12168134,definition:{id:9102,name:'Eldritch Mind',is2024:true,description:'PAID MIND TEXT'}},
  ]};
  payload.data.modifiers.class=[
    {type:'proficiency',subType:'charisma-saving-throws',componentId:44,isGranted:true},
    {type:'proficiency',subType:'simple-weapons',componentId:44,isGranted:true},
    {type:'enable-feature',subType:'enable-pact-weapon',componentId:9100,componentTypeId:258900837,isGranted:true},
    {type:'replace-weapon-ability',subType:'charisma-score',componentId:9100,componentTypeId:258900837,statId:6,entityId:6,isGranted:true},
  ];
  payload.data.inventory=[{id:700,entityTypeId:1439493548,equipped:true,isAttuned:true,definition:{id:701,name:'Light Hammer of Warning',type:'Light Hammer',filterType:'Weapon',categoryId:1,attackType:1,damage:{diceString:'1d4'},damageType:'Bludgeoning',properties:[{name:'Light'},{name:'Thrown'}],is2024:true}}];
  payload.data.characterValues=[{typeId:28,value:true,valueId:'700',valueTypeId:'1439493548'}];
  payload.data.pactMagic=[{level:3,used:0,available:2}];
  const report=importDdbCharacter(payload,'152187683');const names=report.character.features.map(feature=>feature.name);const hammer=report.character.items.find(item=>item.name==='Light Hammer of Warning');
  assert.deepEqual(names,['Magical Cunning','Owned Patron Ward','Pact of the Blade','Eldritch Smite','Eldritch Mind']);
  assert.equal(report.character.features.find(feature=>feature.name==='Eldritch Smite')?.origin?.kind,'eldritch-invocation');
  assert.equal(report.character.features.every(feature=>feature.automation==='reference'),true);
  assert.equal(JSON.stringify(report.character).includes('PAID DESCRIPTION'),false);assert.equal(JSON.stringify(report.character).includes('PAID BLADE TEXT'),false);
  assert.equal(hammer?.attack?.ability,'str');
  assert.equal(hammer?.pactWeapon?.attackAbility,'cha');
  assert.ok(hammer?.pactWeapon?.evidence.some(value=>value.includes('enable-feature:enable-pact-weapon')));
  assert.ok(hammer?.pactWeapon?.evidence.some(value=>value.includes('characterValues')));
  assert.match(report.coverage.find(item=>item.label==='Owned Warlock features')?.detail??'',/3 selected invocation names imported as reference-only evidence/);

  const withoutAbility=structuredClone(payload);withoutAbility.data.modifiers.class=withoutAbility.data.modifiers.class.filter((entry:any)=>entry.type!=='replace-weapon-ability');const conservative=importDdbCharacter(withoutAbility,'152187683').character.items[0];
  assert.ok(conservative?.pactWeapon);assert.equal(conservative?.pactWeapon?.attackAbility,undefined);assert.equal(conservative?.attack?.ability,'str');
});

test('restores every always-prepared Circle of the Moon spell D&D Beyond omits at the current Druid level',()=>{
  const payload=structuredClone(ferocitusPayload);
  const spellGroup=payload.data.classSpells[0];assert.ok(spellGroup);
  spellGroup.spells=spellGroup.spells.filter(entry=>!['Starry Wisp','Cure Wounds','Moonbeam'].includes(entry.definition.name));
  const report=importDdbCharacter(payload,'152187683');const character=report.character;
  const circle=character.spells.filter(spell=>spell.specialAccess==='circle-of-the-moon');
  assert.deepEqual(circle.map(spell=>spell.name).sort(),['Conjure Animals','Cure Wounds','Moonbeam','Starry Wisp']);
  assert.equal(circle.find(spell=>spell.name==='Starry Wisp')?.damage?.[0]?.expression,'2d8');
  assert.equal(circle.find(spell=>spell.name==='Cure Wounds')?.healing,'2d8+3');
  assert.equal(circle.find(spell=>spell.name==='Moonbeam')?.saveAbility,'con');
  assert.equal(circle.find(spell=>spell.name==='Conjure Animals')?.saveAbility,'dex');
  assert.match(report.coverage.find(item=>item.label==='Prepared and known spells')?.detail??'',/4 Circle spells restored/);
});

test('imports healing rolls but keeps conditional spell damage manual',()=>{
  const payload=JSON.parse(JSON.stringify(ferocitusPayload));
  payload.data.classSpells[0].spells.push(
    spell(20,'Healing Word',1,{modifiers:[{type:'bonus',subType:'hit-points',usePrimaryStat:true,restriction:'',die:{diceString:'2d4'}}]}),
    spell(21,'Absorb Elements',1,{modifiers:[{type:'damage',subType:'fire',restriction:'Triggering damage',die:{diceString:'1d6'}}]}),
  );
  const character=importDdbCharacter(payload,'152187683').character;
  const healing=character.spells.find(entry=>entry.name==='Healing Word');assert.equal(healing?.healing,'2d4+3');
  const conditional=character.spells.find(entry=>entry.name==='Absorb Elements');assert.equal(conditional?.resolution,'manual');assert.deepEqual(conditional?.damage,[{expression:'1d6',type:'Fire'}]);
});

test('flags missing Wild Shape selections and rejects response identity mismatches',()=>{
  const missingForms=structuredClone(ferocitusPayload);
  missingForms.data.creatures=[];
  const report=importDdbCharacter(missingForms,'152187683');
  assert.equal(report.character.knownForms.length,0);
  assert.ok(report.warnings.some(item=>item.code==='wild-shape-not-provided'));
  assert.equal(report.coverage.find(item=>item.label==='Wild Shape selections')?.status,'review');
  assert.throws(()=>importDdbCharacter(ferocitusPayload,'999999999'),/but 999999999 was requested/);
});

test('loads a selected legal form from the SRD support catalog without guessing',()=>{
  const payload=structuredClone(ferocitusPayload);payload.data.creatures=[{groupId:1,definition:{name:'Ape'}}];
  const report=importDdbCharacter(payload,'152187683');
  assert.deepEqual(report.supportRequests.creatures,['Ape']);
  const enriched=applyDdbSrdCreatures(report,[{
    id:'srd-ape',name:'Ape',type:'Beast',cr:.5,size:'Medium',ac:12,hp:19,hitDice:'3d8+6',
    abilities:{str:16,dex:14,con:14,int:6,wis:12,cha:7},saves:{str:3,dex:2,con:2,int:-2,wis:1,cha:-2},skills:{Athletics:5,Perception:3},
    speeds:{walk:30,climb:30},senses:['Passive Perception 13'],resistances:[],immunities:[],vulnerabilities:[],traits:[],
    actions:[{id:'fist',name:'Fist',type:'attack',cost:'action',attackBonus:5,ability:'str',kind:'beast',reach:5,damage:[{expression:'1d6+3',type:'Bludgeoning'}]}],
    artKey:'base',source:{ruleset:'SRD 5.2.1 (CC BY 4.0)',page:'SRD creature: Ape',verified:'Live catalog validation'},
  }]);
  assert.deepEqual(enriched.character.knownForms,['srd-ape']);
  assert.equal(enriched.character.customForms['srd-ape']?.name,'Ape');
  assert.deepEqual(enriched.supportRequests.creatures,[]);
  assert.equal(enriched.coverage.find(item=>item.label==='Wild Shape selections')?.status,'verified');
});

test('rejects malformed D&D Beyond responses before they reach the character schema',()=>{
  assert.throws(()=>importDdbCharacter(null),/invalid response/);
  assert.throws(()=>importDdbCharacter({success:false,message:'No character'}),/No character/);
  assert.throws(()=>importDdbCharacter({success:true,data:{}}),/did not include character data/);
});
