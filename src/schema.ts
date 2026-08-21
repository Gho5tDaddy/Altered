import type {Ability,ActionCost,Character,CharacterClass,Creature,CreatureAction,DamagePacket,DamageType,ImportedFeatureRule,ProficiencyRank,ResourcePool,RuleAutomationState,Spell,TransformProfile,TransformationEffects,TransformationGrant} from './types.js';
import {CREATURES} from './content-registry.js';

const ABILITIES:Ability[]=['str','dex','con','int','wis','cha'];
const CORE_CLASSES=new Set(['Artificer','Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard']);
const SPECIES=new Set(['Aasimar','Dragonborn','Dwarf','Elf','Gnome','Goliath','Halfling','Human','Orc','Tiefling']);
const CREATURE_TYPES=['Aberration','Beast','Celestial','Construct','Dragon','Elemental','Fey','Fiend','Giant','Humanoid','Monstrosity','Ooze','Plant','Undead'] as const;
const canonicalCreatureType=(value:string)=>CREATURE_TYPES.find(type=>type.toLowerCase()===value.trim().toLowerCase())??value.trim();
const DAMAGE_TYPES=new Set(['Acid','Bludgeoning','Cold','Fire','Force','Lightning','Necrotic','Piercing','Poison','Psychic','Radiant','Slashing','Thunder']);
const DICE=/^(?:\d{1,3}d\d{1,4}|\d{1,5})(?:[+-](?:\d{1,3}d\d{1,4}|\d{1,5}))*$/i;
const isObject=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const num=(v:unknown,name:string,min:number,max:number):number=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`${name} must be a number from ${min} to ${max}.`);return v};
const str=(v:unknown,name:string,max=120):string=>{if(typeof v!=='string'||v.trim()===''||v.length>max)throw new Error(`${name} must be non-empty text under ${max} characters.`);return v.trim()};
const bool=(v:unknown,def=false):boolean=>typeof v==='boolean'?v:def;
const ACTION_COSTS:ActionCost[]=['action','bonus','reaction','free','magic-action','none'];
const actionCost=(v:unknown,path:string,defaultValue?:ActionCost):ActionCost=>{
  if(v==null&&defaultValue)return defaultValue;
  if(!ACTION_COSTS.includes(v as ActionCost))throw new Error(`${path} must be one of: ${ACTION_COSTS.join(', ')}.`);
  return v as ActionCost;
};
const ability=(v:unknown,name:string):Ability=>{if(!ABILITIES.includes(v as Ability))throw new Error(`${name} must be str, dex, con, int, wis, or cha.`);return v as Ability};
const rank=(v:unknown):ProficiencyRank=>v===2?2:v===1?1:0;

function parseDamage(v:unknown,path:string):DamagePacket[]{
  if(v==null)return [];
  if(!Array.isArray(v))throw new Error(`${path} must be an array.`);
  return v.map((x,i)=>{if(!isObject(x))throw new Error(`${path}[${i}] must be an object.`);const expression=str(x.expression,`${path}[${i}].expression`,40).replace(/\s+/g,'');if(!DICE.test(expression))throw new Error(`${path}[${i}].expression is not a safe dice expression.`);const type=str(x.type,`${path}[${i}].type`,30);if(!DAMAGE_TYPES.has(type))throw new Error(`${path}[${i}].type is not a supported damage type.`);return {expression,type:type as DamagePacket['type'],...(typeof x.label==='string'?{label:x.label.slice(0,80)}:{}),...(typeof x.doubleOnCritical==='boolean'?{doubleOnCritical:x.doubleOnCritical}:{})};});
}

const SIZES=new Set(['Tiny','Small','Medium','Large','Huge','Gargantuan']);
const PROFILES:TransformProfile[]=['wildshape','polymorph','true-polymorph','shapechange','animal-shapes','overlay','custom'];
const parseDamageTypes=(value:unknown,path:string):DamageType[]=>{
  if(value==null)return [];
  if(!Array.isArray(value))throw new Error(`${path} must be an array.`);
  return [...new Set(value.map((entry,j)=>{const type=str(entry,`${path}[${j}]`,30);if(!DAMAGE_TYPES.has(type))throw new Error(`${path}[${j}] is not a supported damage type.`);return type as DamageType;}))];
};
function parseSpeeds(v:unknown,path:string){
  if(v==null)return {};
  if(!isObject(v))throw new Error(`${path} must be an object.`);
  const out:Record<string,number>={};
  for(const key of ['walk','climb','swim','fly','burrow'])if(v[key]!=null)out[key]=num(v[key],`${path}.${key}`,0,500);
  return out;
}
function parseConditionEffects(v:unknown,path:string){
  if(v==null)return undefined;
  if(!Array.isArray(v))throw new Error(`${path} must be an array.`);
  return v.slice(0,20).map((entry,i)=>{
    if(!isObject(entry))throw new Error(`${path}[${i}] must be an object.`);
    const out:{condition:string;duration?:string;escapeDc?:number;targetSizeMax?:string;note?:string}={condition:str(entry.condition,`${path}[${i}].condition`,80)};
    if(typeof entry.duration==='string')out.duration=entry.duration.slice(0,120);
    if(typeof entry.escapeDc==='number')out.escapeDc=num(entry.escapeDc,`${path}[${i}].escapeDc`,1,40);
    if(typeof entry.targetSizeMax==='string')out.targetSizeMax=entry.targetSizeMax.slice(0,30);
    if(typeof entry.note==='string')out.note=entry.note.slice(0,300);
    return out;
  });
}
function parseAttackRiders(v:unknown,path:string){
  if(v==null)return undefined;
  if(!Array.isArray(v))throw new Error(`${path} must be an array.`);
  return v.slice(0,20).map((entry,i)=>{
    if(!isObject(entry))throw new Error(`${path}[${i}] must be an object.`);
    const rider:{id:string;label:string;prerequisite:string;damage?:DamagePacket[];effects?:NonNullable<ReturnType<typeof parseConditionEffects>>}={
      id:str(entry.id,`${path}[${i}].id`,120),
      label:str(entry.label,`${path}[${i}].label`,120),
      prerequisite:str(entry.prerequisite,`${path}[${i}].prerequisite`,300)
    };
    if(entry.damage!=null)rider.damage=parseDamage(entry.damage,`${path}[${i}].damage`);
    const effects=parseConditionEffects(entry.effects,`${path}[${i}].effects`);if(effects)rider.effects=effects;
    return rider;
  });
}
function parseAction(v:unknown,path:string):CreatureAction{
  if(!isObject(v))throw new Error(`${path} must be an object.`);
  const id=str(v.id,`${path}.id`);const name=str(v.name,`${path}.name`);const type=str(v.type,`${path}.type`,30);
  if(type==='attack'){
    const kind=['beast','weapon','unarmed','spell'].includes(String(v.kind))?v.kind as 'beast'|'weapon'|'unarmed'|'spell':'beast';
    const out:CreatureAction={id,name,type:'attack',cost:actionCost(v.cost,`${path}.cost`,'action'),attackBonus:num(v.attackBonus,`${path}.attackBonus`,-20,40),ability:ability(v.ability,`${path}.ability`),kind,damage:parseDamage(v.damage,`${path}.damage`)};
    if(typeof v.reach==='number')out.reach=num(v.reach,`${path}.reach`,0,1000);if(typeof v.range==='string')out.range=v.range.slice(0,80);if(typeof v.prerequisite==='string')out.prerequisite=v.prerequisite.slice(0,300);if(typeof v.notes==='string')out.notes=v.notes.slice(0,500);const effects=parseConditionEffects(v.effects,`${path}.effects`);if(effects)out.effects=effects;const riders=parseAttackRiders(v.riders,`${path}.riders`);if(riders)out.riders=riders;parseActionLimits(v,path,out);return out;
  }
  if(type==='save'){
    const out:CreatureAction={id,name,type:'save',cost:actionCost(v.cost,`${path}.cost`,'action'),saveAbility:ability(v.saveAbility,`${path}.saveAbility`),dc:num(v.dc,`${path}.dc`,1,40)};
    if(Array.isArray(v.saveAbilityOptions)){const options=[...new Set(v.saveAbilityOptions.map((entry,i)=>ability(entry,`${path}.saveAbilityOptions[${i}]`)))];if(options.length)out.saveAbilityOptions=options;}
    if(typeof v.range==='string')out.range=v.range.slice(0,80);if(typeof v.prerequisite==='string')out.prerequisite=v.prerequisite.slice(0,300);if(v.damageOnFail!=null)out.damageOnFail=parseDamage(v.damageOnFail,`${path}.damageOnFail`);if(v.damageOnSuccess!=null)out.damageOnSuccess=parseDamage(v.damageOnSuccess,`${path}.damageOnSuccess`);if(typeof v.halfOnSuccess==='boolean')out.halfOnSuccess=v.halfOnSuccess;const effects=parseConditionEffects(v.effectsOnFail,`${path}.effectsOnFail`);if(effects)out.effectsOnFail=effects;parseActionLimits(v,path,out);if(typeof v.notes==='string')out.notes=v.notes.slice(0,500);return out;
  }
  if(type==='automatic'){
    const out:CreatureAction={id,name,type:'automatic',cost:actionCost(v.cost,`${path}.cost`,'action')};if(v.damage!=null)out.damage=parseDamage(v.damage,`${path}.damage`);if(typeof v.damageTiming==='string')out.damageTiming=v.damageTiming.slice(0,200);const effects=parseConditionEffects(v.effects,`${path}.effects`);if(effects)out.effects=effects;if(typeof v.prerequisite==='string')out.prerequisite=v.prerequisite.slice(0,300);
    if(Array.isArray(v.choices)){const resolutions=new Set(['dash','disengage','hide','skill-check','utilize','magic-item','activate']);out.choices=v.choices.slice(0,12).map((entry,i)=>{if(!isObject(entry))throw new Error(`${path}.choices[${i}] must be an object.`);const resolution=str(entry.resolution,`${path}.choices[${i}].resolution`,40);if(!resolutions.has(resolution))throw new Error(`${path}.choices[${i}].resolution is unsupported.`);return {id:str(entry.id,`${path}.choices[${i}].id`,120),label:str(entry.label,`${path}.choices[${i}].label`,120),resolution:resolution as NonNullable<Extract<CreatureAction,{type:'automatic'}>['choices']>[number]['resolution'],...(typeof entry.prerequisite==='string'?{prerequisite:entry.prerequisite.slice(0,300)}:{}),...(typeof entry.skill==='string'?{skill:entry.skill.slice(0,80)}:{}),...(typeof entry.notes==='string'?{notes:entry.notes.slice(0,500)}:{})};});}
    if(typeof v.notes==='string')out.notes=v.notes.slice(0,500);parseActionLimits(v,path,out);return out;
  }
  if(type==='multiattack'){
    if(!Array.isArray(v.sequence)||v.sequence.length===0||v.sequence.length>20)throw new Error(`${path}.sequence must be a non-empty array under 20 entries.`);
    const sequence=v.sequence.map((entry,i)=>str(entry,`${path}.sequence[${i}]`,120));
    const variants=Array.isArray(v.variants)?v.variants.slice(0,20).map((entry,i)=>{
      if(!isObject(entry))throw new Error(`${path}.variants[${i}] must be an object.`);
      if(!Array.isArray(entry.sequence)||entry.sequence.length===0||entry.sequence.length>20)throw new Error(`${path}.variants[${i}].sequence must be a non-empty array under 20 entries.`);
      return {id:str(entry.id,`${path}.variants[${i}].id`,120),label:str(entry.label,`${path}.variants[${i}].label`,120),sequence:entry.sequence.map((child,j)=>str(child,`${path}.variants[${i}].sequence[${j}]`,120))};
    }):undefined;
    return {id,name,type:'multiattack',cost:'action',sequence,...(variants?.length?{variants}:{}),...(typeof v.notes==='string'?{notes:v.notes.slice(0,500)}:{})};
  }
  throw new Error(`${path}.type must be attack, save, automatic, or multiattack.`);
}
function parseActionLimits(v:Record<string,unknown>,path:string,out:Extract<CreatureAction,{type:'attack'|'save'|'automatic'}>){
  if(isObject(v.recharge)){const min=num(v.recharge.min,`${path}.recharge.min`,1,6),max=num(v.recharge.max,`${path}.recharge.max`,1,6);if(min>max)throw new Error(`${path}.recharge.min must not exceed recharge.max.`);out.recharge={min,max};}
  if(isObject(v.uses)){const max=num(v.uses.max,`${path}.uses.max`,1,100);if(v.uses.recovery!=='long')throw new Error(`${path}.uses.recovery must be long.`);out.uses={max,recovery:'long'};}
}
function parseCreature(v:unknown,i:number):Creature{
  const path=`customForms[${i}]`;if(!isObject(v))throw new Error(`${path} must be an object.`);
  const a=v.abilities;if(!isObject(a))throw new Error(`${path}.abilities must be an object.`);
  const abilities={str:num(a.str,`${path}.abilities.str`,1,30),dex:num(a.dex,`${path}.abilities.dex`,1,30),con:num(a.con,`${path}.abilities.con`,1,30),int:num(a.int,`${path}.abilities.int`,1,30),wis:num(a.wis,`${path}.abilities.wis`,1,30),cha:num(a.cha,`${path}.abilities.cha`,1,30)};
  const saves:Partial<Record<Ability,number>>={};if(isObject(v.saves))for(const key of ABILITIES)if(typeof v.saves[key]==='number')saves[key]=num(v.saves[key],`${path}.saves.${key}`,-20,40);
  const skills:Record<string,number>={};if(isObject(v.skills))for(const [key,value] of Object.entries(v.skills)){if(key.length>80)continue;skills[key]=num(value,`${path}.skills.${key}`,-20,40);}
  const size=str(v.size,`${path}.size`,30);if(!SIZES.has(size))throw new Error(`${path}.size must be a standard creature size.`);
  const sourceRaw=isObject(v.source)?v.source:{};
  return {id:str(v.id,`${path}.id`),name:str(v.name,`${path}.name`),type:canonicalCreatureType(str(v.type,`${path}.type`,50)),...(Array.isArray(v.tags)?{tags:v.tags.filter((x):x is string=>typeof x==='string').slice(0,30).map(x=>x.slice(0,60))}:{}),cr:num(v.cr,`${path}.cr`,0,30),size,ac:num(v.ac,`${path}.ac`,1,40),hp:num(v.hp,`${path}.hp`,1,9999),hitDice:str(v.hitDice,`${path}.hitDice`,40),abilities,saves,skills,speeds:parseSpeeds(v.speeds,`${path}.speeds`),senses:Array.isArray(v.senses)?v.senses.filter((x):x is string=>typeof x==='string').slice(0,30).map(x=>x.slice(0,120)):[],resistances:parseDamageTypes(v.resistances,`${path}.resistances`),immunities:parseDamageTypes(v.immunities,`${path}.immunities`),vulnerabilities:parseDamageTypes(v.vulnerabilities,`${path}.vulnerabilities`),...(Array.isArray(v.conditionImmunities)?{conditionImmunities:[...new Set(v.conditionImmunities.filter((x):x is string=>typeof x==='string'&&x.trim().length>0).slice(0,50).map(x=>x.trim().slice(0,80)))]}:{}),traits:Array.isArray(v.traits)?v.traits.filter(isObject).slice(0,50).map((x,j)=>({name:str(x.name,`${path}.traits[${j}].name`),summary:str(x.summary,`${path}.traits[${j}].summary`,500)})):[],actions:Array.isArray(v.actions)?v.actions.slice(0,100).map((x,j)=>parseAction(x,`${path}.actions[${j}]`)):[],artKey:typeof v.artKey==='string'?v.artKey.slice(0,80):'base',source:{ruleset:typeof sourceRaw.ruleset==='string'?sourceRaw.ruleset.slice(0,120):'User-imported content',page:typeof sourceRaw.page==='string'?sourceRaw.page.slice(0,180):'Private character data',verified:typeof sourceRaw.verified==='string'?sourceRaw.verified.slice(0,30):'Unverified'}};
}
function parseEffects(v:unknown,path:string):TransformationEffects|undefined{
  if(v==null)return undefined;if(!isObject(v))throw new Error(`${path} must be an object.`);const out:TransformationEffects={};
  if(typeof v.size==='string'){const size=v.size.slice(0,30);if(!SIZES.has(size))throw new Error(`${path}.size must be a standard creature size.`);out.size=size;}
  if(typeof v.creatureType==='string')out.creatureType=canonicalCreatureType(str(v.creatureType,`${path}.creatureType`,50));
  const parseAbilityMap=(raw:unknown,name:string,min:number,max:number)=>{if(!isObject(raw))return undefined;const result:Partial<Record<Ability,number>>={};for(const key of ABILITIES)if(raw[key]!=null)result[key]=num(raw[key],`${path}.${name}.${key}`,min,max);return result;};
  const abilitySet=parseAbilityMap(v.abilitySet,'abilitySet',1,30);if(abilitySet)out.abilitySet=abilitySet;const abilityMinimum=parseAbilityMap(v.abilityMinimum,'abilityMinimum',1,30);if(abilityMinimum)out.abilityMinimum=abilityMinimum;const abilityBonus=parseAbilityMap(v.abilityBonus,'abilityBonus',-20,20);if(abilityBonus)out.abilityBonus=abilityBonus;
  if(v.speedSet!=null)out.speedSet=parseSpeeds(v.speedSet,`${path}.speedSet`);if(v.speedBonus!=null)out.speedBonus=parseSpeeds(v.speedBonus,`${path}.speedBonus`);
  if(Array.isArray(v.speedEqualToWalk)){const allowed=new Set(['climb','swim','fly','burrow']);out.speedEqualToWalk=[...new Set(v.speedEqualToWalk.map((entry,i)=>{if(typeof entry!=='string'||!allowed.has(entry))throw new Error(`${path}.speedEqualToWalk[${i}] must be climb, swim, fly, or burrow.`);return entry as 'climb'|'swim'|'fly'|'burrow';}))];}
  if(typeof v.acBonus==='number')out.acBonus=num(v.acBonus,`${path}.acBonus`,-20,20);
  if(isObject(v.acFormula)){if(!Array.isArray(v.acFormula.abilities)||v.acFormula.abilities.length>3)throw new Error(`${path}.acFormula.abilities must be an array under 4 entries.`);out.acFormula={base:num(v.acFormula.base,`${path}.acFormula.base`,0,30),abilities:v.acFormula.abilities.map((entry,i)=>ability(entry,`${path}.acFormula.abilities[${i}]`))};}
  out.resistances=parseDamageTypes(v.resistances,`${path}.resistances`);out.immunities=parseDamageTypes(v.immunities,`${path}.immunities`);out.vulnerabilities=parseDamageTypes(v.vulnerabilities,`${path}.vulnerabilities`);
  if(Array.isArray(v.senses))out.senses=v.senses.filter((x):x is string=>typeof x==='string').slice(0,30).map(x=>x.slice(0,120));if(Array.isArray(v.actions))out.actions=v.actions.slice(0,100).map((x,i)=>parseAction(x,`${path}.actions[${i}]`));
  if(Array.isArray(v.activationActions))out.activationActions=v.activationActions.slice(0,20).map((x,i)=>{const action=parseAction(x,`${path}.activationActions[${i}]`);if(action.type!=='save')throw new Error(`${path}.activationActions[${i}] must be a saving-throw effect.`);return action;});
  for(const [key,target] of [['checkAbilitySubstitution','checkAbilitySubstitution'],['saveAbilitySubstitution','saveAbilitySubstitution']] as const){if(!isObject(v[key]))continue;const substitutions:Partial<Record<Ability,Ability>>={};for(const from of ABILITIES)if(v[key][from]!==undefined)substitutions[from]=ability(v[key][from],`${path}.${key}.${from}`);if(Object.keys(substitutions).length)out[target]=substitutions;}
  if(isObject(v.attackAbilityOverride)){if(!Array.isArray(v.attackAbilityOverride.appliesTo)||v.attackAbilityOverride.appliesTo.length===0)throw new Error(`${path}.attackAbilityOverride.appliesTo must list weapon or unarmed.`);const appliesTo=[...new Set(v.attackAbilityOverride.appliesTo.map((entry,i)=>{if(entry!=='weapon'&&entry!=='unarmed')throw new Error(`${path}.attackAbilityOverride.appliesTo[${i}] must be weapon or unarmed.`);return entry as 'weapon'|'unarmed';}))];out.attackAbilityOverride={ability:ability(v.attackAbilityOverride.ability,`${path}.attackAbilityOverride.ability`),appliesTo};}
  if(isObject(v.attackDamageTypeOverride)){if(!Array.isArray(v.attackDamageTypeOverride.appliesTo)||v.attackDamageTypeOverride.appliesTo.length===0)throw new Error(`${path}.attackDamageTypeOverride.appliesTo must list weapon or unarmed.`);const appliesTo=[...new Set(v.attackDamageTypeOverride.appliesTo.map((entry,i)=>{if(entry!=='weapon'&&entry!=='unarmed')throw new Error(`${path}.attackDamageTypeOverride.appliesTo[${i}] must be weapon or unarmed.`);return entry as 'weapon'|'unarmed';}))];const type=str(v.attackDamageTypeOverride.type,`${path}.attackDamageTypeOverride.type`,30);if(!DAMAGE_TYPES.has(type))throw new Error(`${path}.attackDamageTypeOverride.type is not supported.`);out.attackDamageTypeOverride={type:type as DamageType,appliesTo};}
  if(isObject(v.attackReachMinimum)){if(!Array.isArray(v.attackReachMinimum.appliesTo)||v.attackReachMinimum.appliesTo.length===0)throw new Error(`${path}.attackReachMinimum.appliesTo must list weapon or unarmed.`);const appliesTo=[...new Set(v.attackReachMinimum.appliesTo.map((entry,i)=>{if(entry!=='weapon'&&entry!=='unarmed')throw new Error(`${path}.attackReachMinimum.appliesTo[${i}] must be weapon or unarmed.`);return entry as 'weapon'|'unarmed';}))];out.attackReachMinimum={feet:num(v.attackReachMinimum.feet,`${path}.attackReachMinimum.feet`,1,1000),appliesTo};}
  if(Array.isArray(v.checkAdvantage))out.checkAdvantage=v.checkAdvantage.map((x,i)=>ability(x,`${path}.checkAdvantage[${i}]`));if(Array.isArray(v.checkDisadvantage))out.checkDisadvantage=v.checkDisadvantage.map((x,i)=>ability(x,`${path}.checkDisadvantage[${i}]`));if(Array.isArray(v.saveAdvantage))out.saveAdvantage=v.saveAdvantage.map((x,i)=>ability(x,`${path}.saveAdvantage[${i}]`));if(Array.isArray(v.saveDisadvantage))out.saveDisadvantage=v.saveDisadvantage.map((x,i)=>ability(x,`${path}.saveDisadvantage[${i}]`));
  for(const key of ['skillAdvantage','skillDisadvantage'] as const)if(Array.isArray(v[key]))out[key]=v[key].filter((x):x is string=>typeof x==='string').slice(0,30).map(x=>x.slice(0,80));
  if(Array.isArray(v.conditionImmunities))out.conditionImmunities=[...new Set(v.conditionImmunities.filter((x):x is string=>typeof x==='string'&&Boolean(x.trim())).slice(0,30).map(x=>x.trim().slice(0,80)))];
  for(const key of ['canSpeak','canCast','canConcentrate','canAttack','canManipulateObjects','endsAtZeroHp','endsAtZeroTemporaryHp','endsOnIncapacitated'] as const)if(typeof v[key]==='boolean')out[key]=v[key];
  if(isObject(v.attackDamageModifier)){const expression=str(v.attackDamageModifier.expression,`${path}.attackDamageModifier.expression`,40).replace(/\s+/g,'');if(!DICE.test(expression))throw new Error(`${path}.attackDamageModifier.expression is not a safe dice expression.`);const mode=String(v.attackDamageModifier.mode);if(mode!=='add'&&mode!=='subtract')throw new Error(`${path}.attackDamageModifier.mode must be add or subtract.`);if(!Array.isArray(v.attackDamageModifier.appliesTo)||v.attackDamageModifier.appliesTo.length===0)throw new Error(`${path}.attackDamageModifier.appliesTo must list weapon or unarmed.`);const appliesTo=[...new Set(v.attackDamageModifier.appliesTo.map((entry,i)=>{if(entry!=='weapon'&&entry!=='unarmed')throw new Error(`${path}.attackDamageModifier.appliesTo[${i}] must be weapon or unarmed.`);return entry as 'weapon'|'unarmed';}))];const modifier:{expression:string;mode:'add'|'subtract';appliesTo:('weapon'|'unarmed')[];minimumDamage?:number}={expression,mode:mode as 'add'|'subtract',appliesTo};if(v.attackDamageModifier.minimumDamage!==undefined)modifier.minimumDamage=num(v.attackDamageModifier.minimumDamage,`${path}.attackDamageModifier.minimumDamage`,0,999);out.attackDamageModifier=modifier;}
  if(isObject(v.temporaryHp)){const mode=String(v.temporaryHp.mode);if(!['fixed','form-hp','expression'].includes(mode))throw new Error(`${path}.temporaryHp.mode is unsupported.`);const temp:{mode:'fixed'|'form-hp'|'expression';value?:number;expression?:string}={mode:mode as 'fixed'|'form-hp'|'expression'};if(mode==='fixed')temp.value=num(v.temporaryHp.value,`${path}.temporaryHp.value`,0,9999);if(mode==='expression'){const expression=str(v.temporaryHp.expression,`${path}.temporaryHp.expression`,40).replace(/\s+/g,'');if(!DICE.test(expression))throw new Error(`${path}.temporaryHp.expression is not a safe dice expression.`);temp.expression=expression;}out.temporaryHp=temp;}
  return out;
}
function parseGrant(v:unknown,i:number,forms:Record<string,Creature>):TransformationGrant{
  const path=`transformationGrants[${i}]`;if(!isObject(v))throw new Error(`${path} must be an object.`);if(!PROFILES.includes(v.profile as TransformProfile))throw new Error(`${path}.profile is unsupported.`);
  const formIds=Array.isArray(v.formIds)?[...new Set(v.formIds.filter((x):x is string=>typeof x==='string'&&(x in CREATURES||x in forms)))]:[];
  const out:TransformationGrant={id:str(v.id,`${path}.id`),label:str(v.label,`${path}.label`),profile:v.profile as TransformProfile,formIds,source:str(v.source,`${path}.source`),actionCost:actionCost(v.actionCost,`${path}.actionCost`,'action')};
  if(v.endActionCost!=null)out.endActionCost=actionCost(v.endActionCost,`${path}.endActionCost`);if(typeof v.duration==='string')out.duration=v.duration.slice(0,120);if(typeof v.resourceId==='string')out.resourceId=v.resourceId.slice(0,120);if(typeof v.resourceCost==='number')out.resourceCost=num(v.resourceCost,`${path}.resourceCost`,1,999);if(typeof v.concentration==='boolean')out.concentration=v.concentration;if(typeof v.spellName==='string')out.spellName=v.spellName.slice(0,120);if(typeof v.spellLevel==='number')out.spellLevel=num(v.spellLevel,`${path}.spellLevel`,0,9);if(typeof v.switchGroup==='string')out.switchGroup=v.switchGroup.slice(0,120);
  if(Array.isArray(v.availableProfiles))out.availableProfiles=v.availableProfiles.map((entry,j)=>{if(!PROFILES.includes(entry as TransformProfile)&&entry!=='base')throw new Error(`${path}.availableProfiles[${j}] is unsupported.`);return entry as TransformProfile;});
  if(isObject(v.retention)){out.retention={};for(const key of ['hp','hitDice','mentalAbilities','proficiencies','creatureType','classFeatures','feats','spellcasting','speech'] as const)if(typeof v.retention[key]==='boolean')out.retention[key]=v.retention[key];}
  const effects=parseEffects(v.effects,`${path}.effects`);if(effects)out.effects=effects;
  if(out.profile==='custom'&&formIds.length===0&&!out.effects)throw new Error(`${path} custom transformations require a form or explicit effects.`);
  if(out.profile!=='overlay'&&out.profile!=='custom'&&formIds.length===0)throw new Error(`${path} requires at least one formId.`);
  return out;
}

function parseSpell(v:unknown,i:number):Spell{
  if(!isObject(v))throw new Error(`spells[${i}] must be an object.`);
  const out:Spell={name:str(v.name,`spells[${i}].name`),level:num(v.level,`spells[${i}].level`,0,9),sourceClass:str(v.sourceClass,`spells[${i}].sourceClass`),ability:ability(v.ability,`spells[${i}].ability`),castingTime:actionCost(v.castingTime,`spells[${i}].castingTime`)};
  if(typeof v.id==='string')out.id=v.id.slice(0,120);
  if(typeof v.prepared==='boolean')out.prepared=v.prepared;
  if(typeof v.concentration==='boolean')out.concentration=v.concentration;
  if(typeof v.components==='string')out.components=v.components.slice(0,80);
  if(typeof v.materialCost==='boolean')out.materialCost=v.materialCost;
  if(typeof v.materialConsumed==='boolean')out.materialConsumed=v.materialConsumed;
  if(typeof v.attackBonus==='number')out.attackBonus=num(v.attackBonus,`spells[${i}].attackBonus`,-20,30);
  if(typeof v.saveDc==='number')out.saveDc=num(v.saveDc,`spells[${i}].saveDc`,1,40);
  if(v.saveAbility!==undefined)out.saveAbility=ability(v.saveAbility,`spells[${i}].saveAbility`);
  if(v.damage!=null)out.damage=parseDamage(v.damage,`spells[${i}].damage`);
  if(typeof v.healing==='string'){const healing=v.healing.replace(/\s+/g,'').slice(0,40);if(!DICE.test(healing))throw new Error(`spells[${i}].healing is not a safe dice expression.`);out.healing=healing;}
  if(typeof v.halfOnSave==='boolean')out.halfOnSave=v.halfOnSave;
  if(v.higherSlotDamage!=null)out.higherSlotDamage=parseDamage(v.higherSlotDamage,`spells[${i}].higherSlotDamage`);
  if(typeof v.higherSlotHealing==='string'){const healing=v.higherSlotHealing.replace(/\s+/g,'').slice(0,40);if(!DICE.test(healing))throw new Error(`spells[${i}].higherSlotHealing is not a safe dice expression.`);out.higherSlotHealing=healing;}
  if(v.specialAccess!==undefined){if(v.specialAccess!=='circle-of-the-moon')throw new Error(`spells[${i}].specialAccess is unsupported.`);out.specialAccess='circle-of-the-moon';}
  if(v.resolution!==undefined){if(!['save','automatic','manual'].includes(String(v.resolution)))throw new Error(`spells[${i}].resolution is unsupported.`);out.resolution=v.resolution as 'save'|'automatic'|'manual';}
  if(typeof v.slotLevel==='number')out.slotLevel=num(v.slotLevel,`spells[${i}].slotLevel`,0,9);
  if(typeof v.freeCastResourceId==='string')out.freeCastResourceId=v.freeCastResourceId.slice(0,120);
  if(typeof v.freeCastResourceCost==='number')out.freeCastResourceCost=num(v.freeCastResourceCost,`spells[${i}].freeCastResourceCost`,1,999);
  if(typeof v.summary==='string')out.summary=v.summary.slice(0,300);
  if(v.activeEffect!==undefined){if(!isObject(v.activeEffect))throw new Error(`spells[${i}].activeEffect must be an object.`);const effect={id:str(v.activeEffect.id,`spells[${i}].activeEffect.id`,120),duration:str(v.activeEffect.duration,`spells[${i}].activeEffect.duration`,120),summary:str(v.activeEffect.summary,`spells[${i}].activeEffect.summary`,300)};out.activeEffect={...effect,...(typeof v.activeEffect.acMinimum==='number'?{acMinimum:num(v.activeEffect.acMinimum,`spells[${i}].activeEffect.acMinimum`,1,40)}:{})};}
  return out;
}
function parseFeature(v:unknown,i:number):ImportedFeatureRule{
  if(!isObject(v))throw new Error(`features[${i}] must be an object.`);
  const out:ImportedFeatureRule={id:str(v.id,`features[${i}].id`),name:str(v.name,`features[${i}].name`),source:str(v.source,`features[${i}].source`),summary:str(v.summary,`features[${i}].summary`,500)};
  if(typeof v.level==='number')out.level=num(v.level,`features[${i}].level`,1,20);
  if(typeof v.automation==='string'){if(!['calculated','conditional','reference','unsupported'].includes(v.automation))throw new Error(`features[${i}].automation is unsupported.`);out.automation=v.automation as RuleAutomationState;}
  if(v.origin!==undefined){
    if(!isObject(v.origin)||v.origin.provider!=='dndbeyond'||!['eldritch-invocation','owned-class-feature','owned-subclass-feature'].includes(String(v.origin.kind)))throw new Error(`features[${i}].origin is unsupported.`);
    if(!Array.isArray(v.origin.sourceIds))throw new Error(`features[${i}].origin.sourceIds must be an array.`);
    out.origin={provider:'dndbeyond',kind:v.origin.kind as NonNullable<ImportedFeatureRule['origin']>['kind'],sourceIds:[...new Set(v.origin.sourceIds.filter((value):value is string=>typeof value==='string'&&Boolean(value.trim())).slice(0,20).map(value=>value.trim().slice(0,120)))]};
  }
  if(isObject(v.retention))out.retention={wildshape:bool(v.retention.wildshape),polymorph:bool(v.retention.polymorph),'true-polymorph':bool(v.retention['true-polymorph']),shapechange:bool(v.retention.shapechange),'animal-shapes':bool(v.retention['animal-shapes']),overlay:bool(v.retention.overlay),custom:bool(v.retention.custom)};
  if(isObject(v.requires))out.requires={spellcasting:bool(v.requires.spellcasting),concentration:bool(v.requires.concentration),speech:bool(v.requires.speech),weapon:bool(v.requires.weapon),unarmed:bool(v.requires.unarmed),strengthAttack:bool(v.requires.strengthAttack),noArmor:bool(v.requires.noArmor),noShield:bool(v.requires.noShield)};
  if(isObject(v.grants)){
    const grants:NonNullable<ImportedFeatureRule['grants']>={};
    if(typeof v.grants.speedBonus==='number')grants.speedBonus=num(v.grants.speedBonus,`features[${i}].grants.speedBonus`,-100,200);
    const parseTypes=(value:unknown,path:string):DamageType[]=>{
      if(value==null)return [];
      if(!Array.isArray(value))throw new Error(`${path} must be an array.`);
      return [...new Set(value.map((entry,j)=>{const type=str(entry,`${path}[${j}]`,30);if(!DAMAGE_TYPES.has(type))throw new Error(`${path}[${j}] is not a supported damage type.`);return type as DamageType;}))];
    };
    if(v.grants.resistances!=null)grants.resistances=parseTypes(v.grants.resistances,`features[${i}].grants.resistances`);
    if(v.grants.immunities!=null)grants.immunities=parseTypes(v.grants.immunities,`features[${i}].grants.immunities`);
    if(v.grants.saveBonusAbility!=null)grants.saveBonusAbility=ability(v.grants.saveBonusAbility,`features[${i}].grants.saveBonusAbility`);
    if(v.grants.saveBonusFromAbility!=null)grants.saveBonusFromAbility=ability(v.grants.saveBonusFromAbility,`features[${i}].grants.saveBonusFromAbility`);
    if(isObject(v.grants.acFormula)){
      if(!Array.isArray(v.grants.acFormula.abilities)||v.grants.acFormula.abilities.length>3)throw new Error(`features[${i}].grants.acFormula.abilities must be an array with at most 3 abilities.`);
      grants.acFormula={base:num(v.grants.acFormula.base,`features[${i}].grants.acFormula.base`,0,30),abilities:v.grants.acFormula.abilities.map((entry,j)=>ability(entry,`features[${i}].grants.acFormula.abilities[${j}]`))};
    }
    out.grants=grants;
  }
  if(typeof v.activation==='string')out.activation=actionCost(v.activation,`features[${i}].activation`);
  return out;
}
function parseResource(v:unknown,i:number):ResourcePool{
  if(!isObject(v))throw new Error(`resources[${i}] must be an object.`);
  const max=num(v.max,`resources[${i}].max`,0,999);const current=num(v.current,`resources[${i}].current`,0,max);
  const recovery=['short-one','short-all','long-all','manual'].includes(String(v.recovery))?v.recovery as ResourcePool['recovery']:'manual';
  const rawId=str(v.id,`resources[${i}].id`);const normalized=rawId.trim().toLowerCase().replace(/[\s_]+/g,'-');
  const id=['focus','focus-points','ki','ki-points'].includes(normalized)?'focus-points':['pact-magic','pact-magic-slots','pact-slots'].includes(normalized)?'pact-magic-slots':rawId;
  const out:ResourcePool={id,name:id==='focus-points'?'Focus Points':str(v.name,`resources[${i}].name`),current,max,recovery};
  if(v.kind!==undefined){
    if(v.kind!=='pact-magic-slots'||id!=='pact-magic-slots')throw new Error(`resources[${i}].kind is unsupported for this resource.`);
    if(recovery!=='short-all')throw new Error(`resources[${i}] Pact Magic slots must recover with short-all.`);
    out.kind='pact-magic-slots';out.slotLevel=num(v.slotLevel,`resources[${i}].slotLevel`,1,5);
  }else if(v.slotLevel!==undefined)throw new Error(`resources[${i}].slotLevel requires kind pact-magic-slots.`);
  if(typeof v.source==='string')out.source=str(v.source,`resources[${i}].source`,200);
  return out;
}
function parseItem(v:unknown,i:number):Character['items'][number]{
  if(!isObject(v))throw new Error(`items[${i}] must be an object.`);
  const ruleset=['2024','legacy','mixed','unknown'].includes(String(v.ruleset))?v.ruleset as Character['items'][number]['ruleset']:'unknown';
  const mechanics=['included-in-imported-totals','reference-only','review-required'].includes(String(v.mechanics))?v.mechanics as Character['items'][number]['mechanics']:'review-required';
  const out:Character['items'][number]={id:str(v.id,`items[${i}].id`,120),name:str(v.name,`items[${i}].name`,160),type:typeof v.type==='string'?v.type.slice(0,120):'Item',equipped:bool(v.equipped),attuned:bool(v.attuned),requiresAttunement:bool(v.requiresAttunement),ruleset,sourceIds:Array.isArray(v.sourceIds)?[...new Set(v.sourceIds.filter((value):value is string=>typeof value==='string'&&Boolean(value.trim())).slice(0,20).map(value=>value.trim().slice(0,80)))]:[],mechanics};
  const effectKinds=new Set(['armor-class','saving-throws','natural-attack-rolls','natural-attack-damage']);
  if(Array.isArray(v.effects))out.effects=v.effects.slice(0,20).map((raw,j)=>{if(!isObject(raw)||!effectKinds.has(String(raw.kind)))throw new Error(`items[${i}].effects[${j}] is unsupported.`);return {kind:String(raw.kind) as NonNullable<Character['items'][number]['effects']>[number]['kind'],value:num(raw.value,`items[${i}].effects[${j}].value`,-10,10),includedInImportedTotals:bool(raw.includedInImportedTotals)};});
  if(v.pactWeapon!==undefined){
    if(!isObject(v.pactWeapon)||v.pactWeapon.provider!=='dndbeyond'||!Array.isArray(v.pactWeapon.evidence))throw new Error(`items[${i}].pactWeapon is unsupported.`);
    const evidence=[...new Set(v.pactWeapon.evidence.filter((value):value is string=>typeof value==='string'&&Boolean(value.trim())).slice(0,20).map(value=>value.trim().slice(0,160)))];if(!evidence.length)throw new Error(`items[${i}].pactWeapon.evidence must identify at least one D&D Beyond field.`);
    out.pactWeapon={provider:'dndbeyond',evidence,...(v.pactWeapon.attackAbility!==undefined?{attackAbility:ability(v.pactWeapon.attackAbility,`items[${i}].pactWeapon.attackAbility`)}:{})};
  }
  if(isObject(v.attack)){const damage=str(v.attack.damage,`items[${i}].attack.damage`,40).replace(/\s+/g,'');if(!DICE.test(damage))throw new Error(`items[${i}].attack.damage is not a safe dice expression.`);const damageType=str(v.attack.damageType,`items[${i}].attack.damageType`,30);if(!DAMAGE_TYPES.has(damageType))throw new Error(`items[${i}].attack.damageType is not supported.`);out.attack={ability:ability(v.attack.ability,`items[${i}].attack.ability`),damage,damageType:damageType as DamageType,proficient:bool(v.attack.proficient),properties:Array.isArray(v.attack.properties)?[...new Set(v.attack.properties.filter((entry):entry is string=>typeof entry==='string'&&Boolean(entry.trim())).slice(0,20).map(entry=>entry.trim().slice(0,60)))]:[],magicBonus:typeof v.attack.magicBonus==='number'?num(v.attack.magicBonus,`items[${i}].attack.magicBonus`,-5,10):0,...(typeof v.attack.range==='number'?{range:num(v.attack.range,`items[${i}].attack.range`,0,10000)}:{}),...(typeof v.attack.longRange==='number'?{longRange:num(v.attack.longRange,`items[${i}].attack.longRange`,0,10000)}:{})};}
  return out;
}
function parseClasses(v:unknown):CharacterClass[]{
  if(!Array.isArray(v)||v.length===0||v.length>12)throw new Error('classes must be a non-empty array with at most 12 entries.');
  const seen=new Set<string>();
  const result=v.map((x,i)=>{if(!isObject(x))throw new Error(`classes[${i}] must be an object.`);const rawName=str(x.name,`classes[${i}].name`);const name=[...CORE_CLASSES].find(value=>value.toLowerCase()===rawName.toLowerCase())??rawName;if(name.length>80)throw new Error(`classes[${i}].name is too long.`);const identity=name.toLowerCase();if(seen.has(identity))throw new Error(`Duplicate class: ${name}.`);seen.add(identity);const c:CharacterClass={name,level:num(x.level,`classes[${i}].level`,1,20)};if(typeof x.subclass==='string'&&x.subclass.trim())c.subclass=x.subclass.trim().slice(0,120);else c.subclass=null;return c;});
  return result;
}
function normalizeProficiencies(v:unknown):Character['proficiencies']{
  const saves:Partial<Record<Ability,ProficiencyRank>>={};const skills:Record<string,ProficiencyRank>={};
  if(isObject(v)){
    if(Array.isArray(v.saves)){for(const s of v.saves){if(typeof s!=='string')continue;const key=s.slice(0,3).toLowerCase() as Ability;if(ABILITIES.includes(key))saves[key]=1;}}
    else if(isObject(v.saves)){for(const key of ABILITIES)saves[key]=rank(v.saves[key]);}
    if(Array.isArray(v.skills)){for(const s of v.skills)if(typeof s==='string'&&s.length<80)skills[s]=1;}
    else if(isObject(v.skills)){for(const [k,val] of Object.entries(v.skills))if(k.length<80)skills[k]=rank(val);}
  }
  return {saves,skills};
}
function defaultResources(classes:CharacterClass[],abilities:Character['abilities'],species:string,totalLevel:number):ResourcePool[]{
  const level=(name:string)=>classes.find(c=>c.name.trim().toLowerCase()===name.toLowerCase())?.level??0;const pools:ResourcePool[]=[];
  const d=level('Druid');if(d>=2){const max=d>=17?4:d>=6?3:2;pools.push({id:'wild-shape',name:'Wild Shape',current:max,max,recovery:'short-one'});}if(d>=5)pools.push({id:'wild-resurgence-slot',name:'Wild Resurgence Slot Exchange',current:1,max:1,recovery:'long-all'});
  const b=level('Barbarian');if(b){const max=b>=17?6:b>=12?5:b>=6?4:b>=3?3:2;pools.push({id:'rage',name:'Rage',current:max,max,recovery:'short-one'});}
  const f=level('Fighter');if(f>=1){const max=f>=10?4:f>=4?3:2;pools.push({id:'second-wind',name:'Second Wind',current:max,max,recovery:'short-one'});}if(f>=2){const max=f>=17?2:1;pools.push({id:'action-surge',name:'Action Surge',current:max,max,recovery:'short-all'});}
  const m=level('Monk');if(m>=2)pools.push({id:'focus-points',name:'Focus Points',current:m,max:m,recovery:'short-all'});
  const p=level('Paladin');if(p>=1)pools.push({id:'lay-on-hands',name:'Lay On Hands',current:p*5,max:p*5,recovery:'long-all'});
  const bard=level('Bard');if(bard){const max=Math.max(1,Math.floor((abilities.cha-10)/2));pools.push({id:'bardic-inspiration',name:'Bardic Inspiration',current:max,max,recovery:bard>=5?'short-all':'long-all'});}
  const sorcerer=level('Sorcerer');if(sorcerer>=2)pools.push({id:'sorcery-points',name:'Sorcery Points',current:sorcerer,max:sorcerer,recovery:'long-all'});
  if(species.toLowerCase()==='goliath'&&totalLevel>=5)pools.push({id:'goliath-large-form',name:'Large Form',current:1,max:1,recovery:'long-all'});
  if(species.toLowerCase()==='dragonborn'&&totalLevel>=5)pools.push({id:'dragonborn-draconic-flight',name:'Draconic Flight',current:1,max:1,recovery:'long-all'});
  const draconic=classes.find(entry=>entry.name.toLowerCase()==='sorcerer'&&(entry.subclass??'').toLowerCase()==='draconic sorcery');if(draconic&&draconic.level>=14)pools.push({id:'sorcerer-dragon-wings',name:'Dragon Wings',current:1,max:1,recovery:'long-all'});
  return pools;
}

export function parseCharacter(input:unknown):Character{
  if(!isObject(input))throw new Error('Character file must contain one JSON object.');
  const classes=parseClasses(input.classes);const total=classes.reduce((n,c)=>n+c.level,0);
  const suppliedTotal=input.totalLevel==null?total:num(input.totalLevel,'totalLevel',1,20);if(suppliedTotal!==total)throw new Error(`totalLevel ${suppliedTotal} does not equal the sum of class levels ${total}.`);
  const a=input.abilities;if(!isObject(a))throw new Error('abilities must be an object.');
  const abilities={str:num(a.str,'abilities.str',1,30),dex:num(a.dex,'abilities.dex',1,30),con:num(a.con,'abilities.con',1,30),int:num(a.int,'abilities.int',1,30),wis:num(a.wis,'abilities.wis',1,30),cha:num(a.cha,'abilities.cha',1,30)};
  const hp=input.hp;if(!isObject(hp))throw new Error('hp must be an object.');const maxHp=num(hp.max,'hp.max',1,9999);const currentHp=num(hp.current,'hp.current',0,maxHp);
  const speciesRaw=typeof input.species==='string'?input.species:typeof input.race==='string'?input.race:'Human';const parsedSpecies=str(speciesRaw,'species');const species=[...SPECIES].find(value=>value.toLowerCase()===parsedSpecies.toLowerCase())??parsedSpecies;
  const customForms:Record<string,Creature>={};if(Array.isArray(input.customForms)){for(const [i,raw] of input.customForms.slice(0,200).entries()){const form=parseCreature(raw,i);if(form.id in CREATURES||form.id in customForms)throw new Error(`Duplicate or reserved custom form id: ${form.id}.`);customForms[form.id]=form;}}
  const hasForm=(id:string)=>id in CREATURES||id in customForms;const formById=(id:string)=>customForms[id]??CREATURES[id];
  const knownForms=[...new Set(Array.isArray(input.knownForms)?input.knownForms.filter((x):x is string=>typeof x==='string'&&hasForm(x)):[])];
  const seenForms=[...new Set(Array.isArray(input.seenForms)?input.seenForms.filter((x):x is string=>typeof x==='string'&&hasForm(x)).slice(0,500):knownForms)];
  const druid=classes.find(c=>c.name.trim().toLowerCase()==='druid');
  const knownLimit=!druid||druid.level<2?0:druid.level>=8?8:druid.level>=4?6:4;
  if(knownForms.length>knownLimit)throw new Error(`knownForms contains ${knownForms.length} forms, but this Druid level permits ${knownLimit}.`);
  if(knownForms.length&&knownLimit===0)throw new Error('knownForms requires a Druid with Wild Shape.');
  if(druid){
    const moon=druid.subclass?.trim().toLowerCase()==='circle of the moon'&&druid.level>=3;
    const maxCr=moon?Math.floor(druid.level/3):druid.level>=8?1:druid.level>=4?.5:.25;
    const fly=druid.level>=8;
    for(const id of knownForms){const form=formById(id);if(!form)continue;if(form.type.toLowerCase()!=='beast'||form.cr>maxCr||Boolean(form.speeds.fly)&&!fly)throw new Error(`${form.name} is not a legal known Wild Shape form for this Druid level and subclass.`);}
  }
  const defaults=defaultResources(classes,abilities,species,total);const imported=Array.isArray(input.resources)?input.resources.map(parseResource):[];const resourceMap=new Map(defaults.map(r=>[r.id,r]));for(const r of imported){const existing=resourceMap.get(r.id);resourceMap.set(r.id,r.id==='focus-points'&&existing?{...r,current:Math.min(existing.current,r.current),max:Math.max(existing.max,r.max)}:r);}const resources=[...resourceMap.values()];
  const spellSlots:Character['spellSlots']={};if(isObject(input.spellSlots)){for(const [k,v] of Object.entries(input.spellSlots)){if(!/^[1-9]$/.test(k)||!isObject(v))continue;const max=num(v.max,`spellSlots.${k}.max`,0,20);spellSlots[k]={max,current:num(v.current,`spellSlots.${k}.current`,0,max)};}}
  const equipmentRaw=isObject(input.equipment)?input.equipment:{};const armor=['none','light','medium','heavy'].includes(String(equipmentRaw.armorCategory))?equipmentRaw.armorCategory as Character['equipment']['armorCategory']:'none';const behavior=['merge','drop','wear'].includes(String(equipmentRaw.transformBehavior))?equipmentRaw.transformBehavior as Character['equipment']['transformBehavior']:'merge';
  const sizeRaw=typeof input.size==='string'?input.size:'Medium';if(!SIZES.has(sizeRaw))throw new Error('size must be a standard creature size.');
  const creatureType=typeof input.creatureType==='string'?canonicalCreatureType(str(input.creatureType,'creatureType',50)):'Humanoid';
  const provenanceRaw=isObject(input.provenance)?input.provenance:{};const ruleset=['2024','legacy','mixed','unknown'].includes(String(provenanceRaw.ruleset))?provenanceRaw.ruleset as Character['provenance']['ruleset']:'unknown';const provider=provenanceRaw.provider==='dndbeyond'?'dndbeyond':'local';
  const character:Character={schemaVersion:1,id:typeof input.id==='string'?input.id.slice(0,120):cryptoRandomId(),name:str(input.name,'name'),species,creatureType,size:sizeRaw,totalLevel:total,classes,abilities,hp:{current:currentHp,max:maxHp},ac:num(input.ac??10,'ac',1,40),speed:num(input.speed??30,'speed',0,200),proficiencies:normalizeProficiencies(input.proficiencies),knownForms,seenForms,spells:Array.isArray(input.spells)?input.spells.slice(0,200).map(parseSpell):[],spellSlots,feats:Array.isArray(input.feats)?input.feats.filter((x):x is string=>typeof x==='string').slice(0,100).map(x=>x.slice(0,120)):[],features:Array.isArray(input.features)?input.features.slice(0,500).map(parseFeature):[],resources,equipment:{armorCategory:armor,shield:bool(equipmentRaw.shield),transformBehavior:behavior,...(typeof equipmentRaw.formCanWear==='boolean'?{formCanWear:equipmentRaw.formCanWear}:{})},items:Array.isArray(input.items)?input.items.slice(0,300).map(parseItem):[],provenance:{provider,...(typeof provenanceRaw.sourceId==='string'?{sourceId:provenanceRaw.sourceId.slice(0,80)}:{}),ruleset,rulesetEvidence:Array.isArray(provenanceRaw.rulesetEvidence)?provenanceRaw.rulesetEvidence.filter((value):value is string=>typeof value==='string').slice(0,20).map(value=>value.slice(0,200)):[],reviewRequired:typeof provenanceRaw.reviewRequired==='boolean'?provenanceRaw.reviewRequired:ruleset!=='2024'},customForms};
  if(!SPECIES.has(species))character.legacyRace=species;
  if(isObject(input.skillBonuses))character.skillBonuses=Object.fromEntries(Object.entries(input.skillBonuses).filter(([,v])=>typeof v==='number').map(([k,v])=>[k,Number(v)]));
  if(isObject(input.saveBonuses)){const out:Partial<Record<Ability,number>>={};for(const key of ABILITIES)if(typeof input.saveBonuses[key]==='number')out[key]=Number(input.saveBonuses[key]);character.saveBonuses=out;}
  const transformationGrants:Array<TransformationGrant>=Array.isArray(input.transformationGrants)?input.transformationGrants.slice(0,200).map((g,i)=>parseGrant(g,i,customForms)):[];
  if(species.toLowerCase()==='goliath'&&total>=5&&!transformationGrants.some(g=>g.id==='goliath-large-form'))transformationGrants.push({id:'goliath-large-form',label:'Large Form',profile:'overlay',formIds:[],source:'Goliath species trait',actionCost:'bonus',endActionCost:'none',duration:'10 minutes',resourceId:'goliath-large-form',resourceCost:1,availableProfiles:['base','overlay'],effects:{size:'Large',speedBonus:{walk:10},checkAdvantage:['str']}});
  if(species.toLowerCase()==='dragonborn'&&total>=5&&!transformationGrants.some(g=>g.id==='dragonborn-draconic-flight'))transformationGrants.push({id:'dragonborn-draconic-flight',label:'Draconic Flight',profile:'overlay',formIds:[],source:'Dragonborn species trait',actionCost:'bonus',endActionCost:'none',duration:'10 minutes',resourceId:'dragonborn-draconic-flight',resourceCost:1,availableProfiles:['base','overlay'],effects:{speedEqualToWalk:['fly'],endsOnIncapacitated:true}});
  const draconicSorcerer=classes.find(entry=>entry.name.toLowerCase()==='sorcerer'&&(entry.subclass??'').toLowerCase()==='draconic sorcery');if(draconicSorcerer&&draconicSorcerer.level>=14&&!transformationGrants.some(g=>g.id==='sorcerer-dragon-wings'))transformationGrants.push({id:'sorcerer-dragon-wings',label:'Dragon Wings',profile:'overlay',formIds:[],source:'Draconic Sorcery subclass feature',actionCost:'bonus',endActionCost:'none',duration:'1 hour',resourceId:'sorcerer-dragon-wings',resourceCost:1,effects:{speedSet:{fly:60}}});
  if(transformationGrants.length)character.transformationGrants=transformationGrants;
  return character;
}

function cryptoRandomId():string{const uuid=globalThis.crypto?.randomUUID?.();if(uuid)return `character-${uuid}`;return `character-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`}
export function safeJsonParse(text:string):unknown{if(text.length>1_000_000)throw new Error('Character file exceeds the 1 MB safety limit.');return JSON.parse(text)}
