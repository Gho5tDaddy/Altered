import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSrdCreature,parseSrdCatalogPage,parseSrdCatalogStatus,SRD_CATALOG_BASELINE,SRD_CATALOG_DOMAINS} from '../src/srd-catalog.js';

const brownBear={
  key:'srd-2024_brown-bear',name:'Brown Bear',document:{key:'srd-2024'},
  type:{name:'Beast'},size:{name:'Large'},challenge_rating:1,armor_class:11,hit_points:22,hit_dice:'3d10 + 6',
  ability_scores:{strength:17,dexterity:12,constitution:15,intelligence:2,wisdom:13,charisma:7},
  saving_throws_all:{strength:3,dexterity:1,constitution:2,intelligence:-4,wisdom:1,charisma:-2},
  skill_bonuses:{perception:3},speed:{walk:40,climb:30},darkvision_range:60,passive_perception:13,
  resistances_and_immunities:{damage_resistances:[],damage_immunities:[],damage_vulnerabilities:[],condition_immunities:[]},
  traits:[],
  actions:[
    {name:'Bite',desc:'Melee Attack Roll: +5, reach 5 ft. 7 (1d8 + 3) Piercing damage.',action_type:'ACTION',attacks:[{to_hit_mod:5,reach:5,damage_die_count:1,damage_die_type:'D8',damage_bonus:3,extra_damage_type:{name:'Piercing'}}]},
    {name:'Claw',desc:'Melee Attack Roll: +5, reach 5 ft. 5 (1d4 + 3) Slashing damage.',action_type:'ACTION',attacks:[{to_hit_mod:5,reach:5,damage_die_count:1,damage_die_type:'D4',damage_bonus:3,extra_damage_type:{name:'Slashing'}}]},
    {name:'Multiattack',desc:'The bear makes one Bite attack and one Claw attack.',action_type:'ACTION',attacks:[]},
  ],
};

test('live SRD status requires every legal support domain at its verified baseline',()=>{
  const status=parseSrdCatalogStatus({
    sourceVersion:'5.2.1',sourceDocument:'srd-2024',provider:'Open5e',
    checkedAt:'2026-07-29T20:00:00.000Z',counts:{...SRD_CATALOG_BASELINE},
  });
  assert.equal(status.healthy,true);
  assert.equal(status.recordCount,1808);
  const incomplete={...SRD_CATALOG_BASELINE,creatures:10};
  assert.equal(parseSrdCatalogStatus({sourceVersion:'5.2.1',sourceDocument:'srd-2024',provider:'Open5e',checkedAt:'2026-07-29T20:00:00.000Z',counts:incomplete}).healthy,false);
  assert.equal(SRD_CATALOG_DOMAINS.length,12);
});

test('catalog pages reject records from a different source document',()=>{
  const page=parseSrdCatalogPage({domain:'creatures',count:1,page:1,results:[brownBear]},'creatures');
  assert.equal(page.results.length,1);
  assert.throws(()=>parseSrdCatalogPage({domain:'creatures',count:1,page:1,results:[{...brownBear,document:{key:'paid-book'}}]},'creatures'),/unexpected document/);
});

test('SRD creature normalization produces executable attack and Multiattack records',()=>{
  const creature=normalizeSrdCreature(brownBear);
  assert.equal(creature.id,'srd-brown-bear');
  assert.deepEqual(creature.speeds,{walk:40,climb:30});
  const bite=creature.actions.find(action=>action.id==='bite');
  assert.equal(bite?.type,'attack');
  if(bite?.type==='attack')assert.deepEqual(bite.damage,[{expression:'1d8+3',type:'Piercing'}]);
  const multi=creature.actions.find(action=>action.type==='multiattack');
  assert.equal(multi?.type,'multiattack');
  if(multi?.type==='multiattack')assert.deepEqual(multi.sequence,['bite','claw']);
});

test('SRD save actions, conditions, recharge limits, and fixed damage stay executable',()=>{
  const spider=normalizeSrdCreature({
    ...brownBear,name:'Giant Spider',key:'srd-2024_giant-spider',
    ability_scores:{strength:14,dexterity:16,constitution:12,intelligence:2,wisdom:11,charisma:4},
    actions:[{name:'Web',desc:'Dexterity Saving Throw: DC 13, one creature. Failure: The target has the Restrained condition.',action_type:'ACTION',attacks:[],usage_limits:{type:'RECHARGE_ON_ROLL',param:5}}],
  });
  const web=spider.actions[0];assert.equal(web?.type,'save');
  if(web?.type==='save'){assert.equal(web.dc,13);assert.deepEqual(web.recharge,{min:5,max:6});assert.deepEqual(web.effectsOnFail?.map(effect=>effect.condition),['Restrained']);}

  const octopus=normalizeSrdCreature({
    ...brownBear,name:'Octopus',key:'srd-2024_octopus',size:{name:'Small'},challenge_rating:0,armor_class:12,hit_points:3,hit_dice:'1d6',
    ability_scores:{strength:4,dexterity:15,constitution:0,intelligence:3,wisdom:10,charisma:-3},
    saving_throws_all:{strength:-3,dexterity:2,constitution:30,intelligence:-4,wisdom:0,charisma:-3},
    actions:[
      {name:'Tentacles',desc:'Melee Attack Roll: +4, reach 5 ft. Hit: 1 Bludgeoning damage.',action_type:'ACTION',attacks:[{to_hit_mod:4,reach:5,damage_die_count:0,damage_die_type:null,damage_bonus:1,damage_type:{name:'Bludgeoning'}}]},
      {name:'Ink Cloud',desc:'The octopus releases ink.',action_type:'REACTION',attacks:[],usage_limits:{type:'PER_DAY',param:1}},
    ],
  });
  assert.deepEqual(octopus.abilities,{str:4,dex:15,con:11,int:3,wis:10,cha:4});
  assert.equal(octopus.saves.con,0);
  const tentacles=octopus.actions.find(action=>action.id==='tentacles');assert.equal(tentacles?.type,'attack');
  if(tentacles?.type==='attack')assert.deepEqual(tentacles.damage,[{expression:'1',type:'Bludgeoning'}]);
  const ink=octopus.actions.find(action=>action.id==='ink-cloud');assert.equal(ink?.type,'automatic');
  if(ink?.type==='automatic')assert.deepEqual(ink.uses,{max:1,recovery:'long'});
});

test('SRD Multiattack can reference a save-based action',()=>{
  const snake=normalizeSrdCreature({
    ...brownBear,name:'Giant Constrictor Snake',key:'srd-2024_giant-constrictor-snake',
    actions:[
      {name:'Bite',desc:'Melee Attack Roll: +6, reach 10 ft. Hit: 11 (2d6 + 4) Piercing damage.',action_type:'ACTION',attacks:[{to_hit_mod:6,reach:10,damage_die_count:2,damage_die_type:'D6',damage_bonus:4,damage_type:{name:'Piercing'}}]},
      {name:'Constrict',desc:'Strength Saving Throw: DC 14. Failure: 13 (2d8 + 4) Bludgeoning damage.',action_type:'ACTION',attacks:[]},
      {name:'Multiattack',desc:'The snake makes one Bite attack and uses Constrict.',action_type:'ACTION',attacks:[]},
    ],
  });
  const multi=snake.actions.find(action=>action.type==='multiattack');
  assert.ok(multi?.type==='multiattack');if(multi?.type!=='multiattack')return;
  assert.deepEqual(multi.sequence,['bite','constrict']);
});
