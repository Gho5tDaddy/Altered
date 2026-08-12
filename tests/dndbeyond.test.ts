import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDdbSrdCreatures,ddbSetupPackId,extractDdbCharacterId,importDdbCharacter} from '../src/dndbeyond.js';

const spell=(id:number,name:string,level:number,extra:Record<string,unknown>={})=>({
  definition:{id,name,level,concentration:false,components:[1,2],modifiers:[],...extra},
  prepared:true,alwaysPrepared:false,countsAsKnownSpell:false,activation:{activationType:1},spellCastingAbilityId:5,
});

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
      {id:1100,level:1,isStartingClass:true,definition:{id:11,name:'Barbarian',isLegacy:false,spellCastingAbilityId:0,classFeatures:[{id:111,name:'Core Barbarian Traits'}]},subclassDefinition:null},
      {id:2200,level:5,isStartingClass:false,definition:{id:22,name:'Druid',isLegacy:false,spellCastingAbilityId:5,classFeatures:[{id:222,name:'Core Druid Traits'}]},subclassDefinition:{name:'Circle of the Moon'}},
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
      {equipped:true,isAttuned:true,definition:{id:100,name:'Cloak of Protection',type:'Wondrous item',requiresAttunement:true,armorClass:null,armorTypeId:null}},
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
  assert.ok(report.coverage.every(item=>item.status!=='review'||['2024 ruleset','Items and homebrew'].includes(item.label)));
  assert.ok(report.warnings.some(item=>item.code==='ruleset-review'));
  assert.ok(report.warnings.some(item=>item.code==='item-text-review'));
  assert.ok(report.warnings.some(item=>item.code==='circle-moon-spells-restored'));
  assert.deepEqual(report.setupNeeds.map(need=>[need.kind,need.label]),[
    ['feat','Sentinel'],['item','Cloak of Protection'],['item','Insignia of Claws'],
  ]);
  assert.equal(ddbSetupPackId(report.sourceId,report.setupNeeds[0]!.id),'ddb-152187683-feat-sentinel');
});

test('identifies unsupported paid subclass features without copying descriptions',()=>{
  const payload=JSON.parse(JSON.stringify(ferocitusPayload)) as any;const druid=payload.data.classes[1];assert.ok(druid);
  druid.subclassDefinition={name:'Circle of Stars',classFeatures:[{name:'Starry Form',requiredLevel:3},{name:'Cosmic Omen',requiredLevel:6}]};
  const report=importDdbCharacter(payload,'152187683');const setup=report.setupNeeds.filter(need=>need.kind==='subclass');
  assert.deepEqual(setup.map(need=>need.label),['Starry Form']);
  assert.ok(setup[0]?.detail.includes('Circle of Stars Druid feature'));
  assert.ok(!JSON.stringify(setup).includes('description'));
});

test('blocks clearly legacy or mixed D&D Beyond characters from the 2024-only engine',()=>{
  const payload=structuredClone(ferocitusPayload);const first=payload.data.classes[0];assert.ok(first);first.definition.isLegacy=true;
  const report=importDdbCharacter(payload,'152187683');assert.equal(report.blocked,true);assert.equal(report.character.provenance.ruleset,'mixed');assert.match(report.blockReason??'',/2024 rules only/);assert.ok(report.warnings.some(item=>item.code==='non-2024-ruleset'));
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
