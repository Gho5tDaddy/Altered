import type {Ability,ActionCost,Creature,CreatureAction,DamagePacket,DamageType} from './types.js';

export type SrdCatalogDomain=
  'rules'|'classes'|'species'|'backgrounds'|'feats'|'items'|'magicitems'|
  'weapons'|'armor'|'creatures'|'spells'|'weaponproperties';

export const SRD_CATALOG_VERSION='5.2.1';
export const SRD_CATALOG_DOCUMENT='srd-2024';
export const SRD_CATALOG_BASELINE:Readonly<Record<SrdCatalogDomain,number>>=Object.freeze({
  rules:56,classes:24,species:9,backgrounds:4,feats:17,items:203,magicitems:757,
  weapons:38,armor:13,creatures:331,spells:339,weaponproperties:17
});
export const SRD_CATALOG_DOMAINS=Object.freeze(Object.keys(SRD_CATALOG_BASELINE) as SrdCatalogDomain[]);

export interface SrdCatalogStatus {
  sourceVersion:string;
  sourceDocument:string;
  provider:string;
  checkedAt:string;
  healthy:boolean;
  recordCount:number;
  counts:Record<SrdCatalogDomain,number>;
}

export interface SrdCatalogPage {
  domain:SrdCatalogDomain;
  count:number;
  page:number;
  results:Record<string,unknown>[];
}

const isObject=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const object=(value:unknown):Record<string,unknown>=>isObject(value)?value:{};
const array=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const string=(value:unknown):string=>typeof value==='string'?value.trim():'';
const number=(value:unknown):number|undefined=>typeof value==='number'&&Number.isFinite(value)?value:undefined;
const whole=(value:unknown,fallback=0):number=>{
  const numeric=number(value);if(numeric!==undefined)return Math.trunc(numeric);
  if(typeof value==='string'&&/^-?\d+$/.test(value.trim()))return Number.parseInt(value,10);
  return fallback;
};
const slug=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100)||'creature';
const title=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
const abilityMod=(score:number)=>Math.floor((score-10)/2);
const proficiencyForCr=(cr:number)=>cr<=4?2:cr<=8?3:cr<=12?4:cr<=16?5:cr<=20?6:cr<=24?7:cr<=28?8:9;
const ABILITIES:Ability[]=['str','dex','con','int','wis','cha'];
const LONG_ABILITIES:Record<string,Ability>={strength:'str',dexterity:'dex',constitution:'con',intelligence:'int',wisdom:'wis',charisma:'cha'};
const DAMAGE_TYPES:DamageType[]=['Acid','Bludgeoning','Cold','Fire','Force','Lightning','Necrotic','Piercing','Poison','Psychic','Radiant','Slashing','Thunder'];
const DAMAGE_BY_NAME=new Map(DAMAGE_TYPES.map(type=>[type.toLowerCase(),type]));
const CONDITIONS=['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'] as const;
const VERIFIED_ABILITY_CORRECTIONS:Readonly<Record<string,Creature['abilities']>>=Object.freeze({
  // Open5e's parsed SRD 5.2.1 record currently exposes the Octopus's Constitution
  // and Charisma modifiers in the score fields. These values are locked to SRD 5.2.1 p. 358.
  Octopus:{str:4,dex:15,con:11,int:3,wis:10,cha:4}
});
const VERIFIED_SIZE_CORRECTIONS:Readonly<Record<string,string>>=Object.freeze({
  // The upstream parsed catalog currently reports Small; SRD 5.2.1 p. 346 says Tiny.
  Cat:'Tiny'
});
const VERIFIED_SKILL_CORRECTIONS:Readonly<Record<string,Record<string,number>>>=Object.freeze({
  // The upstream parsed catalog currently reports +6; SRD 5.2.1 p. 358 says +7.
  Panther:{Stealth:7}
});

export function parseSrdCatalogStatus(input:unknown):SrdCatalogStatus{
  if(!isObject(input))throw new Error('SRD catalog status must be an object.');
  const countsRaw=object(input.counts);const counts={} as Record<SrdCatalogDomain,number>;
  for(const domain of SRD_CATALOG_DOMAINS){
    const value=whole(countsRaw[domain],-1);if(value<0)throw new Error(`SRD catalog status is missing ${domain}.`);counts[domain]=value;
  }
  const checkedAt=string(input.checkedAt);if(!checkedAt||Number.isNaN(Date.parse(checkedAt)))throw new Error('SRD catalog status has an invalid check time.');
  const sourceVersion=string(input.sourceVersion);if(!sourceVersion)throw new Error('SRD catalog status has no source version.');
  const sourceDocument=string(input.sourceDocument);if(sourceDocument!==SRD_CATALOG_DOCUMENT)throw new Error('SRD catalog status returned an unexpected source document.');
  const recordCount=Object.values(counts).reduce((sum,value)=>sum+value,0);
  const healthy=sourceVersion===SRD_CATALOG_VERSION&&SRD_CATALOG_DOMAINS.every(domain=>counts[domain]>=SRD_CATALOG_BASELINE[domain]);
  return {sourceVersion,sourceDocument,provider:string(input.provider)||'Open5e',checkedAt,healthy,recordCount,counts};
}

export function parseSrdCatalogPage(input:unknown,expectedDomain:SrdCatalogDomain):SrdCatalogPage{
  if(!isObject(input)||input.domain!==expectedDomain||!Array.isArray(input.results))throw new Error('SRD catalog returned an invalid result page.');
  const results=input.results.slice(0,25).map((value,index)=>{
    if(!isObject(value))throw new Error(`SRD catalog result ${index+1} is invalid.`);
    const document=object(value.document);const key=string(document.key);
    if(key&&key!==SRD_CATALOG_DOCUMENT)throw new Error(`SRD catalog result ${index+1} came from an unexpected document.`);
    return value;
  });
  return {domain:expectedDomain,count:Math.max(0,whole(input.count)),page:Math.max(1,whole(input.page,1)),results};
}

function damageType(value:unknown):DamageType|undefined{
  const raw=typeof value==='string'?value:string(object(value).name)||string(object(value).key);
  return DAMAGE_BY_NAME.get(raw.toLowerCase());
}

function damageTypes(value:unknown):DamageType[]{
  return [...new Set(array(value).map(damageType).filter((entry):entry is DamageType=>Boolean(entry)))];
}

function actionCost(value:unknown):ActionCost{
  const raw=string(value).toLowerCase();
  if(raw.includes('bonus'))return 'bonus';if(raw.includes('reaction'))return 'reaction';if(raw.includes('free'))return 'free';
  return 'action';
}

function diceExpression(count:unknown,die:unknown,bonus:unknown):string|undefined{
  const dieCount=whole(count);const dieName=string(die).toLowerCase().replace(/^d/,'');const fixed=whole(bonus);
  if(dieCount<1||!/^([2-9]|1\d|20|100)$/.test(dieName))return undefined;
  return `${dieCount}d${dieName}${fixed>0?`+${fixed}`:fixed<0?fixed:''}`;
}

function damageFromDescription(description:string):DamagePacket[]{
  const packets:DamagePacket[]=[];
  const pattern=/(\d{1,3}d\d{1,4}(?:\s*[+-]\s*\d{1,5})?|\d{1,5})\)?\s+([A-Za-z]+)\s+damage/gi;
  for(const match of description.matchAll(pattern)){
    const type=DAMAGE_BY_NAME.get((match[2]??'').toLowerCase());const expression=(match[1]??'').replace(/\s+/g,'');
    if(type&&expression&&!packets.some(packet=>packet.expression===expression&&packet.type===type))packets.push({expression,type});
  }
  return packets.slice(0,8);
}

function conditionEffects(description:string){
  const effects=[] as {condition:string;escapeDc?:number;targetSizeMax?:string;note?:string}[];
  for(const condition of CONDITIONS){
    const pattern=new RegExp(`(?:has|gains?|becomes?)\\s+(?:the\\s+)?${condition}\\s+condition|knocked\\s+${condition}`,'i');
    if(!pattern.test(description))continue;
    const escape=description.match(/escape\s+DC\s*(\d{1,2})/i);const targetSize=description.match(/\b(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+or\s+smaller\b/i);
    effects.push({condition,...(escape?{escapeDc:whole(escape[1])}:{}),...(targetSize?{targetSizeMax:title(targetSize[1]??'')}:{}),note:'Apply the condition as described in the SRD action.'});
  }
  return effects;
}

function actionLimits(raw:Record<string,unknown>){
  const usage=object(raw.usage_limits);const type=string(usage.type).toUpperCase();const parameter=whole(usage.param);
  return {
    ...((type==='RECHARGE'||type==='RECHARGE_ON_ROLL')&&parameter>=1&&parameter<=6?{recharge:{min:parameter,max:6}}:{}),
    ...(type==='PER_DAY'&&parameter>=1&&parameter<=100?{uses:{max:parameter,recovery:'long' as const}}:{})
  };
}

function attackAbility(attackBonus:number,abilities:Creature['abilities'],cr:number,description:string):Ability{
  const pb=proficiencyForCr(cr);const strengthMatches=abilityMod(abilities.str)+pb===attackBonus;const dexterityMatches=abilityMod(abilities.dex)+pb===attackBonus;
  if(dexterityMatches&&!strengthMatches)return 'dex';if(strengthMatches&&!dexterityMatches)return 'str';
  return /\branged\b/i.test(description)?'dex':'str';
}

function attackAction(raw:Record<string,unknown>,abilities:Creature['abilities'],cr:number):CreatureAction|undefined{
  const attacks=array(raw.attacks).map(object);const attack=attacks[0];if(!attack)return undefined;
  const name=string(raw.name)||string(attack.name)||'Attack';const description=string(raw.desc);const attackBonus=whole(attack.to_hit_mod);
  const primaryType=damageType(attack.damage_type)??damageType(attack.extra_damage_type)??damageFromDescription(description)[0]?.type;
  const expression=diceExpression(attack.damage_die_count,attack.damage_die_type,attack.damage_bonus);
  const damage:DamagePacket[]=[];
  if(primaryType&&expression)damage.push({expression,type:primaryType});
  const extraType=damageType(attack.extra_damage_type);const extraExpression=diceExpression(attack.extra_damage_die_count,attack.extra_damage_die_type,attack.extra_damage_bonus);
  if(extraType&&extraExpression&&!damage.some(packet=>packet.expression===extraExpression&&packet.type===extraType))damage.push({expression:extraExpression,type:extraType});
  for(const packet of damageFromDescription(description))if(!damage.some(existing=>existing.expression===packet.expression&&existing.type===packet.type))damage.push(packet);
  const longRange=number(attack.long_range);const shortRange=number(attack.range);
  const effects=conditionEffects(description);
  return {
    id:slug(name),name,type:'attack',cost:actionCost(raw.action_type),attackBonus,
    ability:attackAbility(attackBonus,abilities,cr,description),kind:'beast',
    ...(number(attack.reach)!==undefined?{reach:Math.max(0,whole(attack.reach))}:{}),
    ...(shortRange!==undefined?{range:`${Math.max(0,whole(shortRange))}${longRange!==undefined?`/${Math.max(0,whole(longRange))}`:''} ft.`}:{}),
    damage,...(effects.length?{effects}:{}),...actionLimits(raw),notes:description.slice(0,500)
  };
}

function saveAction(raw:Record<string,unknown>):CreatureAction|undefined{
  const description=string(raw.desc);const forward=description.match(/DC\s*(\d{1,2})\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/i);
  const reverse=description.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)[^\n.]{0,30}DC\s*(\d{1,2})/i);
  const dc=whole(forward?.[1]??reverse?.[2]);const abilityName=(forward?.[2]??reverse?.[1]??'').toLowerCase();
  const saveAbility=LONG_ABILITIES[abilityName];if(!dc||!saveAbility)return undefined;
  const name=string(raw.name)||'Save';const damage=damageFromDescription(description);
  const effects=conditionEffects(description);
  const halfOnSuccess=/half\s+(?:as\s+much\s+)?damage|half\s+the\s+damage/i.test(description);
  return {id:slug(name),name,type:'save',cost:actionCost(raw.action_type),saveAbility,dc,...(damage.length?{damageOnFail:damage}:{}),...(halfOnSuccess?{halfOnSuccess:true}:{}),...(effects.length?{effectsOnFail:effects}:{}),...actionLimits(raw),notes:description.slice(0,500)};
}

function multiattackAction(raw:Record<string,unknown>,actions:Exclude<CreatureAction,{type:'multiattack'}>[]):CreatureAction|undefined{
  const description=string(raw.desc);const replacementClause=description.match(/\b(?:it|the \w+)\s+can\s+replace\s+one\s+attack\s+with\s+(?:a\s+use\s+of\s+)?[^.]+/i)?.[0]??'';
  const baseDescription=replacementClause?description.replace(replacementClause,''):description;const sequence:string[]=[];
  const counts:Record<string,number>={one:1,two:2,three:3,four:4,five:5,six:6};
  for(const action of actions){
    const escaped=action.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const match=baseDescription.match(new RegExp(`\\b(one|two|three|four|five|six|\\d+)\\s+(?:\\w+\\s+)?${escaped}\\b`,'i'));
    const count=match?counts[(match[1]??'').toLowerCase()]??whole(match[1],1):baseDescription.toLowerCase().includes(action.name.toLowerCase())?1:0;
    for(let index=0;index<count&&sequence.length<20;index++)sequence.push(action.id);
  }
  if(sequence.length===0)return undefined;
  const replacement=actions.find(action=>replacementClause.toLowerCase().includes(action.name.toLowerCase()));
  const baseName=actions.find(action=>action.id===sequence[0])?.name??sequence[0];
  const variants=replacement&&sequence.length>0&&!sequence.includes(replacement.id)?[
    {id:`replace-with-${replacement.id}`,label:`${baseName} → ${replacement.name}`,sequence:[...sequence.slice(0,-1),replacement.id]},
    {id:`${replacement.id}-first`,label:`${replacement.name} → ${baseName}`,sequence:[replacement.id,...sequence.slice(0,-1)]},
  ]:undefined;
  return {id:slug(string(raw.name)||'Multiattack'),name:string(raw.name)||'Multiattack',type:'multiattack',cost:'action',sequence,...(variants?{variants}:{}),notes:description.slice(0,500)};
}

function creatureActions(value:unknown,abilities:Creature['abilities'],cr:number):CreatureAction[]{
  const rawActions=array(value).map(object).slice(0,100);const result:CreatureAction[]=[];
  for(const raw of rawActions){
    const name=string(raw.name)||'Action';
    if(name.toLowerCase()==='multiattack')continue;
    if(array(raw.attacks).length){const attack=attackAction(raw,abilities,cr);if(attack)result.push(attack);continue;}
    const save=saveAction(raw);if(save){result.push(save);continue;}
    const description=string(raw.desc);const effects=conditionEffects(description);
    const damage=damageFromDescription(description);
    result.push({id:slug(name),name,type:'automatic',cost:actionCost(raw.action_type),...(damage.length?{damage}:{}),...(effects.length?{effects}:{}),...actionLimits(raw),notes:description.slice(0,500)});
  }
  for(const raw of rawActions.filter(raw=>string(raw.name).toLowerCase()==='multiattack')){const multi=multiattackAction(raw,result.filter((action):action is Exclude<CreatureAction,{type:'multiattack'}>=>action.type!=='multiattack'));if(multi)result.unshift(multi);}
  const seen=new Set<string>();return result.filter(action=>{if(seen.has(action.id))return false;seen.add(action.id);return true;});
}

export function normalizeSrdCreature(input:unknown):Creature{
  if(!isObject(input))throw new Error('SRD creature must be an object.');
  const document=object(input.document);if(string(document.key)!==SRD_CATALOG_DOCUMENT)throw new Error('Creature is not from the SRD 2024 catalog.');
  const name=string(input.name);if(!name)throw new Error('SRD creature has no name.');
  const scores=object(input.ability_scores);let abilities:Creature['abilities']={
    str:whole(scores.strength),dex:whole(scores.dexterity),con:whole(scores.constitution),
    int:whole(scores.intelligence),wis:whole(scores.wisdom),cha:whole(scores.charisma)
  };
  const correction=VERIFIED_ABILITY_CORRECTIONS[name];if(correction)abilities={...correction};
  if(ABILITIES.some(ability=>abilities[ability]<1||abilities[ability]>30))throw new Error(`${name} has invalid ability scores.`);
  const cr=number(input.challenge_rating);const size=VERIFIED_SIZE_CORRECTIONS[name]??string(object(input.size).name);const type=string(object(input.type).name);
  const ac=whole(input.armor_class),hp=whole(input.hit_points);if(cr===undefined||cr<0||cr>30||!size||!type||ac<1||ac>40||hp<1||hp>9999)throw new Error(`${name} has invalid core statistics.`);
  const savesRaw=object(input.saving_throws_all);const saves:Partial<Record<Ability,number>>={};
  for(const [longName,ability] of Object.entries(LONG_ABILITIES)){const value=number(savesRaw[longName]);saves[ability]=value!==undefined&&value>=-20&&value<=20?value:abilityMod(abilities[ability]);}
  const skills:Record<string,number>={};for(const [key,value] of Object.entries(object(input.skill_bonuses))){const parsed=number(value);if(parsed!==undefined)skills[title(key)]=parsed;}Object.assign(skills,VERIFIED_SKILL_CORRECTIONS[name]??{});
  const speedRaw=object(input.speed);const speeds:Creature['speeds']={};for(const key of ['walk','climb','swim','fly','burrow'] as const){const value=number(speedRaw[key]);if(value!==undefined&&value>=0&&value<=500)speeds[key]=value;}
  const senses:string[]=[];for(const [label,key] of [['Darkvision','darkvision_range'],['Blindsight','blindsight_range'],['Tremorsense','tremorsense_range'],['Truesight','truesight_range']] as const){const value=number(input[key]);if(value)senses.push(`${label} ${whole(value)} ft.`);}const passive=whole(input.passive_perception);if(passive)senses.push(`Passive Perception ${passive}`);
  const defenses=object(input.resistances_and_immunities);
  const traits=array(input.traits).map(object).filter(raw=>string(raw.name)).slice(0,50).map(raw=>({name:string(raw.name).slice(0,120),summary:(string(raw.desc)||'See the SRD entry for this trait.').slice(0,500)}));
  const actions=creatureActions(input.actions,abilities,cr);
  return {
    id:`srd-${slug(name)}`,name,type,cr,size,ac,hp,hitDice:(string(input.hit_dice)||'1d8').replace(/\s+/g,''),
    abilities,saves,skills,speeds,senses,
    resistances:damageTypes(defenses.damage_resistances),immunities:damageTypes(defenses.damage_immunities),vulnerabilities:damageTypes(defenses.damage_vulnerabilities),
    conditionImmunities:array(defenses.condition_immunities).map(value=>typeof value==='string'?value:string(object(value).name)).filter(Boolean).slice(0,50),
    traits,actions,artKey:'base',
    source:{ruleset:'SRD 5.2.1 (CC BY 4.0)',page:`SRD creature: ${name}`,verified:'Live catalog validation'}
  };
}
