import type {Ability,AttackAction,Character,ConditionEffect,CreatureAction,DamagePacket,DamageType,GameState,OwnedContentMatch,OwnedContentPack,ResolvedSheet,Spell,TransformationEffects,TransformationOption,TransitionResult} from './types.js';
import {CONDITIONS,CREATURES,classLevel,contentRegistrySnapshot} from './content-registry.js';
import {parseCharacter,safeJsonParse} from './schema.js';
import {applyDdbSrdCreatures,ddbCoverageLabel,extractDdbCharacterId,importDdbCharacter} from './dndbeyond.js';
import type {DdbImportReport} from './dndbeyond.js';
import {normalizeSrdCreature,parseSrdCatalogPage,parseSrdCatalogStatus} from './srd-catalog.js';
import type {SrdCatalogStatus} from './srd-catalog.js';
import {installExtensionPack,listExtensionPackRecords,loadArtOverride,loadBooleanSetting,optimizePortrait,removeArtOverride,removeExtensionPack,saveArtOverride,saveBooleanSetting} from './storage.js';
import {SAMPLE_CHARACTERS} from './sample-data.js';
import {FEROCITUS_CHARACTER} from './ferocitus-data.js';
import {applyOwnedContentPack,applyOwnedContentPacks,ownedContentTemplate,parseOwnedContentPack,safeOwnedContentParse} from './owned-content.js';
import {rulesAuditSnapshot} from './audit-ledger.js';
import {
  actionCostError,applyCondition,applyDamage,attackBonuses,attackRollSources,availableSpellSlotLevels,availableTransformations,boundedWhole,castSpell,criticalDiceExpression,criticalHitThreshold,
  clearConditions,completeTruePolymorph,concentrationSaveMode,createInitialState,deathSaveMode,declareAttack,declareRecklessAttack,endConcentration,endRage,endSpellEffect,endTransformation,endTurn,
  extendRage,heal,longRest,markActionRechargeUsed,markLimitedActionUsed,markOncePerTurn,pendingActionRecharge,remainingActionUses,removeCondition,resolveAdvantage,resolveConcentrationCheck,resolveDeathSave,resolveRelentlessRage,resolveSheet,resolveTempHpChoice,restoreDragonWings,rollDice,
  proficiencyBonus,rageStartError,rollAttackD20,rulesMetadata,shortRest,spellActiveEffect,spendActionCost,startNewTurn,startRage,startTransformation,useActionSurge,useLayOnHands,useSecondWind,useWildResurgence,wildResurgenceError
} from './engine.js';

const $=<T extends HTMLElement>(selector:string)=>{
  const node=document.querySelector<T>(selector);if(!node)throw new Error(`Missing UI element: ${selector}`);return node;
};
const clear=(node:HTMLElement)=>{while(node.firstChild)node.removeChild(node.firstChild)};
const text=(tag:string,value:string,className?:string)=>{const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node};
const button=(label:string,handler:()=>void,className='button secondary')=>{const node=document.createElement('button');node.type='button';node.className=className;node.textContent=label;node.addEventListener('click',handler);return node};
const signed=(value:number)=>value>=0?`+${value}`:`${value}`;
const damageTypes:DamageType[]=['Acid','Bludgeoning','Cold','Fire','Force','Lightning','Necrotic','Piercing','Poison','Psychic','Radiant','Slashing','Thunder'];
const commonConditions=Object.keys(CONDITIONS).sort((a,b)=>a.localeCompare(b));

const art:Record<string,string>={
  base:`<svg viewBox="0 0 240 210" role="img" aria-label="Base character portrait"><circle cx="120" cy="105" r="78" fill="none" stroke="#c9872b" stroke-width="3" opacity=".65"/><path d="M120 42c20 0 36 16 36 36s-16 36-36 36-36-16-36-36 16-36 36-36Zm-52 132c7-34 29-54 52-54s45 20 52 54" fill="none" stroke="#f1ede5" stroke-width="9" stroke-linecap="round"/><path d="M64 62l20 8m92-8-20 8M82 35l11 20m65-20-11 20" stroke="#c9872b" stroke-width="3"/></svg>`,
  wolf:`<svg viewBox="0 0 240 210" role="img" aria-label="Wolf form portrait"><circle cx="120" cy="105" r="80" fill="none" stroke="#c9872b" stroke-width="3" opacity=".65"/><path d="M72 63l28 15 20-10 20 10 29-15-10 46-11 40-28 25-29-25-10-40Z" fill="#29343b" stroke="#f1ede5" stroke-width="5" stroke-linejoin="round"/><path d="M96 108l16 6m32-6-16 6m-23 28h30l-15 13Z" fill="none" stroke="#c9872b" stroke-width="4" stroke-linecap="round"/><path d="M87 70 66 40l8 43m79-13 21-30-8 43" fill="#29343b" stroke="#f1ede5" stroke-width="5"/></svg>`,
  bear:`<svg viewBox="0 0 240 210" role="img" aria-label="Bear form portrait"><circle cx="120" cy="105" r="80" fill="none" stroke="#c9872b" stroke-width="3" opacity=".65"/><circle cx="78" cy="70" r="25" fill="#29343b" stroke="#f1ede5" stroke-width="5"/><circle cx="162" cy="70" r="25" fill="#29343b" stroke="#f1ede5" stroke-width="5"/><path d="M65 105c0-38 23-62 55-62s55 24 55 62-22 69-55 69-55-31-55-69Z" fill="#29343b" stroke="#f1ede5" stroke-width="5"/><ellipse cx="120" cy="132" rx="31" ry="23" fill="#171c20" stroke="#c9872b" stroke-width="4"/><circle cx="98" cy="103" r="5" fill="#c9872b"/><circle cx="142" cy="103" r="5" fill="#c9872b"/></svg>`,
  spider:`<svg viewBox="0 0 240 210" role="img" aria-label="Spider form portrait"><circle cx="120" cy="105" r="80" fill="none" stroke="#c9872b" stroke-width="3" opacity=".65"/><ellipse cx="120" cy="126" rx="34" ry="45" fill="#29343b" stroke="#f1ede5" stroke-width="5"/><circle cx="120" cy="82" r="25" fill="#29343b" stroke="#f1ede5" stroke-width="5"/><g fill="none" stroke="#f1ede5" stroke-width="6" stroke-linecap="round"><path d="M92 90 57 60 35 58M90 108 48 92 27 98M90 130 49 140 29 156M96 153 66 180 50 192M148 90l35-30 22-2M150 108l42-16 21 6M150 130l41 10 20 16M144 153l30 27 16 12"/></g><g fill="#c9872b"><circle cx="108" cy="76" r="4"/><circle cx="120" cy="72" r="4"/><circle cx="132" cy="76" r="4"/></g></svg>`,
  snake:`<svg viewBox="0 0 240 210" role="img" aria-label="Snake form portrait"><circle cx="120" cy="105" r="80" fill="none" stroke="#c9872b" stroke-width="3" opacity=".65"/><path d="M177 65c-49-25-91-4-90 27 1 29 54 22 59 50 5 31-59 36-84 10-15-15-10-38 10-48" fill="none" stroke="#f1ede5" stroke-width="18" stroke-linecap="round"/><path d="M173 64l22 1-13 18Z" fill="#29343b" stroke="#f1ede5" stroke-width="4"/><circle cx="182" cy="70" r="3.5" fill="#c9872b"/><path d="M195 74l17 7" stroke="#c9872b" stroke-width="3"/></svg>`,
  cat:`<svg viewBox="0 0 240 210" role="img" aria-label="Feline form portrait"><circle cx="120" cy="105" r="80" fill="none" stroke="#c9872b" stroke-width="3" opacity=".65"/><path d="M75 76 92 42l28 20 28-20 17 34-7 71-38 29-38-29Z" fill="#29343b" stroke="#f1ede5" stroke-width="5"/><path d="M96 106l14 5m34-5-14 5m-25 29h30" stroke="#c9872b" stroke-width="4" stroke-linecap="round"/><circle cx="98" cy="94" r="5" fill="#c9872b"/><circle cx="142" cy="94" r="5" fill="#c9872b"/></svg>`,
  bat:`<svg viewBox="0 0 240 210" role="img" aria-label="Bat form portrait"><circle cx="120" cy="105" r="80" fill="none" stroke="#c9872b" stroke-width="3" opacity=".65"/><path d="M120 92c-25-35-63-43-91-26 15 9 24 22 24 38-13 5-23 14-29 27 31-6 58 3 79 27l17-32 17 32c21-24 48-33 79-27-6-13-16-22-29-27 0-16 9-29 24-38-28-17-66-9-91 26Z" fill="#29343b" stroke="#f1ede5" stroke-width="5" stroke-linejoin="round"/><circle cx="120" cy="103" r="22" fill="#20272d" stroke="#c9872b" stroke-width="4"/></svg>`,
  horse:`<svg viewBox="0 0 240 210" role="img" aria-label="Horse form portrait"><circle cx="120" cy="105" r="80" fill="none" stroke="#c9872b" stroke-width="3" opacity=".65"/><path d="M78 164c11-24 18-50 19-81l-8-37 29 19 28-18-3 37c20 17 28 42 20 70-22 22-59 28-85 10Z" fill="#29343b" stroke="#f1ede5" stroke-width="5"/><path d="M107 107h8m18 0h8m-28 31c9 5 19 5 28 0" stroke="#c9872b" stroke-width="4" stroke-linecap="round"/></svg>`,
  goat:`<svg viewBox="0 0 240 210" role="img" aria-label="Goat form portrait"><circle cx="120" cy="105" r="80" fill="none" stroke="#c9872b" stroke-width="3" opacity=".65"/><path d="M91 77C64 57 62 33 75 20c4 24 19 35 38 42m36 15c27-20 29-44 16-57-4 24-19 35-38 42" fill="none" stroke="#f1ede5" stroke-width="7" stroke-linecap="round"/><path d="M76 82c0-25 20-39 44-39s44 14 44 39l-8 63-36 31-36-31Z" fill="#29343b" stroke="#f1ede5" stroke-width="5"/><path d="M104 109h6m20 0h6m-24 32h16" stroke="#c9872b" stroke-width="4" stroke-linecap="round"/></svg>`,
  toad:`<svg viewBox="0 0 240 210" role="img" aria-label="Toad form portrait"><circle cx="120" cy="105" r="80" fill="none" stroke="#c9872b" stroke-width="3" opacity=".65"/><ellipse cx="120" cy="128" rx="69" ry="47" fill="#29343b" stroke="#f1ede5" stroke-width="5"/><circle cx="80" cy="87" r="24" fill="#29343b" stroke="#f1ede5" stroke-width="5"/><circle cx="160" cy="87" r="24" fill="#29343b" stroke="#f1ede5" stroke-width="5"/><circle cx="80" cy="87" r="7" fill="#c9872b"/><circle cx="160" cy="87" r="7" fill="#c9872b"/><path d="M83 142c23 15 51 15 74 0" fill="none" stroke="#c9872b" stroke-width="4" stroke-linecap="round"/></svg>`
};
const BUILT_IN_FORM_ART:Record<string,string>={
  'form:brown-bear':'form-brown-bear.jpg',
  'form:dire-wolf':'form-dire-wolf.jpg',
  'form:giant-octopus':'form-giant-octopus.jpg',
  'form:giant-spider':'form-giant-spider.jpg',
  'form:lion':'form-lion.jpg',
  'form:tiger':'form-tiger.jpg',
};

const BUNDLED_CHARACTERS=[FEROCITUS_CHARACTER,...SAMPLE_CHARACTERS];
let baseCharacters:Character[]=BUNDLED_CHARACTERS.map(parseCharacter);
let baseCharacter=baseCharacters[0] as Character;
let characters:Character[]=[...baseCharacters];
let character=characters[0] as Character;
let state=createInitialState(character);
let sheet=resolveSheet(character,state);
let currentTab='actions';
let selectedOptionId='base';
const selectedOptionalBonuses=new Map<string,Set<string>>();
const selectedRollModes=new Map<string,RollMode>();
const selectedMultiattackVariants=new Map<string,string>();
const selectedSpellSlots=new Map<string,number>();
const radiantActions=new Set<string>();
let pendingTempChoice:{incoming:number;source:string}|null=null;
let magicEffectsEnabled=true;
let reduceMotion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)').matches:false;
let auraInitialized=false;
let previousTransformId:string|undefined;
let previousAuraId:string|undefined;
let auraTimer:number|undefined;
const artOverrideCache=new Map<string,string|undefined>();
const artLoading=new Set<string>();
const registrySnapshot=contentRegistrySnapshot();
const auditSnapshot=rulesAuditSnapshot();
let installedPacks:OwnedContentPack[]=[];
let pendingActiveSnapshot:Partial<GameState>['activeTransform']|undefined;
let invalidPackCount=0;
let pendingDdbImport:DdbImportReport|null=null;
let srdCatalogStatus:SrdCatalogStatus|null=null;
let srdCatalogMessage='Checking the live legal SRD support catalog...';
let formSearch='';
let formFilter='all';
let walkthroughStepIndex=0;
let walkthroughTarget:HTMLElement|undefined;
const WALKTHROUGH_SETTING='walkthrough-completed-v1';
type UiStatus='available'|'active'|'inactive'|'locked'|'unavailable'|'requirements'|'selected'|'favorite'|'new'|'importing'|'loading'|'success'|'warning'|'error';
const UI_STATUS:Record<UiStatus,{icon:string;label:string}>={
  available:{icon:'✓',label:'Available'},active:{icon:'✦',label:'Active'},inactive:{icon:'○',label:'Inactive'},
  locked:{icon:'⌁',label:'Locked'},unavailable:{icon:'×',label:'Unavailable'},requirements:{icon:'◇',label:'Requirements missing'},
  selected:{icon:'◆',label:'Selected'},favorite:{icon:'★',label:'Favorite'},new:{icon:'✧',label:'New'},
  importing:{icon:'⇩',label:'Importing'},loading:{icon:'…',label:'Loading'},success:{icon:'✓',label:'Success'},
  warning:{icon:'!',label:'Warning'},error:{icon:'×',label:'Error'},
};
const WALKTHROUGH_STEPS=[
  {selector:'.character-strip',title:'Choose your character',copy:'Switch between sample and imported characters here. Each character keeps its own validated sheet and combat state.'},
  {selector:'.transform-panel',title:'Find and choose a form',copy:'Search or filter forms, then read the Selected and Available or Locked chips before transforming.'},
  {selector:'#action-economy',title:'Check what remains this turn',copy:'These chips show Action, Bonus Action, Reaction, and spell-slot availability before you press anything.'},
  {selector:'.tabs',title:'Use the focused sheet sections',copy:'Actions, rolls, spells, features, and rule explanations stay grouped in five keyboard-friendly tabs.'},
  {selector:'.side-column',title:'Run the turn',copy:'Track damage, healing, turns, rests, conditions, and recent activity here. Help remains available from the top bar.'},
] as const;

function statusChip(status:UiStatus,label=UI_STATUS[status].label,titleText?:string){
  const meta=UI_STATUS[status];const node=document.createElement('span');node.className=`ui-status ${status}`;
  const icon=text('span',meta.icon);icon.setAttribute('aria-hidden','true');node.append(icon,document.createTextNode(label));
  node.title=titleText??label;return node;
}
function availableWalkthroughSteps(){
  return WALKTHROUGH_STEPS.flatMap(step=>{const target=document.querySelector<HTMLElement>(step.selector);return target&&!target.hidden?[{step,target}]:[];});
}
function clearWalkthroughHighlight(){
  walkthroughTarget?.classList.remove('walkthrough-target');walkthroughTarget=undefined;
}
function finishWalkthrough(message:string){
  clearWalkthroughHighlight();$('#walkthrough').hidden=true;void saveBooleanSetting(WALKTHROUGH_SETTING,true);
  $('#status-message').textContent=message;
}
function renderWalkthroughStep(){
  const available=availableWalkthroughSteps();if(available.length===0){finishWalkthrough('Walkthrough skipped because its interface targets are unavailable.');return;}
  walkthroughStepIndex=Math.max(0,Math.min(walkthroughStepIndex,available.length-1));const current=available[walkthroughStepIndex];if(!current)return;
  clearWalkthroughHighlight();walkthroughTarget=current.target;walkthroughTarget.classList.add('walkthrough-target');
  walkthroughTarget.scrollIntoView({block:'center',behavior:reduceMotion?'auto':'smooth'});
  $('#walkthrough-step').textContent=`Step ${walkthroughStepIndex+1} of ${available.length}`;
  $('#walkthrough-title').textContent=current.step.title;$('#walkthrough-copy').textContent=current.step.copy;
  const back=$<HTMLButtonElement>('#walkthrough-back');back.disabled=walkthroughStepIndex===0;
  $('#walkthrough-next').textContent=walkthroughStepIndex===available.length-1?'Finish':'Next';
}
function startWalkthrough(){
  const help=$<HTMLDialogElement>('#help-dialog');if(help.open)help.close();
  walkthroughStepIndex=0;$('#walkthrough').hidden=false;renderWalkthroughStep();$<HTMLButtonElement>('#walkthrough-next').focus();
}
function filterHelpTopics(){
  const query=$<HTMLInputElement>('#help-search').value.trim().toLowerCase();const terms=query.split(/\s+/).filter(Boolean);
  const topics=Array.from(document.querySelectorAll<HTMLDetailsElement>('.help-topic'));let visible=0;let sole:HTMLDetailsElement|undefined;
  for(const topic of topics){const content=`${topic.dataset.helpKeywords??''} ${topic.textContent??''}`.toLowerCase();const matches=terms.every(term=>content.includes(term));topic.hidden=!matches;if(matches){visible++;sole=topic;}else topic.open=false;}
  if(query&&visible===1&&sole)sole.open=true;
  $('#help-empty').hidden=visible>0;$('#help-search-status').textContent=query?`${visible} help topic${visible===1?'':'s'} found.`:`${topics.length} concise help topics.`;
}

function addActivity(message:string){state.log.unshift(message);state.log=state.log.slice(0,25);persist();}
function notify(message:string){$('#status-message').textContent=message;addActivity(message);}
function persist(){try{localStorage.setItem('altered-v0.18',JSON.stringify({baseCharacters,currentCharacterId:baseCharacter.id,state}));}catch{/* storage is optional */}}
function safeSavedText(value:unknown,fallback:string,max=200){return typeof value==='string'?value.slice(0,max):fallback;}
function savedOncePerTurn(value:unknown){
  if(typeof value!=='object'||value===null||Array.isArray(value))return {};
  return Object.fromEntries(Object.entries(value).filter(([key,used])=>key.length<=100&&typeof used==='boolean').slice(0,100));
}
function savedConcentrationCheck(value:unknown){
  if(typeof value!=='object'||value===null||Array.isArray(value))return undefined;
  const check=value as {dc?:unknown;damage?:unknown;source?:unknown};if(typeof check.dc!=='number'||!Number.isFinite(check.dc))return undefined;
  return {dc:boundedWhole(check.dc,10,1,30),damage:boundedWhole(check.damage,0,0,1_000_000),source:safeSavedText(check.source,'damage',80)};
}
function savedActionRecharges(value:unknown){
  if(typeof value!=='object'||value===null||Array.isArray(value))return {};
  const entries=Object.entries(value).slice(0,100).flatMap(([key,raw])=>{
    if(key.length>240||typeof raw!=='object'||raw===null||Array.isArray(raw))return [];
    const item=raw as {name?:unknown;min?:unknown;max?:unknown};
    if(typeof item.name!=='string'||typeof item.min!=='number'||typeof item.max!=='number')return [];
    const min=boundedWhole(item.min,1,1,6),max=boundedWhole(item.max,6,1,6);if(min>max)return [];
    return [[key,{name:item.name.slice(0,120),min,max}] as const];
  });
  return Object.fromEntries(entries);
}
function savedActionUses(value:unknown){
  if(typeof value!=='object'||value===null||Array.isArray(value))return {};
  return Object.fromEntries(Object.entries(value).filter(([key,used])=>key.length<=240&&typeof used==='number'&&Number.isFinite(used)&&used>=0).slice(0,100).map(([key,used])=>[key,boundedWhole(used,0,0,100)]));
}
function restore(){
  try{
    const raw=localStorage.getItem('altered-v0.18')??localStorage.getItem('altered-v0.17')??localStorage.getItem('altered-v0.15')??localStorage.getItem('altered-v0.9')??localStorage.getItem('altered-v0.8')??localStorage.getItem('altered-v0.4');if(!raw)return false;
    const parsed=JSON.parse(raw) as {baseCharacters?:unknown[];currentCharacterId?:string;baseCharacter?:unknown;character?:unknown;state?:Partial<GameState>};
    const library:Character[]=[];
    if(Array.isArray(parsed.baseCharacters)){for(const rawCharacter of parsed.baseCharacters.slice(0,50)){try{const entry=parseCharacter(rawCharacter);if(!library.some(existing=>existing.id===entry.id))library.push(entry);}catch{/* one damaged library entry should not block the rest */}}}
    if(library.length===0){const restored=parseCharacter(parsed.baseCharacter??parsed.character);library.push(restored);}
    for(const sample of BUNDLED_CHARACTERS.map(parseCharacter))if(!library.some(entry=>entry.id===sample.id))library.push(sample);
    baseCharacters=library;
    const requestedId=typeof parsed.currentCharacterId==='string'?parsed.currentCharacterId:typeof (parsed.baseCharacter as {id?:unknown}|undefined)?.id==='string'?String((parsed.baseCharacter as {id:string}).id):typeof (parsed.character as {id?:unknown}|undefined)?.id==='string'?String((parsed.character as {id:string}).id):library[0]?.id;
    const restored=library.find(entry=>entry.id===requestedId)??library[0];if(!restored)return false;
    const clean=createInitialState(restored);const saved=parsed.state;
    if(saved){clean.hp=boundedWhole(saved.hp,clean.hp,0,restored.hp.max);clean.tempHp=boundedWhole(saved.tempHp,0,0,9999);
      clean.exhaustionLevel=boundedWhole(saved.exhaustionLevel,Array.isArray(saved.conditions)&&saved.conditions.includes('Exhaustion')?1:0,0,6);
      clean.relentlessRageDc=boundedWhole(saved.relentlessRageDc,10,10,100);
      if(saved.life&&typeof saved.life==='object')clean.life={dead:Boolean(saved.life.dead),stable:Boolean(saved.life.stable),deathSaveSuccesses:boundedWhole(saved.life.deathSaveSuccesses,0,0,2),deathSaveFailures:boundedWhole(saved.life.deathSaveFailures,0,0,2)};
      if(saved.pendingRelentlessRage&&typeof saved.pendingRelentlessRage==='object'&&typeof saved.pendingRelentlessRage.dc==='number')clean.pendingRelentlessRage={dc:boundedWhole(saved.pendingRelentlessRage.dc,clean.relentlessRageDc,10,100),damage:boundedWhole(saved.pendingRelentlessRage.damage,0,0,1_000_000),source:damageTypes.includes(saved.pendingRelentlessRage.source as DamageType)?saved.pendingRelentlessRage.source as DamageType:'Bludgeoning'};
      if(typeof saved.tempHpSource==='string')clean.tempHpSource=saved.tempHpSource.slice(0,120);
      for(const [id,pool] of Object.entries(saved.resources??{})){const target=clean.resources[id];if(target&&pool&&typeof pool==='object')target.current=boundedWhole((pool as {current?:unknown}).current,target.current,0,target.max);}
      for(const [level,slot] of Object.entries(saved.spellSlots??{})){const target=clean.spellSlots[level];if(target&&slot&&typeof slot==='object')target.current=boundedWhole((slot as {current?:unknown}).current,target.current,0,target.max);}
      if(Array.isArray(saved.conditions))clean.conditions=saved.conditions.filter((x):x is string=>typeof x==='string'&&Object.hasOwn(CONDITIONS,x)).slice(0,20);
      if(Array.isArray(saved.overlays))clean.overlays=saved.overlays.filter((x):x is string=>typeof x==='string'&&x.length<=120).slice(0,20);
      clean.recharges=savedActionRecharges(saved.recharges);
      clean.actionUses=savedActionUses(saved.actionUses);
      if(Array.isArray(saved.log))clean.log=saved.log.filter((x):x is string=>typeof x==='string').slice(0,25).map(x=>x.slice(0,500));
      if(saved.turn&&typeof saved.turn==='object'){clean.turn={number:boundedWhole(saved.turn.number,clean.turn.number,1,1_000_000),actionsRemaining:boundedWhole(saved.turn.actionsRemaining,clean.turn.actionsRemaining,0,1),surgeActionsRemaining:boundedWhole(saved.turn.surgeActionsRemaining,clean.turn.surgeActionsRemaining,0,1),bonusRemaining:boundedWhole(saved.turn.bonusRemaining,clean.turn.bonusRemaining,0,1),reactionRemaining:boundedWhole(saved.turn.reactionRemaining,clean.turn.reactionRemaining,0,1),slotSpellCast:Boolean(saved.turn.slotSpellCast),attackRollsMade:boundedWhole(saved.turn.attackRollsMade,clean.turn.attackRollsMade,0,100),oncePerTurn:savedOncePerTurn(saved.turn.oncePerTurn)};}
      if(saved.rage&&typeof saved.rage==='object'&&typeof saved.rage.active==='boolean')clean.rage={active:saved.rage.active,endsAtTurn:boundedWhole(saved.rage.endsAtTurn,clean.rage.endsAtTurn,0,1_000_000),usedThisTurn:Boolean(saved.rage.usedThisTurn),recklessDeclared:Boolean(saved.rage.recklessDeclared),extendedThisTurn:Boolean(saved.rage.extendedThisTurn)};
      if(saved.concentration&&typeof saved.concentration.name==='string')clean.concentration={name:saved.concentration.name.slice(0,120),source:safeSavedText(saved.concentration.source,'Unknown',120)};
      if(Array.isArray(saved.activeSpellEffects))clean.activeSpellEffects=saved.activeSpellEffects.filter(effect=>effect&&typeof effect==='object'&&typeof effect.id==='string'&&typeof effect.name==='string'&&typeof effect.duration==='string'&&typeof effect.summary==='string').slice(0,20).map(effect=>({id:effect.id.slice(0,120),name:effect.name.slice(0,120),source:safeSavedText(effect.source,'Unknown',120),duration:effect.duration.slice(0,120),summary:effect.summary.slice(0,300),...(typeof effect.acMinimum==='number'?{acMinimum:boundedWhole(effect.acMinimum,10,1,40)}:{}),...(typeof effect.castLevel==='number'?{castLevel:boundedWhole(effect.castLevel,1,1,9)}:{})}));
      const legacyCheck=(saved as Partial<GameState>&{pendingConcentration?:unknown}).pendingConcentration;const normalizedLegacy=savedConcentrationCheck(legacyCheck);if(normalizedLegacy)clean.concentrationChecks=[normalizedLegacy];
      if(Array.isArray(saved.concentrationChecks))clean.concentrationChecks=saved.concentrationChecks.map(savedConcentrationCheck).filter((x):x is NonNullable<typeof x>=>Boolean(x)).slice(0,20);
      pendingActiveSnapshot=saved.activeTransform&&typeof saved.activeTransform==='object'?saved.activeTransform:undefined;const savedId=pendingActiveSnapshot?.option?.id;
      if(typeof savedId==='string'){
        const option=availableTransformations(restored,clean).find(o=>o.id===savedId);
        if(option)clean.activeTransform={option,startedTurn:boundedWhole(pendingActiveSnapshot?.startedTurn,clean.turn.number,1,1_000_000),duration:safeSavedText(pendingActiveSnapshot?.duration,'',200),tempHpSource:Boolean(pendingActiveSnapshot?.tempHpSource),...(pendingActiveSnapshot?.spellConcentration?{spellConcentration:true}:{}),...(pendingActiveSnapshot?.permanentUntilDispelled?{permanentUntilDispelled:true}:{})};
      }
    }
    baseCharacter=restored;character=restored;characters=[...baseCharacters];state=clean;return true;
  }catch{return false;}
}

function currentOption(){return availableTransformations(character,state).find(o=>o.id===selectedOptionId)}
function applyResult(result:TransitionResult){
  if(previousTransformId&&!state.activeTransform){selectedOptionId='base';radiantActions.clear();selectedOptionalBonuses.clear();selectedRollModes.clear();selectedMultiattackVariants.clear();}
  if(result.choice){pendingTempChoice={incoming:result.choice.incoming,source:result.choice.source};const dialog=$<HTMLDialogElement>('#temp-hp-dialog');$('#temp-hp-copy').textContent=`Keep the current ${result.choice.current} Temporary Hit Points or replace them with ${result.choice.incoming} from ${result.choice.source}?`;$('#keep-current-thp').textContent=`Keep ${result.choice.current}`;$('#keep-new-thp').textContent=`Use ${result.choice.incoming}`;dialog.showModal();}
  notify(result.message);render();
}
function resetLatestResult(){$('#latest-roll').classList.remove('flash');$('#roll-title').textContent='Ready';$('#roll-total').textContent='—';$('#roll-detail').textContent='Press an attack, spell, save, or skill button. Altered rolls the correct dice and modifiers automatically.';}
function setCharacter(next:Character){character=next;baseCharacter=baseCharacters.find(entry=>entry.id===next.id)??next;state=createInitialState(character);sheet=resolveSheet(character,state);selectedOptionId='base';currentTab='actions';formSearch='';formFilter='all';$<HTMLInputElement>('#form-search').value='';$<HTMLSelectElement>('#form-filter').value='all';radiantActions.clear();selectedOptionalBonuses.clear();selectedRollModes.clear();selectedMultiattackVariants.clear();selectedSpellSlots.clear();resetLatestResult();notify(`${character.name} loaded in Base Form.`);render();}
function reconcileState(next:Character,previous:GameState){
  const clean=createInitialState(next);clean.hp=Math.min(previous.hp,next.hp.max);clean.tempHp=previous.tempHp;clean.life={...previous.life};clean.exhaustionLevel=previous.exhaustionLevel;clean.relentlessRageDc=previous.relentlessRageDc;if(previous.pendingRelentlessRage)clean.pendingRelentlessRage={...previous.pendingRelentlessRage};if(previous.tempHpSource)clean.tempHpSource=previous.tempHpSource;
  for(const [id,pool] of Object.entries(clean.resources)){const old=previous.resources[id];if(old)pool.current=Math.min(old.current,pool.max);}
  for(const [level,slot] of Object.entries(clean.spellSlots)){const old=previous.spellSlots[level];if(old)slot.current=Math.min(old.current,slot.max);}
  clean.conditions=[...previous.conditions];clean.overlays=previous.overlays.filter(id=>id.startsWith('spell:')||(next.transformationGrants??[]).some(grant=>grant.id===id));clean.activeSpellEffects=previous.activeSpellEffects.map(effect=>({...effect}));clean.recharges=Object.fromEntries(Object.entries(previous.recharges).map(([key,value])=>[key,{...value}]));clean.actionUses={...previous.actionUses};clean.log=[...previous.log];clean.turn={...previous.turn,oncePerTurn:{...previous.turn.oncePerTurn}};clean.rage={...previous.rage};clean.concentrationChecks=previous.concentrationChecks.map(check=>({...check}));
  if(previous.concentration)clean.concentration={...previous.concentration};
  const previousId=previous.activeTransform?.option.id;if(previousId){const option=availableTransformations(next,clean).find(candidate=>candidate.id===previousId);if(option)clean.activeTransform={option,startedTurn:previous.activeTransform?.startedTurn??clean.turn.number,duration:previous.activeTransform?.duration??'',tempHpSource:Boolean(previous.activeTransform?.tempHpSource),...(previous.activeTransform?.spellConcentration?{spellConcentration:true}:{}),...(previous.activeTransform?.permanentUntilDispelled?{permanentUntilDispelled:true}:{})};else if(previous.activeTransform?.tempHpSource){clean.tempHp=0;delete clean.tempHpSource;if(clean.concentration?.name===(previous.activeTransform.option.spellName??previous.activeTransform.option.label))delete clean.concentration;}}
  return clean;
}

function creatureById(id?:string){return id?(character.customForms[id]??CREATURES[id]):undefined;}
function artCacheKey(targetId:string){return `${character.id}:${targetId}`;}
function artTargetInfo(){
  const active=state.activeTransform?.option;
  const selected=!active?currentOption():undefined;
  const option=active??selected;
  const form=creatureById(option?.formId);
  if(form)return {targetId:`form:${form.id}`,label:form.name,fallbackKey:form.artKey,option};
  return {targetId:'base',label:character.name,fallbackKey:'base',option};
}
function queueArtLoad(targetId:string){
  const key=artCacheKey(targetId);if(artOverrideCache.has(key)||artLoading.has(key))return;artLoading.add(key);
  void loadArtOverride(character.id,targetId).then(value=>{artOverrideCache.set(key,value);artLoading.delete(key);if(artTargetInfo().targetId===targetId)renderArt();}).catch(()=>{artOverrideCache.set(key,undefined);artLoading.delete(key);});
}
function appendPortrait(container:HTMLElement,targetId:string,fallbackKey:string,label:string,className='main-form-art'){
  const wrapper=document.createElement('div');wrapper.className=className;const key=artCacheKey(targetId);const override=artOverrideCache.get(key);
  if(override){const image=document.createElement('img');image.src=override;image.alt=`Custom artwork for ${label}`;image.loading='lazy';image.decoding='async';wrapper.append(image);}
  else{const builtIn=BUILT_IN_FORM_ART[targetId];if(builtIn){const image=document.createElement('img');image.src=builtIn;image.alt=`Built-in artwork for ${label}`;image.loading='lazy';image.decoding='async';wrapper.append(image);}else wrapper.innerHTML=art[fallbackKey]??art['base']??'';queueArtLoad(targetId);}
  container.append(wrapper);return Boolean(override);
}
function activeOverlayVisuals(){
  const options=availableTransformations(character,state);
  return state.overlays.map(id=>{
    const option=options.find(candidate=>candidate.id===id||candidate.grantId===id);
    return {id,label:(option?.label??character.transformationGrants?.find(grant=>grant.id===id)?.label??id).replace(/^End /,'')};
  });
}
function activeAuraVisual(){
  const replacement=state.activeTransform?.option;const overlays=activeOverlayVisuals();const ids=[replacement?.id,...overlays.map(overlay=>overlay.id)].filter((value):value is string=>Boolean(value));
  const labels=[replacement?.label,...overlays.map(overlay=>overlay.label)].filter((value):value is string=>Boolean(value));
  return {active:ids.length>0,id:ids.join('|')||undefined,label:labels.join(' + ')||character.name,replacement,overlays};
}
function renderArt(){
  const container=$('#form-art');clear(container);
  const aura=activeAuraVisual();const active=aura.replacement;
  const preview=!aura.active?currentOption():undefined;
  const activeForm=creatureById(active?.formId);
  const mainTarget=activeForm?{targetId:`form:${activeForm.id}`,label:activeForm.name,fallbackKey:activeForm.artKey}:{targetId:'base',label:character.name,fallbackKey:'base'};
  container.classList.toggle('is-active',aura.active);container.classList.toggle('is-base',!aura.active);
  appendPortrait(container,mainTarget.targetId,mainTarget.fallbackKey,mainTarget.label);
  if(aura.active){const pulse=document.createElement('div');pulse.className='form-aura-pulse';pulse.setAttribute('aria-hidden','true');container.append(pulse);}
  container.append(text('div',aura.active?'ACTIVE FORM':'BASE FORM','form-state '+(aura.active?'active':'base')));
  container.append(text('div',aura.label,'art-label'));
  if(!aura.active&&preview&&preview.profile!=='base'&&preview.formId){
    const form=creatureById(preview.formId);if(form){const chip=document.createElement('div');chip.className='form-preview';const icon=document.createElement('div');icon.className='form-preview-icon';appendPortrait(icon,`form:${form.id}`,form.artKey,form.name,'preview-art');const copy=document.createElement('div');copy.append(text('span','Selected form'),text('strong',preview.label));chip.append(icon,copy);container.append(chip);}
  }
  const target=artTargetInfo();$('#art-target-label').textContent=`Artwork target: ${target.label}`;
  const reset=$<HTMLButtonElement>('#reset-art');const cached=artOverrideCache.get(artCacheKey(target.targetId));reset.disabled=!cached;
}
function auraPaletteClass(){
  const active=state.activeTransform?.option;
  if(!active)return state.overlays.length?'aura-overlay':undefined;
  const form=creatureById(active.formId);
  const normalizedType=(form?.type??'').toLowerCase();
  const normalizedId=(form?.id??active.id).toLowerCase();
  const normalizedName=(form?.name??active.label).toLowerCase();
  const isMoonDruidWildshape=active.profile==='wildshape'&&character.classes.some(c=>c.name==='Druid'&&c.subclass?.toLowerCase().includes('moon'));
  if(normalizedType==='beast')return isMoonDruidWildshape?'aura-moon':'aura-beast';
  if(normalizedType==='undead')return normalizedName.includes('shadow')||normalizedId.includes('shadow')?'aura-shadow':'aura-undead';
  if(normalizedType==='fey')return 'aura-fey';
  if(normalizedType==='fiend')return 'aura-fiend';
  if(normalizedType==='celestial')return 'aura-celestial';
  if(normalizedType==='dragon')return 'aura-draconic';
  if(normalizedType==='plant')return 'aura-plant';
  if(normalizedType==='ooze')return 'aura-ooze';
  if(normalizedType==='construct')return 'aura-construct';
  if(normalizedType==='aberration')return 'aura-aberrant';
  if(normalizedType==='elemental'){
    if(/fire|flame|ember|magma|lava/.test(normalizedId)||/fire|flame|ember|magma|lava/.test(normalizedName))return 'aura-elemental-fire';
    if(/water|ice|frost|tidal|wave/.test(normalizedId)||/water|ice|frost|tidal|wave/.test(normalizedName))return 'aura-elemental-water';
    if(/air|wind|storm|lightning|thunder/.test(normalizedId)||/air|wind|storm|lightning|thunder/.test(normalizedName))return 'aura-elemental-air';
    if(/earth|stone|rock|dust|sand/.test(normalizedId)||/earth|stone|rock|dust|sand/.test(normalizedName))return 'aura-elemental-earth';
    return 'aura-elemental';
  }
  if(active.profile==='polymorph')return 'aura-arcane';
  if(active.profile==='shapechange')return 'aura-prismatic';
  if(active.profile==='wildshape')return isMoonDruidWildshape?'aura-moon':'aura-nature';
  return 'aura-overlay';
}
function scheduleAuraClassRemoval(className:string,duration:number){if(auraTimer!==undefined)window.clearTimeout(auraTimer);auraTimer=window.setTimeout(()=>{$('#app').classList.remove(className);auraTimer=undefined;},duration);}
function syncAuraState(){
  const app=$('#app');const activeTransformId=state.activeTransform?.option.id;const activeId=activeAuraVisual().id;const palette=auraPaletteClass();
  app.classList.toggle('effects-disabled',!magicEffectsEnabled);app.classList.toggle('reduce-motion',reduceMotion);app.classList.toggle('motion-forced',!reduceMotion);app.classList.toggle('form-active',Boolean(activeId));app.classList.toggle('rage-empowered',state.rage.active);
  for(const value of ['aura-moon','aura-beast','aura-nature','aura-arcane','aura-prismatic','aura-overlay','aura-rage','aura-undead','aura-shadow','aura-fey','aura-fiend','aura-celestial','aura-draconic','aura-plant','aura-ooze','aura-construct','aura-aberrant','aura-elemental','aura-elemental-fire','aura-elemental-water','aura-elemental-air','aura-elemental-earth'])app.classList.toggle(value,value===palette);
  if(!auraInitialized){previousTransformId=activeTransformId;previousAuraId=activeId;auraInitialized=true;return;}
  if(activeId&&activeId!==previousAuraId){app.classList.remove('form-dissipating');app.classList.add('form-transforming');scheduleAuraClassRemoval('form-transforming',1150);}
  else if(!activeId&&previousAuraId){app.classList.remove('form-transforming');app.classList.add('form-dissipating');scheduleAuraClassRemoval('form-dissipating',820);}
  previousTransformId=activeTransformId;previousAuraId=activeId;
}
function renderContentRegistry(target:HTMLElement,compact=false){
  clear(target);const summary=document.createElement('div');summary.className='registry-summary';
  const labels:[string,number][]=[['Audited rules',auditSnapshot.rules],['Functions',auditSnapshot.functions],['Creatures',registrySnapshot.counts.creatures],['Class rules',registrySnapshot.counts['class-features']],['Species rules',registrySnapshot.counts['species-features']],['Spells',registrySnapshot.counts.spells],['Conditions',registrySnapshot.counts.conditions],['Profiles',registrySnapshot.counts['transformation-profiles']]];
  for(const [label,count] of labels)summary.append(text('span',`${label}: ${count}`,'registry-chip'));target.append(summary);
  if(compact)return;
  for(const pack of registrySnapshot.packs){const row=document.createElement('div');row.className='content-pack';row.append(text('strong',pack.name),text('span',`v${pack.version}`),text('small',`${pack.domain} · ${pack.source} · verified ${pack.verified}`));target.append(row);}
}
function renderSettings(){
  $<HTMLInputElement>('#magic-effects-enabled').checked=magicEffectsEnabled;$<HTMLInputElement>('#reduce-motion').checked=reduceMotion;
  $('#content-registry-summary').textContent=`${auditSnapshot.rules} source-ledgered rules cover ${auditSnapshot.functions} state-changing functions (${auditSnapshot.counts.calculated} calculated, ${auditSnapshot.counts.conditional} conditional). ${registrySnapshot.packs.length} versioned built-in packs plus ${installedPacks.length} private local packs are verified through ${registrySnapshot.verifiedThrough}.`;
  renderContentRegistry($('#content-pack-list'));
  $('#srd-catalog-status').textContent=srdCatalogStatus?`${srdCatalogStatus.healthy?'Current':'Needs review'} · ${srdCatalogStatus.recordCount.toLocaleString()} legal SRD 5.2.1 support records · checked ${new Date(srdCatalogStatus.checkedAt).toLocaleString()}. The live catalog supplies relevant import data; validated built-in rules remain available offline.`:srdCatalogMessage;
}
function slug(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'private-content';}
function downloadJson(data:unknown,filename:string){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function loadHostedAccount(){
  try{
    const response=await fetch('/api/auth/me',{headers:{Accept:'application/json','X-Altered-Request':'app'},credentials:'same-origin',cache:'no-store'});
    if(!response.ok)return;
    const payload=await response.json() as {displayName?:unknown;email?:unknown};
    const displayName=typeof payload.displayName==='string'?payload.displayName.trim().slice(0,100):'';
    const email=typeof payload.email==='string'?payload.email.trim().slice(0,254):'';
    if(!displayName&&!email)return;
    const status=$('#account-status');
    $('#account-name').textContent=displayName||email;
    status.title=email?`Signed in as ${email}`:'Signed in to Altered';
    status.hidden=false;
  }catch{
    // Standalone and local builds intentionally have no hosted account route.
  }
}
function setImportStatus(message:string){$('#import-status').textContent=message;}
function setBuilderStatus(message:string){$('#builder-status').textContent=message;}
function applyImportedCharacter(parsed:Character){
  const baseIndex=baseCharacters.findIndex(entry=>entry.id===parsed.id);if(baseIndex>=0)baseCharacters[baseIndex]=parsed;else baseCharacters=[parsed,...baseCharacters];
  baseCharacter=parsed;const result=applyInstalledPacks(parsed);const imported=result.character;rebuildEffectiveCharacterLibrary(false);setCharacter(characters.find(entry=>entry.id===imported.id)??imported);
  const detail=result.applied?` Matching private packs added ${result.added.transformations} transformations, ${result.added.forms} forms, and ${result.added.features} features.`:'';
  setImportStatus(`${imported.name} imported successfully.${detail}`);return imported;
}
function renderDdbReview(report:DdbImportReport){
  const root=$('#dndbeyond-review');root.hidden=false;$('#dndbeyond-review-id').textContent=`DDB ${report.sourceId}`;
  const summary=$('#dndbeyond-review-summary');clear(summary);
  const classes=report.character.classes.map(entry=>`${entry.name} ${entry.level}`).join(' / ');
  for(const value of [report.character.name,report.character.species,classes,`HP ${report.character.hp.current}/${report.character.hp.max}`,`AC ${report.character.ac}`,`${report.character.knownForms.length} forms`,`${report.character.spells.length} spells`])summary.append(text('span',value,'ddb-summary-chip'));
  const coverage=$('#dndbeyond-coverage');clear(coverage);
  for(const item of report.coverage){const row=document.createElement('div');row.className='ddb-coverage-row';const status=statusChip(item.status==='verified'?'success':item.status==='review'?'warning':'inactive',ddbCoverageLabel(item.status));status.classList.add('ddb-coverage-status',item.status);row.append(text('strong',item.label),status,text('span',item.detail));coverage.append(row);}
  const warnings=$('#dndbeyond-warnings');clear(warnings);
  for(const item of report.warnings){const warning=document.createElement('p');warning.className=`ddb-warning ${item.severity}`;warning.append(statusChip(item.severity==='warning'?'warning':'inactive',item.severity==='warning'?'Warning':'Notice'),document.createTextNode(item.message));warnings.append(warning);}
  const confirm=$<HTMLButtonElement>('#confirm-dndbeyond-import');confirm.disabled=report.blocked;confirm.textContent=report.blocked?'2024 Rules Required':'Confirm Import';if(report.blockReason)confirm.title=report.blockReason;else confirm.removeAttribute('title');
}
async function loadSrdCreature(name:string){
  const params=new URLSearchParams({domain:'creatures',q:name,exact:'1'});
  const response=await fetch(`/api/srd/catalog?${params}`,{headers:{Accept:'application/json','X-Altered-Request':'app'},cache:'no-store'});
  const payload=await response.json() as unknown;if(!response.ok)throw new Error('SRD support catalog request failed.');
  const page=parseSrdCatalogPage(payload,'creatures');const exact=page.results.find(record=>String(record.name??'').toLowerCase()===name.toLowerCase());
  return exact?normalizeSrdCreature(exact):null;
}
async function refreshSrdCatalogStatus(){
  srdCatalogMessage='Checking the live legal SRD support catalog...';renderSettings();
  try{
    const response=await fetch('/api/srd/status',{headers:{Accept:'application/json','X-Altered-Request':'app'},cache:'no-store'});const payload=await response.json() as unknown;
    if(!response.ok)throw new Error('Catalog status request failed.');srdCatalogStatus=parseSrdCatalogStatus(payload);
    srdCatalogMessage=srdCatalogStatus.healthy?'The legal SRD support catalog is current.':'The catalog changed and needs validation before new records affect transformations.';
  }catch{srdCatalogStatus=null;srdCatalogMessage='Live SRD catalog unavailable. Altered is using its validated offline transformation rules; try Check now when connected.';}
  renderSettings();
}
async function fetchDdbCharacter(explicitSource?:string){
  const source=explicitSource??$<HTMLInputElement>('#dndbeyond-source').value;const id=extractDdbCharacterId(source);
  if(!id){setImportStatus('Enter a public D&D Beyond character link or numeric character ID.');return;}
  $<HTMLInputElement>('#dndbeyond-source').value=id;const trigger=$<HTMLButtonElement>('#fetch-dndbeyond');trigger.disabled=true;trigger.textContent='Fetching…';
  pendingDdbImport=null;$('#dndbeyond-review').hidden=true;setImportStatus(`Retrieving D&D Beyond character ${id} without account credentials…`);
  try{
    // The private hosted app authenticates same-origin API requests at its
    // edge. The worker never forwards the incoming request or its cookies to
    // D&D Beyond, so sending credentials only to Altered is both necessary and
    // contained.
    const response=await fetch(`/api/dndbeyond/character/${id}`,{headers:{Accept:'application/json','X-Altered-Request':'app'},credentials:'same-origin',cache:'no-store'});
    const body=await response.text();let payload:unknown;try{payload=JSON.parse(body);}catch{throw new Error(response.ok?'The import service returned invalid data.':'The local Altered server does not support D&D Beyond import. Restart Altered and try again.');}
    if(!response.ok){const error=typeof payload==='object'&&payload!==null&&typeof (payload as {error?:unknown}).error==='string'?(payload as {error:string}).error:`Import service returned status ${response.status}.`;throw new Error(error);}
    let report=importDdbCharacter(payload,id);
    if(report.supportRequests.creatures.length){
      trigger.textContent='Loading SRD forms...';
      try{
        const creatures=(await Promise.all(report.supportRequests.creatures.map(loadSrdCreature))).filter((entry):entry is NonNullable<typeof entry>=>Boolean(entry));
        report=applyDdbSrdCreatures(report,creatures);
      }catch{
        report.warnings.push({code:'srd-catalog-unavailable',severity:'warning',message:'The live SRD support catalog was unavailable. The character can still be imported, but selected forms missing from the offline library need review.'});
      }
    }
    pendingDdbImport=report;renderDdbReview(report);
    const reviewCount=report.coverage.filter(item=>item.status==='review').length;setImportStatus(report.blocked?report.blockReason??'This character cannot be imported into the 2024-only rules engine.':`${report.character.name} is ready for review. ${reviewCount?`${reviewCount} area${reviewCount===1?' needs':'s need'} attention before you confirm.`:'All provided core fields passed validation.'}`);
  }catch(error){
    setImportStatus(`D&D Beyond import failed: ${error instanceof Error?error.message:'Unknown error'}`);
  }finally{trigger.disabled=false;trigger.textContent='Fetch & Review';}
}
function packCounts(pack:OwnedContentPack){const c=pack.content;return `${c.transformationGrants.length} transformations · ${c.customForms.length} forms · ${c.knownForms.length} known · ${c.seenForms.length} seen · ${c.features.length} features · ${c.resources.length} resources · ${c.spells.length} spells`;}
function packMatchLabel(pack:OwnedContentPack){return pack.appliesTo.map(rule=>{const parts:string[]=[];if(rule.characterId)parts.push(`character ${rule.characterId}`);if(rule.species)parts.push(rule.species);if(rule.className)parts.push(rule.className);if(rule.subclass)parts.push(rule.subclass);if(rule.minimumClassLevel)parts.push(`level ${rule.minimumClassLevel}+`);if(rule.maximumClassLevel)parts.push(`through level ${rule.maximumClassLevel}`);return parts.join(' · ')||'all characters';}).join(' OR ');}
function renderInstalledPacks(){
  const root=$('#installed-pack-list');clear(root);$('#installed-pack-count').textContent=`${installedPacks.length} installed`;
  if(installedPacks.length===0){root.append(text('div','No private packs are installed on this device.','empty'));return;}
  for(const pack of installedPacks){
    const row=document.createElement('div');row.className='installed-pack';
    const copy=document.createElement('div');copy.append(text('strong',`${pack.metadata.name} v${pack.metadata.version}`),text('span',pack.metadata.source),text('small',`${packCounts(pack)} · Match: ${packMatchLabel(pack)}`));
    const actions=document.createElement('div');actions.className='pack-actions';
    actions.append(button('Apply',()=>{try{const result=applyOwnedContentPack(baseCharacter,pack);if(!result.applied){setImportStatus(result.notes.join(' '));return;}rebuildEffectiveCharacterLibrary(true);selectedOptionId='base';setImportStatus(`${pack.metadata.name} applied from the private library. Added ${result.added.transformations} transformations and ${result.added.forms} private forms.`);renderInstalledPacks();render();}catch(error){setImportStatus(`Could not apply pack: ${error instanceof Error?error.message:'Unknown error'}`);}},'button compact'));
    actions.append(button('Export',()=>downloadJson(pack,`${slug(pack.metadata.name)}-${slug(pack.metadata.version)}.json`),'button compact'));
    actions.append(button('Remove',()=>{void (async()=>{await removeExtensionPack(pack.metadata.id);installedPacks=await loadValidatedInstalledPacks();rebuildEffectiveCharacterLibrary(true);selectedOptionId='base';renderInstalledPacks();renderSettings();render();setImportStatus(`${pack.metadata.name} removed. The current character was rebuilt from its clean base import, so that pack’s mechanics were removed automatically.`);})();},'button compact danger'));
    row.append(copy,actions);root.append(row);
  }
}
async function loadValidatedInstalledPacks(){
  invalidPackCount=0;const valid:OwnedContentPack[]=[];
  for(const record of await listExtensionPackRecords()){
    try{valid.push(parseOwnedContentPack(record.pack));}
    catch{invalidPackCount++;await removeExtensionPack(record.id);}
  }
  return valid;
}
function applyInstalledPacks(imported:Character){const result=applyOwnedContentPacks(imported,installedPacks);return result;}
function rebuildEffectiveCharacterLibrary(preserveState=true){
  const previousId=character.id;const previousState=state;characters=baseCharacters.map(entry=>applyOwnedContentPacks(entry,installedPacks).character);
  const next=characters.find(entry=>entry.id===previousId)??characters[0];if(!next)return;character=next;baseCharacter=baseCharacters.find(entry=>entry.id===next.id)??next;state=preserveState?reconcileState(next,previousState):createInitialState(next);sheet=resolveSheet(character,state);
}
function populateBuilderClassOptions(){const select=$<HTMLSelectElement>('#builder-match-class');clear(select);for(const entry of character.classes){const option=document.createElement('option');option.value=entry.name;option.textContent=`${entry.subclass?`${entry.subclass} `:''}${entry.name} ${entry.level}`;select.append(option);}}
function numericValue(id:string){const raw=$<HTMLInputElement>(id).value.trim();if(!raw)return undefined;const value=Number(raw);if(!Number.isFinite(value))throw new Error(`${id.replace('#builder-','')} must be a number.`);return value;}
function booleanChoice(id:string){const value=$<HTMLSelectElement>(id).value;return value==='inherit'?undefined:value==='true';}
function damageList(id:string):DamageType[]{const raw=$<HTMLInputElement>(id).value.trim();if(!raw)return [];const byName=new Map(damageTypes.map(type=>[type.toLowerCase(),type]));return [...new Set(raw.split(',').map(value=>value.trim()).filter(Boolean).map(value=>{const found=byName.get(value.toLowerCase());if(!found)throw new Error(`${value} is not a supported damage type.`);return found;}))];}
function builderMatch():OwnedContentMatch{
  const mode=$<HTMLSelectElement>('#builder-match').value;const selectedClass=$<HTMLSelectElement>('#builder-match-class').value;const classEntry=character.classes.find(entry=>entry.name===selectedClass)??character.classes[0];
  if(mode==='all')return {};
  if(mode==='character')return {characterId:character.id};
  if(!classEntry)throw new Error('Choose a class for pack matching.');
  if(mode==='class')return {className:classEntry.name,minimumClassLevel:classEntry.level};
  if(!classEntry.subclass)throw new Error(`${classEntry.name} has no subclass to match.`);
  return {className:classEntry.name,subclass:classEntry.subclass,minimumClassLevel:classEntry.level};
}
function mergeAdvancedEffects(base:TransformationEffects):TransformationEffects{
  const raw=$<HTMLTextAreaElement>('#builder-advanced-effects').value.trim();if(!raw)return base;if(raw.length>30_000)throw new Error('Advanced effects JSON is too large.');const parsed=JSON.parse(raw) as unknown;if(typeof parsed!=='object'||parsed===null||Array.isArray(parsed))throw new Error('Advanced effects JSON must be one object.');return {...base,...parsed as TransformationEffects};
}
function builderRetention(){
  const preset=$<HTMLSelectElement>('#builder-retention').value;
  if(preset==='full-replacement')return {hp:true,hitDice:true,mentalAbilities:false,proficiencies:false,creatureType:false,classFeatures:false,feats:false,spellcasting:false,speech:false};
  if(preset==='wildshape-like')return {hp:true,hitDice:true,mentalAbilities:true,proficiencies:true,creatureType:true,classFeatures:true,feats:true,spellcasting:false,speech:true};
  if(preset==='shapechange-like')return {hp:true,hitDice:true,mentalAbilities:true,proficiencies:true,creatureType:true,classFeatures:false,feats:false,spellcasting:true,speech:true};
  return {hp:true,hitDice:true,mentalAbilities:true,proficiencies:true,creatureType:true,classFeatures:true,feats:true,spellcasting:true,speech:true};
}
function createPackFromBuilder():OwnedContentPack{
  const packName=$<HTMLInputElement>('#builder-pack-name').value.trim();const source=$<HTMLInputElement>('#builder-source').value.trim();const label=$<HTMLInputElement>('#builder-label').value.trim();if(!packName||!source||!label)throw new Error('Pack name, source, and transformation name are required.');
  const profile=$<HTMLSelectElement>('#builder-profile').value as TransformationOption['profile'];const formId=$<HTMLInputElement>('#builder-form-id').value.trim();
  const abilitySet:Partial<Record<Ability,number>>={};for(const abilityName of ['str','dex','con','int','wis','cha'] as Ability[]){const value=numericValue(`#builder-${abilityName}-set`);if(value!==undefined)abilitySet[abilityName]=value;}
  const speedSet:Record<string,number>={};for(const [kind,id] of [['fly','#builder-fly-speed'],['swim','#builder-swim-speed'],['climb','#builder-climb-speed']] as const){const value=numericValue(id);if(value!==undefined)speedSet[kind]=value;}
  const speedBonus:Record<string,number>={};const walkBonus=numericValue('#builder-walk-bonus');if(walkBonus) speedBonus.walk=walkBonus;
  const effects:TransformationEffects={};const size=$<HTMLSelectElement>('#builder-size').value;if(size)effects.size=size;const creatureType=$<HTMLSelectElement>('#builder-creature-type').value;if(creatureType)effects.creatureType=creatureType;if(Object.keys(abilitySet).length)effects.abilitySet=abilitySet;if(Object.keys(speedSet).length)effects.speedSet=speedSet;if(Object.keys(speedBonus).length)effects.speedBonus=speedBonus;
  const acBonus=numericValue('#builder-ac-bonus');if(acBonus)effects.acBonus=acBonus;const tempHp=numericValue('#builder-temp-hp');if(tempHp&&tempHp>0)effects.temporaryHp={mode:'fixed',value:tempHp};const resistances=damageList('#builder-resistances');if(resistances.length)effects.resistances=resistances;const immunities=damageList('#builder-immunities');if(immunities.length)effects.immunities=immunities;
  const canSpeak=booleanChoice('#builder-speak');if(canSpeak!==undefined)effects.canSpeak=canSpeak;const canCast=booleanChoice('#builder-cast');if(canCast!==undefined)effects.canCast=canCast;const canConcentrate=booleanChoice('#builder-concentrate');if(canConcentrate!==undefined)effects.canConcentrate=canConcentrate;const canAttack=booleanChoice('#builder-attack');if(canAttack!==undefined)effects.canAttack=canAttack;const canManipulate=booleanChoice('#builder-manipulate');if(canManipulate!==undefined)effects.canManipulateObjects=canManipulate;
  const finalEffects=mergeAdvancedEffects(effects);
  const customForms:unknown[]=[];const customRaw=$<HTMLTextAreaElement>('#builder-custom-form').value.trim();if(customRaw){if(customRaw.length>120_000)throw new Error('Custom form JSON is too large.');customForms.push(JSON.parse(customRaw));}
  if(formId&&!customRaw){const existing=character.customForms[formId];if(existing)customForms.push(existing);}
  const requiresForm=['wildshape','polymorph','true-polymorph','shapechange','animal-shapes'].includes(profile);if(requiresForm&&!formId)throw new Error('This replacement profile requires a replacement form ID.');if(formId&&customRaw){const candidate=customForms[0] as {id?:unknown};if(candidate?.id!==formId)throw new Error('Replacement form ID must match the id in the custom form JSON.');}
  const resourceId=$<HTMLInputElement>('#builder-resource-id').value.trim();const resourceCost=numericValue('#builder-resource-cost')??1;const resourceMax=numericValue('#builder-resource-max')??1;const existingResource=resourceId?character.resources.find(resource=>resource.id===resourceId):undefined;
  const grant:Record<string,unknown>={id:`${slug(label)}-${Date.now().toString(36)}`,label,profile,formIds:formId?[formId]:[],source,actionCost:$<HTMLSelectElement>('#builder-action').value,endActionCost:$<HTMLSelectElement>('#builder-end-action').value,duration:$<HTMLInputElement>('#builder-duration').value.trim()||'Until ended',effects:finalEffects};
  if(profile==='custom')grant.retention=builderRetention();
  if(resourceId){grant.resourceId=resourceId;grant.resourceCost=resourceCost;}
  const resources:unknown[]=[];if(resourceId&&!existingResource)resources.push({id:resourceId,name:resourceId.split('-').map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' '),current:resourceMax,max:resourceMax,recovery:$<HTMLSelectElement>('#builder-resource-recovery').value});
  const knownForms=profile==='wildshape'&&formId?[formId]:[];const seenForms=(profile==='wildshape'||profile==='shapechange'||profile==='true-polymorph')&&formId?[formId]:[];
  const rawPack={schemaVersion:1,kind:'altered-owned-content-pack',metadata:{id:`${slug(packName)}-${Date.now().toString(36)}`,name:packName,version:'1.0.0',source,description:`Private transformation mechanics for ${label}.`,privateUse:true,createdAt:new Date().toISOString()},appliesTo:[builderMatch()],content:{customForms,knownForms,seenForms,transformationGrants:[grant],features:[],resources,spells:[]}};
  return parseOwnedContentPack(rawPack);
}
async function installAndApplyPack(pack:OwnedContentPack){await installExtensionPack(pack);installedPacks=await loadValidatedInstalledPacks();const result=applyOwnedContentPack(baseCharacter,pack);rebuildEffectiveCharacterLibrary(true);selectedOptionId='base';renderInstalledPacks();render();return result;}

function renderCharacterStrip(){
  const select=$<HTMLSelectElement>('#sample-character');clear(select);
  for(const c of characters){const option=document.createElement('option');option.value=c.id;option.textContent=c.name;select.append(option);}select.value=character.id;
  $('#character-name').textContent=character.name;
  $('#character-build').textContent=`${character.species} · ${character.classes.map(c=>`${c.subclass?`${c.subclass} `:''}${c.name} ${c.level}`).join(' / ')}`;
  const meta=rulesMetadata();$('#rules-badge').textContent=`${meta.srd} · ${auditSnapshot.rules} audited rules · verified ${meta.reviewed}`;
}
function renderTransformSelector(){
  const select=$<HTMLSelectElement>('#form-select');const options=availableTransformations(character,state);
  const activeId=state.activeTransform?.option.id;
  if(activeId&&selectedOptionId==='base'&&options.some(o=>o.id===activeId))selectedOptionId=activeId;
  else if(!options.some(o=>o.id===selectedOptionId))selectedOptionId=activeId??'base';
  const search=formSearch.trim().toLowerCase();const matchesFilter=(option:TransformationOption)=>{
    const availableNow=option.usable&&(option.profile==='base'||option.id===activeId||!actionCostError(state,option.actionCost,sheet.conditionImmunities));
    if(formFilter==='usable'&&!availableNow)return false;
    if(formFilter==='wildshape'&&option.profile!=='wildshape')return false;
    if(formFilter==='spell'&&!['polymorph','true-polymorph','shapechange','animal-shapes'].includes(option.profile))return false;
    if(formFilter==='overlay'&&option.profile!=='overlay')return false;
    if(formFilter==='custom'&&option.profile!=='custom'&&!/private/i.test(option.source))return false;
    return !search||`${option.label} ${option.source} ${option.profile}`.toLowerCase().includes(search);
  };
  const matched=options.filter(matchesFilter);const visible=options.filter(option=>option.profile==='base'||option.id===selectedOptionId||option.id===activeId||matchesFilter(option));clear(select);
  const groups=new Map<string,HTMLOptGroupElement>();
  const groupName=(o:TransformationOption)=>o.profile==='base'?'Character':o.profile==='wildshape'?'Wild Shape':o.profile==='polymorph'?'Polymorph':o.profile==='true-polymorph'?'True Polymorph':o.profile==='shapechange'?'Shapechange':o.profile==='animal-shapes'?'Animal Shapes':o.profile==='overlay'?'Class, species, spell, item, and private transformations':'Custom replacement forms';
  for(const o of visible){const name=groupName(o);let group=groups.get(name);if(!group){group=document.createElement('optgroup');group.label=name;groups.set(name,group);select.append(group);}const item=document.createElement('option');item.value=o.id;item.textContent=`${o.label}${o.id===activeId?' · Active':o.usable?'':' · Locked'}`;item.title=o.id===activeId?'Currently active':o.reason??o.source;group.append(item);}
  select.value=selectedOptionId;
  const selected=options.find(o=>o.id===selectedOptionId);const active=state.activeTransform?.option;
  const economyError=selected&&selected.profile!=='base'&&selected.id!==active?.id?actionCostError(state,selected.actionCost,sheet.conditionImmunities):null;
  const results=$('#form-results-status');const hiddenSelection=Boolean(selected&&!matched.some(option=>option.id===selected.id)&&selected.profile!=='base');results.textContent=!search&&formFilter==='all'?'':`${matched.length} of ${options.length} forms shown${hiddenSelection?' · selected form retained':''}.`;
  const statuses=$('#form-status-strip');clear(statuses);
  if(selected){statuses.append(statusChip('selected'));if(selected.id===active?.id)statuses.append(statusChip('active'));else if(selected.profile==='base')statuses.append(statusChip('available','Base Form'));else if(selected.usable&&!economyError)statuses.append(statusChip('available'));else statuses.append(statusChip(selected.usable?'requirements':'locked',selected.usable?'Requirements missing':'Locked',economyError??selected.reason));if(selected.profile!=='base')statuses.append(statusChip('inactive',actionCostLabel(selected.actionCost)));}
  $('#form-reason').textContent=active&&selected?.id===active.id?`${active.label} is active. Choose another legal form to change directly, or press End Form to return to ${character.name}.`:economyError??selected?.reason??selected?.source??'';
  const transform=$<HTMLButtonElement>('#transform-button');const transformLabel=selected?.deactivate?selected.label:selected?.profile==='overlay'?'Activate':active&&selected?.id!==active.id?'Change Form':selected?.profile==='base'?'Choose a Form':'Transform';transform.textContent=economyError?`${transformLabel} — ${economyError.replace(/[.!]$/,'')}`:transformLabel;transform.disabled=!selected||!selected.usable||Boolean(economyError)||selected.profile==='base'||selected.id===active?.id;transform.hidden=Boolean(!selected||selected.profile==='base'||selected.id===active?.id);if(economyError)transform.title=economyError;else transform.removeAttribute('title');
  const end=$<HTMLButtonElement>('#end-form-button');const permanentTruePolymorph=active?.profile==='true-polymorph'&&state.activeTransform?.permanentUntilDispelled;const needsBonus=active?.profile==='wildshape'||active?.profile==='animal-shapes';const canEnd=permanentTruePolymorph||!needsBonus||state.turn.bonusRemaining>0;end.textContent=permanentTruePolymorph?'Remove Dispelled Effect':needsBonus&&!canEnd?'End Form — Bonus Action Used':'End Form';end.disabled=!active||!canEnd;end.hidden=!active;if(permanentTruePolymorph)end.title='True Polymorph cannot be ended voluntarily after the full hour. Use this only after the effect is dispelled or otherwise ended externally.';else if(active&&needsBonus&&!canEnd)end.title='Voluntarily ending this form requires a Bonus Action. Start a new turn or regain a Bonus Action first.';else end.removeAttribute('title');
}
function metric(label:string,value:string,note:string){const node=document.createElement('div');node.className='metric';node.append(text('span',label),text('strong',value),text('small',note));return node}
function healthMetric(){
  const available=state.hp+state.tempHp;
  const node=document.createElement('div');node.className='metric vitality-metric';
  const heading=document.createElement('div');heading.className='vitality-heading';
  const lifeStatus=state.life.dead?'Dead':state.pendingRelentlessRage?'Relentless Rage pending':state.life.stable?'Stable at 0 HP':state.hp===0?`${state.life.deathSaveSuccesses} successes / ${state.life.deathSaveFailures} failures`:'Damage is taken from Temporary HP first.';
  const labels=document.createElement('div');labels.append(text('span','Available Health'),text('small',lifeStatus));
  heading.append(labels,text('strong',String(available)));
  const breakdown=document.createElement('div');breakdown.className='vitality-breakdown';
  const hp=document.createElement('div');hp.className='vitality-part hp-part';hp.append(text('span','Hit Points'),text('b',`${state.hp} / ${character.hp.max}`));
  const temporary=document.createElement('div');temporary.className='vitality-part temp-part'+(state.tempHp>0?' active':'');temporary.append(text('span','Temporary HP'),text('b',String(state.tempHp)),text('small',state.tempHpSource??'None'));
  breakdown.append(hp,temporary);node.append(heading,breakdown);return node;
}
function speedText(){return Object.entries(sheet.speeds).filter(([,v])=>v!==undefined).map(([k,v])=>`${k} ${v} ft.`).join(' · ')||'0 ft.'}
function renderMetrics(){
  const grid=$('#metric-grid');clear(grid);grid.append(healthMetric(),metric('Armor Class',String(sheet.ac),sheet.acSource),metric('Speed',String(sheet.speeds.walk??0)+' ft.',speedText()));
  const economy=$('#action-economy');clear(economy);const chips:[string,number][]=[['Action',state.turn.actionsRemaining],['Surge Action',state.turn.surgeActionsRemaining],['Bonus Action',state.turn.bonusRemaining],['Reaction',state.turn.reactionRemaining]];for(const [name,count] of chips){const node=text('span',`${name}: ${count}`,'economy-chip '+(count>0?'available':'used'));economy.append(node);}const slotSpell=text('span',state.turn.slotSpellCast?'Slot spell: Used':'Slot spell: Available','economy-chip '+(state.turn.slotSpellCast?'used':'available'));slotSpell.title='2024 rule: you can expend only one spell slot to cast a spell on a turn. Cantrips do not use this limit.';economy.append(slotSpell);
  if(state.turn.actionsRemaining>0&&state.turn.bonusRemaining===0)economy.append(text('p',`Action still available: use it for an attack, another non-spell action, or a cantrip. Rage and Wild Shape each require the Bonus Action already used this turn; press New Turn before using either.${state.turn.slotSpellCast?' Another leveled spell is also blocked by the 2024 one-slot-spell-per-turn rule.':''}`,'turn-guidance'));
  $('#turn-number').textContent=`Turn ${state.turn.number}`;
}
function renderResources(){
  const strip=$('#resource-strip');clear(strip);
  for(const pool of Object.values(state.resources)){const node=document.createElement('span');node.className='resource-chip';node.append(document.createTextNode(`${pool.name} `),text('b',`${pool.current}/${pool.max}`));strip.append(node);}
  for(const [level,slot] of Object.entries(state.spellSlots)){if(slot.max>0){const node=document.createElement('span');node.className='resource-chip';node.append(document.createTextNode(`L${level} slots `),text('b',`${slot.current}/${slot.max}`));strip.append(node);}}
  if(state.concentration)strip.append(text('span',`Concentrating: ${state.concentration.name}`,'state-chip'));
  if(state.concentrationChecks.length){const next=state.concentrationChecks[0];if(next)strip.append(text('span',`Concentration check: DC ${next.dc}${state.concentrationChecks.length>1?` (+${state.concentrationChecks.length-1})`:''}`,'state-chip warning'));}
}
function isMoonDruid(){return character.classes.some(entry=>entry.name.toLowerCase()==='druid'&&(entry.subclass??'').toLowerCase()==='circle of the moon');}
function renderActiveEffects(){
  const root=$('#active-effects');clear(root);const cards:HTMLElement[]=[];
  if(state.life.dead||state.hp===0){
    const panel=document.createElement('article');panel.className='effect-card warning';
    const status=state.life.dead?'Dead':state.pendingRelentlessRage?`Relentless Rage save DC ${state.pendingRelentlessRage.dc} pending`:state.life.stable?'Stable and Unconscious':`Unconscious · Death Saves ${state.life.deathSaveSuccesses} successes / ${state.life.deathSaveFailures} failures`;
    panel.append(text('strong',status),text('small',state.life.dead?'Ordinary healing and actions are unavailable. Record a valid revival outside this tracker before continuing.':state.pendingRelentlessRage?'Resolve the Constitution save now. On a success, HP becomes twice the Barbarian level.':'At 0 HP, actions are unavailable. Healing removes Unconscious and resets Death Save marks.'));
    cards.push(panel);
  }
  if(state.exhaustionLevel>0){
    const panel=document.createElement('article');panel.className='effect-card exhaustion-effect';
    panel.append(text('strong',`Exhaustion level ${state.exhaustionLevel}`),text('span',`D20 Tests ${signed(-state.exhaustionLevel*2)} · every Speed −${state.exhaustionLevel*5} ft.`,'effect-benefit'),text('small',state.exhaustionLevel>=6?'Level 6 causes death. Actions and ordinary healing are unavailable.':'A completed Long Rest removes one level. Gaining Exhaustion again increases the level.'));
    cards.push(panel);
  }
  if(state.rage.active){
    const panel=document.createElement('article');panel.className='effect-card rage-effect';
    panel.append(text('strong','Rage is active'),text('span','B/P/S resistance · Advantage on Strength checks and saves','effect-benefit'),text('small','Spells and Concentration are blocked. Rage Damage applies only to Strength attacks with a weapon or Unarmed Strike—not beast stat-block attacks.'));
    cards.push(panel);
  }
  if(sheet.profile==='wildshape'&&isMoonDruid()){
    const circle=sheet.spells.filter(spell=>spell.specialAccess==='circle-of-the-moon');const ready=circle.filter(spell=>spell.available);
    const panel=document.createElement('article');panel.className='effect-card moon-effect';
    panel.append(text('strong',`Moon Wild Shape · ${sheet.form?.name??'Beast form'}`),text('span',`AC ${sheet.ac} · ${state.tempHp} Temporary HP${state.tempHpSource?` from ${state.tempHpSource}`:''}`,'effect-benefit'));
    panel.append(text('small',state.rage.active?'Circle spells are currently blocked by Rage. End Rage to cast them.':ready.length?`Circle spells usable in this form: ${ready.map(spell=>spell.name).join(', ')}.`:'No Circle spell can be used right now; check your Action and spell slots.'));
    panel.append(text('small',!magicEffectsEnabled?'Form aura is off. Open Settings and enable Magical form aura to show it.':reduceMotion?'Static aura is active because Reduce motion is on. Turn Reduce motion off in Settings to see the pulse.':'Animated moon aura is active around the form portrait.','effect-aura-status'));
    cards.push(panel);
  }
  if(state.concentration){
    const panel=document.createElement('article');panel.className='effect-card concentration-effect';panel.append(text('strong',`Concentrating on ${state.concentration.name}`));
    if(state.concentration.name.toLowerCase()==='fount of moonlight')panel.append(text('span','Radiant resistance · +2d6 Radiant on melee attacks','effect-benefit'));
    panel.append(text('small','Taking damage queues a Constitution saving throw. Starting Rage or another Concentration effect ends this one.'));cards.push(panel);
  }
  for(const effect of state.activeSpellEffects){
    const panel=document.createElement('article');panel.className='effect-card spell-effect';panel.append(text('strong',`${effect.name} is active`),text('span',effect.acMinimum!==undefined?`Armor Class minimum ${effect.acMinimum}`:effect.summary,'effect-benefit'),text('small',`${effect.summary} Duration: ${effect.duration}.${effect.id==='barkskin'?' This effect continues through Wild Shape. Barkskin, Wild Shape, and Rage each require a Bonus Action, so activate them on separate turns.':''}`));
    panel.append(button(`End ${effect.name}`,()=>applyResult(endSpellEffect(state,effect.id)),'button compact secondary'));cards.push(panel);
  }
  root.hidden=cards.length===0;if(cards.length){root.append(text('h3','Active now'),...cards);}
}
function renderQuickFeatures(){
  const box=$('#quick-features');clear(box);
  if(state.pendingRelentlessRage){
    const pending=state.pendingRelentlessRage;
    box.append(button(`Roll Relentless Rage · CON DC ${pending.dc}`,()=>{
      const save=resolveSheet(character,state).saves.con;const mode=resolveAdvantage({advantage:[...(save.advantageSources??[])],disadvantage:[...(save.disadvantageSources??[])]}).mode as RollMode;const result=rollD20Result(save.modifier,mode);
      showRoll(result.total,`${modeText(result)} ${signed(save.modifier)} = ${result.total} against DC ${pending.dc}.`,'Relentless Rage');
      applyResult(resolveRelentlessRage(character,state,result.total));
    },'button primary'));
    box.append(button('Decline Relentless Rage',()=>applyResult(resolveRelentlessRage(character,state))));
  }else if(state.hp===0&&!state.life.dead&&!state.life.stable){
    box.append(button('Roll Death Saving Throw',()=>{
      const rules=deathSaveMode(character,state);const result=rollD20Result(0,rules.mode);showRoll(result.kept,`${modeText(result)}. No ability modifier applies.${rules.sources.length?` ${rules.sources.join(' · ')}.`:''}`,'Death Saving Throw');applyResult(resolveDeathSave(character,state,result.kept));
    },'button primary'));
  }
  if(state.life.dead||state.hp===0)return;
  if(classLevel(character,'Barbarian')>=1){
    const rageError=state.rage.active?null:rageStartError(character,state);const rageLabel=state.rage.active?'Rage Active · End':state.turn.bonusRemaining===0?'Start Rage — Bonus Action Used':'Start Rage · Bonus Action';const rage=button(rageLabel,()=>applyResult(state.rage.active?endRage(state):startRage(character,state)),'button secondary'+(state.rage.active?' active rage-active-button':''));rage.disabled=Boolean(rageError);if(rageError)rage.title=rageError;box.append(rage);
    if(state.rage.active&&classLevel(character,'Barbarian')<15){const extendError=actionCostError(state,'bonus',sheet.conditionImmunities);const extend=button('Extend Rage · Bonus Action',()=>applyResult(extendRage(character,state)));extend.disabled=Boolean(extendError);if(extendError)extend.title=extendError;box.append(extend);}
  }
  if(classLevel(character,'Barbarian')>=2){const reckless=button(state.rage.recklessDeclared?'Reckless On':'Reckless',()=>applyResult(declareRecklessAttack(character,state)),'button secondary'+(state.rage.recklessDeclared?' active':''));box.append(reckless);}
  if(classLevel(character,'Fighter')>=1)box.append(button('Second Wind',()=>{const roll=rollDice('1d10').total;applyResult(useSecondWind(character,state,roll));}));
  if(classLevel(character,'Fighter')>=2)box.append(button('Action Surge',()=>applyResult(useActionSurge(character,state))));
  if(classLevel(character,'Paladin')>=1)box.append(button('Lay On Hands',()=>applyResult(useLayOnHands(character,state,Number($<HTMLInputElement>('#damage-amount').value)))));
  if(classLevel(character,'Druid')>=5){
    const slotToShapeError=wildResurgenceError(character,state,'slot-to-shape');const slotToShape=button('Slot → Wild Shape',()=>applyResult(useWildResurgence(character,state,'slot-to-shape')));slotToShape.disabled=Boolean(slotToShapeError);if(slotToShapeError)slotToShape.title=slotToShapeError;box.append(slotToShape);
    const shapeToSlotError=wildResurgenceError(character,state,'shape-to-slot');const shapeToSlot=button('Wild Shape → L1 Slot',()=>applyResult(useWildResurgence(character,state,'shape-to-slot')));shapeToSlot.disabled=Boolean(shapeToSlotError);if(shapeToSlotError)shapeToSlot.title=shapeToSlotError;box.append(shapeToSlot);
  }
  const dragonWings=state.resources['sorcerer-dragon-wings'];if(dragonWings&&dragonWings.current<dragonWings.max)box.append(button('3 Sorcery Points → Dragon Wings',()=>applyResult(restoreDragonWings(character,state))));
  if(state.concentrationChecks.length){const pending=state.concentrationChecks[0];if(pending)box.append(button(`Concentration DC ${pending.dc}`,()=>{const save=resolveSheet(character,state).saves.con;const rules=concentrationSaveMode(character,state);const mode=combinedMode(rules.mode as 'normal'|'advantage'|'disadvantage');const total=d20(save.modifier,mode,'Concentration save');applyResult(resolveConcentrationCheck(state,total));},'button primary'));}
  if(state.activeTransform?.option.profile==='true-polymorph'&&state.activeTransform.spellConcentration&&!state.activeTransform.permanentUntilDispelled)box.append(button('Complete 1-Hour True Polymorph',()=>applyResult(completeTruePolymorph(state)),'button primary'));
  if(state.concentration)box.append(button('End Concentration',()=>applyResult(endConcentration(state,'Ended voluntarily.',character))));
}

function card(title:string,badgeText:string,summary:string,status:UiStatus='available'){
  const node=document.createElement('article');node.className='item-card';const head=document.createElement('div');head.className='item-head';
  const indicators=document.createElement('div');indicators.className='item-head-status';const badge=text('span',badgeText,'badge');indicators.append(statusChip(status),badge);head.append(text('strong',title),indicators);
  node.append(head,text('p',summary));const options=document.createElement('div');options.className='action-options';node.append(options);const actions=document.createElement('div');actions.className='item-actions';node.append(actions);return {node,options,actions,badge};
}
type RollMode='normal'|'advantage'|'disadvantage';
interface D20Result {first:number;second?:number;kept:number;total:number;mode:RollMode;critical:boolean;naturalOne:boolean;naturalTwenty:boolean}
function rollD20Result(mod:number,mode:RollMode,criticalThreshold=20):D20Result{return rollAttackD20(mod,mode,criticalThreshold)}
function modeText(result:D20Result){return result.mode==='normal'?`d20 ${result.first}`:`${result.mode==='advantage'?'Advantage':'Disadvantage'} ${result.first}, ${result.second}; kept ${result.kept}`;}
function showRoll(total:number|string,detail:string,title='Roll result'){const panel=$('#latest-roll');$('#roll-title').textContent=title;$('#roll-total').textContent=String(total);$('#roll-detail').textContent=detail;panel.classList.remove('flash');void panel.offsetWidth;panel.classList.add('flash');addActivity(`${title}: ${detail}`);renderLog();}
function d20(mod:number,mode:RollMode,label:string,minimumD20?:number,minimumTotal?:number,minimumSource?:string){const result=rollD20Result(mod,mode);const treated=minimumD20!==undefined?Math.max(minimumD20,result.kept):result.kept;const raw=treated+mod;const total=minimumTotal!==undefined?Math.max(minimumTotal,raw):raw;const adjustments=[treated!==result.kept?`${minimumSource??'Feature'} treated ${result.kept} as ${treated}`:'',total!==raw?`${minimumSource??'Feature'} raised total ${raw} to ${total}`:''].filter(Boolean).join(' · ');showRoll(total,`${modeText(result)}${treated!==result.kept?` → ${treated}`:''} ${signed(mod)} = ${raw}${total!==raw?` → ${total}`:''}${adjustments?` · ${adjustments}`:''}`,label);return total;}
function combinedMode(rulesMode:RollMode){return rulesMode;}
function rollContext(actionId:string,rules:ReturnType<typeof attackRollSources>){
  const selected=selectedRollModes.get(actionId)??'normal';const advantage=[...rules.sources.advantage],disadvantage=[...rules.sources.disadvantage];
  if(selected==='advantage')advantage.push('Selected situational Advantage');if(selected==='disadvantage')disadvantage.push('Selected situational Disadvantage');
  const resolved=resolveAdvantage({advantage,disadvantage});return {mode:resolved.mode as RollMode,sources:resolved.sources,conditional:rules.conditional};
}
function rollModePicker(actionId:string,labelText:string){
  const label=document.createElement('label');label.className='slot-picker';label.append(text('span','Situational roll'));
  const select=document.createElement('select');select.setAttribute('aria-label',`${labelText} situational roll mode`);
  for(const [value,name] of [['normal','Use automatic rules'],['advantage','Add Advantage'],['disadvantage','Add Disadvantage']] as const){const option=document.createElement('option');option.value=value;option.textContent=name;option.selected=(selectedRollModes.get(actionId)??'normal')===value;select.append(option);}
  select.addEventListener('change',()=>selectedRollModes.set(actionId,select.value as RollMode));label.append(select);return label;
}
function initiativeModePicker(){
  const label=document.createElement('label');label.className='slot-picker';label.append(text('span','Combat start'));
  const select=document.createElement('select');select.setAttribute('aria-label','Initiative roll mode');
  for(const [value,name] of [['normal','Not surprised / automatic rules'],['advantage','Situational Advantage'],['disadvantage','Surprised (Disadvantage)']] as const){const option=document.createElement('option');option.value=value;option.textContent=name;option.selected=(selectedRollModes.get('initiative')??'normal')===value;select.append(option);}
  select.addEventListener('change',()=>selectedRollModes.set('initiative',select.value as RollMode));label.append(select);return label;
}
function rollInitiative(){
  const value=sheet.initiative;const selected=selectedRollModes.get('initiative')??'normal';const advantage=[...(value.advantageSources??[])],disadvantage=[...(value.disadvantageSources??[])];
  if(selected==='advantage')advantage.push('Selected situational Advantage');if(selected==='disadvantage')disadvantage.push('Surprised');
  const resolved=resolveAdvantage({advantage,disadvantage});const result=rollD20Result(value.modifier,resolved.mode as RollMode);
  const sources=[...advantage.map(source=>`Advantage: ${source}`),...disadvantage.map(source=>`Disadvantage: ${source}`),...(value.conditionalSources??[]).map(source=>`Conditional: ${source}`)];
  showRoll(result.total,[`${modeText(result)} ${signed(value.modifier)} = ${result.total}.`,value.source,`Initiative order stays fixed after this roll, even if you later change form.`,sources.join(' · ')].filter(Boolean).join('\n'),'Initiative');render();
}
function attackMinimum(action:CreatureAction){if(action.type!=='attack')return 0;return Math.max(0,...sheet.attackDamageModifiers.filter(modifier=>modifier.appliesTo.includes(action.kind as 'weapon'|'unarmed')).map(modifier=>modifier.minimumDamage??0));}
function packetTotal(packets:DamagePacket[],critical=false,minimum=0){let total=0;const details:string[]=[];for(const packet of packets){const expression=critical&&packet.doubleOnCritical!==false?criticalDiceExpression(packet.expression):packet.expression;const result=rollDice(expression);total+=result.total;details.push(`${packet.label??packet.type}: ${result.total} [${expression}]`);}const raw=total;total=Math.max(minimum,total);if(total!==raw)details.push(`Minimum ${minimum} damage`);return {total,detail:details.join(' + ')};}
function effectText(effect:ConditionEffect){const details=[effect.targetSizeMax?`${effect.targetSizeMax} or smaller target`:'',effect.escapeDc?`escape DC ${effect.escapeDc}`:'',effect.duration??'',effect.note??''].filter(Boolean);return `${effect.condition}${details.length?` (${details.join('; ')})`:''}`;}
function effectsText(effects:ConditionEffect[]|undefined){return effects?.map(effectText).join('; ')??'';}
function saveAbilities(action:Extract<CreatureAction,{type:'save'}>){return (action.saveAbilityOptions?.length?action.saveAbilityOptions:[action.saveAbility]).map(ability=>ability.toUpperCase()).join(' or ');}
function riderToken(id:string){return `Rider:${id}`;}
function activeRiders(action:AttackAction){const selected=optionalSet(action.id);return (action.riders??[]).filter(rider=>selected.has(riderToken(rider.id)));}
function attackRollDetail(attack:D20Result,bonus:number,threshold:number){
  if(attack.naturalOne)return `${modeText(attack)} ${signed(bonus)} = ${attack.total} — natural 1, automatic miss.`;
  if(attack.naturalTwenty)return `${modeText(attack)} ${signed(bonus)} = ${attack.total} — natural 20, automatic hit and CRITICAL HIT.`;
  if(attack.critical)return `${modeText(attack)} ${signed(bonus)} = ${attack.total} — CRITICAL HIT if the total hits AC (critical range ${threshold}–20).`;
  return `${modeText(attack)} ${signed(bonus)} = ${attack.total} to hit.`;
}
function spendForAction(action:CreatureAction){const error=spendActionCost(state,action.cost,sheet.conditionImmunities);if(error){notify(error);render();return false;}return true;}
type LimitedAction=Extract<CreatureAction,{type:'attack'|'save'|'automatic'}>;
function limitedActionStatus(action:LimitedAction){
  const recharge=pendingActionRecharge(state,action),remaining=remainingActionUses(state,action);
  return {recharge,remaining,unavailable:Boolean(recharge)||remaining===0};
}
function prepareLimitedAction(action:LimitedAction){
  const {recharge,remaining}=limitedActionStatus(action);
  if(recharge){notify(`${action.name} has not recharged; roll ${recharge.min}–${recharge.max} at the start of a turn.`);render();return false;}
  if(remaining===0){notify(`${action.name} has no uses remaining. It resets on a Long Rest.`);render();return false;}
  if(!spendForAction(action))return false;
  markActionRechargeUsed(state,action);markLimitedActionUsed(state,action);return true;
}
function actionLimitText(action:LimitedAction){const remaining=remainingActionUses(state,action);return [action.recharge?`Recharge ${action.recharge.min}–${action.recharge.max}`:'',remaining===undefined?'':`${remaining}/${action.uses?.max??remaining} uses`].filter(Boolean).join(' · ');}
function optionalSet(actionId:string){let set=selectedOptionalBonuses.get(actionId);if(!set){set=new Set<string>();selectedOptionalBonuses.set(actionId,set);}return set;}
function toggleRow(labelText:string,checked:boolean,onChange:(checked:boolean)=>void){const label=document.createElement('label');label.className='action-toggle';const input=document.createElement('input');input.type='checkbox';input.checked=checked;input.addEventListener('change',()=>onChange(input.checked));label.append(input,text('span',labelText));return label;}
function markOptionalBonus(label:string|undefined){if(label?.includes('Primal'))markOncePerTurn(state,'primal-strike');if(label?.includes('Lunar'))markOncePerTurn(state,'lunar-form');}
function resolveAttackAction(action:AttackAction){
  if(!prepareLimitedAction(action))return;sheet=resolveSheet(character,state);
  const context=rollContext(action.id,attackRollSources(character,state,action,sheet));const threshold=criticalHitThreshold(character,action,state);const attack=rollD20Result(action.attackBonus,context.mode,threshold);
  const radiant=radiantActions.has(action.id);const automatic=attackBonuses(character,state,sheet,action).filter(p=>!p.label?.startsWith('Optional'));
  const selected=optionalSet(action.id);const optional=attackBonuses(character,state,sheet,action).filter(p=>p.label?.startsWith('Optional')&&selected.has(p.label??''));
  const riders=activeRiders(action);const base=action.damage.map((packet,index)=>radiant&&index===0?{...packet,type:'Radiant' as DamageType}:packet);const allPackets=[...base,...automatic,...optional,...riders.flatMap(rider=>rider.damage??[])];const damage=attack.naturalOne?null:packetTotal(allPackets,attack.critical,attackMinimum(action));
  optional.forEach(packet=>markOptionalBonus(packet.label));declareAttack(state,action);
  const sources=[...context.sources.advantage.map(x=>`Advantage: ${x}`),...context.sources.disadvantage.map(x=>`Disadvantage: ${x}`),...context.conditional.map(x=>`Conditional: ${x}`)];
  const attackLine=attackRollDetail(attack,action.attackBonus,threshold);
  const damageLine=damage?`${damage.total} damage if the attack hits${attack.critical?' (damage dice doubled)':''}: ${damage.detail}`:'No damage roll on a natural 1.';
  const hitEffects=[...(action.effects??[]),...riders.flatMap(rider=>rider.effects??[])];const riderLines=riders.map(rider=>`${rider.label} selected: ${rider.prerequisite}`);
  showRoll(attack.naturalOne?'Natural 1':`${attack.total} to hit · ${damage?.total??0} dmg`,[attackLine,damageLine,hitEffects.length?`On a hit, apply: ${effectsText(hitEffects)}.`:'',...riderLines,sources.length?sources.join(' · '):''].filter(Boolean).join('\n'),action.name);render();
}
function resolveSaveAction(action:Extract<CreatureAction,{type:'save'}>){if(!prepareLimitedAction(action))return;const fail=packetTotal(action.damageOnFail??[]);const success=action.halfOnSuccess?{total:Math.floor(fail.total/2),detail:`${Math.floor(fail.total/2)} (half of the failed-save roll, rounded down)`}:packetTotal(action.damageOnSuccess??[]);declareAttack(state,action);const total=fail.total?`${fail.total} fail dmg`:'Effect';const detail=[`Target makes a DC ${action.dc} ${saveAbilities(action)} save.`,fail.detail?`Failed save: ${fail.detail}.`:'',action.effectsOnFail?.length?`Failed-save effects: ${effectsText(action.effectsOnFail)}.`:!fail.detail?'Apply the listed failed-save effect.':'',success.detail?`Successful save: ${success.detail}.`:'Successful save: no listed failed-save damage or effects.',action.notes??''].filter(Boolean).join('\n');showRoll(total,detail,action.name);render();}
function resolveAutomaticAction(action:Extract<CreatureAction,{type:'automatic'}>){if(!prepareLimitedAction(action))return;const result=packetTotal(action.damage??[]);const detail=[action.prerequisite?`Prerequisite: ${action.prerequisite}`:'',result.detail?`${action.damageTiming??'Listed damage'}: ${result.detail}.`:action.damage?.length?'Listed damage did not resolve.':'Effect activated.',action.effects?.length?`Effects: ${effectsText(action.effects)}.`:'',action.notes??''].filter(Boolean).join('\n');showRoll(result.total||'Activated',detail,action.name);render();}
function multiattackSequence(action:Extract<CreatureAction,{type:'multiattack'}>){const selected=selectedMultiattackVariants.get(action.id);return action.variants?.find(variant=>variant.id===selected)?.sequence??action.sequence;}
function resolveMultiattack(action:Extract<CreatureAction,{type:'multiattack'}>){
  if(!spendForAction(action))return;const lines:string[]=[];const headlines:string[]=[];let combinedDamage=0;
  for(const id of multiattackSequence(action)){
    const child=sheet.actions.find(candidate=>candidate.id===id);if(!child||child.type==='multiattack')continue;
    const status=limitedActionStatus(child);if(status.unavailable){lines.push(`${child.name}: unavailable (${status.recharge?'recharging':'no uses remaining'})`);continue;}
    markActionRechargeUsed(state,child);markLimitedActionUsed(state,child);
    if(child.type==='attack'){
      const context=rollContext(child.id,attackRollSources(character,state,child,sheet));const threshold=criticalHitThreshold(character,child,state);const attack=rollD20Result(child.attackBonus,context.mode,threshold);
      const bonuses=attackBonuses(character,state,sheet,child),automatic=bonuses.filter(packet=>!packet.label?.startsWith('Optional')),selected=optionalSet(child.id),optional=bonuses.filter(packet=>packet.label?.startsWith('Optional')&&selected.has(packet.label??'')),riders=activeRiders(child),radiant=radiantActions.has(child.id);
      const base=child.damage.map((packet,index)=>radiant&&index===0?{...packet,type:'Radiant' as DamageType}:packet),damage=attack.naturalOne?null:packetTotal([...base,...automatic,...optional,...riders.flatMap(rider=>rider.damage??[])],attack.critical,attackMinimum(child));optional.forEach(packet=>markOptionalBonus(packet.label));
      combinedDamage+=damage?.total??0;headlines.push(`${child.name}: ${attack.naturalOne?'Natural 1 miss':`${attack.total} to hit`}`);const sources=[...context.sources.advantage.map(value=>`Advantage: ${value}`),...context.sources.disadvantage.map(value=>`Disadvantage: ${value}`),...context.conditional.map(value=>`Conditional: ${value}`)],hitEffects=[...(child.effects??[]),...riders.flatMap(rider=>rider.effects??[])];
      lines.push(`${child.name} attack roll: ${attackRollDetail(attack,child.attackBonus,threshold)}\n${damage?`${child.name} damage if it hits: ${damage.total} (${damage.detail}).`:'No damage roll on a natural 1.'}${hitEffects.length?`\nOn a hit, apply: ${effectsText(hitEffects)}.`:''}${riders.length?`\n${riders.map(rider=>`${rider.label}: ${rider.prerequisite}`).join(' · ')}`:''}${sources.length?`\n${sources.join(' · ')}`:''}`);declareAttack(state,child);
    }else if(child.type==='save'){const fail=packetTotal(child.damageOnFail??[]);const success=child.halfOnSuccess?{total:Math.floor(fail.total/2),detail:'half the failed-save roll, rounded down'}:packetTotal(child.damageOnSuccess??[]);combinedDamage+=fail.total;headlines.push(`${child.name}: DC ${child.dc} ${saveAbilities(child)}`);lines.push(`${child.name}: target makes a DC ${child.dc} ${saveAbilities(child)} save.${fail.total?`\nFailed-save damage: ${fail.total} (${fail.detail}).`:''}${child.effectsOnFail?.length?`\nFailed-save effects: ${effectsText(child.effectsOnFail)}.`:''}${success.total?`\nSuccessful-save damage: ${success.total} (${success.detail}).`:'\nSuccess: no listed failed-save damage or effects.'}`);declareAttack(state,child);}
    else{const result=packetTotal(child.damage??[]);combinedDamage+=result.total;headlines.push(`${child.name}: activated`);lines.push(`${child.name}: ${[result.detail,child.effects?.length?`Effects: ${effectsText(child.effects)}.`:'',child.notes].filter(Boolean).join(' ')||'effect activated'}`);}
  }
  const potential=combinedDamage?`Potential damage if every attack hits and every save fails: ${combinedDamage}.`:'';showRoll(headlines.join(' · ')||'Resolved',[...lines,...(potential?[potential]:[]),...(action.notes?[action.notes]:[])].join('\n\n')||'Multiattack resolved.',action.name);render();
}
function actionCostLabel(cost:CreatureAction['cost']|Spell['castingTime']){
  if(cost==='magic-action')return 'Magic Action';
  if(cost==='bonus')return 'Bonus Action';
  if(cost==='reaction')return 'Reaction';
  if(cost==='free'||cost==='none')return 'No action';
  return 'Action';
}
function renderActions(){
  const root=$('#tab-content');clear(root);root.append(text('p','Choose an action below. A used Action, Bonus Action, or Reaction is disabled until the next turn so it is always clear what is still available.','tab-help'));
  if(sheet.actions.length===0){root.append(text('div','No actions are defined for this form.','empty'));return;}
  for(const action of sheet.actions){
    const economyError=actionCostError(state,action.cost,sheet.conditionImmunities);
    if(action.type==='attack'){
      const limit=limitedActionStatus(action);const blocked=limit.unavailable||Boolean(economyError);const limitText=actionLimitText(action);const description=[`${signed(action.attackBonus)} to hit`,action.damage.map(packet=>`${packet.expression} ${packet.type}`).join(' + '),action.effects?.length?`On hit: ${effectsText(action.effects)}`:'',limitText,action.notes,economyError].filter(Boolean).join(' · ');const c=card(action.name,limit.recharge?'Recharging':limit.remaining===0?'Expended':actionCostLabel(action.cost),description,blocked?(limit.unavailable?'locked':'requirements'):'available');if(blocked)c.badge.className='badge inactive';
      c.options.append(rollModePicker(action.id,action.name));
      const radiantEligible=sheet.profile==='wildshape'&&classLevel(character,'Druid')>=6&&action.kind==='beast';if(radiantEligible)c.options.append(toggleRow('Use Radiant damage for this attack',radiantActions.has(action.id),checked=>{checked?radiantActions.add(action.id):radiantActions.delete(action.id);}));
      for(const bonus of attackBonuses(character,state,sheet,action).filter(packet=>packet.label?.startsWith('Optional'))){const label=bonus.label??'Optional damage';c.options.append(toggleRow(`${label} (${bonus.expression} ${bonus.type})`,optionalSet(action.id).has(label),checked=>{const set=optionalSet(action.id);checked?set.add(label):set.delete(label);}));}
      for(const rider of action.riders??[]){const token=riderToken(rider.id);c.options.append(toggleRow(`${rider.label}: ${rider.prerequisite}`,optionalSet(action.id).has(token),checked=>{const set=optionalSet(action.id);checked?set.add(token):set.delete(token);}));}
      const label=limit.recharge?`Awaiting ${limit.recharge.min}–${limit.recharge.max}`:limit.remaining===0?'No uses remaining':economyError??`Roll ${action.name}`;const use=button(label,()=>resolveAttackAction(action),blocked?'button secondary action-roll':'button primary action-roll');use.disabled=blocked;c.actions.append(use);root.append(c.node);
    }else if(action.type==='save'){
      const limit=limitedActionStatus(action);const blocked=limit.unavailable||Boolean(economyError);const damage=action.damageOnFail?.map(packet=>`${packet.expression} ${packet.type}`).join(' + ')||'Effect on failed save';const detail=[damage,action.halfOnSuccess?'Half damage on a successful save (rounded down)':'',action.effectsOnFail?.length?`On failure: ${effectsText(action.effectsOnFail)}`:'',actionLimitText(action),action.notes,economyError].filter(Boolean).join(' · ');const c=card(action.name,limit.recharge?'Recharging':limit.remaining===0?'Expended':`${actionCostLabel(action.cost)} · DC ${action.dc} ${saveAbilities(action)}`,detail,blocked?(limit.unavailable?'locked':'requirements'):'available');if(blocked)c.badge.className='badge inactive';const label=limit.recharge?`Awaiting ${limit.recharge.min}–${limit.recharge.max}`:limit.remaining===0?'No uses remaining':economyError??`Use ${action.name}`;const use=button(label,()=>resolveSaveAction(action),blocked?'button secondary action-roll':'button primary action-roll');use.disabled=blocked;c.actions.append(use);root.append(c.node);
    }else if(action.type==='multiattack'){
      const names=multiattackSequence(action).map(id=>sheet.actions.find(candidate=>candidate.id===id)?.name??id);const c=card(action.name,actionCostLabel(action.cost),`Rolls each component separately with its own attack roll or saving throw: ${names.join(' → ')}. Damage, critical hits, and on-hit effects are shown per component. Optional choices configured on the individual attack cards are applied when eligible.${action.notes?` ${action.notes}`:''}${economyError?` · ${economyError}`:''}`,economyError?'requirements':'available');if(economyError)c.badge.className='badge inactive';
      if(action.variants?.length){const label=document.createElement('label');label.className='slot-picker';label.append(text('span','Multiattack option'));const select=document.createElement('select');select.setAttribute('aria-label',`${action.name} option`);const standard=document.createElement('option');standard.value='';standard.textContent=action.sequence.map(id=>sheet.actions.find(candidate=>candidate.id===id)?.name??id).join(' + ');select.append(standard);for(const variant of action.variants){const option=document.createElement('option');option.value=variant.id;option.textContent=variant.label;option.selected=selectedMultiattackVariants.get(action.id)===variant.id;select.append(option);}select.addEventListener('change',()=>{selectedMultiattackVariants.set(action.id,select.value);renderActions();});label.append(select);c.options.append(label);}
      const use=button(economyError??`Roll ${action.name}`,()=>resolveMultiattack(action),economyError?'button secondary action-roll':'button primary action-roll');use.disabled=Boolean(economyError);c.actions.append(use);root.append(c.node);
    }else{
      const limit=limitedActionStatus(action);const blocked=limit.unavailable||Boolean(economyError);const detail=[action.prerequisite,action.damage?.length?`${action.damageTiming??'Listed damage'}: ${action.damage.map(packet=>`${packet.expression} ${packet.type}`).join(' + ')}`:'',action.effects?.length?`Effects: ${effectsText(action.effects)}`:'',actionLimitText(action),action.notes,economyError].filter(Boolean).join(' · ');const c=card(action.name,limit.recharge?'Recharging':limit.remaining===0?'Expended':actionCostLabel(action.cost),detail,blocked?(limit.unavailable?'locked':'requirements'):'available');if(blocked)c.badge.className='badge inactive';const label=limit.recharge?`Awaiting ${limit.recharge.min}–${limit.recharge.max}`:limit.remaining===0?'No uses remaining':economyError??`Use ${action.name}`;const use=button(label,()=>resolveAutomaticAction(action),blocked?'button secondary action-roll':'button primary action-roll');use.disabled=blocked;c.actions.append(use);root.append(c.node);
    }
  }
}
function renderRolls(){
  const root=$('#tab-content');clear(root);const initiative=sheet.initiative;const initiativeSource=sheet.form?`Current form: ${sheet.form.name}. ${initiative.source}.`:`Base form. ${initiative.source}.`;const initiativeCard=card(`Initiative ${signed(initiative.modifier)}`,sheet.form?.name??'Base Form',`${initiativeSource} Initiative is a Dexterity check when combat starts. If you transform after rolling, keep the existing Initiative order.`);
  initiativeCard.options.append(initiativeModePicker());initiativeCard.actions.append(button('Roll Initiative',rollInitiative,'button primary action-roll'));root.append(text('h3','Initiative'),initiativeCard.node);
  const saveTitle=text('h3','Saving Throws');root.append(saveTitle);const saves=document.createElement('div');saves.className='roll-grid';
  for(const value of Object.values(sheet.saves)){const row=document.createElement('div');row.className='roll-row';const info=document.createElement('div');const ruleMode=resolveAdvantage({advantage:value.advantageSources??[],disadvantage:value.disadvantageSources??[]}).mode as 'normal'|'advantage'|'disadvantage';const notes=[value.source,...(value.advantageSources?.length?[`Advantage: ${value.advantageSources.join(', ')}`]:[]),...(value.disadvantageSources?.length?[`Disadvantage: ${value.disadvantageSources.join(', ')}`]:[]),...(value.minimumTotal!==undefined?[`${value.minimumSource}: minimum total ${value.minimumTotal}`]:[]),...(value.automaticFailure?[value.automaticFailure]:[])];info.append(text('strong',`${value.name} ${signed(value.modifier)}`),text('small',notes.join(' · ')));const roll=button(value.automaticFailure?'Automatic Failure':'Roll',()=>d20(value.modifier,combinedMode(ruleMode),value.name,value.minimumD20,value.minimumTotal,value.minimumSource),'button compact');roll.disabled=Boolean(value.automaticFailure);row.append(info,roll);saves.append(row);}root.append(saves,text('h3','Skills'));
  const skills=document.createElement('div');skills.className='roll-grid';for(const value of Object.values(sheet.skills).sort((a,b)=>a.name.localeCompare(b.name))){const row=document.createElement('div');row.className='roll-row';const info=document.createElement('div');const ruleMode=resolveAdvantage({advantage:value.advantageSources??[],disadvantage:value.disadvantageSources??[]}).mode as 'normal'|'advantage'|'disadvantage';const detail=[value.source,...(value.advantageSources?.length?[`Advantage: ${value.advantageSources.join(', ')}`]:[]),...(value.disadvantageSources?.length?[`Disadvantage: ${value.disadvantageSources.join(', ')}`]:[]),...(value.conditionalSources?.length?[`Conditional: ${value.conditionalSources.join(', ')}`]:[]),...(value.minimumD20!==undefined?[`${value.minimumSource}: d20 minimum ${value.minimumD20}`]:[]),...(value.minimumTotal!==undefined?[`${value.minimumSource}: total minimum ${value.minimumTotal}`]:[]),...(value.alternate?[`Alternate ${signed(value.alternate.modifier)}: ${value.alternate.source}`]:[])].join(' · ');info.append(text('strong',`${value.name} ${signed(value.modifier)}`),text('small',detail));const actions=document.createElement('div');actions.className='inline-actions';actions.append(button('Roll',()=>d20(value.modifier,combinedMode(ruleMode),value.name,value.minimumD20,value.minimumTotal,value.minimumSource),'button compact'));if(value.alternate)actions.append(button('Use STR',()=>d20(value.alternate?.modifier??value.modifier,combinedMode(ruleMode),`${value.name} (Strength)`,value.alternate?.minimumD20,value.alternate?.minimumTotal,value.alternate?.minimumSource),'button compact'));row.append(info,actions);skills.append(row);}root.append(skills);
}

function spellAttackModifier(spell:Spell){const current=Math.floor((sheet.abilities[spell.ability]-10)/2);const base=Math.floor((character.abilities[spell.ability]-10)/2);return spell.attackBonus!==undefined?spell.attackBonus+current-base:proficiencyBonus(character.totalLevel)+current;}
function spellSaveDc(spell:Spell){const current=Math.floor((sheet.abilities[spell.ability]-10)/2);const base=Math.floor((character.abilities[spell.ability]-10)/2);return spell.saveDc!==undefined?spell.saveDc+current-base:8+proficiencyBonus(character.totalLevel)+current;}
function scaledSpell(spell:Spell,castLevel:number){
  const minimum=spell.slotLevel??spell.level;const extra=Math.max(0,castLevel-minimum);const damage=[...(spell.damage??[])];for(let i=0;i<extra;i++)for(const packet of spell.higherSlotDamage??[])damage.push({...packet,label:packet.label??`Higher slot +${i+1}`});
  const healing=spell.healing&&spell.higherSlotHealing&&extra>0?[spell.healing,...Array(extra).fill(spell.higherSlotHealing)].join('+'):spell.healing;
  return {...spell,...(damage.length?{damage}:{}),...(healing?{healing}:{})};
}
function spellKey(spell:Spell){return `${spell.sourceClass.toLowerCase()}:${spell.name.toLowerCase()}`;}
function chosenSpellLevel(spell:Spell){
  const minimum=spell.slotLevel??spell.level;if(minimum===0)return 0;const levels=availableSpellSlotLevels(character,state,minimum);const selected=selectedSpellSlots.get(spellKey(spell));return selected!==undefined&&levels.includes(selected)?selected:(levels[0]??minimum);
}
function resolveSpellEffect(baseSpell:Spell,castLevel=baseSpell.slotLevel??baseSpell.level){
  const spell=scaledSpell(baseSpell,castLevel);
  if(spell.attackBonus!==undefined){const pseudo:AttackAction={id:`spell-${spell.name}`,name:spell.name,type:'attack',cost:'none',attackBonus:spellAttackModifier(spell),ability:spell.ability,kind:'spell',damage:spell.damage??[]};const context=rollContext(pseudo.id,attackRollSources(character,state,pseudo,sheet));const attack=rollD20Result(pseudo.attackBonus,context.mode);const damage=attack.naturalOne?null:packetTotal(spell.damage??[],attack.critical);declareAttack(state,pseudo);const sources=[...context.sources.advantage.map(value=>`Advantage: ${value}`),...context.sources.disadvantage.map(value=>`Disadvantage: ${value}`),...context.conditional.map(value=>`Conditional: ${value}`)];showRoll(attack.naturalOne?'Natural 1':`${attack.total} to hit · ${damage?.total??0} dmg`,`${attackRollDetail(attack,pseudo.attackBonus,20)}
${damage?`${damage.total} damage if hit: ${damage.detail}`:'No damage roll on a natural 1.'}${spell.summary?`\nSpell effect: ${spell.summary}`:''}${sources.length?`\n${sources.join(' · ')}`:''}`,spell.name);return;}
  if(spell.healing){const healing=rollDice(spell.healing);showRoll(`${healing.total} healing`,`${spell.healing} = ${healing.total}. Apply it to the chosen target.${spell.summary?`\n${spell.summary}`:''}`,spell.name);return;}
  if(spell.damage?.length&&spell.resolution==='manual'){showRoll('Manual',spell.summary??'Resolve this conditional effect from your source.',spell.name);return;}
  if(spell.damage?.length){const damage=packetTotal(spell.damage);const save=spell.saveAbility?`DC ${spellSaveDc(spell)} ${spell.saveAbility.toUpperCase()} save`:`DC ${spellSaveDc(spell)} save`;const success=spell.halfOnSave?` Success: ${Math.floor(damage.total/2)} damage.`:'';showRoll(`${damage.total} effect dmg`,`${spell.resolution==='automatic'?`No attack roll or saving throw is required. ${damage.detail}`:`${save}. Failure: ${damage.total} damage.${success} ${damage.detail}`}${spell.summary?`\n${spell.summary}`:''}`,spell.name);return;}
  showRoll('Cast',spell.summary??'Spell effect activated.',spell.name);
}
function castAndResolveSpell(spell:Spell&{available:boolean;reason:string}){const castLevel=chosenSpellLevel(spell);const result=castSpell(character,state,spell.name,castLevel||undefined);const success=result.message.startsWith('Cast ');applyResult(result);if(!success)return;const immediate=spell.resolution!=='manual'&&(spell.attackBonus!==undefined||Boolean(spell.healing)||(!spell.concentration&&Boolean(spell.damage?.length)));const persistent=spellActiveEffect(spell);const timing=persistent?.id==='barkskin'?' Barkskin used your Bonus Action; your Action remains available. Wild Shape and Rage also require a Bonus Action and must wait until a later turn.':'';if(immediate)resolveSpellEffect(spell,castLevel);else showRoll('Cast',`${persistent?`${persistent.summary} Active for ${persistent.duration}.`:spell.concentration?'Concentration started. Use Resolve Effect whenever the spell deals damage or healing.':spell.summary??'Spell activated.'}${timing}`,spell.name);}
function spellCard(spell:Spell&{available:boolean;reason:string}){
  const slotLevel=spell.slotLevel??spell.level;const chosen=chosenSpellLevel(spell);const persistent=spellActiveEffect(spell);const resolution=spell.damage?.length&&spell.attackBonus===undefined?(spell.resolution==='automatic'?'Automatic damage':spell.resolution==='manual'?'Conditional/manual effect':`Save DC ${spellSaveDc(spell)}${spell.saveAbility?` ${spell.saveAbility.toUpperCase()}`:''}${spell.halfOnSave?' · half on success':''}`):'';const stats=[actionCostLabel(spell.castingTime),slotLevel===0?'Cantrip':`Level ${slotLevel}`,spell.concentration?'Concentration':'',persistent?.acMinimum!==undefined?`AC minimum ${persistent.acMinimum}`:'',persistent?.duration?`Duration ${persistent.duration}`:'',spell.components?`Components ${spell.components}`:'',spell.attackBonus!==undefined?`Spell attack ${signed(spellAttackModifier(spell))}`:'',spell.healing?`Healing ${spell.healing}`:'',resolution].filter(Boolean).join(' · ');const timing=persistent?.id==='barkskin'?'2024 timing: Barkskin, Wild Shape, and Rage each use a Bonus Action, so they cannot be activated together on one turn. Barkskin lasts 1 hour; cast it before combat or on an earlier turn, then transform or Rage later.':'';const detail=[stats,spell.reason,persistent?.summary??spell.summary??'',timing].filter(Boolean).join('\n');const badge=spell.specialAccess==='circle-of-the-moon'?(spell.available?'Circle · Ready':'Circle · Blocked'):(spell.available?'Ready':'Unavailable');const c=card(spell.name,badge,detail,spell.available?'available':'unavailable');c.badge.className=`badge ${spell.available?'active':'inactive'}`;
  const levels=availableSpellSlotLevels(character,state,slotLevel);if(slotLevel>0&&levels.length){const picker=document.createElement('label');picker.className='slot-picker';picker.append(text('span','Cast using'));const select=document.createElement('select');select.setAttribute('aria-label',`${spell.name} spell slot level`);const scales=Boolean(spell.higherSlotHealing||spell.higherSlotDamage?.length);for(const level of levels){const option=document.createElement('option');option.value=String(level);option.textContent=`Level ${level} slot${level>slotLevel?scales?' · scaled effect':' · higher-level slot':''}`;option.selected=level===chosen;select.append(option);}select.disabled=!spell.available;select.addEventListener('change',()=>{selectedSpellSlots.set(spellKey(spell),Number(select.value));renderSpells();});picker.append(select);c.options.append(picker);}if(spell.attackBonus!==undefined)c.options.append(rollModePicker(`spell-${spell.name}`,spell.name));
  const immediate=spell.resolution!=='manual'&&(spell.attackBonus!==undefined||Boolean(spell.healing)||(!spell.concentration&&Boolean(spell.damage?.length)));const castLabel=persistent?.id==='barkskin'?'Cast Barkskin on Self':immediate?`Cast & Roll ${spell.name}`:`Cast ${spell.name}`;const cast=button(spell.available?castLabel:spell.reason,()=>castAndResolveSpell(spell),spell.available?'button primary action-roll':'button secondary');cast.disabled=!spell.available;c.actions.append(cast);const activeEffect=state.concentration?.name===spell.name&&spell.resolution!=='manual'&&Boolean(spell.damage?.length||spell.healing);if(activeEffect)c.actions.append(button(`Resolve ${spell.name} Effect`,()=>resolveSpellEffect(spell,state.concentration?.castLevel??slotLevel),'button secondary'));return c.node;
}
function renderSpells(){
  const root=$('#tab-content');clear(root);if(sheet.spells.length===0){root.append(text('div','No spells were imported for this character.','empty'));return;}
  const circleInForm=sheet.profile==='wildshape'&&isMoonDruid();root.append(text('p',state.rage.active?'Rage blocks all spells, including Circle of the Moon spells. End Rage before casting.':circleInForm?'While Wild Shaped, Circle spells using the Magic Action remain usable whenever your Action is available. Wild Shape used your Bonus Action, not your Action.':'Choose a spell and, when relevant, the spell-slot level. You can still use both an Action and a Bonus Action, but 2024 rules allow only one spell-slot expenditure to cast a spell per turn.','tab-help'));
  const ready=sheet.spells.filter(spell=>spell.available).sort((a,b)=>Number(Boolean(b.specialAccess))-Number(Boolean(a.specialAccess))||a.level-b.level||a.name.localeCompare(b.name));const blocked=sheet.spells.filter(spell=>!spell.available).sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name));
  if(ready.length){root.append(text('h3',`Available now (${ready.length})`));for(const spell of ready)root.append(spellCard(spell));}else root.append(text('div','No spell can be cast right now. The reasons are shown below.','empty'));
  if(blocked.length){const details=document.createElement('details');details.className='unavailable-spells';if(ready.length===0)details.open=true;const summary=document.createElement('summary');summary.textContent=`Unavailable right now (${blocked.length})`;details.append(summary);for(const spell of blocked)details.append(spellCard(spell));root.append(details);}
}
function renderFeatures(){
  const root=$('#tab-content');clear(root);let count=0;
  if(sheet.form?.traits.length){root.append(text('h3',`${sheet.form.name} form traits`));for(const trait of sheet.form.traits){const c=card(trait.name,'Form trait',trait.summary,'active');c.badge.className='badge active';root.append(c.node);count++;}}
  if(sheet.features.length){root.append(text('h3','Character features and feats'));for(const feature of sheet.features){const featureStatus:UiStatus=feature.status==='active'?'active':feature.status==='conditional'?'requirements':feature.status==='inactive'?'inactive':'warning';const c=card(feature.name,feature.status,`${feature.reason} ${feature.summary}`,featureStatus);c.badge.className=`badge ${feature.status}`;root.append(c.node);count++;}}
  if(state.overlays.length){root.append(text('h3','Active transformation overlays'));for(const id of state.overlays){const grant=character.transformationGrants?.find(item=>item.id===id);const c=card(grant?.label??id,'Active overlay',grant?`${grant.source}${grant.duration?` · ${grant.duration}`:''}`:'Built-in transformation effect currently applied.','active');c.badge.className='badge active';root.append(c.node);count++;}}
  if(count===0)root.append(text('div','No evaluated features or active form traits.','empty'));
}
function renderRules(){
  const root=$('#tab-content');clear(root);root.append(text('h3','Armor Class candidates'));const list=document.createElement('div');list.className='ac-list';for(const candidate of sheet.acCandidates){const row=document.createElement('div');row.className='ac-row'+(candidate.legal?'':' invalid');const info=document.createElement('div');info.append(text('strong',candidate.name),text('div',candidate.reason,'source-note'));row.append(info,text('strong',String(candidate.value)));list.append(row);}root.append(list,text('h3','Current transformation'));const source=document.createElement('div');source.className='item-card';source.append(text('strong',state.activeTransform?.option.label??'Base Form'),text('p',state.activeTransform?`${state.activeTransform.option.source} · ${state.activeTransform.duration}${state.activeTransform.permanentUntilDispelled?' · no Concentration required':''}`:'No replacement transformation is active.'));source.append(text('p',`Creature type: ${sheet.creatureType} · Size: ${sheet.size}`));if(sheet.form)source.append(text('p',`Verified stat block: ${sheet.form.source.page} · ${sheet.form.source.verified}`));root.append(source,text('h3','Current defenses'));const defenses=document.createElement('div');defenses.className='item-card';const moonReady=sheet.profile==='wildshape'?sheet.spells.filter(spell=>spell.specialAccess==='circle-of-the-moon'&&spell.available).length:0;const casting=sheet.canCast?'Yes':moonReady?`Circle spells only (${moonReady} ready)`:'No';defenses.append(text('p',`Resistances: ${sheet.resistances.join(', ')||'None'}`),text('p',`Immunities: ${sheet.immunities.join(', ')||'None'}`),text('p',`Senses: ${sheet.senses.join(', ')||'Base character senses'}`),text('p',`Speech: ${sheet.canSpeak?'Yes':'No'} · Spellcasting: ${casting} · Concentration: ${sheet.canConcentrate?'Allowed':'Blocked'} · Attack: ${sheet.canAttack?'Yes':'No'} · Manipulate objects: ${sheet.canManipulateObjects?'Yes':'No'}`),text('p',`Condition immunities: ${sheet.conditionImmunities.join(', ')||'None'}`));root.append(defenses,text('h3','Character source and items'));const provenance=document.createElement('div');provenance.className='item-card';provenance.append(text('strong',`${character.provenance.provider==='dndbeyond'?'D&D Beyond':'Local'} · ${character.provenance.ruleset.toUpperCase()} rules`),text('p',character.provenance.rulesetEvidence.join(' · ')||'No ruleset evidence was supplied.'),text('p',`${character.items.length} item record${character.items.length===1?'':'s'}; imported numeric totals are not applied a second time.`));for(const item of character.items){provenance.append(text('p',`${item.name} · ${item.type} · ${item.equipped?'equipped':'not equipped'}${item.requiresAttunement?item.attuned?' · attuned':' · attunement required':''} · ${item.ruleset.toUpperCase()} · ${item.mechanics.replaceAll('-',' ')}`,'source-note'));}root.append(provenance,text('h3','Rules databank'));const registry=document.createElement('div');registry.className='item-card';registry.append(text('p',`${registrySnapshot.packs.length} built-in packs and ${installedPacks.length} private local packs are available. The engine, shared rules, private owned content, imported character, and mutable combat state are stored as separate layers.`));renderContentRegistry(registry,true);root.append(registry);
}
function syncTabState(){
  let activeTab:HTMLButtonElement|undefined;
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach(tab=>{const active=tab.dataset.tab===currentTab;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active)activeTab=tab;});
  if(activeTab)$('#tab-content').setAttribute('aria-labelledby',activeTab.id);
}
function renderTab(){sheet=resolveSheet(character,state);syncTabState();if(currentTab==='actions')renderActions();else if(currentTab==='rolls')renderRolls();else if(currentTab==='spells')renderSpells();else if(currentTab==='features')renderFeatures();else renderRules();}
function activateTab(tab:HTMLButtonElement,focus=false){currentTab=tab.dataset.tab??'actions';renderTab();if(focus)tab.focus();}
function renderConditions(){const list=$('#condition-list');clear(list);for(const condition of state.conditions){const label=condition==='Exhaustion'?`Exhaustion ${state.exhaustionLevel} −1`:`${condition} ×`;const chip=button(label,()=>applyResult(removeCondition(state,condition)),'condition-chip');chip.setAttribute('aria-label',condition==='Exhaustion'?`Reduce Exhaustion from level ${state.exhaustionLevel}`:`Remove ${condition} condition`);list.append(chip);}}
function renderLog(){const root=$('#activity-log');clear(root);$<HTMLButtonElement>('#clear-activity').disabled=state.log.length===0;if(state.log.length===0){root.append(text('div','No activity yet.','log-row'));return;}for(const item of state.log)root.append(text('div',item,'log-row'));}
function render(){sheet=resolveSheet(character,state);document.documentElement.dataset.alteredCharacter=character.name;syncAuraState();renderCharacterStrip();renderTransformSelector();renderArt();renderMetrics();renderResources();renderQuickFeatures();renderActiveEffects();renderTab();renderConditions();renderLog();persist();}

function endCurrentForm(){const wasActive=Boolean(state.activeTransform);const recordsExternalEnd=state.activeTransform?.option.profile==='true-polymorph'&&state.activeTransform.permanentUntilDispelled;const result=endTransformation(state,!recordsExternalEnd,character);if(wasActive&&!state.activeTransform){selectedOptionId='base';radiantActions.clear();selectedOptionalBonuses.clear();selectedRollModes.clear();selectedMultiattackVariants.clear();}applyResult(result);}
function initializeControls(){
  const damage=$<HTMLSelectElement>('#damage-type');for(const type of damageTypes){const option=document.createElement('option');option.value=type;option.textContent=type;damage.append(option);}damage.value='Slashing';
  const conditions=$<HTMLSelectElement>('#condition-select');for(const condition of commonConditions){const option=document.createElement('option');option.value=condition;option.textContent=condition;conditions.append(option);}
  $('#sample-character').addEventListener('change',event=>{const id=(event.target as HTMLSelectElement).value;const found=characters.find(c=>c.id===id);if(found)setCharacter(found);});
  $('#form-select').addEventListener('change',event=>{selectedOptionId=(event.target as HTMLSelectElement).value;renderTransformSelector();renderArt();});
  $('#form-search').addEventListener('input',event=>{formSearch=(event.target as HTMLInputElement).value;renderTransformSelector();renderArt();});
  $('#form-filter').addEventListener('change',event=>{formFilter=(event.target as HTMLSelectElement).value;renderTransformSelector();renderArt();});
  $('#transform-button').addEventListener('click',()=>{const option=currentOption();if(option)applyResult(startTransformation(character,state,option));});
  $('#end-form-button').addEventListener('click',endCurrentForm);
  const tabs=Array.from(document.querySelectorAll<HTMLButtonElement>('.tab'));
  tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>activateTab(tab));tab.addEventListener('keydown',(event:KeyboardEvent)=>{let next:number|undefined;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;if(next===undefined)return;event.preventDefault();const target=tabs[next];if(target)activateTab(target,true);});});
  $('#apply-damage').addEventListener('click',()=>{const amount=Number($<HTMLInputElement>('#damage-amount').value);const type=$<HTMLSelectElement>('#damage-type').value as DamageType;applyResult(applyDamage(state,resolveSheet(character,state),amount,type,character));});
  $('#apply-healing').addEventListener('click',()=>applyResult(heal(state,character,Number($<HTMLInputElement>('#damage-amount').value))));
  $('#new-turn').addEventListener('click',()=>applyResult(startNewTurn(state)));$('#end-turn').addEventListener('click',()=>applyResult(endTurn(character,state)));$('#short-rest').addEventListener('click',()=>applyResult(shortRest(state)));$('#long-rest').addEventListener('click',()=>applyResult(longRest(character,state)));
  $('#add-condition').addEventListener('click',()=>applyResult(applyCondition(character,state,$<HTMLSelectElement>('#condition-select').value)));$('#clear-conditions').addEventListener('click',()=>applyResult(clearConditions(state)));
  $('#clear-activity').addEventListener('click',()=>{state.log=[];$('#status-message').textContent='Recent activity cleared.';renderLog();persist();});
  $('#open-help').addEventListener('click',()=>{filterHelpTopics();const dialog=$<HTMLDialogElement>('#help-dialog');dialog.showModal();$<HTMLInputElement>('#help-search').focus();});
  $('#close-help').addEventListener('click',()=>$<HTMLDialogElement>('#help-dialog').close());
  $('#help-search').addEventListener('input',filterHelpTopics);
  $('#start-walkthrough').addEventListener('click',startWalkthrough);
  $('#skip-walkthrough').addEventListener('click',()=>finishWalkthrough('Walkthrough skipped. Restart it anytime from Help.'));
  $('#walkthrough-back').addEventListener('click',()=>{walkthroughStepIndex--;renderWalkthroughStep();});
  $('#walkthrough-next').addEventListener('click',()=>{const available=availableWalkthroughSteps();if(walkthroughStepIndex>=available.length-1)finishWalkthrough('Walkthrough complete. Help remains available from the top bar.');else{walkthroughStepIndex++;renderWalkthroughStep();}});
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#walkthrough').hidden)finishWalkthrough('Walkthrough closed. Restart it anytime from Help.');});
  $('#import-file').addEventListener('change',async event=>{const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{applyImportedCharacter(parseCharacter(safeJsonParse(await file.text())));}catch(error){const message=`Import failed: ${error instanceof Error?error.message:'Unknown error'}`;notify(message);setImportStatus(message);}finally{input.value='';}});
  $('#fetch-dndbeyond').addEventListener('click',()=>void fetchDdbCharacter());
  $('#dndbeyond-source').addEventListener('keydown',event=>{if((event as KeyboardEvent).key==='Enter'){event.preventDefault();void fetchDdbCharacter();}});
  $('#confirm-dndbeyond-import').addEventListener('click',()=>{if(!pendingDdbImport){setImportStatus('Fetch and review a D&D Beyond character first.');return;}if(pendingDdbImport.blocked){setImportStatus(pendingDdbImport.blockReason??'This character is blocked by the 2024-only rules policy.');return;}const imported=applyImportedCharacter(pendingDdbImport.character);pendingDdbImport=null;$('#dndbeyond-review').hidden=true;setImportStatus(`${imported.name} imported after review. Export an Altered JSON backup once you finish checking any flagged areas.`);});
  $('#download-dndbeyond-json').addEventListener('click',()=>{if(!pendingDdbImport){setImportStatus('Fetch and review a D&D Beyond character first.');return;}downloadJson(pendingDdbImport.character,`${slug(pendingDdbImport.character.name)}-altered.json`);});
  $('#export-character').addEventListener('click',()=>downloadJson(character,`${character.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'altered-character'}.json`));
  $('#open-import-center').addEventListener('click',()=>{renderInstalledPacks();setImportStatus('Import from a public D&D Beyond character link, or use a validated Altered JSON backup.');$<HTMLDialogElement>('#import-dialog').showModal();});
  $('#close-import-center').addEventListener('click',()=>$<HTMLDialogElement>('#import-dialog').close());
  $('#owned-pack-file').addEventListener('change',async event=>{const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{const pack=safeOwnedContentParse(await file.text());const result=await installAndApplyPack(pack);setImportStatus(result.applied?`${pack.metadata.name} installed and applied to ${character.name}. ${packCounts(pack)}.`:`${pack.metadata.name} installed. It does not match ${character.name}, so the current sheet was not changed.`);renderSettings();}catch(error){setImportStatus(`Pack installation failed: ${error instanceof Error?error.message:'Unknown error'}`);}finally{input.value='';}});
  $('#download-pack-template').addEventListener('click',()=>downloadJson(ownedContentTemplate(character),`${slug(character.name)}-private-content-template.json`));
  $('#open-transform-builder').addEventListener('click',()=>{populateBuilderClassOptions();setBuilderStatus('The builder creates a validated local pack. Advanced fields are optional.');$<HTMLDialogElement>('#transform-builder-dialog').showModal();});
  $('#close-transform-builder').addEventListener('click',()=>$<HTMLDialogElement>('#transform-builder-dialog').close());
  $('#cancel-transform-builder').addEventListener('click',()=>$<HTMLDialogElement>('#transform-builder-dialog').close());
  $('#transform-builder-form').addEventListener('submit',event=>{event.preventDefault();void (async()=>{try{const pack=createPackFromBuilder();const result=await installAndApplyPack(pack);setBuilderStatus(`${pack.metadata.name} created and installed. ${result.applied?'The transformation is now available on this character.':'The pack was saved but did not match the current character.'}`);setImportStatus(`${pack.metadata.name} installed from the private transformation builder.`);renderSettings();}catch(error){setBuilderStatus(`Could not create transformation: ${error instanceof Error?error.message:'Unknown error'}`);}})();});
  $('#keep-current-thp').addEventListener('click',()=>{if(pendingTempChoice)resolveTempHpChoice(state,'current',pendingTempChoice.incoming,pendingTempChoice.source);pendingTempChoice=null;$<HTMLDialogElement>('#temp-hp-dialog').close();notify('Kept current Temporary Hit Points.');render();});
  $('#keep-new-thp').addEventListener('click',()=>{if(pendingTempChoice)resolveTempHpChoice(state,'incoming',pendingTempChoice.incoming,pendingTempChoice.source);pendingTempChoice=null;$<HTMLDialogElement>('#temp-hp-dialog').close();notify('Replaced Temporary Hit Points with the new source.');render();});
  $('#art-file').addEventListener('change',async event=>{const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;const target=artTargetInfo();try{notify(`Optimizing artwork for ${target.label}…`);const optimized=await optimizePortrait(file);await saveArtOverride(character.id,target.targetId,optimized);artOverrideCache.set(artCacheKey(target.targetId),optimized);notify(`Custom artwork saved for ${target.label}.`);renderArt();}catch(error){notify(`Artwork could not be saved: ${error instanceof Error?error.message:'Unknown error'}`);}finally{input.value='';}});
  $('#reset-art').addEventListener('click',async()=>{const target=artTargetInfo();await removeArtOverride(character.id,target.targetId);artOverrideCache.set(artCacheKey(target.targetId),undefined);notify(`Default artwork restored for ${target.label}.`);renderArt();});
  $('#open-settings').addEventListener('click',()=>{renderSettings();$<HTMLDialogElement>('#settings-dialog').showModal();});
  $('#close-settings').addEventListener('click',()=>$<HTMLDialogElement>('#settings-dialog').close());
  $('#refresh-srd-catalog').addEventListener('click',()=>void refreshSrdCatalogStatus());
  $('#magic-effects-enabled').addEventListener('change',event=>{magicEffectsEnabled=(event.target as HTMLInputElement).checked;void saveBooleanSetting('magic-effects-enabled',magicEffectsEnabled);syncAuraState();});
  $('#reduce-motion').addEventListener('change',event=>{reduceMotion=(event.target as HTMLInputElement).checked;void saveBooleanSetting('reduce-motion',reduceMotion);syncAuraState();});
  window.addEventListener('beforeunload',persist);
  if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

async function boot(){
  restore();
  // Paint a complete built-in sheet before waiting on IndexedDB. Some mobile
  // browsers can delay storage initialization after an authenticated redirect;
  // the core app must remain usable while private packs and settings hydrate.
  initializeControls();filterHelpTopics();renderSettings();renderInstalledPacks();
  notify(`Altered loaded for ${character.name}. Built-in rules and forms are ready.`);render();
  document.documentElement.dataset.alteredReady='true';
  void loadHostedAccount();
  installedPacks=await loadValidatedInstalledPacks();
  rebuildEffectiveCharacterLibrary(true);
  if(pendingActiveSnapshot?.option?.id){const option=availableTransformations(character,state).find(candidate=>candidate.id===pendingActiveSnapshot?.option?.id);if(option)state.activeTransform={option,startedTurn:boundedWhole(pendingActiveSnapshot.startedTurn,state.turn.number,1,1_000_000),duration:safeSavedText(pendingActiveSnapshot.duration,'',200),tempHpSource:Boolean(pendingActiveSnapshot.tempHpSource),...(pendingActiveSnapshot.spellConcentration?{spellConcentration:true}:{}),...(pendingActiveSnapshot.permanentUntilDispelled?{permanentUntilDispelled:true}:{})};}
  magicEffectsEnabled=await loadBooleanSetting('magic-effects-enabled',true);
  reduceMotion=await loadBooleanSetting('reduce-motion',reduceMotion);
  const walkthroughCompleted=await loadBooleanSetting(WALKTHROUGH_SETTING,false);
  renderSettings();renderInstalledPacks();
  const repairNote=invalidPackCount?` ${invalidPackCount} damaged private pack${invalidPackCount===1?' was':'s were'} removed safely.`:'';
  notify(`Altered loaded for ${character.name}. ${installedPacks.length} private content pack${installedPacks.length===1?'':'s'} available.${repairNote}`);render();
  if(!walkthroughCompleted)startWalkthrough();
  void refreshSrdCatalogStatus();
}
void boot().catch(error=>{console.error(error);document.documentElement.dataset.alteredReady='error';const status=document.querySelector<HTMLElement>('#status-message');if(status)status.textContent=`Altered could not start: ${error instanceof Error?error.message:'Unknown error'}`;});
