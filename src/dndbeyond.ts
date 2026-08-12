import type {Ability,ActionCost,Character,CharacterItem,CharacterRuleset,Creature,DamagePacket,DamageType,ProficiencyRank,ResourcePool,Spell} from './types.js';
import {CREATURES,MOON_FORM_SPELL_LEVELS,SUBCLASS_FEATURES} from './content-registry.js';
import {parseCharacter} from './schema.js';

type JsonObject=Record<string,unknown>;
type CoverageStatus='verified'|'review'|'not-provided';

export interface DdbImportWarning {
  code:string;
  severity:'info'|'warning';
  message:string;
}

export interface DdbImportCoverage {
  label:string;
  status:CoverageStatus;
  detail:string;
}

export type DdbSetupKind='subclass'|'feat'|'item'|'spell'|'homebrew';
export interface DdbSetupNeed {
  id:string;
  kind:DdbSetupKind;
  label:string;
  detail:string;
}

export interface DdbImportReport {
  sourceId:string;
  character:Character;
  blocked:boolean;
  blockReason?:string;
  warnings:DdbImportWarning[];
  coverage:DdbImportCoverage[];
  supportRequests:{creatures:string[]};
  setupNeeds:DdbSetupNeed[];
}

const ABILITIES:Ability[]=['str','dex','con','int','wis','cha'];
const ABILITY_NAMES=['strength','dexterity','constitution','intelligence','wisdom','charisma'] as const;
const SKILLS:Record<string,{name:string;ability:Ability}>={
  acrobatics:{name:'Acrobatics',ability:'dex'},
  'animal-handling':{name:'Animal Handling',ability:'wis'},
  arcana:{name:'Arcana',ability:'int'},
  athletics:{name:'Athletics',ability:'str'},
  deception:{name:'Deception',ability:'cha'},
  history:{name:'History',ability:'int'},
  insight:{name:'Insight',ability:'wis'},
  intimidation:{name:'Intimidation',ability:'cha'},
  investigation:{name:'Investigation',ability:'int'},
  medicine:{name:'Medicine',ability:'wis'},
  nature:{name:'Nature',ability:'int'},
  perception:{name:'Perception',ability:'wis'},
  performance:{name:'Performance',ability:'cha'},
  persuasion:{name:'Persuasion',ability:'cha'},
  religion:{name:'Religion',ability:'int'},
  'sleight-of-hand':{name:'Sleight of Hand',ability:'dex'},
  stealth:{name:'Stealth',ability:'dex'},
  survival:{name:'Survival',ability:'wis'},
};
const DAMAGE_TYPES:Record<string,DamageType>={
  acid:'Acid',bludgeoning:'Bludgeoning',cold:'Cold',fire:'Fire',force:'Force',lightning:'Lightning',
  necrotic:'Necrotic',piercing:'Piercing',poison:'Poison',psychic:'Psychic',radiant:'Radiant',
  slashing:'Slashing',thunder:'Thunder',
};
const FULL_CASTERS=new Set(['bard','cleric','druid','sorcerer','wizard']);
const HALF_CASTERS=new Set(['paladin','ranger']);
const SLOT_TABLE:number[][]=[
  [],
  [2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],
  [4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],
  [4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],
  [4,3,3,3,3,2,2,1,1],
];

const isObject=(value:unknown):value is JsonObject=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const array=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const object=(value:unknown):JsonObject=>isObject(value)?value:{};
const string=(value:unknown):string=>typeof value==='string'?value.trim():'';
const finite=(value:unknown):number|undefined=>typeof value==='number'&&Number.isFinite(value)?value:undefined;
const whole=(value:unknown,fallback=0):number=>Math.trunc(finite(value)??fallback);
const slug=(value:string):string=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100)||'ddb-resource';
const modifier=(score:number):number=>Math.floor((score-10)/2);
const proficiencyBonus=(level:number):number=>Math.floor((level-1)/4)+2;
const title=(value:string):string=>value.split('-').map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' ');

export function extractDdbCharacterId(value:string):string|null{
  const input=value.trim();
  if(/^\d{5,15}$/.test(input))return input;
  const urlMatch=input.match(/(?:dndbeyond\.com\/characters\/|character\/v\d+\/character\/)(\d{5,15})(?:[/?#]|$)/i);
  if(urlMatch?.[1])return urlMatch[1];
  const fileMatch=input.match(/_(\d{5,15})(?:\.pdf)?$/i);
  return fileMatch?.[1]??null;
}

function activeInventoryIds(data:JsonObject):Set<number>{
  const ids=new Set<number>();
  for(const raw of array(data.inventory)){
    const item=object(raw);const definition=object(item.definition);const id=finite(definition.id);
    const attunementRequired=whole(definition.canAttune)===1||Boolean(definition.requiresAttunement);
    if(id!==undefined&&Boolean(item.equipped)&&(!attunementRequired||Boolean(item.isAttuned)))ids.add(id);
  }
  return ids;
}

function selectedChoiceComponents(data:JsonObject):Set<string>{
  const selected=new Set<string>();
  for(const rawGroup of Object.values(object(data.choices))){
    for(const raw of array(rawGroup)){
      const choice=object(raw);if(choice.optionValue===null||choice.optionValue===undefined)continue;
      const componentId=finite(choice.componentId);if(componentId===undefined)continue;
      selected.add(`${whole(choice.componentTypeId)}:${componentId}`);
    }
  }
  return selected;
}

function collectModifiers(data:JsonObject):JsonObject[]{
  const result:JsonObject[]=[];const activeItems=activeInventoryIds(data);const selectedComponents=selectedChoiceComponents(data);
  const startingClass=array(data.classes).map(object).find(entry=>entry.isStartingClass===true);
  const startingDefinition=object(startingClass?.definition);
  const startingClassComponents=new Set<number>();
  for(const id of [finite(startingClass?.id),finite(startingDefinition.id)]){
    if(id!==undefined)startingClassComponents.add(id);
  }
  for(const raw of array(startingDefinition.classFeatures)){
    const id=finite(object(raw).id);if(id!==undefined)startingClassComponents.add(id);
  }
  for(const [group,rawGroup] of Object.entries(object(data.modifiers))){
    if(group==='condition')continue;
    for(const raw of array(rawGroup)){
      const entry=object(raw);
      const componentId=finite(entry.componentId);const componentKey=`${whole(entry.componentTypeId)}:${componentId??0}`;
      if(entry.isGranted===false&&!selectedComponents.has(componentKey))continue;
      if(group==='class'&&string(entry.type)==='proficiency'&&string(entry.subType).endsWith('-saving-throws')&&startingClassComponents.size&&
        (componentId===undefined||!startingClassComponents.has(componentId)))continue;
      if(group==='item'){
        if(componentId===undefined||!activeItems.has(componentId))continue;
      }
      result.push(entry);
    }
  }
  return result;
}

function modifierValue(entry:JsonObject):number{
  return finite(entry.fixedValue)??finite(entry.value)??0;
}

function unconditional(entry:JsonObject):boolean{
  return string(entry.restriction)==='';
}

function parseAbilities(data:JsonObject,modifiers:JsonObject[]):Character['abilities']{
  const stats=array(data.stats);const bonusStats=array(data.bonusStats);const overrides=array(data.overrideStats);
  const out={} as Character['abilities'];
  for(let i=0;i<ABILITIES.length;i++){
    const key=ABILITIES[i] as Ability;const longName=ABILITY_NAMES[i] as string;
    const base=whole(object(stats.find(raw=>whole(object(raw).id)===i+1)).value,10);
    const manual=whole(object(bonusStats.find(raw=>whole(object(raw).id)===i+1)).value,0);
    const override=finite(object(overrides.find(raw=>whole(object(raw).id)===i+1)).value);
    let score=override&&override>0?override:base+manual;
    if(!(override&&override>0)){
      for(const entry of modifiers){
        if(!unconditional(entry))continue;
        if(string(entry.type)==='bonus'&&string(entry.subType)===`${longName}-score`)score+=modifierValue(entry);
      }
    }
    const setValues=modifiers.filter(entry=>unconditional(entry)&&string(entry.type)==='set'&&string(entry.subType)===`${longName}-score`).map(modifierValue);
    if(setValues.length)score=Math.max(score,...setValues);
    out[key]=Math.max(1,Math.min(30,Math.trunc(score)));
  }
  return out;
}

function parseClasses(data:JsonObject):Character['classes']{
  return array(data.classes).map((raw,index)=>{
    const entry=object(raw);const definition=object(entry.definition);const subclass=object(entry.subclassDefinition);
    const name=string(definition.name);const level=whole(entry.level);
    if(!name||level<1)throw new Error(`D&D Beyond class ${index+1} is incomplete.`);
    return {name,level,subclass:string(subclass.name)||null};
  });
}

function parseRace(data:JsonObject):{species:string;size:string;speed:number}{
  const race=object(data.race);const species=string(race.fullName)||string(race.baseRaceName)||'Unknown';
  const sizeMap:Record<number,string>={2:'Tiny',3:'Small',4:'Medium',5:'Large',6:'Huge',7:'Gargantuan'};
  const size=sizeMap[whole(race.sizeId)]??'Medium';
  const normal=object(object(race.weightSpeeds).normal);
  const speed=whole(normal.walk,30);
  return {species,size,speed};
}

function parseProficiencies(abilities:Character['abilities'],level:number,modifiers:JsonObject[]):{
  proficiencies:Character['proficiencies'];skillBonuses:Record<string,number>;saveBonuses:Partial<Record<Ability,number>>;
}{
  const saves:Partial<Record<Ability,ProficiencyRank>>={};const skills:Record<string,ProficiencyRank>={};
  for(const entry of modifiers){
    const type=string(entry.type);const subType=string(entry.subType);
    const saveIndex=ABILITY_NAMES.findIndex(name=>subType===`${name}-saving-throws`);
    if(type==='proficiency'&&saveIndex>=0)saves[ABILITIES[saveIndex] as Ability]=1;
    const skill=SKILLS[subType];
    if(skill){
      const rank:ProficiencyRank=type==='expertise'?2:type==='proficiency'?1:0;
      if(rank>(skills[skill.name]??0))skills[skill.name]=rank;
    }
  }
  const pb=proficiencyBonus(level);const skillBonuses:Record<string,number>={};
  const allCheckBonus=modifiers.filter(entry=>unconditional(entry)&&string(entry.type)==='bonus'&&['ability-checks','skill-checks'].includes(string(entry.subType))).reduce((sum,entry)=>sum+modifierValue(entry),0);
  for(const [subType,skill] of Object.entries(SKILLS)){
    const specific=modifiers.filter(entry=>unconditional(entry)&&string(entry.type)==='bonus'&&string(entry.subType)===subType).reduce((sum,entry)=>sum+modifierValue(entry),0);
    skillBonuses[skill.name]=modifier(abilities[skill.ability])+pb*(skills[skill.name]??0)+allCheckBonus+specific;
  }
  const saveBonuses:Partial<Record<Ability,number>>={};
  const allSaveBonus=modifiers.filter(entry=>unconditional(entry)&&string(entry.type)==='bonus'&&string(entry.subType)==='saving-throws').reduce((sum,entry)=>sum+modifierValue(entry),0);
  for(let i=0;i<ABILITIES.length;i++){
    const key=ABILITIES[i] as Ability;const longName=ABILITY_NAMES[i] as string;
    const specific=modifiers.filter(entry=>unconditional(entry)&&string(entry.type)==='bonus'&&string(entry.subType)===`${longName}-saving-throws`).reduce((sum,entry)=>sum+modifierValue(entry),0);
    saveBonuses[key]=modifier(abilities[key])+pb*(saves[key]??0)+allSaveBonus+specific;
  }
  return {proficiencies:{saves,skills},skillBonuses,saveBonuses};
}

function parseHitPoints(data:JsonObject,abilities:Character['abilities'],level:number,modifiers:JsonObject[]):Character['hp']{
  const override=finite(data.overrideHitPoints);
  if(override&&override>0){const max=Math.max(1,Math.trunc(override));const removed=Math.max(0,whole(data.removedHitPoints));return {max,current:Math.max(0,max-removed)};}
  const base=whole(data.baseHitPoints)+whole(data.bonusHitPoints)+level*modifier(abilities.con);
  let bonuses=0;
  for(const entry of modifiers){
    if(!unconditional(entry)||string(entry.type)!=='bonus')continue;
    const subType=string(entry.subType);const value=modifierValue(entry);
    if(subType==='hit-points')bonuses+=value;
    if(['hit-points-per-level','hit-points-per-level-no-level-cap'].includes(subType))bonuses+=value*level;
  }
  const max=Math.max(1,Math.trunc(base+bonuses));const removed=Math.max(0,whole(data.removedHitPoints));
  return {max,current:Math.max(0,max-removed)};
}

function parseEquipmentAndAc(data:JsonObject,abilities:Character['abilities'],classes:Character['classes'],modifiers:JsonObject[]):{
  ac:number;equipment:Character['equipment'];review:boolean;
}{
  let armorCategory:Character['equipment']['armorCategory']='none';let shield=false;let bestArmor=10+modifier(abilities.dex);let review=false;
  for(const raw of array(data.inventory)){
    const item=object(raw);if(!Boolean(item.equipped))continue;
    const definition=object(item.definition);const type=string(definition.type).toLowerCase();const name=string(definition.name).toLowerCase();
    const armorType=whole(definition.armorTypeId);const armorClass=finite(definition.armorClass);
    if(armorType===4||type.includes('shield')||name.includes('shield')){shield=true;continue;}
    if(armorClass===undefined)continue;
    let candidate=armorClass;let category:Character['equipment']['armorCategory']='none';
    if(armorType===1||type.includes('light armor')){category='light';candidate+=modifier(abilities.dex);}
    else if(armorType===2||type.includes('medium armor')){category='medium';candidate+=Math.min(2,modifier(abilities.dex));}
    else if(armorType===3||type.includes('heavy armor'))category='heavy';
    else {review=true;continue;}
    if(candidate>bestArmor||armorCategory==='none'){bestArmor=candidate;armorCategory=category;}
  }
  if(armorCategory==='none'){
    if(classes.some(entry=>entry.name.toLowerCase()==='barbarian'))bestArmor=Math.max(bestArmor,10+modifier(abilities.dex)+modifier(abilities.con));
    if(classes.some(entry=>entry.name.toLowerCase()==='monk'))bestArmor=Math.max(bestArmor,10+modifier(abilities.dex)+modifier(abilities.wis));
  }
  const acBonus=modifiers.filter(entry=>unconditional(entry)&&string(entry.type)==='bonus'&&string(entry.subType)==='armor-class').reduce((sum,entry)=>sum+modifierValue(entry),0);
  let ac=bestArmor+(shield?2:0)+acBonus;
  const override=finite(data.overrideArmorClass);if(override&&override>0)ac=override;
  if(array(data.customDefenseAdjustments).length)review=true;
  return {ac:Math.max(1,Math.min(40,Math.trunc(ac))),equipment:{armorCategory,shield,transformBehavior:'merge'},review};
}

function parseSpeed(data:JsonObject,baseSpeed:number,modifiers:JsonObject[]):number{
  let speed=baseSpeed;
  for(const entry of modifiers){
    if(!unconditional(entry))continue;
    const type=string(entry.type);const subType=string(entry.subType);const value=modifierValue(entry);
    if(type==='bonus'&&subType==='speed-walking')speed+=value;
    if(type==='set'&&['speed-walking','innate-speed-walking'].includes(subType)&&value>0)speed=Math.max(speed,value);
  }
  return Math.max(0,Math.min(200,Math.trunc(speed)));
}

function casterLevel(classes:Character['classes']):number{
  let level=0;
  for(const entry of classes){
    const name=entry.name.toLowerCase();const subclass=(entry.subclass??'').toLowerCase();
    if(FULL_CASTERS.has(name))level+=entry.level;
    else if(name==='artificer')level+=Math.ceil(entry.level/2);
    else if(HALF_CASTERS.has(name))level+=Math.ceil(entry.level/2);
    else if((name==='fighter'&&subclass.includes('eldritch knight'))||(name==='rogue'&&subclass.includes('arcane trickster')))level+=Math.floor(entry.level/3);
  }
  return Math.max(0,Math.min(20,level));
}

function parseSpellSlots(data:JsonObject,classes:Character['classes']):Character['spellSlots']{
  const level=casterLevel(classes);const table=SLOT_TABLE[level]??[];const used=new Map<number,number>();
  for(const raw of array(data.spellSlots)){const slot=object(raw);used.set(whole(slot.level),Math.max(0,whole(slot.used)));}
  const result:Character['spellSlots']={};
  table.forEach((max,index)=>{const key=String(index+1);result[key]={max,current:Math.max(0,max-(used.get(index+1)??0))};});
  return result;
}

function spellAbility(raw:JsonObject,parent:JsonObject,classesById:Map<number,JsonObject>):{ability:Ability;sourceClass:string}{
  let id=whole(raw.spellCastingAbilityId)||whole(object(raw.definition).spellCastingAbilityId);
  const characterClassId=whole(parent.characterClassId);const classEntry=classesById.get(characterClassId);
  const classDefinition=object(classEntry?.definition);if(!id)id=whole(classDefinition.spellCastingAbilityId);
  return {ability:ABILITIES[id-1]??'wis',sourceClass:string(classDefinition.name)||'Imported'};
}

function spellAction(raw:JsonObject):ActionCost{
  const type=whole(object(raw.activation).activationType)||whole(object(raw.definition).activationType);
  if(type===3)return 'bonus';if(type===4)return 'reaction';return 'magic-action';
}

function diceExpression(entry:JsonObject):string|null{
  const die=object(entry.die);const expression=string(die.diceString).replace(/\s+/g,'');
  if(/^\d+d\d+(?:[+-]\d+)?$/i.test(expression))return expression;
  const fixed=finite(entry.fixedValue)??finite(entry.value);return fixed!==undefined&&fixed>=0?String(Math.trunc(fixed)):null;
}

function spellDamage(definition:JsonObject):DamagePacket[]{
  const packets:DamagePacket[]=[];
  for(const raw of array(definition.modifiers)){
    const entry=object(raw);if(string(entry.type)!=='damage')continue;
    const type=DAMAGE_TYPES[string(entry.subType).toLowerCase()];const expression=diceExpression(entry);
    if(type&&expression)packets.push({expression,type});
  }
  return packets.slice(0,8);
}

function spellHealing(definition:JsonObject,abilityModifier:number):string|undefined{
  for(const raw of array(definition.modifiers)){
    const entry=object(raw);if(string(entry.type)!=='bonus'||string(entry.subType)!=='hit-points')continue;
    const expression=diceExpression(entry);if(!expression)continue;
    const bonus=Boolean(entry.usePrimaryStat)?abilityModifier:0;
    return `${expression}${bonus>0?`+${bonus}`:bonus<0?bonus:''}`;
  }
  return undefined;
}

function hasConditionalDamage(definition:JsonObject):boolean{
  return array(definition.modifiers).map(object).some(entry=>string(entry.type)==='damage'&&string(entry.restriction)!=='');
}

function parseSpells(data:JsonObject,abilities:Character['abilities'],level:number):Spell[]{
  const classesById=new Map<number,JsonObject>();for(const raw of array(data.classes)){const entry=object(raw);classesById.set(whole(entry.id),entry);const definitionId=whole(object(entry.definition).id);if(definitionId)classesById.set(definitionId,entry);}
  const candidates:{spell:JsonObject;parent:JsonObject}[]=[];
  for(const [group,rawGroup] of Object.entries(object(data.spells)))for(const raw of array(rawGroup))candidates.push({spell:object(raw),parent:{group}});
  for(const rawParent of array(data.classSpells)){const parent=object(rawParent);for(const raw of array(parent.spells))candidates.push({spell:object(raw),parent});}
  const result:Spell[]=[];const seen=new Set<string>();const pb=proficiencyBonus(level);
  for(const {spell:raw,parent} of candidates){
    const definition=object(raw.definition);const name=string(definition.name);const spellLevel=whole(definition.level);
    const included=spellLevel===0||Boolean(raw.prepared)||Boolean(raw.alwaysPrepared)||Boolean(raw.countsAsKnownSpell);
    if(!name||!included)continue;
    const {ability,sourceClass}=spellAbility(raw,parent,classesById);const key=`${name.toLowerCase()}|${sourceClass.toLowerCase()}`;
    if(seen.has(key))continue;seen.add(key);
    const saveAbility=whole(definition.saveDcAbilityId);const attackType=finite(definition.attackType);
    const components=array(definition.components).map(value=>whole(value)===1?'V':whole(value)===2?'S':whole(value)===3?'M':'').filter(Boolean).join(', ');
    const damage=spellDamage(definition);const conditionalDamage=damage.length>0&&hasConditionalDamage(definition);const healing=spellHealing(definition,modifier(abilities[ability]));
    const entry:Spell={id:`ddb-spell-${whole(definition.id)||slug(name)}`,name,level:spellLevel,sourceClass,ability,prepared:true,castingTime:spellAction(raw),summary:'Imported from D&D Beyond; verify full spell text in your source.'};
    if(name.toLowerCase()==='barkskin')entry.activeEffect={id:'barkskin',duration:'1 hour',acMinimum:17,summary:'The target has Armor Class 17 if its AC would otherwise be lower.'};
    if(Boolean(definition.concentration))entry.concentration=true;
    if(components)entry.components=components;
    if(attackType!==undefined)entry.attackBonus=modifier(abilities[ability])+pb;
    if(saveAbility>0){entry.saveDc=8+modifier(abilities[ability])+pb;const save=ABILITIES[saveAbility-1];if(save)entry.saveAbility=save;}
    if(damage.length)entry.damage=damage;
    if(healing)entry.healing=healing;
    if(conditionalDamage){entry.resolution='manual';entry.summary='Conditional damage rider imported from D&D Beyond; resolve its trigger and damage type from your source.';}
    else if(damage.length&&attackType===undefined&&saveAbility===0)entry.resolution='automatic';
    else if(damage.length&&saveAbility>0)entry.resolution='save';
    result.push(entry);
  }
  return result.slice(0,200);
}

function signedDice(expression:string,bonus:number){
  return `${expression}${bonus>0?`+${bonus}`:bonus<0?bonus:''}`;
}

function cantripDice(level:number,size:number){
  const dice=level>=17?4:level>=11?3:level>=5?2:1;
  return `${dice}d${size}`;
}

function moonCircleSpell(name:string,abilities:Character['abilities'],level:number):Spell{
  const wisdom=modifier(abilities.wis);const attack=wisdom+proficiencyBonus(level);const save=8+attack;
  const common={id:`rules-circle-moon-${slug(name)}`,name,sourceClass:'Druid',ability:'wis' as const,prepared:true,specialAccess:'circle-of-the-moon' as const,castingTime:'magic-action' as const};
  if(name==='Starry Wisp')return {...common,level:0,components:'V, S',attackBonus:attack,damage:[{expression:cantripDice(level,8),type:'Radiant'}],summary:'Ranged spell attack. On a hit, the target sheds Dim Light and cannot benefit from Invisible until the end of your next turn.'};
  if(name==='Cure Wounds')return {...common,level:1,components:'V, S',healing:signedDice('2d8',wisdom),higherSlotHealing:'2d8',summary:'Touch one creature to restore Hit Points. Adds 2d8 for every slot level above 1.'};
  if(name==='Moonbeam')return {...common,level:2,components:'V, S, M',concentration:true,saveDc:save,saveAbility:'con',damage:[{expression:'2d10',type:'Radiant'}],higherSlotDamage:[{expression:'1d10',type:'Radiant'}],halfOnSave:true,resolution:'save',summary:'Concentration, up to 1 minute. A creature in the beam makes a Constitution save; half damage on success.'};
  if(name==='Conjure Animals')return {...common,level:3,components:'V, S',concentration:true,saveDc:save,saveAbility:'dex',damage:[{expression:'3d10',type:'Slashing'}],higherSlotDamage:[{expression:'1d10',type:'Slashing'}],halfOnSave:true,resolution:'save',summary:'Concentration, up to 10 minutes. Creatures in the spectral pack make Dexterity saves; half damage on success.'};
  if(name==='Fount of Moonlight')return {...common,level:4,components:'V, S',concentration:true,resolution:'manual',summary:'Concentration, up to 10 minutes. Your melee attacks gain Radiant damage and you have Resistance to Radiant damage; resolve the attack rider from your source.'};
  return {...common,level:5,components:'V, S',healing:signedDice('5d8',wisdom),higherSlotHealing:'1d8',summary:'Up to six creatures in range regain Hit Points. Adds 1d8 for every slot level above 5.'};
}

function restoreMoonCircleSpells(spells:Spell[],classes:Character['classes'],abilities:Character['abilities'],level:number){
  const druid=classes.find(entry=>entry.name.toLowerCase()==='druid');
  if(!druid||druid.level<3||(druid.subclass??'').toLowerCase()!=='circle of the moon')return {spells,added:0};
  const result=[...spells];let added=0;
  for(const [name,requiredLevel] of Object.entries(MOON_FORM_SPELL_LEVELS)){
    if(druid.level<requiredLevel)continue;
    const index=result.findIndex(spell=>spell.name.toLowerCase()===name.toLowerCase()&&['druid','imported'].includes(spell.sourceClass.toLowerCase()));
    if(index>=0){const existing=result[index];if(existing)result[index]={...existing,sourceClass:'Druid',ability:'wis',prepared:true,specialAccess:'circle-of-the-moon'};}
    else{result.push(moonCircleSpell(name,abilities,level));added++;}
  }
  return {spells:result.slice(0,200),added};
}

function parseFeats(data:JsonObject):string[]{
  return [...new Set(array(data.feats).map(raw=>string(object(object(raw).definition).name)).filter(Boolean))].slice(0,100);
}

function definitionRuleset(definition:JsonObject):CharacterRuleset{
  const text=[definition.rulesVersion,definition.ruleset,definition.source,definition.sourceName,definition.book].map(string).join(' ').toLowerCase();
  const sources=array(definition.sources).map(raw=>{const source=object(raw);return [source.name,source.sourceName,source.book,source.description].map(string).join(' ');}).join(' ').toLowerCase();
  if(definition.isLegacy===true||definition.is2014===true||/\b(2014|legacy)\b/.test(`${text} ${sources}`))return 'legacy';
  if(definition.is2024===true||definition.isLegacy===false||/\b(2024|revised)\b/.test(`${text} ${sources}`))return '2024';
  return 'unknown';
}
function rulesetAssessment(data:JsonObject):{ruleset:CharacterRuleset;evidence:string[];reviewRequired:boolean}{
  const definitions:JsonObject[]=[];
  const add=(raw:unknown)=>{const entry=object(raw),definition=object(entry.definition);if(Object.keys(definition).length)definitions.push(definition);const subclass=object(entry.subclassDefinition);if(Object.keys(subclass).length)definitions.push(subclass);};
  array(data.classes).forEach(add);array(data.feats).forEach(add);array(data.inventory).forEach(add);add({definition:data.race});
  for(const group of Object.values(object(data.spells)))array(group).forEach(add);
  for(const parent of array(data.classSpells))array(object(parent).spells).forEach(add);
  const states=definitions.map(definitionRuleset);const current=states.filter(value=>value==='2024').length,legacy=states.filter(value=>value==='legacy').length,unknown=states.filter(value=>value==='unknown').length;
  const ruleset:CharacterRuleset=legacy&&current?'mixed':legacy?'legacy':current?'2024':'unknown';
  return {
    ruleset,
    evidence:[`${current} current definitions`,`${legacy} legacy definitions`,`${unknown} definitions without a ruleset marker`],
    // A positive 2024 marker permits import, but unmarked nested definitions
    // remain an explicit manual-review boundary.
    reviewRequired:ruleset!=='2024'||unknown>0,
  };
}
function parseItems(data:JsonObject):CharacterItem[]{
  return array(data.inventory).slice(0,300).flatMap((raw,index)=>{
    const item=object(raw),definition=object(item.definition);const name=string(definition.name);if(!name)return [];
    const id=String(whole(definition.id)||whole(item.id)||slug(`${name}-${index}`));const requiresAttunement=whole(definition.canAttune)===1||Boolean(definition.requiresAttunement);const equipped=Boolean(item.equipped),attuned=Boolean(item.isAttuned);
    const sourceIds=[finite(definition.sourceId),...array(definition.sources).flatMap(source=>[finite(object(source).sourceId),finite(object(source).id)])].filter((value):value is number=>value!==undefined).map(String);
    const ruleset=definitionRuleset(definition);const included=equipped&&(!requiresAttunement||attuned);
    return [{id:`ddb-item-${id}`,name,type:string(definition.type)||'Item',equipped,attuned,requiresAttunement,ruleset,sourceIds:[...new Set(sourceIds)].slice(0,20),mechanics:included?'included-in-imported-totals':ruleset==='legacy'||ruleset==='mixed'?'review-required':'reference-only'} satisfies CharacterItem];
  });
}

function legalKnownForms(data:JsonObject,classes:Character['classes'],warnings:DdbImportWarning[]):{knownForms:string[];unmapped:string[]}{
  const druid=classes.find(entry=>entry.name.toLowerCase()==='druid');if(!druid||druid.level<2)return {knownForms:[],unmapped:[]};
  const moon=(druid.subclass??'').toLowerCase()==='circle of the moon'&&druid.level>=3;
  const maxCr=moon?Math.floor(druid.level/3):druid.level>=8?1:druid.level>=4?.5:.25;const fly=druid.level>=8;
  const limit=druid.level>=8?8:druid.level>=4?6:4;const byName=new Map(Object.values(CREATURES).map(form=>[form.name.toLowerCase(),form]));
  const result:string[]=[];const unmapped:string[]=[];const illegal:string[]=[];
  for(const raw of array(data.creatures)){
    const name=string(object(object(raw).definition).name);if(!name)continue;
    const form=byName.get(name.toLowerCase());if(!form){unmapped.push(name);continue;}
    if(form.type.toLowerCase()!=='beast'||form.cr>maxCr||Boolean(form.speeds.fly)&&!fly){illegal.push(name);continue;}
    if(!result.includes(form.id))result.push(form.id);
  }
  if(unmapped.length)warnings.push({code:'wild-shape-unmapped',severity:'warning',message:`${unmapped.length} D&D Beyond creature entr${unmapped.length===1?'y was':'ies were'} not available in Altered's verified form library: ${unmapped.slice(0,5).join(', ')}${unmapped.length>5?'…':''}.`});
  if(illegal.length)warnings.push({code:'wild-shape-illegal',severity:'warning',message:`Altered excluded creature entries that are not legal Wild Shape forms at this level: ${illegal.join(', ')}.`});
  if(result.length>limit)warnings.push({code:'wild-shape-limit',severity:'warning',message:`D&D Beyond listed ${result.length} form entries; Altered kept the first ${limit} permitted at this Druid level.`});
  return {knownForms:result.slice(0,limit),unmapped:[...new Set(unmapped)]};
}

function legalWildShapeLimit(character:Character){
  const druid=character.classes.find(entry=>entry.name.toLowerCase()==='druid');if(!druid||druid.level<2)return {limit:0,maxCr:0,fly:false};
  const moon=(druid.subclass??'').toLowerCase()==='circle of the moon'&&druid.level>=3;
  return {limit:druid.level>=8?8:druid.level>=4?6:4,maxCr:moon?Math.floor(druid.level/3):druid.level>=8?1:druid.level>=4?.5:.25,fly:druid.level>=8};
}

export function applyDdbSrdCreatures(report:DdbImportReport,creatures:Creature[]):DdbImportReport{
  if(creatures.length===0)return report;
  const requested=new Set(report.supportRequests.creatures.map(name=>name.toLowerCase()));const current={...report.character.customForms};
  const {limit,maxCr,fly}=legalWildShapeLimit(report.character);const added:string[]=[];
  for(const creature of creatures){
    if(!requested.has(creature.name.toLowerCase())||creature.type.toLowerCase()!=='beast'||creature.cr>maxCr||Boolean(creature.speeds.fly)&&!fly)continue;
    current[creature.id]=creature;if(report.character.knownForms.length+added.length<limit)added.push(creature.id);
  }
  if(added.length===0)return report;
  const resolvedNames=new Set(added.map(id=>current[id]?.name.toLowerCase()).filter((name):name is string=>Boolean(name)));
  const unresolved=report.supportRequests.creatures.filter(name=>!resolvedNames.has(name.toLowerCase()));
  const character=parseCharacter({...report.character,customForms:Object.values(current),knownForms:[...report.character.knownForms,...added],seenForms:[...new Set([...report.character.seenForms,...added])]});
  const warnings=report.warnings.filter(warning=>warning.code!=='wild-shape-not-provided'&&warning.code!=='wild-shape-unmapped');
  if(unresolved.length)warnings.push({code:'wild-shape-unmapped',severity:'warning',message:`${unresolved.length} selected creature entr${unresolved.length===1?'y is':'ies are'} still unavailable in the validated SRD form library: ${unresolved.slice(0,5).join(', ')}.`});
  warnings.push({code:'srd-form-enrichment',severity:'info',message:`Loaded ${added.length} selected form${added.length===1?'':'s'} from the live SRD 5.2.1 support catalog.`});
  const coverage=report.coverage.map(item=>item.label==='Wild Shape selections'?{...item,status:'verified' as const,detail:character.knownForms.map(id=>current[id]?.name??CREATURES[id]?.name??id).join(', ')}:item);
  return {...report,character,warnings,coverage,supportRequests:{creatures:unresolved}};
}

function parseResources(data:JsonObject,level:number):ResourcePool[]{
  const result:ResourcePool[]=[];const pb=proficiencyBonus(level);
  const groups=object(data.actions);
  for(const rawGroup of Object.values(groups)){
    for(const raw of array(rawGroup)){
      const action=object(raw);const limited=object(action.limitedUse);const name=string(action.name);
      if(!name||Object.keys(limited).length===0)continue;
      let max=Math.max(0,whole(limited.maxUses));if(Boolean(limited.useProficiencyBonus))max+=pb;
      if(max<=0||max>999)continue;
      const aliases:Record<string,{id:string;name:string}>={
        'wild shape':{id:'wild-shape',name:'Wild Shape'},
        rage:{id:'rage',name:'Rage'},
        'rage (enter)':{id:'rage',name:'Rage'},
        'large form':{id:'goliath-large-form',name:'Large Form'},
        'activate large form':{id:'goliath-large-form',name:'Large Form'},
        'wild resurgence: regain spell slot':{id:'wild-resurgence-slot',name:'Wild Resurgence Slot Exchange'},
      };
      const alias=aliases[name.toLowerCase()];const id=alias?.id??slug(name);const displayName=alias?.name??name;const reset=whole(limited.resetType);
      const recovery:ResourcePool['recovery']=id==='wild-shape'||id==='rage'?'short-one':reset===1?'short-all':reset===2?'long-all':'manual';
      const current=Math.max(0,max-Math.max(0,whole(limited.numberUsed)));
      const existing=result.find(entry=>entry.id===id);if(existing){existing.max=Math.max(existing.max,max);existing.current=Math.max(existing.current,current);}else result.push({id,name:displayName,current,max,recovery});
    }
  }
  return result;
}

function homebrewCount(data:JsonObject):number{
  let count=0;const consider=(raw:unknown)=>{const definition=object(object(raw).definition);if(Boolean(definition.isHomebrew))count++;};
  array(data.classes).forEach(consider);array(data.feats).forEach(consider);array(data.inventory).forEach(consider);
  for(const rawGroup of Object.values(object(data.spells)))array(rawGroup).forEach(consider);
  for(const parent of array(data.classSpells))array(object(parent).spells).forEach(consider);
  return count;
}

const BUILT_IN_FEAT_MECHANICS=new Set(['alert','tough','war caster','weapon mastery']);
function setupNeeds(data:JsonObject,classes:Character['classes'],feats:string[],items:CharacterItem[],spells:Spell[],homebrew:number):DdbSetupNeed[]{
  const needs:DdbSetupNeed[]=[];const add=(need:DdbSetupNeed)=>{if(!needs.some(entry=>entry.id===need.id))needs.push(need);};
  const knownSubclasses=new Set([...Object.keys(SUBCLASS_FEATURES),'Circle of the Moon'].map(name=>name.toLowerCase()));
  for(const rawClass of array(data.classes)){
    const entry=object(rawClass),subclass=object(entry.subclassDefinition),subclassName=string(subclass.name);if(!subclassName||knownSubclasses.has(subclassName.toLowerCase()))continue;
    const className=string(object(entry.definition).name)||classes.find(candidate=>candidate.subclass?.toLowerCase()===subclassName.toLowerCase())?.name||'Class';const classLevel=whole(entry.level);
    const featureNames=array(subclass.classFeatures).flatMap(raw=>{const feature=object(raw),name=string(feature.name);const required=whole(feature.requiredLevel??feature.level,1);return name&&required<=classLevel?[{name,required}]:[];});
    if(featureNames.length){for(const feature of featureNames)add({id:`subclass-${slug(subclassName)}-${slug(feature.name)}`,kind:'subclass',label:feature.name,detail:`${subclassName} ${className} feature${feature.required>1?` (level ${feature.required})`:''}; confirm only its playable mechanics from your authorized D&D Beyond source.`});}
    else add({id:`subclass-${slug(subclassName)}`,kind:'subclass',label:subclassName,detail:`This subclass is not included in Altered's shared SRD rules pack. Add its transformation-relevant features from your authorized D&D Beyond source.`});
  }
  for(const feat of feats)if(!BUILT_IN_FEAT_MECHANICS.has(feat.toLowerCase())&&!/ability score improvement/i.test(feat))add({id:`feat-${slug(feat)}`,kind:'feat',label:feat,detail:'Altered imported the feat choice, but its situation-specific mechanics need a private confirmation before they can affect play.'});
  for(const item of items)if(item.equipped&&item.requiresAttunement&&item.attuned)add({id:`item-${slug(item.id)}`,kind:'item',label:item.name,detail:'Numeric sheet totals are already imported. Add only special actions, conditions, or transformation interactions so bonuses are not counted twice.'});
  for(const spell of spells)if(spell.resolution==='manual')add({id:`spell-${slug(spell.id??spell.name)}`,kind:'spell',label:spell.name,detail:'The spell is available, but its conditional effect remains manual until you confirm a supported private mechanic.'});
  if(homebrew)add({id:'homebrew-content',kind:'homebrew',label:`Homebrew content (${homebrew})`,detail:'Homebrew is private user content. Confirm any mechanics that should remain available or change while transformed.'});
  return needs.slice(0,100);
}

export function ddbSetupPackId(sourceId:string,needId:string):string{return `ddb-${sourceId}-${slug(needId)}`.slice(0,120);}

export function importDdbCharacter(payload:unknown,expectedId?:string):DdbImportReport{
  if(!isObject(payload))throw new Error('D&D Beyond returned an invalid response.');
  if(payload.success===false)throw new Error(string(payload.message)||'D&D Beyond did not return this character.');
  const data=object(payload.data);if(Object.keys(data).length===0)throw new Error('D&D Beyond response did not include character data.');
  const sourceId=String(whole(data.id)||whole(payload.id));if(!/^\d{5,15}$/.test(sourceId))throw new Error('D&D Beyond response did not include a valid character ID.');
  if(expectedId&&sourceId!==expectedId)throw new Error(`D&D Beyond returned character ${sourceId}, but ${expectedId} was requested.`);
  const warnings:DdbImportWarning[]=[{code:'undocumented-adapter',severity:'info',message:'D&D Beyond does not publish a supported character-data API. Altered validates the response, but this adapter may need updates if their service changes.'}];
  const ruleset=rulesetAssessment(data);const blocked=ruleset.ruleset==='legacy'||ruleset.ruleset==='mixed';const blockReason=blocked?`Altered is configured for 2024 rules only, but D&D Beyond identified this character as ${ruleset.ruleset} rules. Update the character to 2024 rules before importing.`:undefined;
  if(blocked)warnings.push({code:'non-2024-ruleset',severity:'warning',message:blockReason!});
  else if(ruleset.reviewRequired)warnings.push({code:'ruleset-review',severity:'warning',message:'Some D&D Beyond definitions did not include a reliable 2024/legacy marker. The character has positive 2024 evidence, but verify the unmarked subclass, feats, spells, and items before confirming.'});
  const classes=parseClasses(data);const totalLevel=classes.reduce((sum,entry)=>sum+entry.level,0);
  if(totalLevel<1||totalLevel>20)throw new Error(`D&D Beyond reported an invalid total level (${totalLevel}).`);
  const modifiers=collectModifiers(data);const abilities=parseAbilities(data,modifiers);const race=parseRace(data);
  const proficiencies=parseProficiencies(abilities,totalLevel,modifiers);const hp=parseHitPoints(data,abilities,totalLevel,modifiers);
  const defense=parseEquipmentAndAc(data,abilities,classes,modifiers);const formSelection=legalKnownForms(data,classes,warnings);const knownForms=formSelection.knownForms;
  const druid=classes.find(entry=>entry.name.toLowerCase()==='druid');
  if(druid&&druid.level>=2&&knownForms.length===0)warnings.push({code:'wild-shape-not-provided',severity:'warning',message:'D&D Beyond did not provide recognizable Wild Shape selections. No forms were guessed; add or review known forms in Altered before transforming.'});
  const parsedSpells=parseSpells(data,abilities,totalLevel);const moonSpells=restoreMoonCircleSpells(parsedSpells,classes,abilities,totalLevel);const spells=moonSpells.spells;const feats=parseFeats(data);const resources=parseResources(data,totalLevel);const items=parseItems(data);
  if(moonSpells.added)warnings.push({code:'circle-moon-spells-restored',severity:'info',message:`D&D Beyond omitted ${moonSpells.added} always-prepared Circle of the Moon spell${moonSpells.added===1?'':'s'} from its character payload. Altered restored the current 2024 Circle spell list for this Druid level.`});
  const activeItems=array(data.inventory).filter(raw=>Boolean(object(raw).equipped));
  if(activeItems.length)warnings.push({code:'item-text-review',severity:'warning',message:'Numeric armor, saving-throw, ability, speed, and hit-point item modifiers were imported. Review special item text and attack-only bonuses; Altered does not copy proprietary descriptions.'});
  const homebrew=homebrewCount(data);if(homebrew)warnings.push({code:'homebrew-review',severity:'warning',message:`${homebrew} homebrew entr${homebrew===1?'y requires':'ies require'} manual rules review in Altered.`});
  if(defense.review)warnings.push({code:'defense-review',severity:'warning',message:'D&D Beyond included a custom or unrecognized defense adjustment. Review Armor Class before importing.'});
  const raw={
    schemaVersion:1,id:`ddb-${sourceId}`,name:string(data.name)||`D&D Beyond ${sourceId}`,species:race.species,creatureType:'Humanoid',size:race.size,totalLevel,classes,abilities,hp,
    ac:defense.ac,speed:parseSpeed(data,race.speed,modifiers),proficiencies:proficiencies.proficiencies,skillBonuses:proficiencies.skillBonuses,saveBonuses:proficiencies.saveBonuses,
    knownForms,seenForms:knownForms,spells,spellSlots:parseSpellSlots(data,classes),feats,features:[],resources,equipment:defense.equipment,items,provenance:{provider:'dndbeyond',sourceId,ruleset:ruleset.ruleset,rulesetEvidence:ruleset.evidence,reviewRequired:ruleset.reviewRequired},customForms:[],
  };
  const character=parseCharacter(raw);
  const privateSetup=setupNeeds(data,classes,feats,items,spells,homebrew);
  const coverage:DdbImportCoverage[]=[
    {label:'2024 ruleset',status:ruleset.ruleset==='2024'&&!ruleset.reviewRequired?'verified':'review',detail:`${ruleset.ruleset.toUpperCase()} · ${ruleset.evidence.join(' · ')}`},
    {label:'Identity and levels',status:'verified',detail:`${character.name} · ${character.classes.map(entry=>`${entry.name} ${entry.level}${entry.subclass?` (${entry.subclass})`:''}`).join(' / ')}`},
    {label:'Ability scores, HP, and speed',status:'verified',detail:`${ABILITIES.map(key=>`${key.toUpperCase()} ${character.abilities[key]}`).join(' · ')} · HP ${character.hp.current}/${character.hp.max} · ${character.speed} ft.`},
    {label:'Armor Class and equipment',status:defense.review?'review':'verified',detail:`AC ${character.ac} · ${character.equipment.armorCategory} armor · ${character.equipment.shield?'shield':'no shield'}`},
    {label:'Saving throws and skills',status:'verified',detail:`${Object.values(character.proficiencies.saves).filter(rank=>rank>0).length} save proficiencies · ${Object.values(character.proficiencies.skills).filter(rank=>rank>0).length} skill proficiencies`},
    {label:'Prepared and known spells',status:spells.length?'verified':'not-provided',detail:`${spells.length} spell${spells.length===1?'':'s'} available${moonSpells.added?` · ${moonSpells.added} Circle spell${moonSpells.added===1?'':'s'} restored`:''} · ${Object.keys(character.spellSlots).length} slot levels`},
    {label:'Wild Shape selections',status:druid&&druid.level>=2?(knownForms.length?'verified':'review'):'not-provided',detail:knownForms.length?knownForms.map(id=>CREATURES[id]?.name??id).join(', '):'No form names were provided or matched'},
    {label:'Items and homebrew',status:activeItems.length||homebrew?'review':'not-provided',detail:`${items.length} item record${items.length===1?'':'s'} · ${activeItems.length} equipped · ${homebrew} homebrew entr${homebrew===1?'y':'ies'}`},
  ];
  return {sourceId,character,blocked,...(blockReason?{blockReason}:{}),warnings,coverage,supportRequests:{creatures:formSelection.unmapped},setupNeeds:privateSetup};
}

export function ddbCoverageLabel(status:CoverageStatus):string{
  return status==='verified'?'Verified':status==='review'?'Review':'Not provided';
}
