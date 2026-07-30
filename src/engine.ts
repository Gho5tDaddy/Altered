import type {
  Ability,AcCandidate,ActionCost,Character,CreatureAction,DamagePacket,DamageType,
  DerivedRoll,EvaluatedFeature,GameState,ImportedFeatureRule,ResolvedSheet,ResourcePool,RetentionPolicy,
  Spell,TransformProfile,TransformationEffects,TransformationOption,TransitionResult
} from './types.js';
import {
  CLASS_FEATURES,CREATURES,MOON_FORM_SPELL_LEVELS,RULES_VERSION,SKILL_ABILITIES,TRANSFORMATION_PROFILES,
  SPECIES_FEATURES,classLevel,subclass
} from './content-registry.js';

const ABILITIES:Ability[]=['str','dex','con','int','wis','cha'];
const ALL_DAMAGE_TYPES:DamageType[]=['Acid','Bludgeoning','Cold','Fire','Force','Lightning','Necrotic','Piercing','Poison','Psychic','Radiant','Slashing','Thunder'];
export const abilityMod=(score:number)=>Math.floor((score-10)/2);
export const proficiencyBonus=(level:number)=>2+Math.floor((Math.max(1,level)-1)/4);
const unique=<T>(items:T[])=>[...new Set(items)];
const normalized=(value:string|undefined|null)=>value?.trim().toLowerCase()??'';
const sameText=(a:string|undefined|null,b:string)=>normalized(a)===normalized(b);
const recordValue=<T>(record:Record<string,T>,name:string):T|undefined=>record[Object.keys(record).find(key=>sameText(key,name))??''];
const resource=(state:GameState,id:string)=>state.resources[id];
const cloneResource=(r:ResourcePool):ResourcePool=>({...r});
const hasCondition=(state:GameState,...conditions:string[])=>conditions.some(condition=>state.conditions.includes(condition));
const isIncapacitated=(state:GameState)=>hasCondition(state,'Incapacitated','Unconscious','Paralyzed','Petrified','Stunned');
const hasZeroSpeedCondition=(state:GameState)=>hasCondition(state,'Grappled','Restrained','Paralyzed','Petrified','Stunned','Unconscious');
const autoFailsPhysicalSaves=(state:GameState)=>hasCondition(state,'Unconscious','Paralyzed','Petrified','Stunned');
export function boundedWhole(value:unknown,fallback:number,min=0,max=Number.MAX_SAFE_INTEGER){
  if(typeof value!=='number'||!Number.isFinite(value))return fallback;
  return Math.max(min,Math.min(max,Math.floor(value)));
}

export function wildShapeLimits(character:Character){
  const level=classLevel(character,'Druid');
  const base=level>=8?{known:8,maxCr:1,fly:true}:level>=4?{known:6,maxCr:.5,fly:false}:level>=2?{known:4,maxCr:.25,fly:false}:{known:0,maxCr:0,fly:false};
  const moon=sameText(subclass(character,'Druid'),'Circle of the Moon')&&level>=3;
  return {...base,maxCr:moon?Math.floor(level/3):base.maxCr,moon};
}
export function wildShapeUses(level:number){return level>=17?4:level>=6?3:level>=2?2:0}
export function rageDamage(level:number){return level>=16?4:level>=9?3:2}
export function monkDie(level:number){return level>=17?'1d12':level>=11?'1d10':level>=5?'1d8':'1d6'}
export function monkMovement(level:number){return level>=18?30:level>=14?25:level>=10?20:level>=6?15:level>=2?10:0}

function preparedSpell(character:Character,name:string){const key=name.toLowerCase();return character.spells.some(s=>s.name.toLowerCase()===key&&s.prepared!==false)}
function spellOnSheet(character:Character,name:string){const key=name.toLowerCase();return character.spells.find(s=>s.name.toLowerCase()===key&&s.prepared!==false)}
export function availableSpellSlotLevels(character:Character,state:GameState|undefined,minimumLevel:number){
  if(minimumLevel<=0)return [];
  return Object.entries(state?.spellSlots??character.spellSlots)
    .filter(([level,slot])=>Number(level)>=minimumLevel&&slot.current>0)
    .map(([level])=>Number(level))
    .sort((a,b)=>a-b);
}
function slotAvailable(state:GameState|undefined,character:Character,level:number){return level===0||availableSpellSlotLevels(character,state,level).length>0}
function nextSpellSlot(character:Character,state:GameState,minimumLevel:number,requestedLevel?:number){
  const levels=availableSpellSlotLevels(character,state,minimumLevel);
  return requestedLevel===undefined?levels[0]:levels.includes(requestedLevel)?requestedLevel:undefined;
}
function creature(character:Character,id?:string){return id?(character.customForms[id]??CREATURES[id]):undefined}
function allForms(character:Character){return [...Object.values(CREATURES),...Object.values(character.customForms)]}
function activeProfile(state?:GameState):TransformProfile{return state?.activeTransform?.option.profile??'base'}
function activeOption(state?:GameState):TransformationOption{return state?.activeTransform?.option??{id:'base',label:'Base Form',profile:'base',source:'Character sheet',actionCost:'none',usable:true}}
function activeConditionImmunities(character:Character,state:GameState,option=activeOption(state)){
  const values=[...(creature(character,option.formId)?.conditionImmunities??[]),...(option.effects?.conditionImmunities??[])];
  for(const overlay of activeOverlayOptions(character,state))values.push(...(overlay.effects?.conditionImmunities??[]));
  return new Set(values.map(value=>normalized(value)));
}
function effectivelyIncapacitated(character:Character,state:GameState,immunities=activeConditionImmunities(character,state)){
  return ['Incapacitated','Unconscious','Paralyzed','Petrified','Stunned'].some(condition=>state.conditions.includes(condition)&&!immunities.has(normalized(condition)));
}
function policyFor(option:TransformationOption):RetentionPolicy{
  const base=TRANSFORMATION_PROFILES[option.profile]?.retains??TRANSFORMATION_PROFILES.custom!.retains;
  return {...base,...(option.retention??{})};
}
function retainedProficiencies(option:TransformationOption){return policyFor(option).proficiencies}
function retainedClassFeatures(option:TransformationOption){return policyFor(option).classFeatures}
function canNormallyCast(character:Character,state:GameState|undefined){
  if(state?.rage.active||state&&effectivelyIncapacitated(character,state))return false;
  const option=activeOption(state);const policy=policyFor(option);
  let allowed=option.profile==='wildshape'&&classLevel(character,'Druid')>=18?true:policy.spellcasting;
  if(state){
    for(const overlay of activeOverlayOptions(character,state))if(overlay.effects?.canCast!==undefined)allowed=overlay.effects.canCast;
  }
  return allowed;
}
function grantFor(character:Character,id:string){return character.transformationGrants?.find(g=>g.id===id)}
const SIZES=['Tiny','Small','Medium','Large','Huge','Gargantuan'];
function shiftedSize(size:string,amount:number){const index=Math.max(0,SIZES.indexOf(size));return SIZES[Math.max(0,Math.min(SIZES.length-1,index+amount))]??'Medium'}
function replacementSize(character:Character,state?:GameState,excludeSwitchGroup?:string){
  let size=creature(character,state?.activeTransform?.option.formId)?.size??character.size;
  for(const id of state?.overlays??[]){
    if(id.startsWith('spell:enlarge-reduce:')){if(excludeSwitchGroup==='enlarge-reduce')continue;size=shiftedSize(size,id.endsWith(':enlarge')?1:-1);continue;}
    const grant=grantFor(character,id);if(grant?.switchGroup&&grant.switchGroup===excludeSwitchGroup)continue;if(grant?.effects?.size)size=grant.effects.size;
  }
  return size;
}
function replacementWalkSpeed(character:Character,state?:GameState){
  const option=activeOption(state);const form=creature(character,option.formId);let walk=form&&option.profile!=='overlay'?(form.speeds.walk??0):character.speed;
  if(state&&retainedClassFeatures(option)){const barb=classLevel(character,'Barbarian');if(barb>=5&&!(armorActive(state,option)&&state.equipment.armorCategory==='heavy'))walk+=10;const monk=classLevel(character,'Monk');if(monk>=2&&!armorActive(state,option)&&!shieldActive(state,option))walk+=monkMovement(monk);for(const feature of character.features)if(retentionAllows(feature,option))walk+=feature.grants?.speedBonus??0;}
  for(const id of state?.overlays??[]){if(id.startsWith('spell:alter-self:'))continue;const grant=grantFor(character,id);if(grant?.effects?.speedSet?.walk!==undefined)walk=grant.effects.speedSet.walk;if(grant?.effects?.speedBonus?.walk!==undefined)walk+=grant.effects.speedBonus.walk;}
  return Math.max(0,walk);
}
function naturalWeaponEffect(character:Character,type:DamageType):TransformationEffects{
  const spell=spellOnSheet(character,'Alter Self');const castingAbility=spell?.ability??'int';const modifier=abilityMod(character.abilities[castingAbility]);
  return {actions:[{id:`alter-self-natural-weapon-${type.toLowerCase()}`,name:`Alter Self Natural Weapon — ${type}`,type:'attack',cost:'action',attackBonus:proficiencyBonus(character.totalLevel)+modifier,ability:castingAbility,kind:'unarmed',reach:5,damage:[{expression:`1d6${modifier>=0?'+':''}${modifier}`,type}],notes:'Uses the spellcasting ability from the imported Alter Self spell for attack and damage rolls.'}]};
}
function builtInOverlayOption(character:Character,state:GameState|undefined,id:string):TransformationOption|undefined{
  const currentSize=replacementSize(character,state,id.startsWith('spell:enlarge-reduce:')?'enlarge-reduce':undefined);
  if(id==='spell:alter-self:aquatic')return {id,grantId:id,label:'Alter Self — Aquatic Adaptation',profile:'overlay',source:'Alter Self',actionCost:'magic-action',endActionCost:'none',duration:'Concentration, up to 1 hour',concentration:true,spellName:'Alter Self',spellLevel:2,switchGroup:'alter-self',effects:{speedSet:{swim:replacementWalkSpeed(character,state)},senses:['Can breathe underwater']},usable:true};
  if(id==='spell:alter-self:appearance')return {id,grantId:id,label:'Alter Self — Change Appearance',profile:'overlay',source:'Alter Self',actionCost:'magic-action',endActionCost:'none',duration:'Concentration, up to 1 hour',concentration:true,spellName:'Alter Self',spellLevel:2,switchGroup:'alter-self',effects:{},usable:true};
  if(id==='spell:alter-self:weapons-slashing')return {id,grantId:id,label:'Alter Self — Natural Weapons (Slashing)',profile:'overlay',source:'Alter Self',actionCost:'magic-action',endActionCost:'none',duration:'Concentration, up to 1 hour',concentration:true,spellName:'Alter Self',spellLevel:2,switchGroup:'alter-self',effects:naturalWeaponEffect(character,'Slashing'),usable:true};
  if(id==='spell:alter-self:weapons-piercing')return {id,grantId:id,label:'Alter Self — Natural Weapons (Piercing)',profile:'overlay',source:'Alter Self',actionCost:'magic-action',endActionCost:'none',duration:'Concentration, up to 1 hour',concentration:true,spellName:'Alter Self',spellLevel:2,switchGroup:'alter-self',effects:naturalWeaponEffect(character,'Piercing'),usable:true};
  if(id==='spell:alter-self:weapons-bludgeoning')return {id,grantId:id,label:'Alter Self — Natural Weapons (Bludgeoning)',profile:'overlay',source:'Alter Self',actionCost:'magic-action',endActionCost:'none',duration:'Concentration, up to 1 hour',concentration:true,spellName:'Alter Self',spellLevel:2,switchGroup:'alter-self',effects:naturalWeaponEffect(character,'Bludgeoning'),usable:true};
  if(id==='spell:enlarge-reduce:enlarge')return {id,grantId:id,label:'Enlarge',profile:'overlay',source:'Enlarge/Reduce',actionCost:'magic-action',endActionCost:'none',duration:'Concentration, up to 1 minute',concentration:true,spellName:'Enlarge/Reduce',spellLevel:2,effects:{size:shiftedSize(currentSize,1),checkAdvantage:['str'],saveAdvantage:['str'],attackDamageModifier:{expression:'1d4',mode:'add',appliesTo:['weapon','unarmed']}},usable:true};
  if(id==='spell:enlarge-reduce:reduce')return {id,grantId:id,label:'Reduce',profile:'overlay',source:'Enlarge/Reduce',actionCost:'magic-action',endActionCost:'none',duration:'Concentration, up to 1 minute',concentration:true,spellName:'Enlarge/Reduce',spellLevel:2,effects:{size:shiftedSize(currentSize,-1),checkDisadvantage:['str'],saveDisadvantage:['str'],attackDamageModifier:{expression:'1d4',mode:'subtract',appliesTo:['weapon','unarmed'],minimumDamage:1}},usable:true};
  if(id==='spell:gaseous-form')return {id,grantId:id,label:'Gaseous Form',profile:'overlay',source:'Gaseous Form',actionCost:'magic-action',endActionCost:'magic-action',duration:'Concentration, up to 1 hour',concentration:true,spellName:'Gaseous Form',spellLevel:3,effects:{speedSet:{walk:0,climb:0,swim:0,fly:10,burrow:0},resistances:['Bludgeoning','Piercing','Slashing'],saveAdvantage:['str','dex','con'],conditionImmunities:['Prone'],canSpeak:false,canCast:false,canAttack:false,canManipulateObjects:false,endsAtZeroHp:true,senses:["Can hover, occupy another creature's space, pass through narrow openings, and treats liquids as solid surfaces."],actions:[{id:'gaseous-form-dash',name:'Dash in Gaseous Form',type:'automatic',cost:'action',notes:'Dash is the only ordinary action available in this form; ending the spell on yourself takes a Magic action.'}]},usable:true};
  return undefined;
}
function overlayOption(character:Character,state:GameState|undefined,id:string):TransformationOption|undefined{
  const grant=grantFor(character,id);if(grant)return {id:`grant:${grant.id}`,grantId:grant.id,label:grant.label,profile:'overlay',source:grant.source,actionCost:grant.actionCost,usable:true,duration:grant.duration,endActionCost:grant.endActionCost,resourceId:grant.resourceId,resourceCost:grant.resourceCost,concentration:grant.concentration,spellName:grant.spellName,spellLevel:grant.spellLevel,switchGroup:grant.switchGroup,retention:grant.retention,effects:grant.effects};
  return builtInOverlayOption(character,state,id);
}
function activeOverlayOptions(character:Character,state:GameState){return state.overlays.map(id=>overlayOption(character,state,id)).filter((x):x is TransformationOption=>Boolean(x))}
function addSpellOverlayOptions(options:TransformationOption[],character:Character,state:GameState|undefined,spellName:string,ids:string[]){
  if(!preparedSpell(character,spellName))return;
  const activeIds=new Set(state?.overlays??[]);const activeGroup=ids.some(id=>activeIds.has(id));const castAllowed=canNormallyCast(character,state);const level=spellOnSheet(character,spellName)?.slotLevel??spellOnSheet(character,spellName)?.level??0;const slotReady=slotAvailable(state,character,level);
  for(const id of ids){const base=builtInOverlayOption(character,state,id);if(!base)continue;const active=activeIds.has(id);const switching=Boolean(base.switchGroup&&activeGroup&&!active);const usable=active||switching||(castAllowed&&slotReady);const reason=!castAllowed?'Current form, condition, or Rage blocks spellcasting.':!slotReady?`No level ${level} or higher spell slot remains.`:undefined;options.push({...base,label:active?`End ${base.label}`:base.label,actionCost:active?(base.endActionCost??'none'):base.actionCost,usable,...(!active&&!usable&&reason?{reason}:{}),...(active?{deactivate:true}:{})});}
}

export function availableTransformations(character:Character,state?:GameState):TransformationOption[]{
  const options:TransformationOption[]=[{id:'base',label:'Base Form',profile:'base',source:'Character sheet',actionCost:'none',usable:true}];
  const profile=activeProfile(state);const option=activeOption(state);const classFeaturesAvailable=retainedClassFeatures(option);
  const druid=classLevel(character,'Druid');
  if(druid>=2&&classFeaturesAvailable){
    const limits=wildShapeLimits(character);const pool=state?resource(state,'wild-shape'):undefined;
    for(const id of character.knownForms){const form=creature(character,id);if(!form||normalized(form.type)!=='beast'||form.cr>limits.maxCr||(form.speeds.fly&&!limits.fly))continue;const usable=!pool||pool.current>0;options.push({id:`wildshape:${id}`,label:form.name,profile:'wildshape',formId:id,source:limits.moon?'Circle of the Moon Wild Shape':'Wild Shape',actionCost:'bonus',usable,...(!usable?{reason:'No Wild Shape uses remaining.'}:{})});}
  }
  if(preparedSpell(character,'Polymorph')){
    const castAllowed=canNormallyCast(character,state);const usable=castAllowed&&slotAvailable(state,character,4);const reason=!castAllowed?'Current form or Rage blocks Polymorph.':'No level 4 or higher spell slot remains.';
    for(const form of allForms(character))if(normalized(form.type)==='beast'&&form.cr<=character.totalLevel)options.push({id:`polymorph:${form.id}`,label:`${form.name} — Polymorph`,profile:'polymorph',formId:form.id,source:'Polymorph',actionCost:'magic-action',spellName:'Polymorph',spellLevel:4,concentration:true,usable,...(!usable?{reason}:{})});
  }
  if(preparedSpell(character,'True Polymorph')){
    const castAllowed=canNormallyCast(character,state);const usable=castAllowed&&slotAvailable(state,character,9);const reason=!castAllowed?'Current form or Rage blocks True Polymorph.':'No level 9 or higher spell slot remains.';
    for(const form of allForms(character))if(form.cr<=character.totalLevel)options.push({id:`true-polymorph:${form.id}`,label:`${form.name} — True Polymorph`,profile:'true-polymorph',formId:form.id,source:'True Polymorph — creature into creature',actionCost:'magic-action',spellName:'True Polymorph',spellLevel:9,concentration:true,duration:'Concentration, up to 1 hour; permanent until dispelled after the full hour',usable,...(!usable?{reason}:{})});
  }
  if(preparedSpell(character,'Shapechange')&&(profile==='base'||profile==='shapechange')){
    const switching=profile==='shapechange';const usable=switching||(canNormallyCast(character,state)&&slotAvailable(state,character,9));const reason=state?.rage.active?'Rage blocks spellcasting.':switching?'':'No level 9 or higher spell slot remains.';
    for(const id of character.seenForms){const form=creature(character,id);if(form&&form.cr<=character.totalLevel&&!['construct','undead'].includes(normalized(form.type)))options.push({id:`shapechange:${id}`,label:`${form.name} — Shapechange`,profile:'shapechange',formId:id,source:'Shapechange',actionCost:'magic-action',spellName:'Shapechange',spellLevel:9,concentration:true,switchGroup:'shapechange',usable,...(!usable?{reason}:{})});}
  }
  if(preparedSpell(character,'Animal Shapes')){
    const switching=profile==='animal-shapes';const usable=switching||(canNormallyCast(character,state)&&slotAvailable(state,character,8));const reason=!canNormallyCast(character,state)?'Current state blocks spellcasting.':'No level 8 or higher spell slot remains.';
    for(const form of allForms(character))if(normalized(form.type)==='beast'&&form.cr<=4&&!['Huge','Gargantuan'].includes(form.size))options.push({id:`animal-shapes:${form.id}`,label:`${form.name} — Animal Shapes`,profile:'animal-shapes',formId:form.id,source:'Animal Shapes',actionCost:'magic-action',endActionCost:'bonus',spellName:'Animal Shapes',spellLevel:8,switchGroup:'animal-shapes',duration:'24 hours',usable,...(!usable?{reason}:{})});
  }
  addSpellOverlayOptions(options,character,state,'Alter Self',['spell:alter-self:aquatic','spell:alter-self:appearance','spell:alter-self:weapons-slashing','spell:alter-self:weapons-piercing','spell:alter-self:weapons-bludgeoning']);
  addSpellOverlayOptions(options,character,state,'Enlarge/Reduce',['spell:enlarge-reduce:enlarge','spell:enlarge-reduce:reduce']);
  addSpellOverlayOptions(options,character,state,'Gaseous Form',['spell:gaseous-form']);
  for(const grant of character.transformationGrants??[]){
    const allowed=grant.availableProfiles?.includes(profile)??(grant.profile==='overlay'?policyFor(option).classFeatures:profile==='base'||grant.profile===profile);
    if(!allowed)continue;const activeOverlay=grant.profile==='overlay'&&(state?.overlays.includes(grant.id)??false);const resourceReady=!grant.resourceId||!state||(resource(state,grant.resourceId)?.current??0)>=(grant.resourceCost??1);
    const usable=activeOverlay||resourceReady;const common={grantId:grant.id,source:grant.source,actionCost:activeOverlay?(grant.endActionCost??'none'):grant.actionCost,usable,...(!usable?{reason:`No ${grant.resourceId??'required resource'} remains.`}:{}),duration:grant.duration,endActionCost:grant.endActionCost,resourceId:grant.resourceId,resourceCost:grant.resourceCost,concentration:grant.concentration,spellName:grant.spellName,spellLevel:grant.spellLevel,switchGroup:grant.switchGroup,retention:grant.retention,effects:grant.effects,...(activeOverlay?{deactivate:true}:{})};
    if(grant.formIds.length){for(const id of grant.formIds){const form=creature(character,id);if(form)options.push({id:`grant:${grant.id}:${id}`,label:activeOverlay?`End ${grant.label}`:`${form.name} — ${grant.label}`,profile:grant.profile,formId:id,...common});}}
    else options.push({id:`grant:${grant.id}`,label:activeOverlay?`End ${grant.label}`:grant.label,profile:grant.profile,...common});
  }
  return options;
}

export function createInitialState(character:Character):GameState{
  return {
    stateVersion:3,hp:character.hp.current,tempHp:0,
    rage:{active:false,endsAtTurn:0,usedThisTurn:false,recklessDeclared:false,extendedThisTurn:false},
    turn:{number:1,actionsRemaining:1,surgeActionsRemaining:0,bonusRemaining:1,reactionRemaining:1,slotSpellCast:false,attackRollsMade:0,oncePerTurn:{}},
    resources:Object.fromEntries(character.resources.map(r=>[r.id,cloneResource(r)])),
    spellSlots:Object.fromEntries(Object.entries(character.spellSlots).map(([k,v])=>[k,{...v}])),
    concentrationChecks:[],activeSpellEffects:[],conditions:[],equipment:{...character.equipment},overlays:[],recharges:{},actionUses:{},log:[]
  };
}

function effectList(character:Character,state:GameState,option:TransformationOption):TransformationEffects[]{return [option.effects,...activeOverlayOptions(character,state).map(g=>g.effects)].filter((x):x is TransformationEffects=>Boolean(x))}
function physicalFromForm(character:Character,option:TransformationOption,effects:TransformationEffects[]){
  const form=creature(character,option.formId);const policy=policyFor(option);let result={...character.abilities};
  if(form&&option.profile!=='base'&&option.profile!=='overlay'){result={...form.abilities};if(policy.mentalAbilities){result.int=character.abilities.int;result.wis=character.abilities.wis;result.cha=character.abilities.cha;}}
  for(const effect of effects){for(const a of ABILITIES){const set=effect.abilitySet?.[a];if(set!==undefined)result[a]=set;const minimum=effect.abilityMinimum?.[a];if(minimum!==undefined)result[a]=Math.max(result[a],minimum);const bonus=effect.abilityBonus?.[a];if(bonus!==undefined)result[a]=Math.max(1,Math.min(30,result[a]+bonus));}}
  return result;
}
function armorActive(state:GameState,option:TransformationOption){return option.profile==='base'||option.profile==='overlay'||(state.equipment.transformBehavior==='wear'&&state.equipment.formCanWear===true)}
function shieldActive(state:GameState,option:TransformationOption){return armorActive(state,option)&&state.equipment.shield}
function getClassFeatureRules(character:Character):ImportedFeatureRule[]{return [...character.classes.flatMap(c=>(recordValue(CLASS_FEATURES,c.name)??[]).filter(f=>(f.level??1)<=c.level)),...character.features]}
function getSpeciesRules(character:Character):ImportedFeatureRule[]{return (recordValue(SPECIES_FEATURES,character.species)??[]).filter(f=>(f.level??1)<=character.totalLevel)}
function retentionAllows(feature:ImportedFeatureRule,option:TransformationOption){
  if(option.profile==='base'||option.profile==='overlay')return true;if(!policyFor(option).classFeatures)return false;
  if(option.profile==='wildshape')return feature.retention?.wildshape!==false;
  return feature.retention?.[option.profile]===true;
}
function evaluateFeatures(character:Character,state:GameState,option:TransformationOption,canCast:boolean):EvaluatedFeature[]{
  const result:EvaluatedFeature[]=[];const profile=option.profile;
  for(const feature of getClassFeatureRules(character)){
    let status:EvaluatedFeature['status']='active';let reason='Retained class feature; normal prerequisites still apply.';
    if(!retentionAllows(feature,option)){status='inactive';reason=`Not retained by the ${profile} transformation policy.`;}
    if(status==='active'&&feature.requires?.spellcasting&&!canCast){status='inactive';reason='Requires spellcasting, which the current state blocks.';}
    if(status==='active'&&feature.requires?.concentration&&!state.concentration){status='inactive';reason='Requires an active Concentration effect.';}
    if(status==='active'&&feature.requires?.speech&&!policyFor(option).speech){status='inactive';reason='The current transformation does not retain speech.';}
    if(status==='active'&&feature.requires?.noArmor&&armorActive(state,option)){status='inactive';reason='Requires no armor.';}
    if(status==='active'&&feature.requires?.noShield&&shieldActive(state,option)){status='inactive';reason='Requires no Shield.';}
    if(status==='active'&&(feature.requires?.weapon||feature.requires?.unarmed||feature.requires?.strengthAttack)){status='conditional';reason='Availability depends on the specific attack or action selected.';}
    if(status==='active'&&['sneak-attack','radiant-strikes','blessed-strikes','martial-arts','extra-attack-fighter','extra-attack-monk'].includes(feature.id)){status='conditional';reason=feature.summary;}
    if(feature.id==='rage')reason=state.rage.active?'Active. Concentration and spellcasting are blocked.':'Available if a Rage use and Bonus Action remain.';
    if(feature.id==='reckless-attack')reason=state.turn.attackRollsMade===0?'May be declared before the first attack roll of this turn.':'The first attack-roll decision has passed this turn.';
    result.push({id:feature.id,name:feature.name,source:feature.source,status,reason,summary:feature.summary,...(feature.activation?{activation:feature.activation}:{})});
  }
  for(const feature of getSpeciesRules(character)){const ongoing=state.overlays.includes(feature.id);const active=profile==='base'||profile==='overlay'||ongoing;result.push({id:feature.id,name:feature.name,source:feature.source,status:active?'active':'inactive',reason:active?(ongoing?'An already-active effect continues through shape-shifting.':'Available in the current form.'):'Species traits are not generally retained by replacement transformations.',summary:feature.summary,...(feature.activation?{activation:feature.activation}:{})});}
  for(const feat of character.feats){const active=policyFor(option).feats;result.push({id:`feat:${feat}`,name:feat,source:'Feat',status:active?'conditional':'inactive',reason:active?'The transformation retains feats; exact prerequisites still apply.':'This transformation does not retain feats.',summary:'Imported feat.'});}
  return result;
}
function moonSpellAllowed(character:Character,spell:Spell){const level=recordValue(MOON_FORM_SPELL_LEVELS,spell.name);return sameText(subclass(character,'Druid'),'Circle of the Moon')&&level!==undefined&&classLevel(character,'Druid')>=level&&sameText(spell.sourceClass,'Druid')}
export function spellActiveEffect(spell:Spell){if(spell.activeEffect)return spell.activeEffect;if(sameText(spell.name,'Barkskin'))return {id:'barkskin',duration:'1 hour',acMinimum:17,summary:'The target has Armor Class 17 if its AC would otherwise be lower.'};return undefined}
function evaluateSpells(character:Character,state:GameState,option:TransformationOption,baseCanCast:boolean){return character.spells.map(spell=>{const prepared=spell.prepared!==false;const circleAccess=moonSpellAllowed(character,spell);let available=baseCanCast&&prepared;let reason=available?'Spellcasting is allowed.':'Spellcasting is blocked in the current form.';if(option.profile==='wildshape'&&circleAccess&&prepared&&!state.rage.active){available=true;reason='Available through Circle of the Moon while in Wild Shape.';}if(option.profile==='wildshape'&&classLevel(character,'Druid')>=18&&!state.rage.active){available=prepared&&!(spell.materialCost||spell.materialConsumed);reason=!prepared?'The spell is not prepared or otherwise available.':available?'Available through Beast Spells.':'Beast Spells excludes costly or consumed Material components.';}if(state.rage.active){available=false;reason='Rage blocks all spellcasting, including Circle spells.';}const level=spell.slotLevel??spell.level;if(available&&level>0&&state.turn.slotSpellCast){available=false;reason='2024 rule: a spell slot has already been expended to cast a spell on this turn. Cantrips and non-spell actions remain available.';}if(available&&level>0&&!slotAvailable(state,character,level)){available=false;reason=`No level ${level} or higher spell slot remains.`;}if(available){const error=actionError(state,spell.castingTime,activeConditionImmunities(character,state,option));if(error){available=false;reason=error;}}return {...spell,...(circleAccess?{specialAccess:'circle-of-the-moon' as const}:{}),available,reason};});}
function resolveSpeeds(character:Character,state:GameState,option:TransformationOption,effects:TransformationEffects[]){
  const form=creature(character,option.formId);const speeds=form&&option.profile!=='overlay'?{...form.speeds}:{walk:character.speed};
  if(retainedClassFeatures(option)){const barb=classLevel(character,'Barbarian');if(barb>=5&&!(armorActive(state,option)&&state.equipment.armorCategory==='heavy'))speeds.walk=(speeds.walk??0)+10;const monk=classLevel(character,'Monk');if(monk>=2&&!armorActive(state,option)&&!shieldActive(state,option))speeds.walk=(speeds.walk??0)+monkMovement(monk);const ranger=classLevel(character,'Ranger');if(ranger>=6&&!(armorActive(state,option)&&state.equipment.armorCategory==='heavy')){speeds.walk=(speeds.walk??0)+10;speeds.climb=Math.max(speeds.climb??0,speeds.walk);speeds.swim=Math.max(speeds.swim??0,speeds.walk);}for(const feature of character.features){if(!retentionAllows(feature,option))continue;const bonus=feature.grants?.speedBonus??0;if(bonus)speeds.walk=(speeds.walk??0)+bonus;}}
  const equalToWalk=new Set<'climb'|'swim'|'fly'|'burrow'>();
  for(const effect of effects){for(const [key,value] of Object.entries(effect.speedSet??{}))if(value!==undefined)speeds[key as keyof typeof speeds]=value;for(const [key,value] of Object.entries(effect.speedBonus??{}))if(value!==undefined)speeds[key as keyof typeof speeds]=(speeds[key as keyof typeof speeds]??0)+value;for(const key of effect.speedEqualToWalk??[])equalToWalk.add(key);}
  for(const key of equalToWalk)speeds[key]=speeds.walk??0;
  const immunities=new Set(unique(effects.flatMap(effect=>effect.conditionImmunities??[])).map(value=>normalized(value)));
  const activeZeroSpeed=['Grappled','Restrained','Paralyzed','Petrified','Stunned','Unconscious'].some(condition=>state.conditions.includes(condition)&&!immunities.has(normalized(condition)));
  if(activeZeroSpeed)for(const key of Object.keys(speeds) as (keyof typeof speeds)[])speeds[key]=0;return speeds;
}
function resolveAc(character:Character,state:GameState,option:TransformationOption,abilities:Character['abilities'],effects:TransformationEffects[]){
  const candidates:AcCandidate[]=[];const form=creature(character,option.formId);
  if(option.profile==='base'||option.profile==='overlay')candidates.push({name:'Base character sheet',value:character.ac,legal:true,reason:'Imported base AC.'});if(form&&option.profile!=='overlay')candidates.push({name:`${form.name} stat block`,value:form.ac,legal:true,reason:'The transformation supplies this AC.'});
  if(option.profile==='wildshape'&&sameText(subclass(character,'Druid'),'Circle of the Moon')&&classLevel(character,'Druid')>=3)candidates.push({name:'Circle Forms',value:13+abilityMod(character.abilities.wis),legal:true,reason:'13 + retained Wisdom modifier.'});
  if(retainedClassFeatures(option)&&classLevel(character,'Barbarian')>=1)candidates.push({name:'Barbarian Unarmored Defense',value:10+abilityMod(abilities.dex)+abilityMod(abilities.con),legal:!armorActive(state,option),reason:armorActive(state,option)?'Illegal while armor is active.':'10 + Dexterity + Constitution.'});
  if(retainedClassFeatures(option)&&classLevel(character,'Monk')>=1)candidates.push({name:'Monk Unarmored Defense',value:10+abilityMod(abilities.dex)+abilityMod(abilities.wis),legal:!armorActive(state,option)&&!shieldActive(state,option),reason:armorActive(state,option)||shieldActive(state,option)?'Illegal while armor or a Shield is active.':'10 + Dexterity + Wisdom.'});
  for(const feature of character.features){const formula=feature.grants?.acFormula;if(!formula||!retentionAllows(feature,option))continue;const value=formula.base+formula.abilities.reduce((n,a)=>n+abilityMod(abilities[a]),0);const legal=!(feature.requires?.noArmor&&armorActive(state,option))&&!(feature.requires?.noShield&&shieldActive(state,option));candidates.push({name:feature.name,value,legal,reason:legal?'Imported structured AC formula.':'Imported prerequisites are not met.'});}
  for(const [i,effect] of effects.entries())if(effect.acFormula)candidates.push({name:`Transformation formula ${i+1}`,value:effect.acFormula.base+effect.acFormula.abilities.reduce((n,a)=>n+abilityMod(abilities[a]),0),legal:true,reason:'Explicit imported transformation AC formula.'});
  for(const effect of state.activeSpellEffects)if(effect.acMinimum!==undefined)candidates.push({name:`${effect.name} minimum`,value:effect.acMinimum,legal:true,reason:`Active for ${effect.duration}. This is a minimum; a higher legal AC still wins.`});
  const bonus=effects.reduce((n,e)=>n+(e.acBonus??0),0);const legal=candidates.filter(c=>c.legal).sort((a,b)=>b.value-a.value);const selected=legal[0]??{name:'Fallback AC',value:10,legal:true,reason:'No legal formula found.'};if(bonus)candidates.push({name:'Transformation AC modifiers',value:selected.value+bonus,legal:true,reason:`Selected AC plus ${bonus>=0?'+':''}${bonus}.`});return {value:selected.value+bonus,source:bonus?`${selected.name} + modifiers`:selected.name,candidates};
}
function characterSaveValue(character:Character,option:TransformationOption,abilities:Character['abilities'],a:Ability,rank:number,pb:number){if((option.profile==='base'||option.profile==='overlay')&&character.saveBonuses?.[a]!==undefined)return (character.saveBonuses[a] as number)+abilityMod(abilities[a])-abilityMod(character.abilities[a]);return abilityMod(abilities[a])+pb*rank}
function characterSkillValue(character:Character,option:TransformationOption,abilities:Character['abilities'],name:string,a:Ability,rank:number,pb:number){if((option.profile==='base'||option.profile==='overlay')&&character.skillBonuses?.[name]!==undefined)return (character.skillBonuses[name] as number)+abilityMod(abilities[a])-abilityMod(character.abilities[a]);return abilityMod(abilities[a])+pb*rank}
function effectConditionImmunities(form:ReturnType<typeof creature>,effects:TransformationEffects[]){return new Set([...(form?.conditionImmunities??[]),...effects.flatMap(effect=>effect.conditionImmunities??[])].map(value=>normalized(value)))}
function conditionApplies(state:GameState,condition:string,immunities:Set<string>){return state.conditions.includes(condition)&&!immunities.has(normalized(condition))}
function resolveSaves(character:Character,state:GameState,option:TransformationOption,abilities:Character['abilities'],effects:TransformationEffects[]):Record<Ability,DerivedRoll>{
  const form=creature(character,option.formId);const pb=proficiencyBonus(character.totalLevel);const retain=retainedProficiencies(option);const output={} as Record<Ability,DerivedRoll>;const conditionImmunities=effectConditionImmunities(form,effects);const incapacitated=effectivelyIncapacitated(character,state,conditionImmunities);
  for(const a of ABILITIES){
    const rank=retain?(character.proficiencies.saves[a]??0):0;const formValue=form?.saves[a];let modifier=characterSaveValue(character,option,abilities,a,rank,pb);let source=rank?'Retained character proficiency':'Current ability modifier';
    if(form&&!retain){modifier=formValue??abilityMod(form.abilities[a]);source=`${form.name} stat block`;}else if(form&&formValue!==undefined&&formValue>modifier){modifier=formValue;source=`Higher ${form.name} modifier`;}
    if(option.profile==='wildshape'&&sameText(subclass(character,'Druid'),'Circle of the Moon')&&classLevel(character,'Druid')>=6&&a==='con'){modifier+=abilityMod(character.abilities.wis);source+=' + Improved Circle Forms';}
    if(retainedClassFeatures(option)&&classLevel(character,'Paladin')>=6&&!incapacitated){modifier+=Math.max(1,abilityMod(character.abilities.cha));source+=' + Aura of Protection';}
    for(const feature of character.features){if(!retentionAllows(feature,option)||feature.grants?.saveBonusAbility!==a||!feature.grants.saveBonusFromAbility)continue;modifier+=abilityMod(abilities[feature.grants.saveBonusFromAbility]);source+=` + ${feature.name}`;}
    const advantageSources=effects.filter(e=>e.saveAdvantage?.includes(a)).map(()=> 'Active transformation');const disadvantageSources=effects.filter(e=>e.saveDisadvantage?.includes(a)).map(()=> 'Active transformation');
    if(retainedClassFeatures(option)&&classLevel(character,'Barbarian')>=2&&a==='dex'&&!incapacitated)advantageSources.push('Danger Sense');if(retainedClassFeatures(option)&&state.rage.active&&a==='str')advantageSources.push('Rage');if(conditionApplies(state,'Restrained',conditionImmunities)&&a==='dex')disadvantageSources.push('Restrained');
    const automaticFailure=(a==='str'||a==='dex')&&['Unconscious','Paralyzed','Petrified','Stunned'].some(condition=>conditionApplies(state,condition,conditionImmunities))?'This condition automatically fails Strength and Dexterity saving throws.':undefined;
    output[a]={name:`${a.toUpperCase()} save`,modifier,source,proficiency:rank,...(formValue!==undefined?{beastModifier:formValue}:{}),...(advantageSources.length?{advantageSources}:{}),...(disadvantageSources.length?{disadvantageSources}:{}),...(automaticFailure?{automaticFailure}:{})};
  }
  return output;
}
function resolveSkills(character:Character,state:GameState,option:TransformationOption,abilities:Character['abilities'],effects:TransformationEffects[]):Record<string,DerivedRoll>{
  const form=creature(character,option.formId);const pb=proficiencyBonus(character.totalLevel);const retain=retainedProficiencies(option);const conditionImmunities=effectConditionImmunities(form,effects);const names=unique([...Object.keys(SKILL_ABILITIES),...Object.keys(form?.skills??{}),...Object.keys(character.proficiencies.skills)]);const out:Record<string,DerivedRoll>={};
  for(const name of names){
    const a=SKILL_ABILITIES[name]??'wis';const rank=retain?(character.proficiencies.skills[name]??0):0;const formValue=form?.skills[name];let modifier=characterSkillValue(character,option,abilities,name,a,rank,pb);let source=rank?'Retained character proficiency':'Current ability modifier';
    if(form&&!retain){modifier=formValue??abilityMod(form.abilities[a]);source=`${form.name} stat block`;}else if(form&&formValue!==undefined&&formValue>modifier){modifier=formValue;source=`Higher ${form.name} modifier`;}
    let alternate:DerivedRoll['alternate'];if(retainedClassFeatures(option)&&state.rage.active&&classLevel(character,'Barbarian')>=3&&['Acrobatics','Intimidation','Perception','Stealth','Survival'].includes(name))alternate={modifier:abilityMod(abilities.str)+pb*rank,source:'Primal Knowledge: make this as a Strength check while Raging'};
    const advantageSources=effects.filter(e=>e.checkAdvantage?.includes(a)).map(()=> 'Active transformation');const disadvantageSources=effects.filter(e=>e.checkDisadvantage?.includes(a)).map(()=> 'Active transformation');if(conditionApplies(state,'Poisoned',conditionImmunities))disadvantageSources.push('Poisoned');const conditionalSources=conditionApplies(state,'Frightened',conditionImmunities)?['Frightened imposes Disadvantage only while the source is in line of sight.']:[];
    out[name]={name,modifier,source,proficiency:rank,...(formValue!==undefined?{beastModifier:formValue}:{}),...(advantageSources.length?{advantageSources}:{}),...(disadvantageSources.length?{disadvantageSources}:{}),...(conditionalSources.length?{conditionalSources}:{}),...(alternate?{alternate}:{})};
  }
  return out;
}
function baseActions(character:Character,abilities:Character['abilities']):CreatureAction[]{const mod=abilityMod(abilities.str);return [{id:'unarmed',name:'Unarmed Strike',type:'attack',cost:'action',attackBonus:proficiencyBonus(character.totalLevel)+mod,ability:'str',kind:'unarmed',reach:5,damage:[{expression:String(Math.max(1,1+mod)),type:'Bludgeoning'}]}]}
function resolvedActions(character:Character,option:TransformationOption,effects:TransformationEffects[],canAttack:boolean,abilities:Character['abilities']):CreatureAction[]{
  const form=creature(character,option.formId);const actions:CreatureAction[]=form&&option.profile!=='overlay'?[...form.actions]:baseActions(character,abilities);for(const effect of effects)actions.push(...(effect.actions??[]));
  const monk=classLevel(character,'Monk');if(canAttack&&retainedClassFeatures(option)&&monk>=1){const stats=abilities;const strMod=abilityMod(stats.str),dexMod=abilityMod(stats.dex),mod=Math.max(strMod,dexMod),chosen:Ability=dexMod>=strMod?'dex':'str';actions.push({id:'monk-unarmed',name:'Monk Unarmed Strike',type:'attack',cost:'action',attackBonus:proficiencyBonus(character.totalLevel)+mod,ability:chosen,kind:'unarmed',reach:5,damage:[{expression:`${monkDie(monk)}${mod>=0?'+':''}${mod}`,type:'Bludgeoning'}],notes:'Separate Unarmed Strike; Beast attacks do not become Unarmed Strikes.'});}
  if(canAttack)return actions;
  return actions.filter(action=>action.type==='automatic'&&!action.damage?.length&&!action.effects?.length);
}
export function resolveSheet(character:Character,state:GameState):ResolvedSheet{
  const option=activeOption(state);const profile=option.profile;const form=creature(character,option.formId);const effects=effectList(character,state,option);const abilities=physicalFromForm(character,option,effects);
  const effectiveConditionImmunities=effectConditionImmunities(form,effects);const incapacitated=effectivelyIncapacitated(character,state,effectiveConditionImmunities);
  let baseCanCast=(option.profile==='wildshape'&&classLevel(character,'Druid')>=18)||policyFor(option).spellcasting;for(const effect of effects)if(effect.canCast!==undefined)baseCanCast=effect.canCast;const canCast=baseCanCast&&!state.rage.active&&!incapacitated;
  let canConcentrate=!state.rage.active&&!incapacitated;for(const effect of effects)if(effect.canConcentrate!==undefined)canConcentrate=effect.canConcentrate&&!state.rage.active&&!incapacitated;
  let canSpeak=policyFor(option).speech&&!incapacitated;for(const effect of effects)if(effect.canSpeak!==undefined)canSpeak=effect.canSpeak&&!incapacitated;
  let canAttack=!incapacitated;for(const effect of effects)if(effect.canAttack!==undefined)canAttack=effect.canAttack&&!incapacitated;
  let canManipulateObjects=!incapacitated;for(const effect of effects)if(effect.canManipulateObjects!==undefined)canManipulateObjects=effect.canManipulateObjects&&!incapacitated;
  const ac=resolveAc(character,state,option,abilities,effects);const features=evaluateFeatures(character,state,option,canCast);const resistances=[...(form?.resistances??[])],immunities=[...(form?.immunities??[])],vulnerabilities=[...(form?.vulnerabilities??[])];
  for(const feature of character.features){if(!retentionAllows(feature,option))continue;resistances.push(...(feature.grants?.resistances??[]));immunities.push(...(feature.grants?.immunities??[]));}
  for(const effect of effects){resistances.push(...(effect.resistances??[]));immunities.push(...(effect.immunities??[]));vulnerabilities.push(...(effect.vulnerabilities??[]));}
  const conditionImmunities=effectConditionImmunities(form,effects);if(state.rage.active&&retainedClassFeatures(option))resistances.push('Bludgeoning','Piercing','Slashing');if(conditionApplies(state,'Petrified',conditionImmunities))resistances.push(...ALL_DAMAGE_TYPES);
  if(sameText(state.concentration?.name,'Fount of Moonlight'))resistances.push('Radiant');
  const resolvedConditionImmunities=unique([...(form?.conditionImmunities??[]),...effects.flatMap(effect=>effect.conditionImmunities??[])]);const attackDamageModifiers=effects.map(effect=>effect.attackDamageModifier).filter((value):value is NonNullable<TransformationEffects['attackDamageModifier']>=>Boolean(value));
  const effectCreatureType=effects.map(effect=>effect.creatureType).filter((value):value is string=>Boolean(value)).at(-1);const creatureType=effectCreatureType??(form&&!policyFor(option).creatureType?form.type:character.creatureType);
  return {profile,...(form?{form}:{}),creatureType,size:effects.map(e=>e.size).filter(Boolean).at(-1)??form?.size??character.size,abilities,ac:ac.value,acSource:ac.source,acCandidates:ac.candidates,speeds:resolveSpeeds(character,state,option,effects),saves:resolveSaves(character,state,option,abilities,effects),skills:resolveSkills(character,state,option,abilities,effects),actions:resolvedActions(character,option,effects,canAttack,abilities),resistances:unique(resistances),immunities:unique(immunities),vulnerabilities:unique(vulnerabilities),senses:unique([...(form?.senses??[]),...effects.flatMap(e=>e.senses??[])]),canSpeak,canCast,canConcentrate,canAttack,canManipulateObjects,conditionImmunities:resolvedConditionImmunities,attackDamageModifiers,features,spells:evaluateSpells(character,state,option,baseCanCast)};
}

function actionError(state:GameState,cost:ActionCost,conditionImmunities:Iterable<string>=[]):string|null{
  const immune=new Set([...conditionImmunities].map(value=>normalized(value)));
  const incapacitated=['Incapacitated','Unconscious','Paralyzed','Petrified','Stunned'].some(condition=>state.conditions.includes(condition)&&!immune.has(normalized(condition)));
  if(incapacitated&&cost!=='none'&&cost!=='free')return 'The Incapacitated condition prevents Actions, Bonus Actions, and Reactions.';
  if(cost==='none'||cost==='free')return null;
  if(cost==='bonus')return state.turn.bonusRemaining>0?null:'Bonus Action already used this turn.';
  if(cost==='reaction')return state.turn.reactionRemaining>0?null:'Reaction already used this round.';
  if(cost==='magic-action')return state.turn.actionsRemaining>0?null:'No normal Action remains; an Action Surge action cannot be used for a Magic action.';
  if(cost==='action')return state.turn.actionsRemaining+state.turn.surgeActionsRemaining>0?null:'Action already used this turn.';
  return null;
}
export function actionCostError(state:GameState,cost:ActionCost,conditionImmunities:Iterable<string>=[]){return actionError(state,cost,conditionImmunities)}
export function spendActionCost(state:GameState,cost:ActionCost,conditionImmunities:Iterable<string>=[]):string|null{
  const error=actionError(state,cost,conditionImmunities);if(error)return error;
  if(cost==='bonus')state.turn.bonusRemaining--;
  else if(cost==='reaction')state.turn.reactionRemaining--;
  else if(cost==='magic-action')state.turn.actionsRemaining--;
  else if(cost==='action'){if(state.turn.actionsRemaining>0)state.turn.actionsRemaining--;else state.turn.surgeActionsRemaining--;}
  return null;
}
function hasResource(state:GameState,id:string,amount=1){const r=resource(state,id);return !!r&&r.current>=amount}
function spendResource(state:GameState,id:string,amount=1){if(!hasResource(state,id,amount))return false;(resource(state,id) as ResourcePool).current-=amount;return true}
function incomingTempHp(character:Character,option:TransformationOption,switchingSameEffect=false){
  const form=creature(character,option.formId);
  if(option.profile==='wildshape'){const d=classLevel(character,'Druid');return sameText(subclass(character,'Druid'),'Circle of the Moon')&&d>=3?d*3:d;}
  if(option.profile==='polymorph'||option.profile==='true-polymorph')return form?.hp??0;
  if(option.profile==='shapechange'||option.profile==='animal-shapes')return switchingSameEffect?0:(form?.hp??0);
  const temporary=option.effects?.temporaryHp;if(!temporary)return 0;
  if(temporary.mode==='fixed')return temporary.value??0;if(temporary.mode==='form-hp')return form?.hp??0;if(temporary.mode==='expression'&&temporary.expression)return rollDice(temporary.expression).total;return 0;
}
function duration(character:Character,option:TransformationOption){
  if(option.duration)return option.duration;if(option.profile==='wildshape')return `${Math.floor(classLevel(character,'Druid')/2)} hours`;if(option.profile==='polymorph'||option.profile==='shapechange'||option.profile==='true-polymorph')return 'Concentration, up to 1 hour';if(option.profile==='animal-shapes')return '24 hours';return 'As defined by the feature';
}
function consumeSpellSlot(state:GameState,level:number){const slot=state.spellSlots[String(level)];if(!slot||slot.current<1)return false;slot.current--;return true}
function consumeAvailableSpellSlot(character:Character,state:GameState,minimumLevel:number,requestedLevel?:number){const level=nextSpellSlot(character,state,minimumLevel,requestedLevel);return level===undefined?undefined:(consumeSpellSlot(state,level),level)}
function removeOverlay(state:GameState,id:string){state.overlays=state.overlays.filter(value=>value!==id)}
function overlayId(option:TransformationOption){return option.grantId??option.id}
function tempHpSourceName(option:TransformationOption){if(option.spellName)return option.spellName;if(option.profile==='animal-shapes')return 'Animal Shapes';return option.label}
function clearActionRecharges(state:GameState){state.recharges={}}
function applyIncomingTempHp(state:GameState,option:TransformationOption,incoming:number):TransitionResult|undefined{
  if(incoming<=0)return undefined;const source=tempHpSourceName(option);
  if(state.tempHp===0){state.tempHp=incoming;state.tempHpSource=source;return undefined;}
  return {state,message:`${option.label} activated. Choose which Temporary Hit Points to keep.`,choice:{kind:'temporary-hit-points',current:state.tempHp,incoming,source}};
}
function overlayInSwitchGroup(character:Character,state:GameState,group:string){return state.overlays.find(id=>overlayOption(character,state,id)?.switchGroup===group)}

export function startTransformation(character:Character,state:GameState,option:TransformationOption):TransitionResult{
  if(!option.usable)return {state,message:option.reason??'That transformation is not currently usable.'};if(option.profile==='base')return endTransformation(state,true,character);
  if(option.profile==='overlay'){
    const id=overlayId(option);
    if(option.deactivate){
      const cost=option.endActionCost??option.actionCost;const error=actionError(state,cost,activeConditionImmunities(character,state));if(error)return {state,message:error};spendActionCost(state,cost,activeConditionImmunities(character,state));removeOverlay(state,id);
      const source=tempHpSourceName(option);if(state.tempHpSource===source){state.tempHp=0;delete state.tempHpSource;}
      if(option.concentration&&state.concentration?.name===(option.spellName??option.label))endConcentration(state,`${option.spellName??option.label} ended.`,character);
      return {state,message:`${option.label.replace(/^End /,'')} ended.`};
    }
    const error=actionError(state,option.actionCost,activeConditionImmunities(character,state));if(error)return {state,message:error};if(option.resourceId&&!hasResource(state,option.resourceId,option.resourceCost??1))return {state,message:`No ${option.resourceId} resource remains.`};
    const existingGroup=option.switchGroup?overlayInSwitchGroup(character,state,option.switchGroup):undefined;const switchingSameSpell=Boolean(existingGroup&&option.switchGroup);
    if(option.spellName&&!switchingSameSpell){if(state.rage.active)return {state,message:'Rage blocks spellcasting.'};const level=option.spellLevel??0;if(level>0&&!slotAvailable(state,character,level))return {state,message:`No level ${level} or higher spell slot remains.`};}
    if(option.concentration&&!switchingSameSpell&&state.rage.active)return {state,message:'Rage blocks Concentration.'};
    spendActionCost(state,option.actionCost,activeConditionImmunities(character,state));if(option.resourceId)spendResource(state,option.resourceId,option.resourceCost??1);
    if(option.spellName&&!switchingSameSpell){const level=option.spellLevel??0;if(level>0)consumeAvailableSpellSlot(character,state,level);if(option.concentration){if(state.concentration)endConcentration(state,`${option.spellName} replaced the previous Concentration effect.`,character);state.concentration={name:option.spellName,source:'Spell'};}}
    else if(option.concentration&&!switchingSameSpell){if(state.concentration)endConcentration(state,`${option.label} replaced the previous Concentration effect.`,character);state.concentration={name:option.label,source:option.source};}
    if(existingGroup)removeOverlay(state,existingGroup);if(!state.overlays.includes(id))state.overlays.push(id);
    const incoming=incomingTempHp(character,option,false);const choice=applyIncomingTempHp(state,option,incoming);if(choice)return choice;
    return {state,message:`${option.label} ${switchingSameSpell?'changed':'activated'}${option.duration?` for ${option.duration}`:''}.`};
  }

  if(option.profile==='custom'&&!option.retention)return {state,message:'This custom replacement form has no explicit retention policy and was not applied.'};
  const activeTransform=state.activeTransform;const active=activeTransform?.option;const switchingSameEffect=Boolean(active&&active.profile===option.profile&&((active.switchGroup&&active.switchGroup===option.switchGroup)||['wildshape','shapechange','animal-shapes'].includes(option.profile)));
  const switchingWildshape=active?.profile==='wildshape'&&option.profile==='wildshape';const switchingShapechange=active?.profile==='shapechange'&&option.profile==='shapechange';const switchingAnimalShapes=active?.profile==='animal-shapes'&&option.profile==='animal-shapes';
  const error=actionError(state,option.actionCost,activeConditionImmunities(character,state));if(error)return {state,message:error};if(option.profile==='wildshape'&&!hasResource(state,'wild-shape'))return {state,message:'No Wild Shape uses remaining.'};if(option.resourceId&&!hasResource(state,option.resourceId,option.resourceCost??1))return {state,message:`No ${option.resourceId} resource remains.`};
  if(option.spellName&&!switchingSameEffect){if(state.rage.active)return {state,message:'Rage blocks spellcasting.'};const level=option.spellLevel??0;if(level>0&&!slotAvailable(state,character,level))return {state,message:`No level ${level} or higher spell slot remains.`};}
  if(option.concentration&&!switchingSameEffect&&state.rage.active)return {state,message:'Rage blocks Concentration.'};
  spendActionCost(state,option.actionCost,activeConditionImmunities(character,state));if(option.profile==='wildshape')spendResource(state,'wild-shape');if(option.resourceId)spendResource(state,option.resourceId,option.resourceCost??1);
  const replacingDifferentEffect=Boolean(active&&!switchingSameEffect);const oldSource=active?tempHpSourceName(active):undefined;
  if(active&&(switchingWildshape||replacingDifferentEffect)&&activeTransform?.tempHpSource&&state.tempHpSource===oldSource){state.tempHp=0;delete state.tempHpSource;}
  if(activeTransform?.spellConcentration&&!switchingSameEffect&&state.concentration?.name===(activeTransform.option.spellName??activeTransform.option.label))endConcentration(state,`${activeTransform.option.label} was replaced by ${option.label}.`,character);
  if(option.spellName&&!switchingSameEffect){const level=option.spellLevel??0;if(level>0)consumeAvailableSpellSlot(character,state,level);if(option.concentration){if(state.concentration)endConcentration(state,`${option.spellName} replaced the previous Concentration effect.`,character);state.concentration={name:option.spellName,source:'Spell'};}}
  else if(option.concentration&&!switchingSameEffect){if(state.concentration)endConcentration(state,`${option.label} replaced the previous Concentration effect.`,character);state.concentration={name:option.label,source:option.source};}
  const incoming=incomingTempHp(character,option,switchingSameEffect);const retainsExistingTransformTemp=Boolean(switchingSameEffect&&activeTransform?.tempHpSource&&state.tempHpSource===tempHpSourceName(option));
  clearActionRecharges(state);state.activeTransform={option,startedTurn:state.turn.number,duration:duration(character,option),tempHpSource:incoming>0||retainsExistingTransformTemp,...(option.concentration?{spellConcentration:true}:{})};
  const choice=applyIncomingTempHp(state,option,incoming);if(choice)return choice;
  const baseMessage=`${switchingWildshape?'Wild Shape changed to':switchingShapechange?'Shapechange shifted to':switchingAnimalShapes?'Animal Shapes changed to':switchingSameEffect?'Form changed to':'Transformed into'} ${option.label}.`;
  if(option.profile==='wildshape')return {state,message:`${baseMessage} A Bonus Action was spent; voluntarily ending Wild Shape also requires a Bonus Action.`};
  if(option.profile==='shapechange'||option.profile==='animal-shapes')return {state,message:`${baseMessage} Only the first form grants this spell's Temporary Hit Points; later form changes do not refresh them.`};return {state,message:baseMessage};
}
export function resolveTempHpChoice(state:GameState,keep:'current'|'incoming',incoming:number,source:string){if(keep==='incoming'){state.tempHp=incoming;state.tempHpSource=source;}return state}
export function endTransformation(state:GameState,voluntary=true,character?:Character):TransitionResult{
  const active=state.activeTransform;if(!active)return {state,message:'No replacement transformation is active.'};
  if(voluntary&&active.option.profile==='true-polymorph'&&active.permanentUntilDispelled)return {state,message:'Permanent True Polymorph cannot be ended voluntarily; record the form ending only after it is dispelled or otherwise ended externally.'};
  const defaultCost:ActionCost=active.option.profile==='wildshape'||active.option.profile==='animal-shapes'?'bonus':'none';const cost=active.option.endActionCost??defaultCost;
  if(voluntary){const immunities=character?activeConditionImmunities(character,state):[];const error=actionError(state,cost,immunities);if(error)return {state,message:error};spendActionCost(state,cost,immunities);}
  if(active.spellConcentration&&state.concentration?.name===(active.option.spellName??active.option.label))endConcentration(state,`${active.option.label} ended.`,character);
  if(active.tempHpSource&&state.tempHpSource===tempHpSourceName(active.option)){state.tempHp=0;delete state.tempHpSource;}
  const name=active.option.label;delete state.activeTransform;clearActionRecharges(state);return {state,message:`${name} ended; Base Form restored.`};
}


export function completeTruePolymorph(state:GameState):TransitionResult{
  const active=state.activeTransform;
  if(!active||active.option.profile!=='true-polymorph')return {state,message:'True Polymorph is not active.'};
  if(active.permanentUntilDispelled)return {state,message:'True Polymorph already lasts until dispelled.'};
  const spellName=active.option.spellName??active.option.label;
  if(!active.spellConcentration||state.concentration?.name!==spellName)return {state,message:'The active True Polymorph is not in its one-hour Concentration phase.'};
  delete state.concentration;state.concentrationChecks=[];active.spellConcentration=false;active.permanentUntilDispelled=true;active.duration='Until dispelled';
  return {state,message:'True Polymorph was maintained for the full hour and now lasts until dispelled. Concentration ended without ending the transformation.'};
}

export function startRage(character:Character,state:GameState):TransitionResult{
  const blocked=rageStartError(character,state);if(blocked)return {state,message:blocked};
  const immunities=activeConditionImmunities(character,state);
  spendActionCost(state,'bonus',immunities);spendResource(state,'rage');
  const persistent=classLevel(character,'Barbarian')>=15;
  state.rage={active:true,endsAtTurn:persistent?Number.MAX_SAFE_INTEGER:state.turn.number+1,usedThisTurn:true,recklessDeclared:false,extendedThisTurn:persistent};
  const endedConcentration=Boolean(state.concentration);
  if(endedConcentration)endConcentration(state,'Rage prevents maintaining Concentration.',character);
  return {state,message:endedConcentration?'Rage started. Concentration ended. You now resist Bludgeoning, Piercing, and Slashing damage and have Advantage on Strength checks and saves; spellcasting is blocked.':'Rage started. You now resist Bludgeoning, Piercing, and Slashing damage and have Advantage on Strength checks and saves; spellcasting is blocked.'};
}
export function rageStartError(character:Character,state:GameState){
  if(classLevel(character,'Barbarian')<1)return 'This character has no Rage feature.';
  if(state.rage.active)return 'Rage is already active.';
  const option=activeOption(state);
  if(!retainedClassFeatures(option))return 'The current transformation does not retain the Rage class feature.';
  if(state.equipment.armorCategory==='heavy'&&armorActive(state,option))return 'Rage cannot begin while wearing Heavy armor.';
  const error=actionError(state,'bonus',activeConditionImmunities(character,state));if(error)return error;
  if(!hasResource(state,'rage'))return 'No Rage uses remain.';
  return null;
}
export function endRage(state:GameState,reason='Rage ended.'):TransitionResult{state.rage={active:false,endsAtTurn:0,usedThisTurn:false,recklessDeclared:false,extendedThisTurn:false};return {state,message:reason}}
export function declareRecklessAttack(character:Character,state:GameState):TransitionResult{
  if(classLevel(character,'Barbarian')<2)return {state,message:'This character has no Reckless Attack feature.'};
  if(state.turn.attackRollsMade>0)return {state,message:'Reckless Attack must be chosen before the first attack roll of the turn.'};
  state.rage.recklessDeclared=!state.rage.recklessDeclared;
  return {state,message:state.rage.recklessDeclared?'Reckless Attack declared for Strength attack rolls this turn.':'Reckless Attack canceled before the first attack roll.'};
}
export function markRageExtension(state:GameState){if(state.rage.active){state.rage.endsAtTurn=Math.max(state.rage.endsAtTurn,state.turn.number+1);state.rage.extendedThisTurn=true;}}
export function extendRage(character:Character,state:GameState):TransitionResult{
  if(!state.rage.active)return {state,message:'Rage is not active.'};
  if(classLevel(character,'Barbarian')>=15)return {state,message:'Persistent Rage does not require round-by-round extension.'};
  const immunities=activeConditionImmunities(character,state);const error=actionError(state,'bonus',immunities);if(error)return {state,message:error};
  spendActionCost(state,'bonus',immunities);markRageExtension(state);return {state,message:'Rage extended with a Bonus Action.'};
}
export function declareAttack(state:GameState,attack:CreatureAction){if(attack.type==='attack')state.turn.attackRollsMade++;if(attack.type==='attack'||attack.type==='save')markRageExtension(state)}

type LimitedCreatureAction=Extract<CreatureAction,{type:'attack'|'save'|'automatic'}>;
function actionStateKey(state:GameState,action:LimitedCreatureAction){return `${state.activeTransform?.option.id??'base'}:${action.id}`}
export function pendingActionRecharge(state:GameState,action:LimitedCreatureAction){return action.recharge?state.recharges[actionStateKey(state,action)]:undefined}
export function markActionRechargeUsed(state:GameState,action:LimitedCreatureAction){
  if(!action.recharge)return;
  state.recharges[actionStateKey(state,action)]={name:action.name,min:action.recharge.min,max:action.recharge.max};
}
export function remainingActionUses(state:GameState,action:LimitedCreatureAction){return action.uses?Math.max(0,action.uses.max-(state.actionUses[actionStateKey(state,action)]??0)):undefined}
export function markLimitedActionUsed(state:GameState,action:LimitedCreatureAction){if(action.uses)state.actionUses[actionStateKey(state,action)]=(state.actionUses[actionStateKey(state,action)]??0)+1}

export function restoreDragonWings(character:Character,state:GameState):TransitionResult{
  const sorcerer=classLevel(character,'Sorcerer');const isDraconic=sameText(subclass(character,'Sorcerer'),'Draconic Sorcery');
  if(sorcerer<14||!isDraconic)return {state,message:'This character does not have the Draconic Sorcery Dragon Wings feature.'};
  const wings=resource(state,'sorcerer-dragon-wings'),points=resource(state,'sorcery-points');if(!wings||!points)return {state,message:'Dragon Wings or Sorcery Points resource data is missing.'};
  if(wings.current>=wings.max)return {state,message:'Dragon Wings is already available.'};if(points.current<3)return {state,message:'At least 3 Sorcery Points are required to restore Dragon Wings.'};
  points.current-=3;wings.current=wings.max;return {state,message:'Spent 3 Sorcery Points to restore Dragon Wings.'};
}

export function useActionSurge(character:Character,state:GameState):TransitionResult{
  if(classLevel(character,'Fighter')<2)return {state,message:'This character has no Action Surge.'};
  if(!retainedClassFeatures(activeOption(state)))return {state,message:'The current transformation does not retain Action Surge.'};
  if(state.turn.oncePerTurn['action-surge'])return {state,message:'Action Surge can be used only once on a turn.'};
  if(!hasResource(state,'action-surge'))return {state,message:'No Action Surge uses remain.'};
  spendResource(state,'action-surge');state.turn.oncePerTurn['action-surge']=true;state.turn.surgeActionsRemaining++;
  return {state,message:'Action Surge added one action that cannot be used for the Magic action.'};
}
function restoreTurnBudget(state:GameState,advance=false){
  state.turn={number:state.turn.number+(advance?1:0),actionsRemaining:1,surgeActionsRemaining:0,bonusRemaining:1,reactionRemaining:1,slotSpellCast:false,attackRollsMade:0,oncePerTurn:{}};
  state.rage.usedThisTurn=false;state.rage.recklessDeclared=false;state.rage.extendedThisTurn=false;
}
export function startNewTurn(state:GameState,rechargeRoll=()=>rollDice('1d6').total):TransitionResult{
  restoreTurnBudget(state,true);
  const rechargeMessages:string[]=[];
  for(const [key,pending] of Object.entries(state.recharges)){
    const roll=boundedWhole(rechargeRoll(),1,1,6);
    if(roll>=pending.min){delete state.recharges[key];rechargeMessages.push(`${pending.name} recharged on ${roll}.`);}
    else rechargeMessages.push(`${pending.name} recharge rolled ${roll}; it needs ${pending.min}–${pending.max}.`);
  }
  return {state,message:`Turn ${state.turn.number} started.${rechargeMessages.length?` ${rechargeMessages.join(' ')}`:''}`};
}
export function endTurn(character:Character,state:GameState):TransitionResult{
  if(state.rage.active&&classLevel(character,'Barbarian')<15&&state.turn.number>=state.rage.endsAtTurn)return endRage(state,'Rage ended because it was not extended.');
  return {state,message:`Turn ${state.turn.number} ended.`};
}
function expiresDuringShortRest(duration:string){const value=normalized(duration);return value.includes('round')||value.includes('minute')||/(^|\D)1 hour(\D|$)/.test(value)}
export function shortRest(state:GameState):TransitionResult{
  for(const r of Object.values(state.resources)){if(r.recovery==='short-all')r.current=r.max;else if(r.recovery==='short-one')r.current=Math.min(r.max,r.current+1);}
  if(state.rage.active)endRage(state,'Rage ended during the Short Rest.');
  const expired=state.activeSpellEffects.filter(effect=>expiresDuringShortRest(effect.duration)).map(effect=>effect.name);state.activeSpellEffects=state.activeSpellEffects.filter(effect=>!expiresDuringShortRest(effect.duration));
  restoreTurnBudget(state);
  return {state,message:`Short Rest completed; eligible resources recovered and Rage ended if it was active.${expired.length?` ${expired.join(', ')} expired during the one-hour rest.`:''}`};
}
function durationPersistsThroughLongRest(duration:string|undefined){const value=normalized(duration);return value.includes('until ended')||value.includes('until dispelled')||value.includes('permanent')||value.includes('24 hour')||value.includes('day');}
export function longRest(character:Character,state:GameState):TransitionResult{
  const notes:string[]=[];
  if(state.concentration){const name=state.concentration.name;endConcentration(state,'A Long Rest ends Concentration.',character);notes.push(`${name} ended.`);}
  const active=state.activeTransform;
  if(active){
    const persists=active.permanentUntilDispelled||active.option.profile==='animal-shapes'||durationPersistsThroughLongRest(active.duration);
    if(!persists){const name=active.option.label;delete state.activeTransform;notes.push(`${name} ended during the rest.`);}
    else active.tempHpSource=false;
  }
  state.overlays=state.overlays.filter(id=>{const option=overlayOption(character,state,id);return Boolean(option&&!option.concentration&&durationPersistsThroughLongRest(option.duration));});
  const endedSpellEffects=state.activeSpellEffects.filter(effect=>!durationPersistsThroughLongRest(effect.duration));state.activeSpellEffects=state.activeSpellEffects.filter(effect=>durationPersistsThroughLongRest(effect.duration));if(endedSpellEffects.length)notes.push(`${endedSpellEffects.map(effect=>effect.name).join(', ')} ended during the rest.`);
  for(const r of Object.values(state.resources))if(r.recovery!=='manual')r.current=r.max;
  for(const slot of Object.values(state.spellSlots))slot.current=slot.max;
  state.hp=character.hp.max;state.tempHp=0;delete state.tempHpSource;
  state.rage={active:false,endsAtTurn:0,usedThisTurn:false,recklessDeclared:false,extendedThisTurn:false};state.concentrationChecks=[];clearActionRecharges(state);state.actionUses={};
  restoreTurnBudget(state);
  return {state,message:`Long Rest completed; HP, slots, and eligible resources restored. Temporary Hit Points ended. Existing conditions were preserved.${notes.length?` ${notes.join(' ')}`:''}`};
}

export function endConcentration(state:GameState,reason='Concentration ended.',character?:Character):TransitionResult{
  const name=state.concentration?.name;delete state.concentration;state.concentrationChecks=[];
  if(character){
    for(const id of [...state.overlays]){
      const overlay=overlayOption(character,state,id);
      if(overlay?.concentration&&(name===undefined||(overlay.spellName??overlay.label)===name)){
        removeOverlay(state,id);
        if(state.tempHpSource===tempHpSourceName(overlay)){state.tempHp=0;delete state.tempHpSource;}
      }
    }
  }
  if(state.activeTransform?.spellConcentration){
    const active=state.activeTransform;
    if(name===undefined||(active.option.spellName??active.option.label)===name){
      if(state.tempHpSource===tempHpSourceName(active.option)){state.tempHp=0;delete state.tempHpSource;}
      delete state.activeTransform;clearActionRecharges(state);
    }
  }
  return {state,message:name?`${name} ended. ${reason}`:reason};
}

export function useSecondWind(character:Character,state:GameState,roll:number):TransitionResult{
  const level=classLevel(character,'Fighter');if(level<1)return {state,message:'This character has no Second Wind.'};
  if(!retainedClassFeatures(activeOption(state)))return {state,message:'The current transformation does not retain Second Wind.'};
  const immunities=activeConditionImmunities(character,state);const error=actionError(state,'bonus',immunities);if(error)return {state,message:error};if(!hasResource(state,'second-wind'))return {state,message:'No Second Wind uses remain.'};
  spendActionCost(state,'bonus',immunities);spendResource(state,'second-wind');const amount=boundedWhole(roll,1,1,10)+level;const before=state.hp;state.hp=Math.min(character.hp.max,state.hp+amount);
  return {state,message:`Second Wind restored ${state.hp-before} Hit Points.`};
}
export function useLayOnHands(character:Character,state:GameState,amount:number):TransitionResult{
  if(classLevel(character,'Paladin')<1)return {state,message:'This character has no Lay On Hands.'};
  if(!retainedClassFeatures(activeOption(state)))return {state,message:'The current transformation does not retain Lay On Hands.'};
  const spend=boundedWhole(amount,1,1);const pool=resource(state,'lay-on-hands');if(!pool||pool.current<spend)return {state,message:'The Lay On Hands pool is too low.'};
  const immunities=activeConditionImmunities(character,state);const error=actionError(state,'bonus',immunities);if(error)return {state,message:error};spendActionCost(state,'bonus',immunities);spendResource(state,'lay-on-hands',spend);const before=state.hp;state.hp=Math.min(character.hp.max,state.hp+spend);
  return {state,message:`Lay On Hands restored ${state.hp-before} Hit Points and spent ${spend} points.`};
}
export function wildResurgenceError(character:Character,state:GameState,mode:'slot-to-shape'|'shape-to-slot'):string|null{
  if(classLevel(character,'Druid')<5)return 'This character has no Wild Resurgence.';
  if(!retainedClassFeatures(activeOption(state)))return 'The current transformation does not retain Wild Resurgence.';
  const pool=resource(state,'wild-shape');if(!pool)return 'Wild Shape resource is missing.';
  if(mode==='slot-to-shape'){
    if(state.turn.oncePerTurn['wild-resurgence-shape'])return 'This Wild Resurgence exchange can be used only once on a turn.';
    if(pool.current>0)return 'Available only when no Wild Shape uses remain.';
    const level=Object.keys(state.spellSlots).map(Number).filter(l=>(state.spellSlots[String(l)]?.current??0)>0).sort((a,b)=>a-b)[0];
    return level?null:'No spell slot remains to exchange.';
  }
  const exchange=resource(state,'wild-resurgence-slot');if(!exchange||exchange.current<1)return 'Unavailable again until a Long Rest.';
  if(pool.current<1)return 'No Wild Shape use remains to exchange.';
  const slot=state.spellSlots['1'];if(!slot)return 'No level 1 spell-slot pool exists on this sheet.';if(slot.current>=slot.max)return 'Level 1 spell slots are already full.';
  return null;
}
export function useWildResurgence(character:Character,state:GameState,mode:'slot-to-shape'|'shape-to-slot'):TransitionResult{
  const error=wildResurgenceError(character,state,mode);if(error)return {state,message:error};
  const pool=resource(state,'wild-shape');if(!pool)return {state,message:'Wild Shape resource is missing.'};
  if(mode==='slot-to-shape'){
    const level=Object.keys(state.spellSlots).map(Number).filter(l=>(state.spellSlots[String(l)]?.current??0)>0).sort((a,b)=>a-b)[0];
    if(!level)return {state,message:'No spell slot remains to exchange.'};consumeSpellSlot(state,level);pool.current=1;state.turn.oncePerTurn['wild-resurgence-shape']=true;return {state,message:`Expended a level ${level} spell slot to regain one Wild Shape use.`};
  }
  const exchange=resource(state,'wild-resurgence-slot');const slot=state.spellSlots['1'];if(!exchange||!slot)return {state,message:'Wild Resurgence resource data is missing.'};
  pool.current--;slot.current++;exchange.current--;return {state,message:'Expended one Wild Shape use to regain a level 1 spell slot.'};
}
export function applyCondition(character:Character,state:GameState,condition:string):TransitionResult{
  const sheet=resolveSheet(character,state);
  if(sheet.conditionImmunities.some(value=>value.toLowerCase()===condition.toLowerCase()))return {state,message:`${condition} was not applied; the current form is immune.`};
  if(!state.conditions.includes(condition))state.conditions.push(condition);
  const messages=[`${condition} applied.`];const incapacitating=['Incapacitated','Unconscious','Paralyzed','Petrified','Stunned'].includes(condition);
  if(incapacitating&&state.concentration){const name=state.concentration.name;endConcentration(state,'Incapacitation ends Concentration.',character);messages.push(`${name} ended because Concentration ended.`);}
  if(incapacitating&&state.activeTransform?.option.profile==='wildshape'){
    const name=state.activeTransform.option.label;endTransformation(state,false,character);messages.push(`${name} ended because Wild Shape ends while Incapacitated.`);
  }
  if(incapacitating){for(const id of [...state.overlays]){const overlay=overlayOption(character,state,id);if(!overlay?.effects?.endsOnIncapacitated)continue;removeOverlay(state,id);if(state.tempHpSource===tempHpSourceName(overlay)){state.tempHp=0;delete state.tempHpSource;}if(state.concentration?.name===(overlay.spellName??overlay.label))endConcentration(state,`${overlay.label} ended because of Incapacitation.`,character);messages.push(`${overlay.label} ended because the feature ends while Incapacitated.`);}}
  if(state.rage.active){const persistent=classLevel(character,'Barbarian')>=15;if((!persistent&&incapacitating)||(persistent&&condition==='Unconscious')){endRage(state);messages.push('Rage ended.');}}
  return {state,message:messages.join(' ')};
}
export function removeCondition(state:GameState,condition:string):TransitionResult{state.conditions=state.conditions.filter(c=>c!==condition);return {state,message:`${condition} removed.`};}
export function concentrationSaveMode(character:Character,state:GameState){
  const advantage:string[]=[];const disadvantage:string[]=[];
  if(character.features.some(f=>f.id==='eldritch-mind'))advantage.push('Eldritch Mind');
  if(character.feats.some(f=>f.toLowerCase()==='war caster'))advantage.push('War Caster');
  return resolveAdvantage({advantage,disadvantage});
}
export function resolveConcentrationCheck(state:GameState,total:number,character?:Character):TransitionResult{
  const pending=state.concentrationChecks.shift();if(!pending)return {state,message:'No Concentration check is pending.'};
  const resolvedTotal=boundedWhole(total,0,0);if(resolvedTotal>=pending.dc)return {state,message:`Concentration maintained with ${resolvedTotal} against DC ${pending.dc}.`};
  const name=state.concentration?.name??'Concentration';endConcentration(state,'Failed Concentration check.',character);
  return {state,message:`Concentration failed with ${resolvedTotal} against DC ${pending.dc}; ${name} ended.`};
}

export function castSpell(character:Character,state:GameState,spellName:string,castLevel?:number):TransitionResult{
  const sheet=resolveSheet(character,state);
  const spell=sheet.spells.find(s=>s.name===spellName);
  if(!spell)return {state,message:'Spell not found on the imported character sheet.'};
  if(!spell.available)return {state,message:spell.reason};
  const immunities=activeConditionImmunities(character,state);const error=actionError(state,spell.castingTime,immunities);if(error)return {state,message:error};
  const minimumLevel=spell.slotLevel??spell.level;let usedLevel=0;
  if(minimumLevel>0&&state.turn.slotSpellCast)return {state,message:'2024 rule: a spell slot has already been expended to cast a spell on this turn. You may still cast a cantrip if its action cost is available.'};
  if(minimumLevel>0){const requested=castLevel??nextSpellSlot(character,state,minimumLevel);if(requested===undefined||requested<minimumLevel)return {state,message:`No level ${minimumLevel} or higher spell slot remains.`};if(!availableSpellSlotLevels(character,state,minimumLevel).includes(requested))return {state,message:`A level ${requested} spell slot is not available.`};usedLevel=requested;}
  spendActionCost(state,spell.castingTime,immunities);if(usedLevel>0){consumeSpellSlot(state,usedLevel);state.turn.slotSpellCast=true;}
  if(spell.concentration){if(state.concentration)endConcentration(state,'A new Concentration spell was cast.',character);state.concentration={name:spell.name,source:spell.sourceClass,...(usedLevel?{castLevel:usedLevel}:{})};}
  const activeEffect=spellActiveEffect(spell);if(activeEffect){state.activeSpellEffects=state.activeSpellEffects.filter(effect=>effect.id!==activeEffect.id);state.activeSpellEffects.push({...activeEffect,name:spell.name,source:spell.sourceClass,...(usedLevel?{castLevel:usedLevel}:{})});}
  return {state,message:`Cast ${spell.name}${usedLevel>0?` using a level ${usedLevel} slot`:''}.`};
}
export function endSpellEffect(state:GameState,effectId:string):TransitionResult{
  const active=state.activeSpellEffects.find(effect=>effect.id===effectId);if(!active)return {state,message:'That spell effect is not active.'};
  state.activeSpellEffects=state.activeSpellEffects.filter(effect=>effect.id!==effectId);return {state,message:`${active.name} ended.`};
}

export function resolveAdvantage(sources:{advantage:string[];disadvantage:string[]}){
  const advantage=sources.advantage.length>0,disadvantage=sources.disadvantage.length>0;
  return {mode:advantage===disadvantage?'normal':advantage?'advantage':'disadvantage',sources};
}
export function attackRollSources(character:Character,state:GameState,action:CreatureAction,sheet?:ResolvedSheet){
  const advantage:string[]=[],disadvantage:string[]=[],conditional:string[]=[];const immunities=new Set((sheet?.conditionImmunities??[]).map(value=>normalized(value)));const active=(condition:string)=>conditionApplies(state,condition,immunities);
  if(action.type==='attack'&&state.rage.recklessDeclared&&classLevel(character,'Barbarian')>=2&&action.ability==='str')advantage.push('Reckless Attack');
  if(active('Invisible'))advantage.push('Invisible');
  if(active('Restrained'))disadvantage.push('Restrained');
  if(active('Poisoned'))disadvantage.push('Poisoned');
  if(active('Blinded'))disadvantage.push('Blinded');
  if(active('Prone'))disadvantage.push('Prone');
  if(active('Frightened'))conditional.push('Frightened imposes Disadvantage only while the source is in line of sight.');
  return {...resolveAdvantage({advantage,disadvantage}),conditional};
}
export function attackBonuses(character:Character,state:GameState,sheet:ResolvedSheet,action:CreatureAction):DamagePacket[]{
  if(action.type!=='attack')return [];
  const packets:DamagePacket[]=[];
  if(state.rage.active&&classLevel(character,'Barbarian')>=1&&action.ability==='str'&&(action.kind==='weapon'||action.kind==='unarmed'))packets.push({expression:String(rageDamage(classLevel(character,'Barbarian'))),type:action.damage[0]?.type??'Bludgeoning',label:'Rage Damage'});
  const hasPrimalStrike=character.features.some(feature=>feature.id==='primal-strike');
  if(sheet.profile==='wildshape'&&hasPrimalStrike&&classLevel(character,'Druid')>=7&&!state.turn.oncePerTurn['primal-strike']&&(action.kind==='beast'||action.kind==='weapon')){
    for(const type of ['Cold','Fire','Lightning','Thunder'] as DamageType[])packets.push({expression:classLevel(character,'Druid')>=15?'2d8':'1d8',type,label:`Optional Primal Strike — ${type}`});
  }
  if(sheet.profile==='wildshape'&&sameText(subclass(character,'Druid'),'Circle of the Moon')&&classLevel(character,'Druid')>=14&&!state.turn.oncePerTurn['lunar-form']&&action.kind==='beast')packets.push({expression:'2d10',type:'Radiant',label:'Optional Lunar Form'});
  if(sameText(state.concentration?.name,'Fount of Moonlight')&&action.range===undefined&&['beast','weapon','unarmed'].includes(action.kind))packets.push({expression:'2d6',type:'Radiant',label:'Fount of Moonlight'});
  if(classLevel(character,'Paladin')>=11&&(action.kind==='unarmed'||(action.kind==='weapon'&&action.reach!==undefined)))packets.push({expression:'1d8',type:'Radiant',label:'Radiant Strikes'});
  for(const modifier of sheet.attackDamageModifiers){
    if(!modifier.appliesTo.includes(action.kind as 'weapon'|'unarmed'))continue;
    packets.push({expression:modifier.mode==='subtract'?`-${modifier.expression}`:modifier.expression,type:action.damage[0]?.type??'Bludgeoning',label:modifier.mode==='subtract'?'Reduce damage (minimum 1)':'Enlarge damage',doubleOnCritical:modifier.mode!=='subtract'});
  }
  return packets;
}
export function markOncePerTurn(state:GameState,id:string){state.turn.oncePerTurn[id]=true}

export function rollDice(expression:string,random:()=>number=Math.random):{total:number;rolls:number[]}{
  const cleaned=expression.replace(/\s+/g,'');
  if(!/^[0-9dD+\-]+$/.test(cleaned))throw new Error('Unsafe or invalid dice expression.');
  const parts=cleaned.match(/[+-]?[^+-]+/g)??[];let total=0;const rolls:number[]=[];
  for(const part of parts){
    const sign=part.startsWith('-')?-1:1;const body=part.replace(/^[+-]/,'');
    if(/[dD]/.test(body)){
      const [countRaw,sizeRaw]=body.toLowerCase().split('d');const count=Number(countRaw),size=Number(sizeRaw);
      if(!Number.isInteger(count)||!Number.isInteger(size)||count<1||count>100||size<2||size>1000)throw new Error('Dice expression exceeds safe limits.');
      for(let i=0;i<count;i++){const r=Math.floor(random()*size)+1;rolls.push(r);total+=sign*r;}
    }else{
      const n=Number(body);if(!Number.isFinite(n)||Math.abs(n)>10000)throw new Error('Numeric modifier exceeds safe limits.');total+=sign*n;
    }
  }
  return {total,rolls};
}

export function applyDamage(state:GameState,sheet:ResolvedSheet,amount:number,type:DamageType,character?:Character):TransitionResult{
  let adjusted=boundedWhole(amount,0);const notes:string[]=[];
  if(sheet.immunities.includes(type)){adjusted=0;notes.push('Immunity reduced damage to 0.');}
  else{
    if(sheet.resistances.includes(type)){adjusted=Math.floor(adjusted/2);notes.push('Resistance halved the damage.');}
    if(sheet.vulnerabilities.includes(type)){adjusted*=2;notes.push('Vulnerability doubled the damage.');}
  }
  const absorbed=Math.min(state.tempHp,adjusted);state.tempHp-=absorbed;state.hp=Math.max(0,state.hp-(adjusted-absorbed));
  if(absorbed)notes.push(`${absorbed} absorbed by Temporary HP.`);
  const active=state.activeTransform?.option;
  if(state.tempHp===0&&active&&(active.profile==='polymorph'||active.effects?.endsAtZeroTemporaryHp)){
    const ended=active.label;delete state.activeTransform;clearActionRecharges(state);
    if(state.concentration?.name===(active.spellName??active.label)){delete state.concentration;state.concentrationChecks=[];}
    delete state.tempHpSource;notes.push(`${ended} ended because its Temporary Hit Points reached 0.`);
  }
  if(state.hp===0){
    for(const id of [...state.overlays]){
      const overlay=character?overlayOption(character,state,id):undefined;
      if(!overlay?.effects?.endsAtZeroHp&&id==='spell:gaseous-form'){removeOverlay(state,id);if(state.concentration?.name==='Gaseous Form'){delete state.concentration;state.concentrationChecks=[];}notes.push('Gaseous Form ended because Hit Points reached 0.');continue;}
      if(!overlay?.effects?.endsAtZeroHp)continue;
      removeOverlay(state,id);
      if(state.tempHpSource===tempHpSourceName(overlay)){state.tempHp=0;delete state.tempHpSource;}
      if(state.concentration?.name===(overlay.spellName??overlay.label)){delete state.concentration;state.concentrationChecks=[];}
      notes.push(`${overlay.label} ended because Hit Points reached 0.`);
    }
    if(state.activeTransform?.option.effects?.endsAtZeroHp){const ended=state.activeTransform.option.label;delete state.activeTransform;clearActionRecharges(state);notes.push(`${ended} ended because Hit Points reached 0.`);}
  }
  if(adjusted>0&&state.concentration){const dc=concentrationCheckDc(adjusted);state.concentrationChecks.push({dc,damage:adjusted,source:type});notes.push(`Concentration save DC ${dc} required.`);}
  return {state,message:`Applied ${adjusted} ${type} damage. ${notes.join(' ')}`.trim()};
}

export function heal(state:GameState,character:Character,amount:number):TransitionResult{
  const before=state.hp;state.hp=Math.min(character.hp.max,state.hp+boundedWhole(amount,0));
  return {state,message:`Recovered ${state.hp-before} Hit Points.`};
}
export function concentrationCheckDc(damageTaken:number){return Math.min(30,Math.max(10,Math.floor(boundedWhole(damageTaken,0)/2)))}
export function rulesMetadata(){return RULES_VERSION}
