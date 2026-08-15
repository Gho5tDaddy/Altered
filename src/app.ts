import type {Ability,ActionCost,AttackAction,AutomaticActionChoice,Character,ConditionEffect,CreatureAction,DamagePacket,DamageType,EvaluatedFeature,GameState,OwnedContentMatch,OwnedContentPack,ReceivedEffect,ReceivedEffectKind,ResolvedSheet,Spell,TransformationEffects,TransformationOption,TransitionResult} from './types.js';
import {CONDITIONS,CREATURES,classLevel,contentRegistrySnapshot} from './content-registry.js';
import {parseCharacter,safeJsonParse} from './schema.js';
import {applyDdbSrdCreatures,ddbCoverageLabel,ddbSetupPackId,extractDdbCharacterId,importDdbCharacter} from './dndbeyond.js';
import type {DdbImportReport} from './dndbeyond.js';
import {normalizeSrdCreature,parseSrdCatalogPage,parseSrdCatalogStatus} from './srd-catalog.js';
import type {SrdCatalogStatus} from './srd-catalog.js';
import {characterFromPdfReview,parsePdfCharacterText} from './pdf-import.js';
import type {PdfCharacterDraft} from './pdf-import.js';
import {findPdfRuleEntry} from './pdf-match.js';
import type {PdfTextItem} from './pdf-match.js';
import {assistantRequestText,parseAssistantProposal} from './assistant-proposal.js';
import {installExtensionPack,listExtensionPackRecords,loadArtOverride,loadBooleanSetting,loadJsonSetting,optimizePortrait,removeArtOverride,removeExtensionPack,removeSetting,saveArtOverride,saveBooleanSetting,saveJsonSetting} from './storage.js';
import {SAMPLE_CHARACTERS} from './sample-data.js';
import {applyOwnedContentPack,applyOwnedContentPacks,ownedContentTemplate,parseOwnedContentPack,privateMechanicPack,safeOwnedContentParse} from './owned-content.js';
import {rulesAuditSnapshot} from './audit-ledger.js';
import {migratePersistedCharacter} from './data-migrations.js';
import {
  actionCostError,actionExecutionError,addReceivedEffect,applyCondition,applyDamage,attackBonuses,attackRollSources,availableSpellSlotLevels,availableTransformations,boundedWhole,castSpell,criticalDiceExpression,criticalHitThreshold,
  clearConditions,completeTruePolymorph,concentrationSaveMode,createInitialState,deathSaveMode,declareAttack,declareRecklessAttack,endConcentration,endRage,endReceivedEffect,endSpellEffect,endTransformation,endTurn,
  extendRage,heal,longRest,markActionRechargeUsed,markLimitedActionUsed,markOncePerTurn,pendingActionRecharge,remainingActionUses,removeCondition,resolveAdvantage,resolveConcentrationCheck,resolveDeathSave,resolveRelentlessRage,resolveSheet,resolveTempHpChoice,restoreDragonWings,rollDice,
  proficiencyBonus,rageStartError,rollAttackD20,rulesMetadata,shortRest,spellActiveEffect,spendActionCost,spendActionExecution,startCombat,startNewTurn,startRage,startTransformation,useActionSurge,useLayOnHands,useSecondWind,useWildResurgence,wildResurgenceError
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
const RECEIVED_EFFECTS:Record<ReceivedEffectKind,{name:string;duration:string;summary:string}>={
  guidance:{name:'Guidance',duration:'Up to 1 minute',summary:'Adds 1d4 to checks using the skill chosen when the effect begins.'},
  bless:{name:'Bless',duration:'Up to 1 minute; end when its source ends it',summary:'Adds 1d4 to your attack rolls and saving throws.'},
  'bardic-inspiration':{name:'Bardic Inspiration',duration:'Up to 1 hour or until used',summary:'After a failed D20 Test, roll and add the inspiration die.'},
  'heroic-inspiration':{name:'Heroic Inspiration',duration:'Until used',summary:'Reroll one die immediately after rolling it; use the new roll.'}
};

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

// Built-in characters are clearly labeled demonstrations only. Ferocitus is
// restored from the owner's existing saved library, never seeded for a new user.
const BUNDLED_CHARACTERS=[...SAMPLE_CHARACTERS];
const DEMO_CHARACTER_IDS=new Set(BUNDLED_CHARACTERS.map(raw=>parseCharacter(raw).id));
let baseCharacters:Character[]=BUNDLED_CHARACTERS.map(parseCharacter);
let baseCharacter=baseCharacters[0] as Character;
let characters:Character[]=[...baseCharacters];
let character=characters[0] as Character;
let state=createInitialState(character);
let sheet=resolveSheet(character,state);
let currentTab='actions';
let latestRollTab='actions';
let latestRollTitle='Ready';
let selectedOptionId='base';
const selectedOptionalBonuses=new Map<string,Set<string>>();
const selectedRollModes=new Map<string,RollMode>();
const selectedMultiattackVariants=new Map<string,string>();
const selectedSpellSlots=new Map<string,number>();
const radiantActions=new Set<string>();
const confirmedActionPrerequisites=new Set<string>();
type BattlefieldFact='ally-near-target'|'attacker-unseen'|'target-unseen';
const nextAttackFacts=new Set<BattlefieldFact>();
interface PendingDamageRoll {id:string;name:string;packets:DamagePacket[];critical:boolean;minimum:number;effects:ConditionEffect[];notes:string[]}
const pendingDamageRolls=new Map<string,PendingDamageRoll>();
let turnUndoSnapshot:{state:GameState;pending:PendingDamageRoll[]}|undefined;
let turnUndoTimer:number|undefined;
let pendingDamageSequence=0;
let pendingTempChoice:{incoming:number;source:string}|null=null;
let magicEffectsEnabled=true;
let reduceMotion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)').matches:false;
let guidedNextStep=true;
let autoRefreshCharacter=true;
let characterRefreshRunning=false;
let lastCharacterRefreshAt=0;
let characterRefreshMessage='No linked character has been checked yet.';
let nextStepTarget:HTMLElement|null=null;
let nextStepReveal:(()=>HTMLElement)|null=null;
let restoredDataRepairs:string[]=[];
let auraInitialized=false;
let previousTransformId:string|undefined;
let previousAuraId:string|undefined;
let auraTimer:number|undefined;
let rollToastTimer:number|undefined;
const artOverrideCache=new Map<string,string|undefined>();
const artLoading=new Set<string>();
const registrySnapshot=contentRegistrySnapshot();
const auditSnapshot=rulesAuditSnapshot();
let installedPacks:OwnedContentPack[]=[];
let pendingActiveSnapshot:Partial<GameState>['activeTransform']|undefined;
let invalidPackCount=0;
let pendingDdbImport:DdbImportReport|null=null;
let confirmedDdbSourceId:string|null=null;
let manualPrivateMechanic=false;
let manualPrivateSource='User-created homebrew mechanic';
let pendingJsonImport:Character|null=null;
let pendingPdfFile:File|null=null;
let pendingPdfDraft:PdfCharacterDraft|null=null;
let deletedCharacterIds=new Set<string>();
let srdCatalogStatus:SrdCatalogStatus|null=null;
let srdCatalogMessage='Checking the live legal SRD support catalog...';
let srdCatalogChecking=false;
let formSearch='';
let formFilter='all';
type WorkspaceView='play'|'forms'|'task'|'more';
let currentWorkspace:WorkspaceView='play';
let taskOrigin:'play'|'sheet'='play';
let walkthroughStepIndex=0;
let walkthroughTarget:HTMLElement|undefined;
let walkthroughReturnFocus:HTMLElement|undefined;
let compactFormLayout:boolean|undefined;
let firstRunCharacterSetup=false;
const WALKTHROUGH_SETTING='walkthrough-completed-v1';
const PENDING_DDB_SETTING='pending-ddb-import-v1';
const AUTO_REFRESH_CHARACTER_SETTING='auto-refresh-ddb-character-v1';
const FIRST_CHARACTER_SETUP_KEY='altered-first-character-setup-v1';
const APP_VERSION='0.29.27';
const CHARACTER_REFRESH_INTERVAL=5*60*1000;
const PRIVATE_PDF_LIMIT=500*1024*1024;
const PRIVATE_PDF_PART_SIZE=5*1024*1024;
interface PrivatePdfRecord{id:string;name:string;size:number;uploadedAt:string}
type PrivatePdfTargetKind='Class or subclass'|'Species'|'Feat'|'Spell'|'Equipped item'|'Character feature';
interface PrivatePdfTarget{id:string;name:string;kind:PrivatePdfTargetKind;detail:string}
interface PrivatePdfMatch extends PrivatePdfTarget{page:number;summary:string;activation:ActionCost;selected:boolean}
let pendingPrivatePdfReview:{record:PrivatePdfRecord;matches:PrivatePdfMatch[];searched:number;pages:number;unmatched:PrivatePdfTarget[]}|null=null;
let pendingPrivatePdfResultRecord:PrivatePdfRecord|null=null;
type UiStatus='available'|'active'|'inactive'|'locked'|'unavailable'|'requirements'|'selected'|'reference'|'favorite'|'new'|'importing'|'loading'|'success'|'warning'|'error';
const UI_STATUS:Record<UiStatus,{icon:string;label:string}>={
  available:{icon:'✓',label:'Available'},active:{icon:'✦',label:'Active'},inactive:{icon:'○',label:'Inactive'},
  locked:{icon:'⌁',label:'Locked'},unavailable:{icon:'×',label:'Unavailable'},requirements:{icon:'◇',label:'Requirements missing'},
  selected:{icon:'◆',label:'Selected'},reference:{icon:'i',label:'Reference'},favorite:{icon:'★',label:'Favorite'},new:{icon:'✧',label:'New'},
  importing:{icon:'⇩',label:'Importing'},loading:{icon:'…',label:'Loading'},success:{icon:'✓',label:'Success'},
  warning:{icon:'!',label:'Warning'},error:{icon:'×',label:'Error'},
};
const WALKTHROUGH_STEPS=[
  {selector:'.character-strip',title:'Choose your character',copy:'Switch between sample and imported characters here. Each character keeps its own validated sheet and combat state.'},
  {selector:'.persistent-form-visual',title:'See your current form',copy:'Your artwork, live form stats, turn resources, and the way back to normal stay visible in every workspace.'},
  {selector:'#action-economy',title:'Check what remains this turn',copy:'These chips show Action, Bonus Action, Reaction, and spell-slot availability before you press anything.'},
  {selector:'.task-launchers',title:'Choose one focused tool',copy:'Open Actions, Spells, Checks, or Abilities. Each gets its own uncluttered workspace.'},
  {selector:'.workspace-nav',title:'Move without losing your place',copy:'Play, Forms, Character, and Manage keep every capability close while your combat state stays active.'},
  {selector:'#toggle-app-menu',title:'Open app tools',copy:'The A menu holds character refresh, Help, Import, Export, and Settings without duplicating them across the dashboard.'},
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
  $('#play-status').textContent=message;
  const returnFocus=walkthroughReturnFocus;walkthroughReturnFocus=undefined;
  const focusTarget=returnFocus?.isConnected&&returnFocus.offsetParent?returnFocus:$<HTMLButtonElement>('#nav-play');
  window.setTimeout(()=>focusTarget.focus({preventScroll:true}),0);
}
function renderWalkthroughStep(){
  const available=availableWalkthroughSteps();if(available.length===0){finishWalkthrough('Walkthrough skipped because its interface targets are unavailable.');return;}
  walkthroughStepIndex=Math.max(0,Math.min(walkthroughStepIndex,available.length-1));const current=available[walkthroughStepIndex];if(!current)return;
  current.target.closest<HTMLDetailsElement>('#character-form-drawer')?.setAttribute('open','');
  clearWalkthroughHighlight();walkthroughTarget=current.target;walkthroughTarget.classList.add('walkthrough-target');
  walkthroughTarget.scrollIntoView({block:'center',behavior:reduceMotion?'auto':'smooth'});
  $('#walkthrough-step').textContent=`Step ${walkthroughStepIndex+1} of ${available.length}`;
  $('#walkthrough-title').textContent=current.step.title;$('#walkthrough-copy').textContent=current.step.copy;
  const back=$<HTMLButtonElement>('#walkthrough-back');back.disabled=walkthroughStepIndex===0;
  $('#walkthrough-next').textContent=walkthroughStepIndex===available.length-1?'Finish':'Next';
}
function startWalkthrough(){
  const help=$<HTMLDialogElement>('#help-dialog');const active=document.activeElement;
  const openHelp=$<HTMLButtonElement>('#open-help');const fallback=openHelp.offsetParent?openHelp:$<HTMLButtonElement>('#toggle-app-menu');
  walkthroughReturnFocus=active instanceof HTMLElement&&active!==document.body&&!help.contains(active)?active:fallback;
  if(help.open)help.close();
  setWorkspace('play');walkthroughStepIndex=0;$('#walkthrough').hidden=false;renderWalkthroughStep();$<HTMLButtonElement>('#walkthrough-next').focus();
}

function setAppMenuOpen(open:boolean,restoreFocus=false){
  const topbar=document.querySelector<HTMLElement>('.topbar');const toggle=$<HTMLButtonElement>('#toggle-app-menu');
  topbar?.classList.toggle('menu-open',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Close Altered menu':'Open Altered menu');
  if(!open&&restoreFocus)toggle.focus({preventScroll:true});
}
const TASK_TITLES:Record<string,string>={actions:'Actions',rolls:'Saves & Skills',spells:'Spells',features:'Abilities & Features',equipment:'Equipment & Inventory',rules:'Rules & Defenses'};
function syncWorkspaceChrome(){
  document.documentElement.dataset.alteredWorkspace=currentWorkspace;
  document.documentElement.dataset.alteredTab=currentTab;
  document.querySelectorAll<HTMLElement>('[data-workspace-view]').forEach(view=>{
    const active=view.dataset.workspaceView===currentWorkspace;view.hidden=!active;view.toggleAttribute('inert',!active);
  });
  const sheetSelected=currentWorkspace==='task'&&taskOrigin==='sheet';
  const activeNav=currentWorkspace==='forms'?'nav-forms':currentWorkspace==='more'?'nav-more':sheetSelected?'nav-sheet':'nav-play';
  for(const id of ['nav-play','nav-forms','nav-sheet','nav-more']){const node=$<HTMLButtonElement>(`#${id}`);const active=id===activeNav;node.classList.toggle('active',active);if(active)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');}
  const returning=currentWorkspace!=='play';$('#nav-play-label').textContent=returning?'Back to Play':'Play';$<HTMLButtonElement>('#nav-play').setAttribute('aria-label',returning?'Back to Play dashboard':'Play dashboard');
  $('#task-view-title').textContent=TASK_TITLES[currentTab]??'Character Sheet';
  $('#task-abilities').hidden=currentTab!=='features';
  const urgentAbility=Boolean(state.pendingRelentlessRage||(state.hp===0&&!state.life.dead&&!state.life.stable)||state.concentrationChecks.length);
  $('#ability-use-now').hidden=currentTab!=='features'||!urgentAbility;
  const activeEffects=$('#active-effects');activeEffects.hidden=currentTab!=='features'||activeEffects.dataset.hasEffects!=='true';
}
function setWorkspace(view:WorkspaceView,tab?:string,origin:'play'|'sheet'=taskOrigin,focusTarget?:HTMLElement){
  currentWorkspace=view;if(tab){currentTab=tab;taskOrigin=origin;renderTab();}
  syncWorkspaceChrome();renderArt();renderNextStepGuide();
  const active=document.querySelector<HTMLElement>(`[data-workspace-view="${currentWorkspace}"]`);active?.scrollTo({top:0,behavior:'auto'});
  if(focusTarget)window.setTimeout(()=>focusTarget.focus({preventScroll:true}),0);
}
function openTask(tab:string,origin:'play'|'sheet'='play'){setWorkspace('task',tab,origin,$<HTMLElement>('#task-view-title'));}
function openMoreDrawer(label:string){
  setWorkspace('more');
  const drawers=Array.from(document.querySelectorAll<HTMLDetailsElement>('#workspace-more .dashboard-drawer'));const target=drawers.find(drawer=>drawer.querySelector('summary span')?.textContent?.startsWith(label));
  if(target){target.open=true;window.setTimeout(()=>target.querySelector<HTMLElement>('summary')?.focus({preventScroll:true}),0);}
}
function syncCharacterFormDrawer(){
  const compact=window.matchMedia('(max-width:700px)').matches;
  $<HTMLDetailsElement>('#character-form-drawer').open=true;
  compactFormLayout=compact;
}
function filterHelpTopics(){
  const query=$<HTMLInputElement>('#help-search').value.trim().toLowerCase();const terms=query.split(/\s+/).filter(Boolean);
  const topics=Array.from(document.querySelectorAll<HTMLDetailsElement>('.help-topic'));let visible=0;let sole:HTMLDetailsElement|undefined;
  for(const topic of topics){const content=`${topic.dataset.helpKeywords??''} ${topic.textContent??''}`.toLowerCase();const matches=terms.every(term=>content.includes(term));topic.hidden=!matches;if(matches){visible++;sole=topic;}else topic.open=false;}
  if(query&&visible===1&&sole)sole.open=true;
  $('#help-empty').hidden=visible>0;$('#help-search-status').textContent=query?`${visible} help topic${visible===1?'':'s'} found.`:`${topics.length} concise help topics.`;
}

function addActivity(message:string){state.log.unshift(message);state.log=state.log.slice(0,25);persist();}
function notify(message:string){$('#status-message').textContent=message;$('#play-status').textContent=message;addActivity(message);}
function setStatus(message:string){$('#status-message').textContent=message;$('#play-status').textContent=message;}
function isLegacyStartupActivity(message:string){return /^Altered loaded for .+\. (?:Built-in rules and forms are ready\.|\d+ private content packs? available\..*)$/.test(message);}
function persist(){try{localStorage.setItem('altered-v0.18',JSON.stringify({baseCharacters,currentCharacterId:baseCharacter.id,state,deletedCharacterIds:[...deletedCharacterIds]}));}catch{/* storage is optional */}}
function finishFirstCharacterSetup(){firstRunCharacterSetup=false;try{localStorage.setItem(FIRST_CHARACTER_SETUP_KEY,'complete');}catch{/* storage is optional */}}
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
    restoredDataRepairs=[];
    const raw=localStorage.getItem('altered-v0.18')??localStorage.getItem('altered-v0.17')??localStorage.getItem('altered-v0.15')??localStorage.getItem('altered-v0.9')??localStorage.getItem('altered-v0.8')??localStorage.getItem('altered-v0.4');if(!raw)return false;
    const parsed=JSON.parse(raw) as {baseCharacters?:unknown[];currentCharacterId?:string;baseCharacter?:unknown;character?:unknown;state?:Partial<GameState>;deletedCharacterIds?:unknown[]};
    deletedCharacterIds=new Set(Array.isArray(parsed.deletedCharacterIds)?parsed.deletedCharacterIds.filter((id):id is string=>typeof id==='string'&&id.length<=160).slice(0,50):[]);
    const library:Character[]=[];
    if(Array.isArray(parsed.baseCharacters)){for(const rawCharacter of parsed.baseCharacters.slice(0,50)){try{const migrated=migratePersistedCharacter(parseCharacter(rawCharacter));restoredDataRepairs.push(...migrated.repairs);const entry=migrated.character;if(!library.some(existing=>existing.id===entry.id))library.push(entry);}catch{/* one damaged library entry should not block the rest */}}}
    if(library.length===0){const migrated=migratePersistedCharacter(parseCharacter(parsed.baseCharacter??parsed.character));restoredDataRepairs.push(...migrated.repairs);library.push(migrated.character);}
    for(const sample of BUNDLED_CHARACTERS.map(parseCharacter))if(!deletedCharacterIds.has(sample.id)&&!library.some(entry=>entry.id===sample.id))library.push(sample);
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
      if(Array.isArray(saved.log))clean.log=saved.log.filter((x):x is string=>typeof x==='string'&&!isLegacyStartupActivity(x)).slice(0,25).map(x=>x.slice(0,500));
      if(saved.turn&&typeof saved.turn==='object'){const sequence=saved.turn.attackAction&&typeof saved.turn.attackAction==='object'?{remaining:boundedWhole(saved.turn.attackAction.remaining,0,0,3),total:boundedWhole(saved.turn.attackAction.total,1,1,4),source:typeof saved.turn.attackAction.source==='string'?saved.turn.attackAction.source.slice(0,80):'Extra Attack'}:undefined;clean.turn={number:boundedWhole(saved.turn.number,clean.turn.number,1,1_000_000),actionsRemaining:boundedWhole(saved.turn.actionsRemaining,clean.turn.actionsRemaining,0,1),surgeActionsRemaining:boundedWhole(saved.turn.surgeActionsRemaining,clean.turn.surgeActionsRemaining,0,1),bonusRemaining:boundedWhole(saved.turn.bonusRemaining,clean.turn.bonusRemaining,0,1),reactionRemaining:boundedWhole(saved.turn.reactionRemaining,clean.turn.reactionRemaining,0,1),slotSpellCast:Boolean(saved.turn.slotSpellCast),attackRollsMade:boundedWhole(saved.turn.attackRollsMade,clean.turn.attackRollsMade,0,100),...(sequence&&sequence.remaining>0&&sequence.remaining<sequence.total?{attackAction:sequence}:{}),oncePerTurn:savedOncePerTurn(saved.turn.oncePerTurn)};}
      if(saved.rage&&typeof saved.rage==='object'&&typeof saved.rage.active==='boolean')clean.rage={active:saved.rage.active,endsAtTurn:boundedWhole(saved.rage.endsAtTurn,clean.rage.endsAtTurn,0,1_000_000),usedThisTurn:Boolean(saved.rage.usedThisTurn),recklessDeclared:Boolean(saved.rage.recklessDeclared),extendedThisTurn:Boolean(saved.rage.extendedThisTurn)};
      if(saved.concentration&&typeof saved.concentration.name==='string')clean.concentration={name:saved.concentration.name.slice(0,120),source:safeSavedText(saved.concentration.source,'Unknown',120)};
      if(Array.isArray(saved.activeSpellEffects))clean.activeSpellEffects=saved.activeSpellEffects.filter(effect=>effect&&typeof effect==='object'&&typeof effect.id==='string'&&typeof effect.name==='string'&&typeof effect.duration==='string'&&typeof effect.summary==='string').slice(0,20).map(effect=>({id:effect.id.slice(0,120),name:effect.name.slice(0,120),source:safeSavedText(effect.source,'Unknown',120),duration:effect.duration.slice(0,120),summary:effect.summary.slice(0,300),...(typeof effect.acMinimum==='number'?{acMinimum:boundedWhole(effect.acMinimum,10,1,40)}:{}),...(typeof effect.castLevel==='number'?{castLevel:boundedWhole(effect.castLevel,1,1,9)}:{}),...(typeof effect.startedTurn==='number'?{startedTurn:boundedWhole(effect.startedTurn,clean.turn.number,1,1_000_000)}:{})}));
      if(Array.isArray(saved.receivedEffects))clean.receivedEffects=saved.receivedEffects.filter((effect):effect is ReceivedEffect=>Boolean(effect&&typeof effect==='object'&&typeof effect.id==='string'&&typeof effect.kind==='string'&&['guidance','bless','bardic-inspiration','heroic-inspiration'].includes(effect.kind)&&typeof effect.name==='string'&&typeof effect.duration==='string')).slice(0,12).map(effect=>({id:effect.id.slice(0,120),kind:effect.kind,name:effect.name.slice(0,120),source:safeSavedText(effect.source,'Another creature',80),addedTurn:boundedWhole(effect.addedTurn,clean.turn.number,1,1_000_000),duration:effect.duration.slice(0,120),...(typeof effect.skill==='string'?{skill:effect.skill.slice(0,80)}:{}),...(effect.autoChooseSkill===true?{autoChooseSkill:true}:{}),...(effect.autoUseNextRoll===true?{autoUseNextRoll:true}:{}),...([4,6,8,10,12].includes(Number(effect.die))?{die:Number(effect.die) as 4|6|8|10|12}:{})}));
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
function clearTurnUndo(){
  turnUndoSnapshot=undefined;if(turnUndoTimer!==undefined)window.clearTimeout(turnUndoTimer);turnUndoTimer=undefined;
  const control=document.querySelector<HTMLButtonElement>('#persistent-undo-turn');if(control)control.hidden=true;
}
function captureTurnUndo(){
  clearTurnUndo();turnUndoSnapshot={state:structuredClone(state),pending:[...pendingDamageRolls.values()].map(value=>structuredClone(value))};
  $('#persistent-undo-turn').hidden=false;turnUndoTimer=window.setTimeout(clearTurnUndo,8000);
}
function undoTurnChange(){
  if(!turnUndoSnapshot)return;state=structuredClone(turnUndoSnapshot.state);pendingDamageRolls.clear();for(const entry of turnUndoSnapshot.pending)pendingDamageRolls.set(entry.id,structuredClone(entry));clearTurnUndo();notify(`Returned to Turn ${state.turn.number}.`);render();
}
function resetLatestResult(){latestRollTab='actions';latestRollTitle='Ready';const title='Ready',total='—',detail='Press an attack, spell, save, or skill button. Altered rolls the correct dice and modifiers automatically.';$('#latest-roll').classList.remove('flash');$('#roll-title').textContent=title;$('#roll-total').textContent=total;$('#roll-detail').textContent=detail;$('#play-roll-title').textContent=title;$('#play-roll-total').textContent=total;$('#play-roll-detail').textContent=detail;const toast=$('#roll-toast');toast.hidden=true;toast.classList.remove('show');if(rollToastTimer!==undefined)window.clearTimeout(rollToastTimer);}
function setCharacter(next:Character){character=next;baseCharacter=baseCharacters.find(entry=>entry.id===next.id)??next;state=createInitialState(character);sheet=resolveSheet(character,state);selectedOptionId='base';currentTab='actions';formSearch='';formFilter='all';$<HTMLInputElement>('#form-search').value='';$<HTMLSelectElement>('#form-filter').value='all';radiantActions.clear();selectedOptionalBonuses.clear();selectedRollModes.clear();selectedMultiattackVariants.clear();selectedSpellSlots.clear();pendingDamageRolls.clear();resetLatestResult();notify(`${character.name} loaded in Base Form.`);render();}
function reconcileState(next:Character,previous:GameState){
  const clean=createInitialState(next);clean.hp=Math.min(previous.hp,next.hp.max);clean.tempHp=previous.tempHp;clean.life={...previous.life};clean.exhaustionLevel=previous.exhaustionLevel;clean.relentlessRageDc=previous.relentlessRageDc;if(previous.pendingRelentlessRage)clean.pendingRelentlessRage={...previous.pendingRelentlessRage};if(previous.tempHpSource)clean.tempHpSource=previous.tempHpSource;
  for(const [id,pool] of Object.entries(clean.resources)){const old=previous.resources[id];if(old)pool.current=Math.min(old.current,pool.max);}
  for(const [level,slot] of Object.entries(clean.spellSlots)){const old=previous.spellSlots[level];if(old)slot.current=Math.min(old.current,slot.max);}
  clean.conditions=[...previous.conditions];clean.overlays=previous.overlays.filter(id=>id.startsWith('spell:')||(next.transformationGrants??[]).some(grant=>grant.id===id));clean.activeSpellEffects=previous.activeSpellEffects.map(effect=>({...effect}));clean.receivedEffects=previous.receivedEffects.map(effect=>({...effect}));clean.recharges=Object.fromEntries(Object.entries(previous.recharges).map(([key,value])=>[key,{...value}]));clean.actionUses={...previous.actionUses};clean.log=[...previous.log];clean.turn={...previous.turn,oncePerTurn:{...previous.turn.oncePerTurn}};clean.rage={...previous.rage};clean.concentrationChecks=previous.concentrationChecks.map(check=>({...check}));
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
function currentFormArtTarget(){const target=artTargetInfo();return target.targetId.startsWith('form:')?target:null;}
async function saveArtwork(file:File,target:{targetId:string;label:string}){
  notify(`Optimizing artwork for ${target.label}…`);const optimized=await optimizePortrait(file);await saveArtOverride(character.id,target.targetId,optimized);artOverrideCache.set(artCacheKey(target.targetId),optimized);notify(`Custom artwork saved for ${target.label}.`);renderArt();
}
async function resetArtwork(target:{targetId:string;label:string}){await removeArtOverride(character.id,target.targetId);artOverrideCache.set(artCacheKey(target.targetId),undefined);notify(`Default artwork restored for ${target.label}.`);renderArt();}
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
  const preview=!aura.active&&currentWorkspace==='forms'?currentOption():undefined;
  const activeForm=creatureById(active?.formId);
  const previewForm=preview&&preview.profile!=='base'&&preview.formId?creatureById(preview.formId):undefined;
  const displayedForm=activeForm??previewForm;
  const previewing=!aura.active&&Boolean(previewForm);
  const previewReady=Boolean(previewing&&preview?.usable&&!actionCostError(state,preview.actionCost,sheet.conditionImmunities));
  const beastIdentity=displayedForm?.type.toLowerCase()==='beast';
  const mainTarget=displayedForm?{targetId:`form:${displayedForm.id}`,label:displayedForm.name,fallbackKey:displayedForm.artKey}:{targetId:'base',label:character.name,fallbackKey:'base'};
  container.classList.toggle('is-active',aura.active);container.classList.toggle('is-preview',previewing);container.classList.toggle('is-base',!aura.active&&!previewing);
  appendPortrait(container,mainTarget.targetId,mainTarget.fallbackKey,mainTarget.label);
  if(aura.active){const pulse=document.createElement('div');pulse.className='form-aura-pulse';pulse.setAttribute('aria-hidden','true');container.append(pulse);}
  const stateLabel=aura.active?'ACTIVE FORM':previewing?'FORM PREVIEW':'BASE FORM';
  const displayLabel=aura.active?aura.label:previewing?preview?.label??mainTarget.label:'Base Form';
  container.setAttribute('aria-label',`${stateLabel}: ${displayLabel}`);
  const persistentCopy=$('#open-persistent-form');persistentCopy.classList.toggle('is-active',aura.active);persistentCopy.classList.toggle('is-preview',previewing);persistentCopy.classList.toggle('is-ready',previewReady);persistentCopy.classList.toggle('is-beast',beastIdentity);
  if(previewReady)persistentCopy.title=`${displayLabel} is available to transform into now.`;else persistentCopy.removeAttribute('title');
  $('#persistent-form-state').textContent=stateLabel;$('#persistent-form-name').textContent=displayLabel;
  const statContext=$('#persistent-stat-context');statContext.hidden=!previewing;statContext.textContent=previewing?'Current stats until transformed':'';$<HTMLElement>('.persistent-form-stats').setAttribute('aria-label',previewing?'Current character statistics until transformation':'Live current form statistics');
  const target=artTargetInfo();$('#art-target-label').textContent=`Artwork target: ${target.label}`;
  const reset=$<HTMLButtonElement>('#reset-art');const cached=artOverrideCache.get(artCacheKey(target.targetId));reset.disabled=!cached;
  const currentForm=currentFormArtTarget();$('#more-art-target').textContent=currentForm?`Character: ${character.name} · current form: ${currentForm.label}`:`Character: ${character.name} · choose or activate a form before adding separate form art.`;const formInput=$<HTMLInputElement>('#current-form-art-file');formInput.disabled=!currentForm;formInput.parentElement?.classList.toggle('is-disabled',!currentForm);formInput.parentElement?.setAttribute('title',currentForm?`Upload artwork for ${currentForm.label}`:'Choose or activate a form first');$<HTMLButtonElement>('#more-reset-art').disabled=!cached;
}
function auraPaletteClass(){
  const active=state.activeTransform?.option;
  if(!active)return state.overlays.length?'aura-overlay':undefined;
  const form=creatureById(active.formId);
  const normalizedType=(form?.type??'').toLowerCase();
  const normalizedId=(form?.id??active.id).toLowerCase();
  const normalizedName=(form?.name??active.label).toLowerCase();
  const isMoonDruidWildshape=active.profile==='wildshape'&&character.classes.some(c=>c.name==='Druid'&&c.subclass?.toLowerCase().includes('moon'));
  if(normalizedType==='beast'){
    const identity=`${normalizedId} ${normalizedName}`;
    if(/octopus|shark|eel|fish|crab|seahorse|quipper|dolphin|whale|ray|seal/.test(identity))return 'aura-aquatic';
    if(/spider|scorpion|centipede|snake|serpent|cobra/.test(identity))return 'aura-venom';
    if(/lion|tiger|panther|leopard|jaguar|cat/.test(identity))return 'aura-feline';
    if(/bear/.test(identity))return 'aura-ursine';
    if(/wolf|dire wolf|dog|jackal|hyena|fox/.test(identity))return 'aura-lupine';
    if(/eagle|owl|hawk|falcon|raven|vulture|bird/.test(identity))return 'aura-avian';
    return isMoonDruidWildshape?'aura-moon':'aura-beast';
  }
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
  for(const value of ['aura-moon','aura-beast','aura-aquatic','aura-venom','aura-feline','aura-ursine','aura-lupine','aura-avian','aura-nature','aura-arcane','aura-prismatic','aura-overlay','aura-rage','aura-undead','aura-shadow','aura-fey','aura-fiend','aura-celestial','aura-draconic','aura-plant','aura-ooze','aura-construct','aura-aberrant','aura-elemental','aura-elemental-fire','aura-elemental-water','aura-elemental-air','aura-elemental-earth'])app.classList.toggle(value,value===palette);
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
  $<HTMLInputElement>('#magic-effects-enabled').checked=magicEffectsEnabled;$<HTMLInputElement>('#reduce-motion').checked=reduceMotion;$<HTMLInputElement>('#guided-next-step').checked=guidedNextStep;$<HTMLInputElement>('#auto-refresh-character').checked=autoRefreshCharacter;
  $('#character-refresh-status').textContent=characterRefreshMessage;const refresh=$<HTMLButtonElement>('#settings-refresh-character');refresh.disabled=characterRefreshRunning;refresh.textContent=characterRefreshRunning?'Checking…':'Check Character Now';
  $('#content-registry-summary').textContent=`${auditSnapshot.rules} source-ledgered rules cover ${auditSnapshot.functions} state-changing functions (${auditSnapshot.counts.calculated} calculated, ${auditSnapshot.counts.conditional} conditional). ${registrySnapshot.packs.length} versioned built-in packs plus ${installedPacks.length} private local packs are verified through ${registrySnapshot.verifiedThrough}.`;
  renderContentRegistry($('#content-pack-list'));
  const catalog=$('#srd-catalog-status');const state=srdCatalogChecking?'checking':srdCatalogStatus?.healthy?'success':srdCatalogStatus?'warning':srdCatalogMessage.includes('unavailable')?'error':'idle';catalog.className=`catalog-check-result ${state}`;catalog.textContent=srdCatalogChecking?'Checking the live legal SRD 5.2.1 catalog now…':srdCatalogStatus?`${srdCatalogStatus.healthy?'✓ Current and verified':'⚠ Needs review'} · ${srdCatalogStatus.recordCount.toLocaleString()} legal SRD 5.2.1 support records · checked ${new Date(srdCatalogStatus.checkedAt).toLocaleString()}. The live catalog supplies relevant import data; validated built-in rules remain available offline.`:srdCatalogMessage;const check=$<HTMLButtonElement>('#refresh-srd-catalog');check.disabled=srdCatalogChecking;check.textContent=srdCatalogChecking?'Checking…':srdCatalogStatus?'Check Again':'Check Now';
}
function setCharacterRefreshStatus(message:string){
  characterRefreshMessage=message;const status=document.querySelector<HTMLElement>('#character-refresh-status');if(status)status.textContent=message;
  for(const selector of ['#refresh-character','#settings-refresh-character']){const control=document.querySelector<HTMLButtonElement>(selector);if(control){control.disabled=characterRefreshRunning;control.textContent=characterRefreshRunning?(selector==='#refresh-character'?'Refreshing…':'Checking…'):(selector==='#refresh-character'?'Refresh Character':'Check Character Now');}}
}
function linkedDdbSourceId(target=baseCharacter){
  const value=target.provenance.sourceId?.trim()??'';if(target.provenance.provider==='dndbeyond'&&/^\d+$/.test(value))return value;
  // Early Altered imports already used this stable numeric ID shape before
  // provenance was stored. Recognizing it preserves upgrade compatibility.
  return target.id.match(/^ddb-(\d{5,15})$/)?.[1]??null;
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
    const signout=$<HTMLAnchorElement>('#account-signout');
    $('#account-name').textContent=displayName||email;
    status.title=email?`Signed in as ${email}`:'Signed in to Altered';
    status.hidden=false;
    signout.hidden=false;
  }catch{
    // Standalone and local builds intentionally have no hosted account route.
  }
}
function setImportStatus(message:string){$('#import-status').textContent=message;}
function privatePdfStatus(message:string){$('#private-pdf-status').textContent=message;}
function showPrivatePdfResult(title:string,summary:string,items:string[],record:PrivatePdfRecord|null=null){
  pendingPrivatePdfResultRecord=record;$('#private-pdf-result-title').textContent=title;$('#private-pdf-result-summary').textContent=summary;const list=$('#private-pdf-result-list');clear(list);for(const item of items)list.append(text('li',item));$<HTMLButtonElement>('#scan-private-pdf-result').hidden=!record;$<HTMLDialogElement>('#private-pdf-result-dialog').showModal();
}
function formatFileSize(bytes:number){if(bytes>=1024*1024)return `${(bytes/(1024*1024)).toFixed(bytes>=10*1024*1024?1:2)} MB`;return `${Math.max(1,Math.ceil(bytes/1024))} KB`;}
function privatePdfRequestHeaders(){return {'X-Altered-Request':'app'};}
function renderPrivatePdfLibrary(records:PrivatePdfRecord[]){
  const list=$('#private-pdf-list');clear(list);$('#private-pdf-count').textContent=records.length?`${records.length} saved`:'';
  if(!records.length){list.append(text('div','No account PDFs saved yet.','private-pdf-empty'));return;}
  for(const record of records){
    const entry=document.createElement('article');entry.className='private-pdf-entry';const details=document.createElement('div');details.append(text('strong',record.name),text('small',`${formatFileSize(record.size)} · saved ${new Date(record.uploadedAt).toLocaleDateString()}`));
    const actions=document.createElement('div');actions.className='private-pdf-entry-actions';
    actions.append(
      button('Scan for this character',()=>void readPrivatePdfForCharacter(record),'button primary compact'),
      button('Download',()=>void downloadPrivatePdf(record),'button secondary compact'),
      button('Delete',()=>void deletePrivatePdf(record),'button danger compact'),
    );
    entry.append(details,actions);list.append(entry);
  }
}
async function privatePdfError(response:Response){try{const payload=await response.json() as {error?:unknown};if(typeof payload.error==='string')return payload.error;}catch{}return `Private PDF service returned status ${response.status}.`;}
async function refreshPrivatePdfLibrary(){
  privatePdfStatus('Loading your private PDF library…');
  try{const response=await fetch('/api/private-pdfs',{headers:{Accept:'application/json',...privatePdfRequestHeaders()},credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error(await privatePdfError(response));const payload=await response.json() as {documents?:PrivatePdfRecord[]};const records=Array.isArray(payload.documents)?payload.documents:[];renderPrivatePdfLibrary(records);privatePdfStatus(records.length?'Your private PDFs are available on every device using this Altered login.':'Upload a private PDF to make it available on your signed-in devices.');}
  catch(error){renderPrivatePdfLibrary([]);privatePdfStatus(error instanceof Error&&/not found|status 404/i.test(error.message)?'Account PDF storage is available in the hosted Altered app.':`Private PDF library unavailable: ${error instanceof Error?error.message:'Unknown error'}`);}
}
function privatePdfId(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,14)}`;}
async function privatePdfUploadRequest(url:string,options:RequestInit,retries=3){
  let lastError:Error|null=null;
  for(let attempt=1;attempt<=retries;attempt++){
    try{const response=await fetch(url,{...options,credentials:'same-origin',headers:{...privatePdfRequestHeaders(),...(options.headers??{})}});if(response.ok)return response;const message=await privatePdfError(response);if(response.status<500&&response.status!==429)throw new Error(message);lastError=new Error(message);}
    catch(error){lastError=error instanceof Error?error:new Error('The upload connection failed.');}
    if(attempt<retries)await new Promise(resolve=>window.setTimeout(resolve,attempt*750));
  }
  throw lastError??new Error('The upload connection failed.');
}
async function uploadPrivatePdf(file:File):Promise<PrivatePdfRecord>{
  if(file.size>PRIVATE_PDF_LIMIT)throw new Error('PDF exceeds the 500 MB account-storage limit.');
  if(file.type&&file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))throw new Error('Choose a PDF file.');
  const progress=$<HTMLProgressElement>('#private-pdf-progress');progress.hidden=false;progress.value=0;const id=privatePdfId();let uploadId='';privatePdfStatus(`Preparing ${file.name} for a secure chunked upload…`);
  try{
    const created=await privatePdfUploadRequest(`/api/private-pdfs/${id}?action=create`,{method:'POST',headers:{'X-Altered-Filename':encodeURIComponent(file.name),'X-Altered-Size':String(file.size)}});
    const createPayload=await created.json() as {uploadId?:unknown};if(typeof createPayload.uploadId!=='string'||!createPayload.uploadId)throw new Error('Private storage did not start the upload.');uploadId=createPayload.uploadId;
    const parts:{partNumber:number;etag:string}[]=[];const totalParts=Math.ceil(file.size/PRIVATE_PDF_PART_SIZE);
    for(let index=0;index<totalParts;index++){
      const partNumber=index+1;const chunk=file.slice(index*PRIVATE_PDF_PART_SIZE,Math.min(file.size,(index+1)*PRIVATE_PDF_PART_SIZE));privatePdfStatus(`Uploading ${file.name}: part ${partNumber} of ${totalParts}…`);
      const uploaded=await privatePdfUploadRequest(`/api/private-pdfs/${id}?action=part&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,{method:'PUT',headers:{'Content-Type':'application/octet-stream','X-Altered-Part-Size':String(chunk.size)},body:chunk});
      const part=await uploaded.json() as {partNumber?:unknown;etag?:unknown};if(typeof part.partNumber!=='number'||typeof part.etag!=='string')throw new Error(`Part ${partNumber} was not confirmed by private storage.`);parts.push({partNumber:part.partNumber,etag:part.etag});progress.value=Math.round(partNumber/totalParts*100);
    }
    const completed=await privatePdfUploadRequest(`/api/private-pdfs/${id}?action=complete&uploadId=${encodeURIComponent(uploadId)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({parts})});const payload=await completed.json() as {size?:unknown};const size=typeof payload.size==='number'?payload.size:file.size;privatePdfStatus(`${file.name} saved to your private Altered account.`);return {id,name:file.name,size,uploadedAt:new Date().toISOString()};
  }catch(error){
    if(uploadId)void fetch(`/api/private-pdfs/${id}?action=abort&uploadId=${encodeURIComponent(uploadId)}`,{method:'DELETE',headers:privatePdfRequestHeaders(),credentials:'same-origin'});throw error;
  }finally{progress.hidden=true;}
}
async function downloadPrivatePdf(record:PrivatePdfRecord){
  privatePdfStatus(`Preparing ${record.name}…`);try{const response=await fetch(`/api/private-pdfs/${encodeURIComponent(record.id)}`,{headers:privatePdfRequestHeaders(),credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error(await privatePdfError(response));const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=record.name;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);privatePdfStatus(`${record.name} downloaded.`);}catch(error){privatePdfStatus(`Download failed: ${error instanceof Error?error.message:'Unknown error'}`);}
}
async function readPrivatePdfForCharacter(record:PrivatePdfRecord){
  privatePdfStatus(`Comparing ${record.name} with ${character.name}…`);
  try{
    const review=await findPrivatePdfCharacterMechanics(record);pendingPrivatePdfReview={record,...review};renderPrivatePdfReview();$<HTMLDialogElement>('#import-dialog').close();$<HTMLDialogElement>('#private-pdf-review-dialog').showModal();
  }catch(error){privatePdfStatus(`Could not read this PDF: ${error instanceof Error?error.message:'Unknown error'}`);}
}
function privatePdfCharacterTargets():PrivatePdfTarget[]{
  const targets:PrivatePdfTarget[]=[];const add=(target:PrivatePdfTarget)=>{const name=target.name.trim();if(name.length<3||targets.some(entry=>entry.name.toLowerCase()===name.toLowerCase()))return;targets.push({...target,name});};
  if(pendingDdbImport?.character.id===baseCharacter.id)for(const need of pendingDdbImport.setupNeeds)add({id:need.id,name:need.label,kind:need.kind==='subclass'?'Class or subclass':need.kind==='species'?'Species':need.kind==='feat'?'Feat':need.kind==='spell'?'Spell':need.kind==='item'?'Equipped item':'Character feature',detail:need.detail});
  for(const feature of character.features)if(feature.automation==='reference'||feature.automation==='unsupported')add({id:`feature-${slug(feature.id)}`,name:feature.name,kind:'Character feature',detail:'This feature is on the character sheet but does not yet have complete executable rules.'});
  for(const feat of character.feats){const evaluated=sheet.features.find(feature=>feature.name.toLowerCase()===feat.toLowerCase());if(evaluated?.status==='ruling')add({id:`feat-${slug(feat)}`,name:feat,kind:'Feat',detail:'This feat is on the selected character but still has reference-only mechanics.'});}
  for(const spell of character.spells)if(spell.resolution==='manual')add({id:`spell-${slug(spell.id??spell.name)}`,name:spell.name,kind:'Spell',detail:'This spell is on the selected character and currently resolves manually.'});
  for(const item of character.items)if(item.equipped&&(item.mechanics==='reference-only'||item.mechanics==='review-required'))add({id:`item-${slug(item.id)}`,name:item.name,kind:'Equipped item',detail:'This equipped item needs private rules beyond the numeric totals already imported.'});
  return targets.slice(0,160);
}
async function copyText(value:string){
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return;}
  const field=document.createElement('textarea');field.value=value;field.readOnly=true;field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();const copied=document.execCommand('copy');field.remove();if(!copied)throw new Error('Copy was blocked by this browser.');
}
async function copyChatGptRequest(source='Source supplied by the user in ChatGPT'){
  const needs=(pendingPrivatePdfReview?.unmatched.length?pendingPrivatePdfReview.unmatched:privatePdfCharacterTargets()).map(({id,name,kind,detail})=>({id,name,kind,detail}));
  const status=$('#assistant-proposal-status');
  if(!needs.length){status.textContent=`${character.name} has no unresolved imported mechanics for ChatGPT to complete.`;return;}
  try{
    await copyText(assistantRequestText(baseCharacter,source,needs));
    status.textContent=`Request copied for ${character.name}. Open ChatGPT, attach or quote only the source you own, paste the request, then return here to review the JSON proposal.`;
    notify('Character-scoped ChatGPT request copied.');
  }catch(error){status.textContent=`Could not copy the request: ${error instanceof Error?error.message:'Unknown error'}`;}
}
async function reviewAssistantProposal(file:File){
  const status=$('#assistant-proposal-status');status.textContent=`Checking ${file.name} against ${character.name} and the D&D 5e 2024 pack schema…`;
  try{
    const pack=parseAssistantProposal(await file.text(),baseCharacter);const result=await installAndApplyPack(pack);
    status.textContent=result.applied?`${pack.metadata.name} validated and added to ${character.name}. ${packCounts(pack)}. Review the visible controls against your 2024 source before play.`:`${pack.metadata.name} is valid but does not match ${character.name}; nothing changed.`;
    renderSettings();
  }catch(error){status.textContent=`Proposal rejected: ${error instanceof Error?error.message:'Unknown error'}`;}
}
function activationFromPrivateText(value:string):ActionCost{const lower=value.toLowerCase();if(/\bbonus action\b/.test(lower))return'bonus';if(/\breaction\b/.test(lower))return'reaction';if(/\bmagic action\b/.test(lower))return'magic-action';if(/\bas an action\b|\btake the action\b/.test(lower))return'action';return'none';}
async function hostedPrivatePdfDocument(record:PrivatePdfRecord){
  await loadImportScript('./pdf.bundle.js',()=>Boolean(externalWindow.pdfjsLib));const library=externalWindow.pdfjsLib;if(!library)throw new Error('PDF reader did not initialize.');
  if(library.GlobalWorkerOptions)library.GlobalWorkerOptions.workerSrc='./pdf.worker.min.mjs';
  return library.getDocument({url:`/api/private-pdfs/${encodeURIComponent(record.id)}`,disableWorker:true,withCredentials:true,httpHeaders:privatePdfRequestHeaders(),rangeChunkSize:256*1024,disableStream:true,disableAutoFetch:true}).promise;
}
async function findPrivatePdfCharacterMechanics(record:PrivatePdfRecord){
  const targets=privatePdfCharacterTargets();if(!targets.length)return {matches:[],searched:0,pages:0,unmatched:[]};const unmatched=[...targets];const matches:PrivatePdfMatch[]=[];const pdf=await hostedPrivatePdfDocument(record);const pageLimit=Math.min(pdf.numPages,1200);
  for(let pageNumber=1;pageNumber<=pageLimit&&unmatched.length;pageNumber++){
    privatePdfStatus(`Scanning only ${character.name}'s content · page ${pageNumber} of ${pageLimit}…`);const page=await pdf.getPage(pageNumber);const content=await page.getTextContent();if(!content.items.length)continue;
    for(let index=unmatched.length-1;index>=0;index--){const target=unmatched[index]!;const summary=findPdfRuleEntry(content.items,target.name,target.kind);if(!summary)continue;matches.push({...target,page:pageNumber,summary,activation:activationFromPrivateText(summary),selected:true});unmatched.splice(index,1);}
  }
  return {matches:matches.sort((a,b)=>a.kind.localeCompare(b.kind)||a.name.localeCompare(b.name)),searched:targets.length,pages:pageLimit,unmatched};
}
function renderPrivatePdfReview(){
  const review=pendingPrivatePdfReview;if(!review)return;$('#private-pdf-review-title').textContent=review.matches.length?`Review matches for ${character.name}`:'Scan complete — no matches';$('#private-pdf-review-intro').textContent=`Altered compared ${review.record.name} only with content already present on ${character.name}'s character sheet. It will not add unrelated book options or duplicate imported totals.`;
  $('#private-pdf-review-summary').textContent=review.matches.length?`Scanned ${review.pages} pages and found ${review.matches.length} exact match${review.matches.length===1?'':'es'} among ${review.searched} character entries. Nothing changes until you press Add.`:`Scanned ${review.pages} pages and checked ${review.searched} character ${review.searched===1?'entry':'entries'}. No exact readable matches were found, so nothing was added or changed.`;
  const list=$('#private-pdf-review-list');clear(list);for(const match of review.matches){const row=document.createElement('label');row.className='private-pdf-match';const input=document.createElement('input');input.type='checkbox';input.checked=match.selected;input.addEventListener('change',()=>{match.selected=input.checked;syncPrivatePdfReviewButton();});const copy=document.createElement('span');const heading=document.createElement('span');heading.className='private-pdf-match-heading';heading.append(text('strong',match.name),text('span',`${match.kind} · page ${match.page}`,'ui-status selected'));copy.append(heading,text('small',match.activation==='none'?'Adds a rules reminder; existing imported totals stay unchanged.':`Adds a ${match.activation.replace('-',' ')} control; existing imported totals stay unchanged.`),text('p',match.summary));row.append(input,copy);list.append(row);}
  if(!review.matches.length)list.append(text('div','The PDF may be image-only, use different wording, or may not contain this character’s unresolved options. Open Advanced setup only if you need to add a specific rule manually.','private-pdf-empty'));syncPrivatePdfReviewButton();
}
function syncPrivatePdfReviewButton(){const review=pendingPrivatePdfReview;const count=review?.matches.filter(match=>match.selected).length??0;const apply=$<HTMLButtonElement>('#apply-private-pdf-matches');apply.disabled=count===0;apply.textContent=count?`Add ${count} Selected ${count===1?'Entry':'Entries'}`:'No Matches Selected';}
async function applyPrivatePdfMatches(){
  const review=pendingPrivatePdfReview;if(!review)return;const selected=review.matches.filter(match=>match.selected);if(!selected.length)return;const apply=$<HTMLButtonElement>('#apply-private-pdf-matches');apply.disabled=true;apply.textContent='Adding content…';
  for(const match of selected){const pack=privateMechanicPack(baseCharacter,{packId:`pdf-${slug(review.record.id)}-${slug(match.id)}`.slice(0,120),name:match.name,source:`Private PDF: ${review.record.name}, page ${match.page}`,summary:match.summary,mode:match.activation==='none'?'reference':'conditional',retainInWildShape:true,activation:match.activation});await installExtensionPack(pack);}
  installedPacks=await loadValidatedInstalledPacks();rebuildEffectiveCharacterLibrary(true);renderInstalledPacks();renderSettings();render();$<HTMLDialogElement>('#private-pdf-review-dialog').close();privatePdfStatus(`${selected.length} matching ${selected.length===1?'entry':'entries'} added to ${character.name}.`);notify(`Private content added to ${character.name}.`);showPrivatePdfResult('Content added',`${selected.length} matching ${selected.length===1?'entry was':'entries were'} added to ${character.name}.`,[...selected.map(match=>`${match.name} — ${match.kind}, page ${match.page}`),`${installedPacks.length} private ${installedPacks.length===1?'pack is':'packs are'} now installed on this device.`]);pendingPrivatePdfReview=null;
}
function recordSafeName(name:string){return name.length>48?`${name.slice(0,45)}…`:name;}
async function deletePrivatePdf(record:PrivatePdfRecord){
  if(!window.confirm(`Delete ${record.name} from your Altered account? This removes it from every device.`))return;privatePdfStatus(`Deleting ${record.name}…`);try{const response=await fetch(`/api/private-pdfs/${encodeURIComponent(record.id)}`,{method:'DELETE',headers:privatePdfRequestHeaders(),credentials:'same-origin'});if(!response.ok)throw new Error(await privatePdfError(response));await refreshPrivatePdfLibrary();privatePdfStatus(`${record.name} deleted from your account.`);}catch(error){privatePdfStatus(`Delete failed: ${error instanceof Error?error.message:'Unknown error'}`);}
}
type PdfPage={getTextContent:()=>Promise<{items:PdfTextItem[]}>;getViewport:(options:{scale:number})=>{width:number;height:number};render:(options:{canvasContext:CanvasRenderingContext2D;viewport:{width:number;height:number}})=>{promise:Promise<void>}};
type PdfDocument={numPages:number;getPage:(page:number)=>Promise<PdfPage>;getFieldObjects?:()=>Promise<Record<string,{value?:unknown}[]>|null>};
type PdfLibrary={GlobalWorkerOptions?:{workerSrc:string};getDocument:(options:{data?:Uint8Array;url?:string;disableWorker:boolean;withCredentials?:boolean;httpHeaders?:Record<string,string>;rangeChunkSize?:number;disableStream?:boolean;disableAutoFetch?:boolean})=>{promise:Promise<PdfDocument>}};
type OcrWorker={recognize:(image:HTMLCanvasElement)=>Promise<{data:{text:string}}>;terminate:()=>Promise<void>};
type OcrLibrary={createWorker:(language:string,oem?:number,options?:{logger?:(message:{status?:string;progress?:number})=>void})=>Promise<OcrWorker>};
const externalWindow=window as Window&{pdfjsLib?:PdfLibrary;Tesseract?:OcrLibrary};
function loadImportScript(src:string,ready:()=>boolean){if(ready())return Promise.resolve();return new Promise<void>((resolve,reject)=>{const existing=document.querySelector<HTMLScriptElement>(`script[data-import-src="${src}"]`);if(existing){existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(new Error(`Could not load ${src}.`)),{once:true});return;}const script=document.createElement('script');script.src=src;script.defer=true;script.dataset.importSrc=src;script.onload=()=>resolve();script.onerror=()=>reject(new Error(`Could not load ${src}.`));document.head.append(script);});}
async function pdfDocument(file:File){if(file.size>20*1024*1024)throw new Error('PDF exceeds the 20 MB safety limit.');await loadImportScript('./pdf.bundle.js',()=>Boolean(externalWindow.pdfjsLib));const library=externalWindow.pdfjsLib;if(!library)throw new Error('PDF reader did not initialize.');if(library.GlobalWorkerOptions)library.GlobalWorkerOptions.workerSrc='./pdf.worker.min.mjs';return library.getDocument({data:new Uint8Array(await file.arrayBuffer()),disableWorker:true}).promise;}
async function embeddedPdfText(file:File){const document=await pdfDocument(file);if(document.numPages>20)throw new Error('PDF exceeds the 20-page import safety limit.');const chunks:string[]=[];const fields=await document.getFieldObjects?.();for(const [name,entries] of Object.entries(fields??{}))for(const entry of entries){const value=entry.value;if(typeof value==='string'&&value.trim())chunks.push(`${name}: ${value}`);}for(let pageNumber=1;pageNumber<=document.numPages;pageNumber++){const page=await document.getPage(pageNumber);const content=await page.getTextContent();chunks.push(content.items.map(item=>item.str??'').join(' '));}return chunks.join('\n');}
function pdfClassLines(draft:PdfCharacterDraft){return draft.classes.map(entry=>`${entry.name} ${entry.level}${entry.subclass?` — ${entry.subclass}`:''}`).join('\n');}
function renderPdfReview(draft:PdfCharacterDraft){pendingPdfDraft=draft;$('#pdf-import-review').hidden=false;$('#pdf-import-method').textContent=draft.method;$<HTMLInputElement>('#pdf-name').value=draft.name;$<HTMLInputElement>('#pdf-species').value=draft.species;$<HTMLTextAreaElement>('#pdf-classes').value=pdfClassLines(draft);for(const ability of ['str','dex','con','int','wis','cha'] as Ability[])$<HTMLInputElement>(`#pdf-${ability}`).value=draft.abilities[ability]?.toString()??'';$<HTMLInputElement>('#pdf-hp-current').value=draft.hp.current?.toString()??'';$<HTMLInputElement>('#pdf-hp-max').value=draft.hp.max?.toString()??'';$<HTMLInputElement>('#pdf-ac').value=draft.ac?.toString()??'';$<HTMLInputElement>('#pdf-speed').value=draft.speed?.toString()??'';$<HTMLSelectElement>('#pdf-ruleset').value=draft.ruleset;const warnings=$('#pdf-import-warnings');clear(warnings);draft.warnings.forEach(message=>warnings.append(text('div',`⚠ ${message}`)));$('#pdf-import-progress').textContent=`${draft.method} complete. Review and correct every field before importing.`;}
async function preparePdfImport(file:File){pendingPdfFile=file;$('#pdf-import-review').hidden=true;$('#pdf-import-progress').textContent='Reading embedded PDF fields and text…';const ddbId=extractDdbCharacterId(file.name);if(ddbId){setImportStatus(`D&D Beyond character ID ${ddbId} found in the filename. Fetching the public structured sheet for the most complete import…`);if(await fetchDdbCharacter(ddbId)){pendingPdfFile=null;$('#pdf-import-progress').textContent='Public structured character loaded. Use the D&D Beyond review above; OCR was not needed.';return;}$('#pdf-import-progress').textContent='The public structured import was unavailable. Falling back to local PDF text and OCR.';}const draft=parsePdfCharacterText(await embeddedPdfText(file),'embedded text');renderPdfReview(draft);if(draft.warnings.length>5)$('#pdf-import-progress').textContent='Embedded text was incomplete. Run OCR for a scanned or flattened sheet, or complete the review fields manually.';}
async function runPdfOcr(){if(!pendingPdfFile)throw new Error('Choose a PDF first.');$('#pdf-import-progress').textContent='Loading the OCR engine and English recognition model…';await loadImportScript('./tesseract.bundle.js',()=>Boolean(externalWindow.Tesseract));const library=externalWindow.Tesseract;if(!library)throw new Error('OCR engine did not initialize.');const pdf=await pdfDocument(pendingPdfFile);const pageCount=Math.min(pdf.numPages,12);const worker=await library.createWorker('eng',1,{logger:message=>{if(typeof message.progress==='number')$('#pdf-import-progress').textContent=`OCR ${message.status??'working'} · ${Math.round(message.progress*100)}%`;}});const chunks:string[]=[];try{for(let index=1;index<=pageCount;index++){const page=await pdf.getPage(index);const initial=page.getViewport({scale:1.6});const scale=Math.min(1,2200/Math.max(initial.width,initial.height));const viewport=scale<1?page.getViewport({scale:1.6*scale}):initial;const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const context=canvas.getContext('2d',{alpha:false});if(!context)throw new Error('This browser cannot create the OCR canvas.');$('#pdf-import-progress').textContent=`Scanning page ${index} of ${pageCount}…`;await page.render({canvasContext:context,viewport}).promise;chunks.push((await worker.recognize(canvas)).data.text);}}finally{await worker.terminate();}renderPdfReview(parsePdfCharacterText(chunks.join('\n'),'OCR'));}
function confirmPdfImport(){const number=(id:string)=>Number($<HTMLInputElement>(id).value);const ruleset=$<HTMLSelectElement>('#pdf-ruleset').value as Character['provenance']['ruleset'];if(ruleset!=='2024')throw new Error('Altered is 2024-only. Confirm “2024 (5.2.1)” after checking the source sheet.');const imported=characterFromPdfReview({name:$<HTMLInputElement>('#pdf-name').value.trim(),species:$<HTMLInputElement>('#pdf-species').value.trim(),classLines:$<HTMLTextAreaElement>('#pdf-classes').value,abilities:{str:number('#pdf-str'),dex:number('#pdf-dex'),con:number('#pdf-con'),int:number('#pdf-int'),wis:number('#pdf-wis'),cha:number('#pdf-cha')},hp:{current:number('#pdf-hp-current'),max:number('#pdf-hp-max')},ac:number('#pdf-ac'),speed:number('#pdf-speed'),ruleset});applyImportedCharacter(imported);$('#pdf-import-review').hidden=true;setImportStatus(`${imported.name} imported from a reviewed ${pendingPdfDraft?.method??'PDF'} draft. Add verified spells, features, items, and forms through D&D Beyond or private content setup.`);}
function renderJsonReview(parsed:Character){pendingJsonImport=parsed;$('#json-import-review').hidden=false;$('#json-import-summary').textContent=`${parsed.name} · ${parsed.species} · ${parsed.classes.map(entry=>`${entry.name} ${entry.level}`).join(' / ')} · ${parsed.hp.max} HP · AC ${parsed.ac}`;const warnings=$('#json-import-warnings');clear(warnings);const messages=[...(parsed.provenance.ruleset!=='2024'?[`Rules version is ${parsed.provenance.ruleset}; Altered requires a reviewed 2024 character.`]:[]),...(parsed.provenance.reviewRequired?['Source data is marked review-required. Verify imported totals and mechanics.']:[]),...(parsed.features.some(feature=>feature.automation==='unsupported')?['One or more imported features are reference-only or unsupported.']:[])];if(!messages.length)warnings.append(text('div','✓ Schema and 2024 provenance checks passed.'));else messages.forEach(message=>warnings.append(text('div',`⚠ ${message}`)));$<HTMLButtonElement>('#confirm-json-import').disabled=parsed.provenance.ruleset!=='2024';}
function setBuilderStatus(message:string){$('#builder-status').textContent=message;}
function applyImportedCharacter(parsed:Character){
  deletedCharacterIds.delete(parsed.id);
  const baseIndex=baseCharacters.findIndex(entry=>entry.id===parsed.id);if(baseIndex>=0)baseCharacters[baseIndex]=parsed;else baseCharacters=[parsed,...baseCharacters];
  baseCharacter=parsed;const result=applyInstalledPacks(parsed);const imported=result.character;rebuildEffectiveCharacterLibrary(false);setCharacter(characters.find(entry=>entry.id===imported.id)??imported);
  const detail=result.applied?` Matching private packs added ${result.added.transformations} transformations, ${result.added.forms} forms, and ${result.added.features} features.`:'';
  finishFirstCharacterSetup();
  const firstRunDialog=$<HTMLDialogElement>('#new-user-character-dialog');if(firstRunDialog.open)firstRunDialog.close();
  setImportStatus(`${imported.name} imported successfully.${detail}`);return imported;
}
function remainingDdbSetup(report:DdbImportReport){return report.setupNeeds.filter(need=>!installedPacks.some(pack=>pack.metadata.id===ddbSetupPackId(report.sourceId,need.id)));}
function renderPendingSetupAccess(){
  const report=pendingDdbImport;const remaining=report?remainingDdbSetup(report):[];const available=Boolean(report&&remaining.length);
  const panel=$('#import-resume-panel');panel.hidden=!available;$<HTMLButtonElement>('#more-resume-setup').hidden=!available;
  if(report&&available){$('#import-resume-title').textContent=`Resume ${report.character.name}'s content setup`;$('#import-resume-detail').textContent=`${remaining.length} mechanic${remaining.length===1?'':'s'} still need${remaining.length===1?'s':''} your confirmation. Progress is saved on this device.`;}
}
function savedDdbReport(value:unknown):DdbImportReport|null{
  if(typeof value!=='object'||value===null||Array.isArray(value))return null;const report=value as Partial<DdbImportReport>;
  if(typeof report.sourceId!=='string'||!Array.isArray(report.coverage)||!Array.isArray(report.warnings)||!Array.isArray(report.setupNeeds)||typeof report.blocked!=='boolean'||!report.supportRequests)return null;
  try{return {...report,character:parseCharacter(report.character)} as DdbImportReport;}catch{return null;}
}
async function clearPendingDdbImport(){pendingDdbImport=null;confirmedDdbSourceId=null;$('#dndbeyond-review').hidden=true;renderPendingSetupAccess();await removeSetting(PENDING_DDB_SETTING);}
function resumePrivateSetup(){
  if(!pendingDdbImport){setImportStatus('There is no unfinished private-content setup on this device.');return;}
  const remaining=remainingDdbSetup(pendingDdbImport);if(!remaining.length){setImportStatus('All detected private mechanics are complete.');renderPendingSetupAccess();return;}
  openPrivateMechanics(remaining[0]?.id);
}
function deleteCurrentCharacter(){
  if(baseCharacters.length<=1){$('#delete-character-status').textContent='Import or keep at least one other character before deleting this one.';return;}
  const removed=baseCharacter;deletedCharacterIds.add(removed.id);baseCharacters=baseCharacters.filter(entry=>entry.id!==removed.id);characters=characters.filter(entry=>entry.id!==removed.id);
  if(pendingDdbImport?.character.id===removed.id)void clearPendingDdbImport();
  const next=characters[0]??baseCharacters[0];if(!next){$('#delete-character-status').textContent='Altered must keep at least one character.';return;}
  $<HTMLDialogElement>('#delete-character-dialog').close();setCharacter(next);notify(`${removed.name} deleted from this device. Use Add / Import Character to start another character.`);
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
  const setup=$<HTMLDetailsElement>('#dndbeyond-private-setup');setup.hidden=report.setupNeeds.length===0;
  const setupList=$('#dndbeyond-setup-list');clear(setupList);let completed=0;
  for(const need of report.setupNeeds){
    const packId=ddbSetupPackId(report.sourceId,need.id);const done=installedPacks.some(pack=>pack.metadata.id===packId);if(done)completed++;
    const row=document.createElement('div');row.className='ddb-setup-item';const copy=document.createElement('div');copy.append(text('strong',need.label),text('small',need.detail));
    const action=button(done?'Review':'Set Up',()=>openPrivateMechanics(need.id),'button compact secondary');row.append(text('span',need.kind,'ddb-setup-kind'),copy,done?statusChip('success','Completed'):action);setupList.append(row);
  }
  const remaining=report.setupNeeds.length-completed;$('#dndbeyond-setup-summary').textContent=remaining?`${remaining} of ${report.setupNeeds.length} need setup`:`${completed} completed`;
  const setupBadge=$('#dndbeyond-setup-badge');setupBadge.className=`ui-status ${remaining?'requirements':'success'}`;setupBadge.textContent=remaining?'Needs Setup':'Completed';
  const confirm=$<HTMLButtonElement>('#confirm-dndbeyond-import');const confirmed=confirmedDdbSourceId===report.sourceId;confirm.disabled=report.blocked||confirmed;confirm.textContent=report.blocked?'2024 Rules Required':confirmed?'Character Imported':'Confirm Import';if(report.blockReason)confirm.title=report.blockReason;else confirm.removeAttribute('title');
  renderPendingSetupAccess();
}
function privateMechanicMode(feature:OwnedContentPack['content']['features'][number]|undefined){
  if(feature?.grants?.speedBonus!==undefined)return 'speed';if(feature?.grants?.resistances?.length)return 'resistance';if(feature?.grants?.immunities?.length)return 'immunity';if(feature?.grants?.acFormula)return 'ac-formula';return feature?.automation==='conditional'?'conditional':'reference';
}
function syncPrivateMechanicFields(){
  if(manualPrivateMechanic)return;
  if(!pendingDdbImport)return;const need=pendingDdbImport.setupNeeds.find(entry=>entry.id===$<HTMLSelectElement>('#private-mechanic-need').value);if(!need)return;
  const pack=installedPacks.find(entry=>entry.metadata.id===ddbSetupPackId(pendingDdbImport!.sourceId,need.id));const feature=pack?.content.features[0];
  $('#private-mechanic-detail').textContent=need.detail;$<HTMLInputElement>('#private-mechanic-name').value=feature?.name??need.label;$<HTMLTextAreaElement>('#private-mechanic-summary').value=feature?.summary??'';
  $<HTMLSelectElement>('#private-mechanic-mode').value=privateMechanicMode(feature);$<HTMLSelectElement>('#private-mechanic-activation').value=feature?.activation??'none';$<HTMLInputElement>('#private-mechanic-wildshape').checked=feature?.retention?.wildshape!==false;
  $<HTMLInputElement>('#private-mechanic-speed').value=String(feature?.grants?.speedBonus??10);$<HTMLSelectElement>('#private-mechanic-damage').value=feature?.grants?.resistances?.[0]??feature?.grants?.immunities?.[0]??'Acid';$<HTMLInputElement>('#private-mechanic-ac-base').value=String(feature?.grants?.acFormula?.base??10);
  $<HTMLSelectElement>('#private-mechanic-ac-ability-one').value=feature?.grants?.acFormula?.abilities[0]??'';$<HTMLSelectElement>('#private-mechanic-ac-ability-two').value=feature?.grants?.acFormula?.abilities[1]??'';syncPrivateMechanicMode();
}
function syncPrivateMechanicMode(){
  const mode=$<HTMLSelectElement>('#private-mechanic-mode').value;$('#private-mechanic-speed-fields').hidden=mode!=='speed';$('#private-mechanic-damage-fields').hidden=mode!=='resistance'&&mode!=='immunity';$('#private-mechanic-ac-fields').hidden=mode!=='ac-formula';
}
function openPrivateMechanics(needId?:string){
  manualPrivateMechanic=false;
  if(!pendingDdbImport||pendingDdbImport.setupNeeds.length===0){setImportStatus('Fetch a D&D Beyond character with private mechanics to complete first.');return;}
  const select=$<HTMLSelectElement>('#private-mechanic-need');clear(select);for(const need of pendingDdbImport.setupNeeds){const option=document.createElement('option');option.value=need.id;const done=installedPacks.some(pack=>pack.metadata.id===ddbSetupPackId(pendingDdbImport!.sourceId,need.id));option.textContent=`${need.label}${done?' · Completed':''}`;select.append(option);}select.value=needId&&pendingDdbImport.setupNeeds.some(need=>need.id===needId)?needId:pendingDdbImport.setupNeeds.find(need=>!installedPacks.some(pack=>pack.metadata.id===ddbSetupPackId(pendingDdbImport!.sourceId,need.id)))?.id??pendingDdbImport.setupNeeds[0]!.id;
  $('#private-mechanics-title').textContent='Complete Private Mechanics';$('#private-mechanics-intro').textContent='Use your authorized D&D Beyond page as the reference. Enter a short mechanical reminder—not copied descriptions. Altered never requests your D&D Beyond password or cookies.';$('#private-mechanic-need-field').hidden=false;$('#private-mechanics-character').textContent=`${pendingDdbImport.character.name} · DDB ${pendingDdbImport.sourceId}`;const source=$<HTMLAnchorElement>('#private-mechanics-source-link');source.hidden=false;source.href=`https://www.dndbeyond.com/characters/${pendingDdbImport.sourceId}`;$<HTMLButtonElement>('#private-mechanic-transformation').textContent='Create Activated Form';$('#private-mechanics-status').textContent='Choose how Altered should treat this mechanic. Nothing is saved until you press Save Private Mechanic.';syncPrivateMechanicFields();$<HTMLDialogElement>('#private-mechanics-dialog').showModal();
}
function openManualPrivateMechanic(sourceReference='User-created homebrew mechanic'){
  manualPrivateMechanic=true;manualPrivateSource=sourceReference;$('#private-mechanics-title').textContent='Create Ability or Feature';$('#private-mechanics-intro').textContent=sourceReference.startsWith('Private PDF:')?'Use the selected account-owned PDF as your reference. Enter a concise mechanical reminder and confirm how Altered should apply it; the original PDF remains private.':'Create a concise homebrew or private mechanic for your current character. Altered validates it, stores it only on this device, and includes it in private-content exports.';$('#private-mechanic-need-field').hidden=true;$('#private-mechanics-character').textContent=`For ${character.name} · source: ${sourceReference}`;const source=$<HTMLAnchorElement>('#private-mechanics-source-link');source.hidden=true;
  const select=$<HTMLSelectElement>('#private-mechanic-need');clear(select);const option=document.createElement('option');option.value='manual';option.textContent='New homebrew ability';select.append(option);
  $<HTMLInputElement>('#private-mechanic-name').value='';$<HTMLTextAreaElement>('#private-mechanic-summary').value='';$<HTMLSelectElement>('#private-mechanic-mode').value='conditional';$<HTMLSelectElement>('#private-mechanic-activation').value='action';$<HTMLInputElement>('#private-mechanic-wildshape').checked=true;$<HTMLInputElement>('#private-mechanic-speed').value='10';$<HTMLSelectElement>('#private-mechanic-damage').value='Acid';$<HTMLInputElement>('#private-mechanic-ac-base').value='10';$<HTMLSelectElement>('#private-mechanic-ac-ability-one').value='';$<HTMLSelectElement>('#private-mechanic-ac-ability-two').value='';$<HTMLButtonElement>('#private-mechanic-transformation').textContent='Create Transformation Instead';
  syncPrivateMechanicMode();$('#private-mechanics-status').textContent='Choose Reminder only for reference text, Conditional for a use button, or a calculated option for Speed, resistance, immunity, or Armor Class. Nothing is saved until you press Save Private Mechanic.';$<HTMLDialogElement>('#private-mechanics-dialog').showModal();$<HTMLInputElement>('#private-mechanic-name').focus();
}
async function savePrivateMechanic(){
  const report=manualPrivateMechanic?null:pendingDdbImport;if(!manualPrivateMechanic&&!report)throw new Error('Fetch and review a D&D Beyond character first.');const need=report?.setupNeeds.find(entry=>entry.id===$<HTMLSelectElement>('#private-mechanic-need').value);if(!manualPrivateMechanic&&!need)throw new Error('Choose a mechanic to complete.');
  const name=$<HTMLInputElement>('#private-mechanic-name').value.trim(),summary=$<HTMLTextAreaElement>('#private-mechanic-summary').value.trim();if(!name||!summary)throw new Error('Display name and a short mechanical reminder are required.');
  const mode=$<HTMLSelectElement>('#private-mechanic-mode').value as 'reference'|'conditional'|'speed'|'resistance'|'immunity'|'ac-formula';const abilityValues=[$<HTMLSelectElement>('#private-mechanic-ac-ability-one').value,$<HTMLSelectElement>('#private-mechanic-ac-ability-two').value].filter((value,index,all):value is Ability=>Boolean(value)&&all.indexOf(value)===index) as Ability[];
  const target=report?.character??character;const packId=report&&need?ddbSetupPackId(report.sourceId,need.id):`manual-${slug(target.id)}-${slug(name)}-${Date.now().toString(36)}`;const source=report?`D&D Beyond character ${report.sourceId} — user-confirmed`:manualPrivateSource;
  const pack=privateMechanicPack(target,{packId,name,source,summary,mode,retainInWildShape:$<HTMLInputElement>('#private-mechanic-wildshape').checked,activation:$<HTMLSelectElement>('#private-mechanic-activation').value as TransformationOption['actionCost'],speedBonus:Number($<HTMLInputElement>('#private-mechanic-speed').value),damageType:$<HTMLSelectElement>('#private-mechanic-damage').value as DamageType,acBase:Number($<HTMLInputElement>('#private-mechanic-ac-base').value),acAbilities:abilityValues});
  if(manualPrivateMechanic){await installAndApplyPack(pack);renderSettings();$<HTMLDialogElement>('#private-mechanics-dialog').close();notify(`${name} created and added to ${character.name}.`);return;}
  await installExtensionPack(pack);installedPacks=await loadValidatedInstalledPacks();if(report&&baseCharacter.id===report.character.id)rebuildEffectiveCharacterLibrary(true);renderInstalledPacks();if(report)renderDdbReview(report);renderSettings();render();$('#private-mechanics-status').textContent=`${name} saved privately. It will be reapplied automatically whenever this character is imported on this device.`;syncPrivateMechanicFields();
}
async function loadSrdCreature(name:string){
  const params=new URLSearchParams({domain:'creatures',q:name,exact:'1'});
  const response=await fetch(`/api/srd/catalog?${params}`,{headers:{Accept:'application/json','X-Altered-Request':'app'},cache:'no-store'});
  const payload=await response.json() as unknown;if(!response.ok)throw new Error('SRD support catalog request failed.');
  const page=parseSrdCatalogPage(payload,'creatures');const exact=page.results.find(record=>String(record.name??'').toLowerCase()===name.toLowerCase());
  return exact?normalizeSrdCreature(exact):null;
}
async function refreshSrdCatalogStatus(){
  if(srdCatalogChecking)return;srdCatalogChecking=true;srdCatalogMessage='Checking the live legal SRD support catalog...';renderSettings();
  try{
    const response=await fetch('/api/srd/status',{headers:{Accept:'application/json','X-Altered-Request':'app'},cache:'no-store'});const payload=await response.json() as unknown;
    if(!response.ok)throw new Error('Catalog status request failed.');srdCatalogStatus=parseSrdCatalogStatus(payload);
    srdCatalogMessage=srdCatalogStatus.healthy?'The legal SRD support catalog is current.':'The catalog changed and needs validation before new records affect transformations.';
  }catch(error){srdCatalogStatus=null;srdCatalogMessage=`Live SRD catalog unavailable${error instanceof Error?`: ${error.message}`:''}. Altered is still using its validated offline transformation rules.`;}
  finally{srdCatalogChecking=false;renderSettings();}
}
async function retrieveDdbCharacterForRefresh(id:string){
  // Credentials stay on Altered's same-origin edge and are never forwarded to
  // D&D Beyond. A no-store request ensures the saved copy cannot mask changes.
  const response=await fetch(`/api/dndbeyond/character/${id}`,{headers:{Accept:'application/json','X-Altered-Request':'app'},credentials:'same-origin',cache:'no-store'});
  const body=await response.text();let payload:unknown;try{payload=JSON.parse(body);}catch{throw new Error(response.ok?'The refresh service returned invalid data.':'Use the hosted Altered app to refresh a linked character.');}
  if(!response.ok){const message=typeof payload==='object'&&payload!==null&&typeof (payload as {error?:unknown}).error==='string'?(payload as {error:string}).error:`Refresh service returned status ${response.status}.`;throw new Error(message);}
  let report=importDdbCharacter(payload,id);
  if(report.supportRequests.creatures.length){
    setCharacterRefreshStatus('Loading current SRD forms…');
    try{const creatures=(await Promise.all(report.supportRequests.creatures.map(loadSrdCreature))).filter((entry):entry is NonNullable<typeof entry>=>Boolean(entry));report=applyDdbSrdCreatures(report,creatures);}
    catch{report.warnings.push({code:'srd-catalog-unavailable',severity:'warning',message:'The live SRD support catalog was unavailable. Existing validated form support remains available.'});}
  }
  return report;
}
async function refreshLinkedCharacter(manual=false,force=false){
  if(!manual&&!autoRefreshCharacter)return false;
  const id=linkedDdbSourceId();
  if(!id){const message=`${baseCharacter.name} is not linked to a public D&D Beyond character. Import a public character first, or continue using this saved local version.`;setCharacterRefreshStatus(message);if(manual)notify(message);return false;}
  const now=Date.now();if(!force&&now-lastCharacterRefreshAt<CHARACTER_REFRESH_INTERVAL)return false;
  if(characterRefreshRunning)return false;characterRefreshRunning=true;lastCharacterRefreshAt=now;const targetCharacterId=baseCharacter.id;setCharacterRefreshStatus(`Checking ${baseCharacter.name} for updates…`);
  try{
    const report=await retrieveDdbCharacterForRefresh(id);
    if(report.blocked||report.character.provenance.ruleset!=='2024')throw new Error(report.blockReason??'The refreshed sheet did not pass Altered’s 2024 rules check.');
    const index=baseCharacters.findIndex(entry=>entry.id===targetCharacterId);if(index<0)throw new Error('The selected saved character is no longer available.');
    const changed=JSON.stringify(baseCharacters[index])!==JSON.stringify(report.character);baseCharacters[index]=report.character;
    if(baseCharacter.id===targetCharacterId){rebuildEffectiveCharacterLibrary(true);render();}else persist();
    const checked=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});const message=changed?`${report.character.name} updated from the latest public D&D Beyond sheet at ${checked}. Current combat state was preserved.`:`${report.character.name} is already current. Checked at ${checked}.`;
    setCharacterRefreshStatus(message);if(manual)notify(message);return true;
  }catch(error){const message=`Using the saved version of ${baseCharacter.name}; refresh could not be completed: ${error instanceof Error?error.message:'Unknown error'}`;setCharacterRefreshStatus(message);if(manual)notify(message);return false;}
  finally{characterRefreshRunning=false;setCharacterRefreshStatus(characterRefreshMessage);}
}
async function fetchDdbCharacter(explicitSource?:string):Promise<boolean>{
  const source=explicitSource??$<HTMLInputElement>('#dndbeyond-source').value;const id=extractDdbCharacterId(source);
  if(!id){setImportStatus('Enter a public D&D Beyond character link or numeric character ID.');return false;}
  $<HTMLInputElement>('#dndbeyond-source').value=id;const trigger=$<HTMLButtonElement>('#fetch-dndbeyond');trigger.disabled=true;trigger.textContent='Fetching…';
  const previousReport=pendingDdbImport;$('#dndbeyond-review').hidden=true;setImportStatus(`Retrieving D&D Beyond character ${id} without account credentials…`);
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
    pendingDdbImport=report;confirmedDdbSourceId=null;await saveJsonSetting(PENDING_DDB_SETTING,report);renderDdbReview(report);
    const reviewCount=report.coverage.filter(item=>item.status==='review').length;setImportStatus(report.blocked?report.blockReason??'This character cannot be imported into the 2024-only rules engine.':`${report.character.name} is ready for review. ${reviewCount?`${reviewCount} area${reviewCount===1?' needs':'s need'} attention before you confirm.`:'All provided core fields passed validation.'}`);
    return true;
  }catch(error){
    if(previousReport){pendingDdbImport=previousReport;renderDdbReview(previousReport);}
    setImportStatus(`D&D Beyond import failed: ${error instanceof Error?error.message:'Unknown error'}`);
    return false;
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
function renderImportedFeatManagement(){
  const root=$('#imported-feat-list');clear(root);const feats=[...baseCharacter.feats];
  $('#imported-feat-summary').textContent=feats.length?`${feats.length} imported feat${feats.length===1?'':'s'} for ${baseCharacter.name}. Remove only a name that is not on the source character sheet.`:`No imported feats are listed for ${baseCharacter.name}.`;
  if(feats.length===0){root.append(text('div','Nothing to review.','empty'));return;}
  for(const feat of feats){
    const row=document.createElement('div');row.className='imported-detail-row';const copy=document.createElement('div');copy.append(text('strong',feat),text('small',baseCharacter.provenance.provider==='dndbeyond'?'Received from the public D&D Beyond character payload.':'Included in the imported character file.'));
    const remove=button('Remove from Altered',()=>{
      const index=baseCharacters.findIndex(entry=>entry.id===baseCharacter.id);if(index<0)return;
      const updated=parseCharacter({...baseCharacter,feats:baseCharacter.feats.filter(name=>name.toLowerCase()!==feat.toLowerCase())});baseCharacters[index]=updated;baseCharacter=updated;rebuildEffectiveCharacterLibrary(true);notify(`${feat} removed from ${updated.name} in Altered. Re-import the source character to restore it.`);render();
    },'button compact danger');remove.setAttribute('aria-label',`Remove ${feat} from ${baseCharacter.name} in Altered`);row.append(copy,remove);root.append(row);
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
function syncBuilderGuidance(){
  const profile=$<HTMLSelectElement>('#builder-profile').value;const enhancement=profile==='overlay';
  $('#builder-profile-help').textContent=enhancement?'Keeps the current sheet. Best for stances, summoned limbs, auras, wings, and other additive effects.':profile==='custom'?'Use when a special state replaces broader statistics or needs its own private stat block.':'Uses the selected replacement rules profile and requires a matching form.';
  const parts:string[]=[enhancement?'Current character sheet stays active.':'Replacement-form rules apply.'];
  const from=$<HTMLSelectElement>('#builder-substitute-from').value.toUpperCase();const to=$<HTMLSelectElement>('#builder-substitute-to').value.toUpperCase();
  if(from&&from!==to){if($<HTMLInputElement>('#builder-substitute-checks').checked)parts.push(`${from} checks use ${to}`);if($<HTMLInputElement>('#builder-substitute-saves').checked)parts.push(`${from} saves use ${to}`);}
  const attack=$<HTMLSelectElement>('#builder-attack-ability').value.toUpperCase();if(attack)parts.push(`${$<HTMLSelectElement>('#builder-attack-scope').value==='weapon-unarmed'?'weapon and unarmed':'unarmed'} attack and damage rolls use ${attack}`);
  const fly=$<HTMLInputElement>('#builder-fly-speed').value.trim();const swim=$<HTMLInputElement>('#builder-swim-speed').value.trim();const climb=$<HTMLInputElement>('#builder-climb-speed').value.trim();if(fly)parts.push(`fly ${fly} ft.`);if(swim)parts.push(`swim ${swim} ft.`);if(climb)parts.push(`climb ${climb} ft.`);
  $('#builder-mechanics-summary').textContent=parts.join(' · ');
}
function applyBuilderTemplate(){
  const template=$<HTMLSelectElement>('#builder-template').value;if(template==='blank'){setBuilderStatus('Choose a starting point, or enter only the mechanics you need.');return;}
  if(template==='ability-substitution'){
    $<HTMLSelectElement>('#builder-profile').value='overlay';$<HTMLSelectElement>('#builder-action').value='bonus';$<HTMLSelectElement>('#builder-end-action').value='none';
    $<HTMLSelectElement>('#builder-substitute-from').value='str';$<HTMLSelectElement>('#builder-substitute-to').value='wis';$<HTMLInputElement>('#builder-substitute-checks').checked=true;$<HTMLInputElement>('#builder-substitute-saves').checked=true;$<HTMLSelectElement>('#builder-attack-ability').value='wis';$<HTMLSelectElement>('#builder-attack-scope').value='unarmed';
    setBuilderStatus('Ability-substitution starting point applied. Adjust the abilities, activation, duration, and optional activation save to match your source.');syncBuilderGuidance();$<HTMLSelectElement>('#builder-substitute-from').focus();return;
  }
  if(template==='movement'){$<HTMLSelectElement>('#builder-profile').value='overlay';$<HTMLSelectElement>('#builder-action').value='bonus';$<HTMLSelectElement>('#builder-end-action').value='none';setBuilderStatus('Movement-enhancement starting point applied. Enter only the granted movement speed and any confirmed duration or resource.');syncBuilderGuidance();$<HTMLInputElement>('#builder-fly-speed').focus();return;}
  $<HTMLSelectElement>('#builder-profile').value='custom';$<HTMLSelectElement>('#builder-end-action').value='bonus';setBuilderStatus('Replacement-form starting point applied. Use the ordinary fields first; add a private stat block only when the effect truly replaces statistics.');syncBuilderGuidance();$<HTMLSelectElement>('#builder-retention').focus();
}
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
  const substituteFrom=$<HTMLSelectElement>('#builder-substitute-from').value as Ability|'';const substituteTo=$<HTMLSelectElement>('#builder-substitute-to').value as Ability;if(substituteFrom&&substituteFrom!==substituteTo){if($<HTMLInputElement>('#builder-substitute-checks').checked)effects.checkAbilitySubstitution={[substituteFrom]:substituteTo};if($<HTMLInputElement>('#builder-substitute-saves').checked)effects.saveAbilitySubstitution={[substituteFrom]:substituteTo};}
  const attackAbility=$<HTMLSelectElement>('#builder-attack-ability').value as Ability|'';if(attackAbility)effects.attackAbilityOverride={ability:attackAbility,appliesTo:$<HTMLSelectElement>('#builder-attack-scope').value==='weapon-unarmed'?['weapon','unarmed']:['unarmed']};
  const triggerName=$<HTMLInputElement>('#builder-trigger-name').value.trim();if(triggerName){const triggerDamage=$<HTMLInputElement>('#builder-trigger-damage').value.trim();if(!triggerDamage)throw new Error('Enter damage dice for the optional activation effect, or clear its effect name.');effects.actions=[...(effects.actions??[]),{id:`${slug(triggerName)}-activation`,name:triggerName,type:'save',cost:'none',saveAbility:$<HTMLSelectElement>('#builder-trigger-save').value as Ability,dc:numericValue('#builder-trigger-dc')??10,damageOnFail:[{expression:triggerDamage,type:$<HTMLSelectElement>('#builder-trigger-damage-type').value as DamageType}],...($<HTMLInputElement>('#builder-trigger-half').checked?{halfOnSuccess:true}:{}),notes:'Resolve this once when the transformation is activated. The target rolls the listed saving throw.'}];}
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
  for(const c of characters){const option=document.createElement('option');option.value=c.id;option.textContent=DEMO_CHARACTER_IDS.has(c.id)?`${c.name} · Demo`:c.name;select.append(option);}select.value=character.id;
  $('#character-name').textContent=character.name;
  $('#character-build').textContent=`${character.species} · ${character.classes.map(c=>`${c.subclass?`${c.subclass} `:''}${c.name} ${c.level}`).join(' / ')}${DEMO_CHARACTER_IDS.has(character.id)?' · Demo character':''}`;
  const meta=rulesMetadata();$('#rules-badge').textContent=`App ${APP_VERSION} · Rules SRD ${meta.srd} · ${auditSnapshot.rules} audited · verified ${meta.reviewed}`;
  $<HTMLButtonElement>('#more-delete-character').disabled=baseCharacters.length<=1;
  renderImportedFeatManagement();
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
  const selected=options.find(o=>o.id===selectedOptionId);const active=state.activeTransform?.option;const overlayEnd=[...options].reverse().find(option=>option.profile==='overlay'&&option.deactivate);const aura=activeAuraVisual();const overlayLabel=aura.overlays.map(overlay=>overlay.label).join(' + ');
  const currentLabel=active?.label??(overlayLabel||'Base Form');const currentDetail=active?`${active.source} · ${actionCostLabel(active.actionCost)}`:aura.overlays.length?`Active additive transformation${aura.overlays.length===1?'':'s'} · tap End to release the latest`:`${character.name} · Character sheet`;
  $('#play-view-title').textContent=currentLabel;$('#play-form-detail').textContent=currentDetail;$('#persistent-form-name').textContent=currentLabel;
  $('#character-form-summary').textContent=active&&selected?.id!==active.id?`${selected?.label??'Form'} selected · ${active.label} active`:active?`${active.label} active`:`${selected?.label??'Base Form'} selected`;
  const economyError=selected&&selected.profile!=='base'&&selected.id!==active?.id?actionCostError(state,selected.actionCost,sheet.conditionImmunities):null;
  const results=$('#form-results-status');const hiddenSelection=Boolean(selected&&!matched.some(option=>option.id===selected.id)&&selected.profile!=='base');results.textContent=!search&&formFilter==='all'?'':`${matched.length} of ${options.length} forms shown${hiddenSelection?' · selected form retained':''}.`;
  const statuses=$('#form-status-strip');clear(statuses);
  if(selected){statuses.append(statusChip('selected'));if(selected.id===active?.id)statuses.append(statusChip('active'));else if(selected.profile==='base')statuses.append(statusChip('available','Base Form'));else if(selected.usable&&!economyError)statuses.append(statusChip('available'));else statuses.append(statusChip(selected.usable?'unavailable':'locked',selected.usable?'Unavailable now':'Locked',economyError??selected.reason));if(selected.profile!=='base')statuses.append(statusChip('inactive',actionCostLabel(selected.actionCost)));}
  $('#form-reason').textContent=active&&selected?.id===active.id?`${active.label} is active. Choose another legal form to change directly, or press End Form to return to ${character.name}.`:economyError??selected?.reason??selected?.source??'';
  const transform=$<HTMLButtonElement>('#transform-button');const transformLabel=selected?.deactivate?selected.label:selected?.profile==='overlay'?'Activate':active&&selected?.id!==active.id?'Change Form':selected?.profile==='base'?'Choose a Form':'Transform';const transformBlockedReason=economyError??(!selected?.usable?selected?.reason:null);transform.textContent=transformBlockedReason?`${transformLabel} unavailable`:transformLabel;transform.disabled=!selected||!selected.usable||Boolean(economyError)||selected.profile==='base'||selected.id===active?.id;transform.hidden=Boolean(!selected||selected.profile==='base'||selected.id===active?.id);transform.classList.toggle('transform-cue-ready',!transform.hidden&&!transform.disabled);transform.classList.toggle('transform-cue-blocked',!transform.hidden&&transform.disabled);transform.dataset.transformState=transform.hidden?'hidden':transform.disabled?'blocked':'ready';transform.setAttribute('aria-label',transform.hidden?transformLabel:transform.disabled?`${transformLabel}. Unavailable: ${transformBlockedReason??'requirements not met'}`:`${transformLabel}. Available now`);if(transformBlockedReason)transform.title=transformBlockedReason;else transform.removeAttribute('title');
  const end=$<HTMLButtonElement>('#end-form-button');const permanentTruePolymorph=active?.profile==='true-polymorph'&&state.activeTransform?.permanentUntilDispelled;const needsBonus=active?.profile==='wildshape'||active?.profile==='animal-shapes';const canEnd=permanentTruePolymorph||!needsBonus||state.turn.bonusRemaining>0;end.textContent=permanentTruePolymorph?'Remove Dispelled Effect':needsBonus&&!canEnd?'End Form — Bonus Action Used':'End Form';end.disabled=!active||!canEnd;end.hidden=!active;if(permanentTruePolymorph)end.title='True Polymorph cannot be ended voluntarily after the full hour. Use this only after the effect is dispelled or otherwise ended externally.';else if(active&&needsBonus&&!canEnd)end.title='Voluntarily ending this form requires a Bonus Action. Start a new turn or regain a Bonus Action first.';else end.removeAttribute('title');
  const playEnd=$<HTMLButtonElement>('#play-end-form');if(active){playEnd.textContent=end.textContent;playEnd.disabled=end.disabled;playEnd.hidden=end.hidden;playEnd.title=end.title;}else if(overlayEnd){const overlayEndError=actionCostError(state,overlayEnd.actionCost,sheet.conditionImmunities);playEnd.textContent=overlayEnd.label;playEnd.disabled=!overlayEnd.usable||Boolean(overlayEndError);playEnd.hidden=false;playEnd.title=overlayEndError??`End ${overlayEnd.label.replace(/^End /,'')} and keep other active effects.`;}else{playEnd.textContent='End Form';playEnd.disabled=true;playEnd.hidden=true;playEnd.removeAttribute('title');}
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
function turnReadyToEnd(){
  return !state.life.dead&&state.turn.actionsRemaining===0&&state.turn.surgeActionsRemaining===0&&state.turn.bonusRemaining===0&&(state.turn.attackAction?.remaining??0)===0&&!state.pendingRelentlessRage&&!(state.hp===0&&!state.life.stable)&&state.concentrationChecks.length===0;
}
function syncTurnCompletionCue(){
  const ready=turnReadyToEnd();
  const explanation='Action, Surge Action, Bonus Action, Extra Attack, and required pending resolutions are complete. End the turn when movement and any free interaction are finished; your Reaction can still be used off-turn.';
  for(const selector of ['#end-turn','#persistent-end-turn']){
    const control=$<HTMLButtonElement>(selector);control.classList.toggle('turn-complete-cue',ready);
    control.textContent=ready?'End Turn →':'End Turn';
    if(ready){control.title=explanation;control.setAttribute('aria-label','End Turn — all tracked turn actions are complete');}
    else{control.removeAttribute('title');control.setAttribute('aria-label','End Turn');}
  }
}
function renderMetrics(){
  const grid=$('#metric-grid');clear(grid);grid.append(healthMetric(),metric('Armor Class',String(sheet.ac),sheet.acSource),metric('Speed',String(sheet.speeds.walk??0)+' ft.',speedText()));
  $('#persistent-hp').textContent=`${state.hp} / ${character.hp.max}`;$('#persistent-temp').textContent=String(state.tempHp);$('#persistent-ac').textContent=String(sheet.ac);$('#persistent-speed').textContent=`${sheet.speeds.walk??0} ft.`;
  const economy=$('#action-economy');clear(economy);const chips:[string,string,number][]=[['Action','Action',state.turn.actionsRemaining],['Surge','Surge Action',state.turn.surgeActionsRemaining],['Bonus','Bonus Action',state.turn.bonusRemaining],['Reaction','Reaction',state.turn.reactionRemaining]];const economySummary:string[]=[];for(const [label,name,count] of chips){const node=text('span',`${label}: ${count}`,'economy-chip '+(count>0?'available':'used'));node.title=`${name}: ${count>0?'available':'used'}`;economy.append(node);economySummary.push(`${name} ${count}`);}if(state.turn.attackAction){const remaining=text('span',`Extra: ${state.turn.attackAction.remaining}`,'economy-chip available');remaining.title=`Extra Attack: ${state.turn.attackAction.remaining} remaining`;economy.append(remaining);economySummary.push(`Extra Attack ${state.turn.attackAction.remaining}`);}const slotSpell=text('span',state.turn.slotSpellCast?'Slot: Used':'Slot: Ready','economy-chip '+(state.turn.slotSpellCast?'used':'available'));slotSpell.title='2024 rule: you can expend only one spell slot to cast a spell on a turn. Cantrips do not use this limit.';economy.append(slotSpell);economySummary.push(`slot spell ${state.turn.slotSpellCast?'used':'available'}`);economy.setAttribute('aria-label',economySummary.join(', '));economy.title=state.turn.actionsRemaining>0&&state.turn.bonusRemaining===0?`Action still available: use it for an attack, another non-spell action, or a cantrip. Rage and Wild Shape require the Bonus Action already used this turn.${state.turn.slotSpellCast?' Another leveled spell is blocked by the one-slot-spell-per-turn rule.':''}`:'Current turn availability.';
  $('#turn-number').textContent=`Turn ${state.turn.number}`;$('#persistent-turn-number').textContent=`Turn ${state.turn.number}`;syncTurnCompletionCue();
}
function renderResources(){
  const strip=$('#resource-strip');clear(strip);
  for(const pool of Object.values(state.resources)){const node=document.createElement('span');node.className='resource-chip';node.append(document.createTextNode(`${pool.name} `),text('b',`${pool.current}/${pool.max}`));strip.append(node);}
  for(const [level,slot] of Object.entries(state.spellSlots)){if(slot.max>0){const node=document.createElement('span');node.className='resource-chip';node.append(document.createTextNode(`L${level} slots `),text('b',`${slot.current}/${slot.max}`));strip.append(node);}}
  if(state.concentration)strip.append(text('span',`Concentrating: ${state.concentration.name}`,'state-chip'));
  if(state.concentrationChecks.length){const next=state.concentrationChecks[0];if(next)strip.append(text('span',`Concentration check: DC ${next.dc}${state.concentrationChecks.length>1?` (+${state.concentrationChecks.length-1})`:''}`,'state-chip warning'));}
  const keyResources=Object.values(state.resources).slice(0,2).map(pool=>`${pool.name} ${pool.current}/${pool.max}`);const firstSlot=Object.entries(state.spellSlots).find(([,slot])=>slot.max>0);if(firstSlot)keyResources.push(`L${firstSlot[0]} slots ${firstSlot[1].current}/${firstSlot[1].max}`);const resourceSummary=keyResources.join(' · ')||'No limited resources';$('#play-resource-summary').textContent=resourceSummary;$<HTMLElement>('#ability-resource-summary').textContent=resourceSummary;
}
function isMoonDruid(){return character.classes.some(entry=>entry.name.toLowerCase()==='druid'&&(entry.subclass??'').toLowerCase()==='circle of the moon');}
type ReceivedRollKind='attack'|'save'|'skill';
function receivedRollBonus(kind:ReceivedRollKind,skill?:string){
  const applied: string[]=[];let total=0;
  for(const effect of state.receivedEffects){
    const quickGuidance=effect.kind==='guidance'&&kind==='skill'&&effect.autoChooseSkill&&!effect.skill&&Boolean(skill);
    const eligible=effect.kind==='bless'&&(kind==='attack'||kind==='save')||effect.kind==='guidance'&&kind==='skill'&&(effect.skill===skill||quickGuidance);
    if(!eligible)continue;const die=rollDice('1d4').total;total+=die;applied.push(`${effect.name} +${die} [1d4]`);
    if(quickGuidance&&skill){effect.skill=skill;delete effect.autoChooseSkill;applied.push(`Guidance chose ${skill}`);queueMicrotask(()=>{renderQuickReceivedEffects();renderConditions();persist();});}
  }
  return {total,detail:applied.join(' · ')};
}
function finiteEffectTurns(duration:string){const match=duration.toLowerCase().match(/(?:up to\s+)?(\d+)\s*(round|minute|hour)s?/);if(!match)return undefined;const amount=Math.max(1,Number(match[1]));return match[2]==='round'?amount:match[2]==='minute'?amount*10:amount*600;}
function receivedEffectSummary(effect:ReceivedEffect){const info=RECEIVED_EFFECTS[effect.kind],turns=finiteEffectTurns(effect.duration),elapsed=Math.max(0,state.turn.number-effect.addedTurn),remaining=turns===undefined?undefined:Math.max(0,turns-elapsed);return [info.summary,effect.autoChooseSkill?'Waiting for your next skill check; that skill is chosen automatically.':'',effect.autoUseNextRoll?'Ready for the next d20 roll; Altered will reroll one die and use the new result.':'',effect.skill?`Chosen skill: ${effect.skill}.`:'',effect.die?`Die: d${effect.die}.`:'',remaining!==undefined?`${remaining} turn${remaining===1?'':'s'} remaining.`:`Duration: ${effect.duration}.`].filter(Boolean).join(' ');}
function consumeReceivedEffect(effect:ReceivedEffect){
  if(effect.kind==='bardic-inspiration'){const die=effect.die??6,result=rollDice(`1d${die}`).total;applyResult(endReceivedEffect(state,effect.id));showRoll(`+${result}`,`Add ${result} [1d${die}] to the failed D20 Test. Bardic Inspiration is now used.`,`Use ${effect.name}`,{tone:result===die?'exceptional':'high',label:'Received effect used'});return;}
  if(effect.kind==='heroic-inspiration'){const result=rollDice('1d20').total;applyResult(endReceivedEffect(state,effect.id));showRoll(result,`Use this as the new d20 result. Heroic Inspiration is now used.`, `Use ${effect.name}`,d20Presentation(result,result));}
}
function quickGuidance(){
  const active=state.receivedEffects.find(effect=>effect.kind==='guidance');
  if(active){applyResult(endReceivedEffect(state,active.id));return;}
  applyResult(addReceivedEffect(state,{id:`received:guidance:${Date.now()}`,kind:'guidance',name:'Guidance',source:'Quick Play',addedTurn:state.turn.number,duration:RECEIVED_EFFECTS.guidance.duration,autoChooseSkill:true}));
}
function quickInspiration(){
  const bardic=state.receivedEffects.find(effect=>effect.kind==='bardic-inspiration');if(bardic){consumeReceivedEffect(bardic);return;}
  const heroic=state.receivedEffects.find(effect=>effect.kind==='heroic-inspiration');if(heroic){applyResult(endReceivedEffect(state,heroic.id));return;}
  applyResult(addReceivedEffect(state,{id:`received:heroic-inspiration:${Date.now()}`,kind:'heroic-inspiration',name:'Heroic Inspiration',source:'Quick Play',addedTurn:state.turn.number,duration:RECEIVED_EFFECTS['heroic-inspiration'].duration,autoUseNextRoll:true}));
}
function renderQuickReceivedEffects(){
  const guidance=state.receivedEffects.find(effect=>effect.kind==='guidance'),bardic=state.receivedEffects.find(effect=>effect.kind==='bardic-inspiration'),heroic=state.receivedEffects.find(effect=>effect.kind==='heroic-inspiration');
  const guidanceButton=$<HTMLButtonElement>('#quick-guidance');guidanceButton.classList.toggle('tracked-active',Boolean(guidance));guidanceButton.textContent=guidance?.autoChooseSkill?'Guidance · Next skill':guidance?.skill?`Guidance · ${guidance.skill}`:'Guidance';guidanceButton.setAttribute('aria-pressed',String(Boolean(guidance)));guidanceButton.setAttribute('aria-label',guidance?`End Guidance${guidance.skill?` for ${guidance.skill}`:' waiting for the next skill check'}`:'Add Guidance for the next skill check');
  const inspirationButton=$<HTMLButtonElement>('#quick-inspiration');const inspiration=bardic??heroic;inspirationButton.classList.toggle('tracked-active',Boolean(inspiration));inspirationButton.textContent=bardic?`Use Inspiration d${bardic.die??6}`:heroic?.autoUseNextRoll?'Inspiration · Next roll':heroic?'Use Inspiration':'Inspiration';inspirationButton.setAttribute('aria-pressed',String(Boolean(inspiration)));inspirationButton.setAttribute('aria-label',bardic?`Roll and use Bardic Inspiration d${bardic.die??6}`:heroic?.autoUseNextRoll?'Cancel automatic Heroic Inspiration reroll':heroic?'Reroll d20 and use Heroic Inspiration':'Ready Heroic Inspiration for the next d20 roll');
}
function renderActiveEffects(){
  const root=$<HTMLDetailsElement>('#active-effects');const wasOpen=root.open;clear(root);const cards:HTMLElement[]=[];
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
  const ordinaryConditions=state.conditions.filter(condition=>condition!=='Exhaustion'&&condition!=='Hidden');
  if(ordinaryConditions.length){
    const panel=document.createElement('article');panel.className='effect-card tracked-effect condition-effect-card';
    panel.append(text('strong',`Conditions · ${ordinaryConditions.join(', ')}`),text('span','Active until removed or ended by its rule.','effect-benefit'),text('small','Open Effects & Conditions to remove a condition as soon as it ends.'));
    panel.append(button('Review / Remove',()=>openMoreDrawer('Effects & Conditions'),'button compact secondary'));cards.push(panel);
  }
  if(state.rage.active){
    const panel=document.createElement('article');panel.className='effect-card rage-effect';
    panel.append(text('strong','Rage is active'),text('span','B/P/S resistance · Advantage on Strength checks and saves','effect-benefit'),text('small','Spells and Concentration are blocked. Rage Damage applies only to Strength attacks with a weapon or Unarmed Strike—not beast stat-block attacks.'));
    cards.push(panel);
  }
  if(state.conditions.includes('Hidden')){
    const panel=document.createElement('article');panel.className='effect-card stealth-effect';
    panel.append(text('strong','Hidden'),text('span','Invisible while hidden · your recorded Stealth total is the search DC','effect-benefit'),text('small','Ends when an enemy finds you, you make an attack roll, cast a spell with a Verbal component, or make a sound louder than a whisper. Remove it manually if another ending trigger occurs.'));
    panel.append(button('Reveal / End Hidden',()=>applyResult(removeCondition(state,'Hidden')),'button compact secondary'));cards.push(panel);
  }
  if(state.turn.oncePerTurn['action:disengage']){const panel=document.createElement('article');panel.className='effect-card';panel.append(text('strong','Disengage active'),text('span','Movement does not provoke Opportunity Attacks for the rest of this turn.','effect-benefit'));cards.push(panel);}
  if(state.turn.oncePerTurn['action:dash']){const panel=document.createElement('article');panel.className='effect-card';panel.append(text('strong','Dash used'),text('span','Extra movement equal to current Speed is available for the rest of this turn.','effect-benefit'));cards.push(panel);}
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
  for(const effect of state.receivedEffects){
    const panel=document.createElement('article');panel.className='effect-card tracked-effect received-effect-card';panel.append(text('strong',`${effect.name} is active`),text('span',RECEIVED_EFFECTS[effect.kind].summary,'effect-benefit'),text('small',receivedEffectSummary(effect)));
    if(effect.kind==='bardic-inspiration'||effect.kind==='heroic-inspiration')panel.append(button(effect.kind==='bardic-inspiration'?`Failed a D20 Test? Roll d${effect.die??6} & use`:'Reroll d20 & use',()=>consumeReceivedEffect(effect),'button compact primary'));
    panel.append(button(`End ${effect.name}`,()=>applyResult(endReceivedEffect(state,effect.id)),'button compact secondary'));cards.push(panel);
  }
  for(const activeCard of cards)activeCard.classList.add('tracked-active');const names=cards.map(card=>card.querySelector('strong')?.textContent).filter((name):name is string=>Boolean(name));root.dataset.hasEffects=String(cards.length>0);root.hidden=cards.length===0||currentTab!=='features';if(cards.length){const summary=document.createElement('summary');const copy=document.createElement('span');copy.append(text('strong',`Active effects (${cards.length})`),text('small',names.join(' · ')));summary.append(copy);root.append(summary,...cards);root.open=wasOpen;}
  const summaryButton=$<HTMLButtonElement>('#open-active-effects');summaryButton.hidden=names.length===0;$('#play-active-summary').textContent=names.join(' · ')||'No active effects';
}
function renderQuickFeatures(){
  const box=$('#quick-features');clear(box);
  if(state.pendingRelentlessRage){
    const pending=state.pendingRelentlessRage;
    box.append(button(`Roll Relentless Rage · CON DC ${pending.dc}`,()=>{
      const save=resolveSheet(character,state).saves.con;const mode=resolveAdvantage({advantage:[...(save.advantageSources??[])],disadvantage:[...(save.disadvantageSources??[])]}).mode as RollMode;const result=rollD20Result(save.modifier,mode);
      showRoll(result.total,`${modeText(result)} ${signed(save.modifier)} (${save.source}) = ${result.total} against DC ${pending.dc}.`,'Relentless Rage',{natural:result.kept,tone:result.total>=pending.dc?'high':'critical-failure',label:result.total>=pending.dc?'Save succeeded':'Save failed'});
      applyResult(resolveRelentlessRage(character,state,result.total));
    },'button primary'));
    box.append(button('Decline Relentless Rage',()=>applyResult(resolveRelentlessRage(character,state))));
  }else if(state.hp===0&&!state.life.dead&&!state.life.stable){
    box.append(button('Roll Death Saving Throw',()=>{
      const rules=deathSaveMode(character,state);const result=rollD20Result(0,rules.mode);const deathPresentation:RollPresentation=result.kept===20?{natural:20,tone:'critical-success',label:'Natural 20 · regain 1 HP'}:result.kept===1?{natural:1,tone:'critical-failure',label:'Natural 1 · two failures'}:result.kept>=10?{natural:result.kept,tone:'high',label:'Death save success'}:{natural:result.kept,tone:'low',label:'Death save failure'};showRoll(result.kept,`${modeText(result)}. No ability modifier applies.${rules.sources.length?` ${rules.sources.join(' · ')}.`:''}`,'Death Saving Throw',deathPresentation);applyResult(resolveDeathSave(character,state,result.kept));
    },'button primary'));
  }
  if(state.concentrationChecks.length){const pending=state.concentrationChecks[0];if(pending)box.append(button(`Concentration DC ${pending.dc}`,()=>{const save=resolveSheet(character,state).saves.con;const rules=concentrationSaveMode(character,state);const mode=combinedMode(rules.mode as 'normal'|'advantage'|'disadvantage');const total=d20(save.modifier,mode,'Concentration save',undefined,undefined,undefined,save.source,'save');applyResult(resolveConcentrationCheck(state,total));},'button primary'));}
  if(state.pendingRelentlessRage||(state.hp===0&&!state.life.dead&&!state.life.stable)||state.concentrationChecks.length)return;
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
  if(state.activeTransform?.option.profile==='true-polymorph'&&state.activeTransform.spellConcentration&&!state.activeTransform.permanentUntilDispelled)box.append(button('Complete 1-Hour True Polymorph',()=>applyResult(completeTruePolymorph(state)),'button primary'));
  if(state.concentration)box.append(button('End Concentration',()=>applyResult(endConcentration(state,'Ended voluntarily.',character))));
  for(const feature of sheet.features.filter(entry=>entry.id.startsWith('private-')&&entry.activation&&entry.activation!=='none'&&entry.status!=='inactive')){
    const activation=feature.activation!;const error=actionCostError(state,activation,sheet.conditionImmunities);const use=button(`${feature.name} · ${actionCostLabel(activation)}`,()=>{const failure=spendActionCost(state,activation,sheet.conditionImmunities);if(failure){notify(failure);render();return;}showRoll('Activated',`${feature.summary} Resolve any target or battlefield prerequisites from your source.` ,feature.name);render();},error?'button secondary':'button primary');use.disabled=Boolean(error);if(error)use.title=error;box.append(use);
  }
  if(box.childElementCount===0)box.append(text('span','No activated abilities are available right now. Passive benefits are applied automatically and explained below.','ability-empty'));
}

function card(title:string,badgeText:string,summary:string,status:UiStatus='available'){
  const node=document.createElement('article');node.className='item-card';const head=document.createElement('div');head.className='item-head';
  const indicators=document.createElement('div');indicators.className='item-head-status';const badge=text('span',badgeText,'badge');indicators.append(statusChip(status),badge);head.append(text('strong',title),indicators);
  node.append(head);const actions=document.createElement('div');actions.className='item-actions';node.append(actions,text('p',summary));const options=document.createElement('div');options.className='action-options';node.append(options);return {node,options,actions,badge};
}
function appendControlReason(parent:HTMLElement,control:HTMLButtonElement,reason:string|null|undefined,id:string){
  parent.append(control);if(!reason)return;const note=text('small',reason,'control-block-reason');note.id=id;control.setAttribute('aria-describedby',id);parent.append(note);
}
type RollMode='normal'|'advantage'|'disadvantage';
interface D20Result {first:number;second?:number;kept:number;total:number;mode:RollMode;critical:boolean;naturalOne:boolean;naturalTwenty:boolean;inspirationDetail?:string}
type RollTone='critical-failure'|'low'|'neutral'|'high'|'exceptional'|'critical-success';
interface RollPresentation {tone?:RollTone;label?:string;natural?:number}
function rollD20Result(mod:number,mode:RollMode,criticalThreshold=20):D20Result{
  const initial=rollAttackD20(mod,mode,criticalThreshold);const inspiration=state.receivedEffects.find(effect=>effect.kind==='heroic-inspiration'&&effect.autoUseNextRoll);if(!inspiration)return initial;
  const before=initial.second===undefined?initial.first:Math.min(initial.first,initial.second),replacement=rollDice('1d20').total;let first=initial.first,second=initial.second;
  if(second===undefined)first=replacement;else if(first<=second)first=replacement;else second=replacement;
  const kept=second===undefined?first:mode==='advantage'?Math.max(first,second):Math.min(first,second);state.receivedEffects=state.receivedEffects.filter(effect=>effect.id!==inspiration.id);
  queueMicrotask(()=>{renderQuickReceivedEffects();renderConditions();persist();});
  return {first,...(second!==undefined?{second}:{}),kept,total:kept+mod,mode,critical:kept>=criticalThreshold,naturalOne:kept===1,naturalTwenty:kept===20,inspirationDetail:`Heroic Inspiration rerolled ${before} to ${replacement}; the new roll was used and Inspiration was consumed.`};
}
function modeText(result:D20Result){const dice=result.mode==='normal'?`d20 ${result.first}`:`${result.mode==='advantage'?'Advantage':'Disadvantage'} ${result.first}, ${result.second}; kept ${result.kept}`;return `${dice}${result.inspirationDetail?` · ${result.inspirationDetail}`:''}`;}
function d20Presentation(natural:number,total=natural):RollPresentation{
  if(natural===1)return {natural,tone:'critical-failure',label:'Natural 1 · lowest possible die'};
  if(natural>=20)return {natural,tone:'critical-success',label:'Natural 20 · highest possible die'};
  if(total>=25)return {natural,tone:'exceptional',label:'Exceptional total · all bonuses included'};
  if(total>=18)return {natural,tone:'high',label:'Strong total · all bonuses included'};
  if(total<=7)return {natural,tone:'low',label:'Low total · all bonuses included'};
  return {natural,tone:'neutral',label:'Roll result'};
}
function showFloatingRoll(totalText:string,detail:string,title:string,presentation:RollPresentation={}){
  const toast=$('#roll-toast');if(rollToastTimer!==undefined)window.clearTimeout(rollToastTimer);
  const tone=presentation.tone??'neutral';toast.className=`roll-toast tone-${tone}${totalText.length>8?' is-long':''}`;
  $('#roll-toast-title').textContent=title;$('#roll-toast-total').textContent=totalText;$('#roll-toast-detail').textContent=detail;$('.roll-toast-kicker').textContent=presentation.label??'Roll result';
  toast.hidden=false;void toast.offsetWidth;toast.classList.add('show');
  rollToastTimer=window.setTimeout(()=>{toast.classList.remove('show');window.setTimeout(()=>{if(!toast.classList.contains('show'))toast.hidden=true;},220);},8000);
}
function showRoll(total:number|string,detail:string,title='Roll result',presentation:RollPresentation={}){latestRollTab=currentTab;latestRollTitle=title;const panel=$('#latest-roll');const totalText=String(total);$('#roll-title').textContent=title;$('#roll-total').textContent=totalText;$('#roll-detail').textContent=detail;$('#play-roll-title').textContent=title;$('#play-roll-total').textContent=totalText;$('#play-roll-detail').textContent=detail;panel.classList.remove('flash');void panel.offsetWidth;panel.classList.add('flash');showFloatingRoll(totalText,detail,title,presentation);addActivity(`${title}: ${detail}`);renderLog();}
function d20(mod:number,mode:RollMode,label:string,minimumD20?:number,minimumTotal?:number,minimumSource?:string,modifierSource?:string,rollKind?:ReceivedRollKind,skillName?:string){const result=rollD20Result(mod,mode);const treated=minimumD20!==undefined?Math.max(minimumD20,result.kept):result.kept;const raw=treated+mod;const received=rollKind?receivedRollBonus(rollKind,skillName):{total:0,detail:''};const boosted=raw+received.total;const total=minimumTotal!==undefined?Math.max(minimumTotal,boosted):boosted;const adjustments=[treated!==result.kept?`${minimumSource??'Feature'} treated ${result.kept} as ${treated}`:'',received.detail,total!==boosted?`${minimumSource??'Feature'} raised total ${boosted} to ${total}`:''].filter(Boolean).join(' · ');const baseLabel=label.replace(/ \(Strength\)$/,'');const save=Object.values(sheet.saves).find(value=>value.name===baseLabel);const skill=Object.values(sheet.skills).find(value=>value.name===baseLabel);const resolvedSource=modifierSource??save?.source??(label.endsWith('(Strength)')?skill?.alternate?.source:skill?.source);const source=resolvedSource?` (${resolvedSource})`:'';showRoll(total,`${modeText(result)}${treated!==result.kept?` → ${treated}`:''} ${signed(mod)}${source}${received.total?` + ${received.total} received`:''} = ${boosted}${total!==boosted?` → ${total}`:''}${adjustments?` · ${adjustments}`:''}`,label,d20Presentation(result.kept,total));return total;}
function combinedMode(rulesMode:RollMode){return rulesMode;}
function rollContext(actionId:string,rules:ReturnType<typeof attackRollSources>){
  const selected=selectedRollModes.get(actionId)??'normal';const advantage=[...rules.sources.advantage],disadvantage=[...rules.sources.disadvantage];
  if(selected==='advantage')advantage.push('Selected situational Advantage');if(selected==='disadvantage')disadvantage.push('Selected situational Disadvantage');
  const unresolved:string[]=[];for(const source of rules.conditional){const packTactics=source.startsWith('Pack Tactics')&&nextAttackFacts.has('ally-near-target');if(packTactics||optionalSet(actionId).has(conditionalRollToken(source)))(conditionalRollMode(source)==='advantage'?advantage:disadvantage).push(packTactics?'Pack Tactics: confirmed ally beside target':source);else unresolved.push(source);}
  if(nextAttackFacts.has('attacker-unseen'))advantage.push('Target cannot see attacker');if(nextAttackFacts.has('target-unseen'))disadvantage.push('Attacker cannot see target');
  if(nextAttackFacts.size){nextAttackFacts.clear();queueMicrotask(syncBattlefieldFacts);}
  const resolved=resolveAdvantage({advantage,disadvantage});return {mode:resolved.mode as RollMode,sources:resolved.sources,conditional:unresolved};
}
function conditionalRollToken(source:string){return `conditional:${conditionalRollMode(source)}:${source}`;}
function conditionalRollMode(source:string):'advantage'|'disadvantage'{return source.toLowerCase().includes('grants advantage')?'advantage':'disadvantage';}
function conditionalRollToggle(actionId:string,source:string){const mode=conditionalRollMode(source),token=conditionalRollToken(source);const label=source.startsWith('Pack Tactics')?'Pack Tactics: another ally within 5 feet of the target is not Incapacitated (Advantage).':`${source} Apply ${mode}.`;return toggleRow(label,optionalSet(actionId).has(token),checked=>{const set=optionalSet(actionId);checked?set.add(token):set.delete(token);});}
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
  clearTurnUndo();
  const value=sheet.initiative;const selected=selectedRollModes.get('initiative')??'normal';const advantage=[...(value.advantageSources??[])],disadvantage=[...(value.disadvantageSources??[])];
  if(selected==='advantage')advantage.push('Selected situational Advantage');if(selected==='disadvantage')disadvantage.push('Surprised');
  const resolved=resolveAdvantage({advantage,disadvantage});const result=rollD20Result(value.modifier,resolved.mode as RollMode);
  const sources=[...advantage.map(source=>`Advantage: ${source}`),...disadvantage.map(source=>`Disadvantage: ${source}`),...(value.conditionalSources??[]).map(source=>`Conditional: ${source}`)];const combat=startCombat(state);sources.push(combat.message);
  showRoll(result.total,[`${modeText(result)} ${signed(value.modifier)} (${value.source}) = ${result.total}.`,`Initiative order stays fixed after this roll, even if you later change form.`,sources.join(' · ')].filter(Boolean).join('\n'),'Initiative',d20Presentation(result.kept,result.total));render();
}
function attackMinimum(action:CreatureAction){if(action.type!=='attack')return 0;return Math.max(0,...sheet.attackDamageModifiers.filter(modifier=>modifier.appliesTo.includes(action.kind as 'weapon'|'unarmed')).map(modifier=>modifier.minimumDamage??0));}
function packetTotal(packets:DamagePacket[],critical=false,minimum=0){let total=0;const details:string[]=[];for(const packet of packets){const expression=critical&&packet.doubleOnCritical!==false?criticalDiceExpression(packet.expression):packet.expression;const result=rollDice(expression);total+=result.total;details.push(`${packet.label??packet.type}: ${result.total} [${expression}]`);}const raw=total;total=Math.max(minimum,total);if(total!==raw)details.push(`Minimum ${minimum} damage`);return {total,detail:details.join(' + ')};}
function effectText(effect:ConditionEffect){const details=[effect.targetSizeMax?`${effect.targetSizeMax} or smaller target`:'',effect.escapeDc?`escape DC ${effect.escapeDc}`:'',effect.duration??'',effect.note??''].filter(Boolean);return `${effect.condition}${details.length?` (${details.join('; ')})`:''}`;}
function effectsText(effects:ConditionEffect[]|undefined){return effects?.map(effectText).join('; ')??'';}
function saveAbilities(action:Extract<CreatureAction,{type:'save'}>){return (action.saveAbilityOptions?.length?action.saveAbilityOptions:[action.saveAbility]).map(ability=>ability.toUpperCase()).join(' or ');}
function riderToken(id:string){return `Rider:${id}`;}
function activeRiders(action:AttackAction){const selected=optionalSet(action.id);return (action.riders??[]).filter(rider=>selected.has(riderToken(rider.id)));}
function attackRollDetail(attack:D20Result,bonus:number,threshold:number,receivedBonus=0){
  const equation=`${modeText(attack)} ${signed(bonus)}${receivedBonus?` + ${receivedBonus} received`:''} = ${attack.total}`;
  if(attack.naturalOne)return `${equation} — natural 1, automatic miss.`;
  if(attack.naturalTwenty)return `${equation} — natural 20, automatic hit and CRITICAL HIT.`;
  if(attack.critical)return `${equation} — CRITICAL HIT if the total hits AC (critical range ${threshold}–20).`;
  return `${equation} to hit.`;
}
function spendForAction(action:CreatureAction){const error=spendActionExecution(character,state,action,sheet.conditionImmunities);if(error){notify(error);render();return false;}return true;}
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
function queueDamageRoll(name:string,packets:DamagePacket[],critical:boolean,minimum:number,effects:ConditionEffect[]=[],notes:string[]=[]){const id=`damage:${++pendingDamageSequence}`;pendingDamageRolls.set(id,{id,name,packets:packets.map(packet=>({...packet})),critical,minimum,effects:effects.map(effect=>({...effect})),notes:[...notes]});return id;}
function resolvePendingDamage(id:string){const pending=pendingDamageRolls.get(id);if(!pending)return;const damage=packetTotal(pending.packets,pending.critical,pending.minimum);pendingDamageRolls.delete(id);showRoll(`${damage.total} damage`,[`${damage.detail}${pending.critical?' · critical damage dice doubled':''}.`,pending.effects.length?`On hit: ${effectsText(pending.effects)}.`:'',...pending.notes].filter(Boolean).join('\n'),`${pending.name} Damage`,{tone:damage.total>=25?'exceptional':damage.total>=15?'high':'neutral',label:pending.critical?'Critical hit damage':'Hit confirmed · damage rolled'});render();}
function resolveAttackAction(action:AttackAction){
  if(!prepareLimitedAction(action))return;sheet=resolveSheet(character,state);
  const context=rollContext(action.id,attackRollSources(character,state,action,sheet));const threshold=criticalHitThreshold(character,action,state);const attackBase=rollD20Result(action.attackBonus,context.mode,threshold),received=receivedRollBonus('attack'),attack={...attackBase,total:attackBase.total+received.total};
  const radiant=radiantActions.has(action.id);const automatic=attackBonuses(character,state,sheet,action).filter(p=>!p.label?.startsWith('Optional'));
  const selected=optionalSet(action.id);const optional=attackBonuses(character,state,sheet,action).filter(p=>p.label?.startsWith('Optional')&&selected.has(p.label??''));
  const riders=activeRiders(action);const base=action.damage.map((packet,index)=>radiant&&index===0?{...packet,type:'Radiant' as DamageType}:packet);const allPackets=[...base,...automatic,...optional,...riders.flatMap(rider=>rider.damage??[])];
  optional.forEach(packet=>markOptionalBonus(packet.label));declareAttack(state,action);
  const sources=[...context.sources.advantage.map(x=>`Advantage: ${x}`),...context.sources.disadvantage.map(x=>`Disadvantage: ${x}`),...context.conditional.map(x=>`Conditional: ${x}`),...(received.detail?[received.detail]:[])];
  const attackLine=attackRollDetail(attack,action.attackBonus,threshold,received.total);
  const hitEffects=[...(action.effects??[]),...riders.flatMap(rider=>rider.effects??[])];const riderLines=riders.map(rider=>`${rider.label} selected: ${rider.prerequisite}`);
  if(!attack.naturalOne)queueDamageRoll(action.name,allPackets,attack.critical,attackMinimum(action),hitEffects,riderLines);
  const presentation:RollPresentation=attack.naturalOne?{natural:1,tone:'critical-failure',label:'Natural 1 · automatic miss'}:attack.critical?{natural:attack.kept,tone:'critical-success',label:'Critical hit · damage dice doubled'}:d20Presentation(attack.kept,attack.total);
  showRoll(attack.naturalOne?'Natural 1':`${attack.total} to hit`,[attackLine,attack.naturalOne?'No damage roll is available.':'If this attack hits, use Roll Damage next. If it misses, clear the pending damage.',hitEffects.length?`On a hit: ${effectsText(hitEffects)}.`:'',...riderLines,sources.length?sources.join(' · '):''].filter(Boolean).join('\n'),`${action.name} Attack`,presentation);render();
}
function resolveSaveAction(action:Extract<CreatureAction,{type:'save'}>){if(!prepareLimitedAction(action))return;const fail=packetTotal(action.damageOnFail??[]);const success=action.halfOnSuccess?{total:Math.floor(fail.total/2),detail:`${Math.floor(fail.total/2)} (half of the failed-save roll, rounded down)`}:packetTotal(action.damageOnSuccess??[]);declareAttack(state,action);const total=fail.total?`${fail.total} fail dmg`:'Effect';const detail=[`Target makes a DC ${action.dc} ${saveAbilities(action)} save.`,fail.detail?`Failed save: ${fail.detail}.`:'',action.effectsOnFail?.length?`Failed-save effects: ${effectsText(action.effectsOnFail)}.`:!fail.detail?'Apply the listed failed-save effect.':'',success.detail?`Successful save: ${success.detail}.`:'Successful save: no listed failed-save damage or effects.',action.notes??''].filter(Boolean).join('\n');showRoll(total,detail,action.name);render();}
function actionPrerequisiteKey(action:Extract<CreatureAction,{type:'automatic'}>,choice?:AutomaticActionChoice){return `${action.id}:${choice?.id??'action'}:prerequisite`;}
function resolveAutomaticAction(action:Extract<CreatureAction,{type:'automatic'}>,choice?:AutomaticActionChoice){
  const prerequisite=choice?.prerequisite??(!action.choices?.length?action.prerequisite:undefined);if(prerequisite&&!confirmedActionPrerequisites.has(actionPrerequisiteKey(action,choice))){notify('Confirm the visible prerequisite before using this option.');return;}
  if(!prepareLimitedAction(action))return;
  if(choice?.resolution==='dash')state.turn.oncePerTurn['action:dash']=true;
  if(choice?.resolution==='disengage')state.turn.oncePerTurn['action:disengage']=true;
  if(choice?.resolution==='hide'||choice?.resolution==='skill-check'){
    const skill=sheet.skills[choice.skill??'Stealth'];if(!skill){showRoll('Review',`The current sheet has no ${choice.skill??'Stealth'} modifier. Resolve this check from the source sheet.`,`${action.name}: ${choice.label}`);render();return;}
    const rules=resolveAdvantage({advantage:skill.advantageSources??[],disadvantage:skill.disadvantageSources??[]});const result=rollD20Result(skill.modifier,rules.mode as RollMode);const treated=skill.minimumD20!==undefined?Math.max(skill.minimumD20,result.kept):result.kept;const raw=treated+skill.modifier,received=receivedRollBonus('skill',skill.name),boosted=raw+received.total;const total=skill.minimumTotal!==undefined?Math.max(skill.minimumTotal,boosted):boosted;
    if(choice.resolution==='hide'){state.conditions=state.conditions.filter(condition=>condition!=='Hidden');if(total>=15)state.conditions.push('Hidden');}
    const outcome=choice.resolution==='hide'?(total>=15?'Hidden · Invisible condition active':'Hide failed · not Hidden'):`${choice.label} check`;
    showRoll(total,[`${modeText(result)}${treated!==result.kept?` → ${treated}`:''} ${signed(skill.modifier)} (${skill.source})${received.total?` + ${received.total} received`:''} = ${boosted}${total!==boosted?` → ${total}`:''}.`,received.detail,choice.resolution==='hide'?`DC 15: ${outcome}. Record ${total} as the DC for a creature trying to find you.`:'Resolve the check against the DM-set DC.',choice.prerequisite?`Confirmed: ${choice.prerequisite}`:'',choice.notes??''].filter(Boolean).join('\n'),`${action.name}: ${choice.label}`,d20Presentation(result.kept,total));confirmedActionPrerequisites.delete(actionPrerequisiteKey(action,choice));render();return;
  }
  const result=packetTotal(action.damage??[]);const detail=[choice?`Choice: ${choice.label}.`:'',prerequisite?`Confirmed prerequisite: ${prerequisite}`:'',choice?.resolution==='disengage'?'Movement does not provoke Opportunity Attacks for the rest of this turn.':'',choice?.resolution==='dash'?'Extra movement equal to Speed is available for the rest of this turn.':'',choice?.resolution==='utilize'?'Resolve the chosen object’s Utilize action.':'',choice?.resolution==='magic-item'?'Resolve the chosen magic item’s Magic action.':'',result.detail?`${action.damageTiming??'Listed damage'}: ${result.detail}.`:action.damage?.length?'Listed damage did not resolve.':'Effect activated.',action.effects?.length?`Effects: ${effectsText(action.effects)}.`:'',choice?.notes??action.notes??''].filter(Boolean).join('\n');showRoll(result.total||choice?.label||'Activated',detail,action.name);confirmedActionPrerequisites.delete(actionPrerequisiteKey(action,choice));render();
}
function multiattackSequence(action:Extract<CreatureAction,{type:'multiattack'}>){const selected=selectedMultiattackVariants.get(action.id);return action.variants?.find(variant=>variant.id===selected)?.sequence??action.sequence;}
function resolveMultiattack(action:Extract<CreatureAction,{type:'multiattack'}>){
  if(!spendForAction(action))return;const lines:string[]=[];const headlines:string[]=[];let combinedDamage=0;
  for(const id of multiattackSequence(action)){
    const child=sheet.actions.find(candidate=>candidate.id===id);if(!child||child.type==='multiattack')continue;
    const status=limitedActionStatus(child);if(status.unavailable){lines.push(`${child.name}: unavailable (${status.recharge?'recharging':'no uses remaining'})`);continue;}
    markActionRechargeUsed(state,child);markLimitedActionUsed(state,child);
    if(child.type==='attack'){
      const context=rollContext(child.id,attackRollSources(character,state,child,sheet));const threshold=criticalHitThreshold(character,child,state);const attackBase=rollD20Result(child.attackBonus,context.mode,threshold),received=receivedRollBonus('attack'),attack={...attackBase,total:attackBase.total+received.total};
      const bonuses=attackBonuses(character,state,sheet,child),automatic=bonuses.filter(packet=>!packet.label?.startsWith('Optional')),selected=optionalSet(child.id),optional=bonuses.filter(packet=>packet.label?.startsWith('Optional')&&selected.has(packet.label??'')),riders=activeRiders(child),radiant=radiantActions.has(child.id);
      const base=child.damage.map((packet,index)=>radiant&&index===0?{...packet,type:'Radiant' as DamageType}:packet),packets=[...base,...automatic,...optional,...riders.flatMap(rider=>rider.damage??[])];optional.forEach(packet=>markOptionalBonus(packet.label));
      headlines.push(`${child.name}: ${attack.naturalOne?'Natural 1 miss':`${attack.total} to hit`}`);const sources=[...context.sources.advantage.map(value=>`Advantage: ${value}`),...context.sources.disadvantage.map(value=>`Disadvantage: ${value}`),...context.conditional.map(value=>`Conditional: ${value}`),...(received.detail?[received.detail]:[])],hitEffects=[...(child.effects??[]),...riders.flatMap(rider=>rider.effects??[])],riderNotes=riders.map(rider=>`${rider.label}: ${rider.prerequisite}`);
      if(!attack.naturalOne)queueDamageRoll(child.name,packets,attack.critical,attackMinimum(child),hitEffects,riderNotes);
      lines.push(`${child.name} attack roll: ${attackRollDetail(attack,child.attackBonus,threshold,received.total)}\n${attack.naturalOne?'No damage roll is available.':'If it hits, use the separate Roll Damage control.'}${hitEffects.length?`\nOn a hit: ${effectsText(hitEffects)}.`:''}${riderNotes.length?`\n${riderNotes.join(' · ')}`:''}${sources.length?`\n${sources.join(' · ')}`:''}`);declareAttack(state,child);
    }else if(child.type==='save'){const fail=packetTotal(child.damageOnFail??[]);const success=child.halfOnSuccess?{total:Math.floor(fail.total/2),detail:'half the failed-save roll, rounded down'}:packetTotal(child.damageOnSuccess??[]);combinedDamage+=fail.total;headlines.push(`${child.name}: DC ${child.dc} ${saveAbilities(child)}`);lines.push(`${child.name}: target makes a DC ${child.dc} ${saveAbilities(child)} save.${fail.total?`\nFailed-save damage: ${fail.total} (${fail.detail}).`:''}${child.effectsOnFail?.length?`\nFailed-save effects: ${effectsText(child.effectsOnFail)}.`:''}${success.total?`\nSuccessful-save damage: ${success.total} (${success.detail}).`:'\nSuccess: no listed failed-save damage or effects.'}`);declareAttack(state,child);}
    else{const result=packetTotal(child.damage??[]);combinedDamage+=result.total;headlines.push(`${child.name}: activated`);lines.push(`${child.name}: ${[result.detail,child.effects?.length?`Effects: ${effectsText(child.effects)}.`:'',child.notes].filter(Boolean).join(' ')||'effect activated'}`);}
  }
  const potential=combinedDamage?`Save-based damage resolved: ${combinedDamage}.`:'';showRoll(headlines.join(' · ')||'Resolved',[...lines,...(potential?[potential]:[]),pendingDamageRolls.size?'Confirm each hit, then use its separate Roll Damage control in Actions.':'',...(action.notes?[action.notes]:[])].filter(Boolean).join('\n\n')||'Multiattack resolved.',`${action.name} Attacks`);render();
}
function actionCostLabel(cost:CreatureAction['cost']|Spell['castingTime']){
  if(cost==='magic-action')return 'Magic Action';
  if(cost==='bonus')return 'Bonus Action';
  if(cost==='reaction')return 'Reaction';
  if(cost==='free'||cost==='none')return 'No action';
  return 'Action';
}
function collapseActionOptions(options:HTMLElement){
  if(!options.childElementCount)return;const disclosure=document.createElement('details');disclosure.className='action-options-disclosure';const summary=document.createElement('summary');summary.textContent='Roll options';options.replaceWith(disclosure);disclosure.append(summary,options);
}
function renderActions(){
  const root=$('#tab-content');clear(root);root.append(text('p','Choose an action below. A used Action, Bonus Action, or Reaction is disabled until the next turn so it is always clear what is still available.','tab-help'));
  if(pendingDamageRolls.size){const pending=document.createElement('section');pending.className='pending-damage-list';pending.append(text('h3',`Resolve confirmed hits (${pendingDamageRolls.size})`));for(const roll of pendingDamageRolls.values()){const row=document.createElement('article');row.className='pending-damage-card tracked-active';const copy=document.createElement('div');copy.append(text('strong',roll.name),text('small',`${roll.critical?'Critical hit · ':''}${roll.packets.map(packet=>`${roll.critical&&packet.doubleOnCritical!==false?criticalDiceExpression(packet.expression):packet.expression} ${packet.type}`).join(' + ')}. Roll only if the attack hit.`));const actions=document.createElement('div');actions.className='inline-actions';actions.append(button('Roll Damage',()=>resolvePendingDamage(roll.id),'button primary action-roll'),button('Miss · Clear',()=>{pendingDamageRolls.delete(roll.id);notify(`${roll.name} missed; pending damage cleared.`);render();},'button secondary compact'));row.append(copy,actions);pending.append(row);}root.append(pending);}
  if(sheet.actions.length===0){root.append(text('div','No actions are defined for this form.','empty'));return;}
  const unavailable=document.createElement('div');unavailable.className='unavailable-action-list';const unarmedChoices=document.createElement('div');unarmedChoices.className='action-choice-list';let availableCount=0,unavailableCount=0,unarmedCount=0;const appendAction=(node:HTMLElement,blocked:boolean)=>{const actionName=node.querySelector('strong')?.textContent??'';if(actionName.startsWith('Unarmed Strike')){unarmedChoices.append(node);unarmedCount++;if(blocked)unavailableCount++;else availableCount++;return;}if(blocked){unavailable.append(node);unavailableCount++;}else{root.append(node);availableCount++;}};
  for(const action of sheet.actions){
    const economyError=actionExecutionError(character,state,action,sheet.conditionImmunities);
    const sequenceText=state.turn.attackAction&&!economyError&&action.cost==='action'?`${state.turn.attackAction.source}: ${state.turn.attackAction.remaining} attack${state.turn.attackAction.remaining===1?'':'s'} remaining`:'';
    if(action.type==='attack'){
      const limit=limitedActionStatus(action);const blocked=limit.unavailable||Boolean(economyError);const limitText=actionLimitText(action);const description=[`${signed(action.attackBonus)} to hit`,action.damage.map(packet=>`${packet.expression} ${packet.type}`).join(' + '),action.effects?.length?`On hit: ${effectsText(action.effects)}`:'',sequenceText,limitText,action.notes,economyError].filter(Boolean).join(' · ');const c=card(action.name,limit.recharge?'Recharging':limit.remaining===0?'Expended':sequenceText||actionCostLabel(action.cost),description,blocked?(limit.unavailable?'locked':'unavailable'):'available');if(blocked)c.badge.className='badge inactive';
      c.options.append(rollModePicker(action.id,action.name));
      for(const source of attackRollSources(character,state,action,sheet).conditional)c.options.append(conditionalRollToggle(action.id,source));
      const radiantEligible=sheet.profile==='wildshape'&&classLevel(character,'Druid')>=6&&action.kind==='beast';if(radiantEligible)c.options.append(toggleRow('Use Radiant damage for this attack',radiantActions.has(action.id),checked=>{checked?radiantActions.add(action.id):radiantActions.delete(action.id);}));
      for(const bonus of attackBonuses(character,state,sheet,action).filter(packet=>packet.label?.startsWith('Optional'))){const label=bonus.label??'Optional damage';c.options.append(toggleRow(`${label} (${bonus.expression} ${bonus.type})`,optionalSet(action.id).has(label),checked=>{const set=optionalSet(action.id);checked?set.add(label):set.delete(label);}));}
      for(const rider of action.riders??[]){const token=riderToken(rider.id);c.options.append(toggleRow(`${rider.label}: ${rider.prerequisite}`,optionalSet(action.id).has(token),checked=>{const set=optionalSet(action.id);checked?set.add(token):set.delete(token);}));}
      collapseActionOptions(c.options);const label=limit.recharge?`Awaiting ${limit.recharge.min}–${limit.recharge.max}`:limit.remaining===0?'No uses remaining':economyError??`Roll ${action.name} Attack`;const use=button(label,()=>resolveAttackAction(action),blocked?'button secondary action-roll':'button primary action-roll');use.disabled=blocked;c.actions.append(use);appendAction(c.node,blocked);
    }else if(action.type==='save'){
      const limit=limitedActionStatus(action);const blocked=limit.unavailable||Boolean(economyError);const damage=action.damageOnFail?.map(packet=>`${packet.expression} ${packet.type}`).join(' + ')||'Effect on failed save';const detail=[damage,action.halfOnSuccess?'Half damage on a successful save (rounded down)':'',action.effectsOnFail?.length?`On failure: ${effectsText(action.effectsOnFail)}`:'',sequenceText,actionLimitText(action),action.notes,economyError].filter(Boolean).join(' · ');const c=card(action.name,limit.recharge?'Recharging':limit.remaining===0?'Expended':`${sequenceText||actionCostLabel(action.cost)} · DC ${action.dc} ${saveAbilities(action)}`,detail,blocked?(limit.unavailable?'locked':'unavailable'):'available');if(blocked)c.badge.className='badge inactive';const label=limit.recharge?`Awaiting ${limit.recharge.min}–${limit.recharge.max}`:limit.remaining===0?'No uses remaining':economyError??`Use ${action.name}`;const use=button(label,()=>resolveSaveAction(action),blocked?'button secondary action-roll':'button primary action-roll');use.disabled=blocked;c.actions.append(use);appendAction(c.node,blocked);
    }else if(action.type==='multiattack'){
      const names=multiattackSequence(action).map(id=>sheet.actions.find(candidate=>candidate.id===id)?.name??id);const c=card(action.name,actionCostLabel(action.cost),`Rolls each component separately with its own attack roll or saving throw: ${names.join(' → ')}. Confirm each hit, then roll its damage separately; critical damage and on-hit effects are preserved.${action.notes?` ${action.notes}`:''}${economyError?` · ${economyError}`:''}`,economyError?'unavailable':'available');if(economyError)c.badge.className='badge inactive';
      const conditionalAttack=multiattackSequence(action).map(id=>sheet.actions.find(candidate=>candidate.id===id)).find((candidate):candidate is AttackAction=>candidate?.type==='attack');if(conditionalAttack)for(const source of attackRollSources(character,state,conditionalAttack,sheet).conditional)c.options.append(conditionalRollToggle(conditionalAttack.id,source));
      if(action.variants?.length){const label=document.createElement('label');label.className='slot-picker multiattack-picker';label.append(text('span','Multiattack option / order'));const select=document.createElement('select');select.setAttribute('aria-label',`${action.name} order`);const standard=document.createElement('option');standard.value='';standard.textContent=action.sequence.map(id=>sheet.actions.find(candidate=>candidate.id===id)?.name??id).join(' → ');select.append(standard);for(const variant of action.variants){const option=document.createElement('option');option.value=variant.id;option.textContent=variant.label;option.selected=selectedMultiattackVariants.get(action.id)===variant.id;select.append(option);}select.addEventListener('change',()=>{selectedMultiattackVariants.set(action.id,select.value);renderActions();renderNextStepGuide();});label.append(select);c.options.append(label);}
      collapseActionOptions(c.options);const use=button(economyError??`Roll ${action.name} Attacks`,()=>resolveMultiattack(action),economyError?'button secondary action-roll':'button primary action-roll');use.disabled=Boolean(economyError);c.actions.append(use);appendAction(c.node,Boolean(economyError));
    }else{
      const limit=limitedActionStatus(action);const blocked=limit.unavailable||Boolean(economyError);const choiceRequired=Boolean(action.choices?.length);const detail=[choiceRequired?'Choose one legal option below before Altered spends the action.':'',action.prerequisite,action.damage?.length?`${action.damageTiming??'Listed damage'}: ${action.damage.map(packet=>`${packet.expression} ${packet.type}`).join(' + ')}`:'',action.effects?.length?`Effects: ${effectsText(action.effects)}`:'',actionLimitText(action),action.notes,economyError].filter(Boolean).join(' · ');const c=card(action.name,limit.recharge?'Recharging':limit.remaining===0?'Expended':choiceRequired?'Choice required':actionCostLabel(action.cost),detail,blocked?(limit.unavailable?'locked':'unavailable'):choiceRequired?'warning':'available');if(blocked)c.badge.className='badge inactive';
      if(action.choices?.length){for(const choice of action.choices){const key=actionPrerequisiteKey(action,choice),confirmed=!choice.prerequisite||confirmedActionPrerequisites.has(key);if(choice.prerequisite)c.options.append(toggleRow(`Confirm ${choice.label}: ${choice.prerequisite}`,confirmed,checked=>{checked?confirmedActionPrerequisites.add(key):confirmedActionPrerequisites.delete(key);renderActions();renderNextStepGuide();}));const label=blocked?(limit.recharge?`Awaiting ${limit.recharge.min}–${limit.recharge.max}`:limit.remaining===0?'No uses remaining':economyError??'Unavailable'):`Use ${action.name}: ${choice.label}`;const use=button(label,()=>resolveAutomaticAction(action,choice),blocked||!confirmed?'button secondary action-roll':'button primary action-roll');use.disabled=blocked||!confirmed;if(!confirmed){const reason=`Confirm the ${choice.label} prerequisite above.`;use.title=reason;}c.actions.append(use);}collapseActionOptions(c.options);}
      else{const key=actionPrerequisiteKey(action),confirmed=!action.prerequisite||confirmedActionPrerequisites.has(key);if(action.prerequisite)c.options.append(toggleRow(`Confirm prerequisite: ${action.prerequisite}`,confirmed,checked=>{checked?confirmedActionPrerequisites.add(key):confirmedActionPrerequisites.delete(key);renderActions();renderNextStepGuide();}));collapseActionOptions(c.options);const label=limit.recharge?`Awaiting ${limit.recharge.min}–${limit.recharge.max}`:limit.remaining===0?'No uses remaining':economyError??`Use ${action.name}`;const use=button(label,()=>resolveAutomaticAction(action),blocked||!confirmed?'button secondary action-roll':'button primary action-roll');use.disabled=blocked||!confirmed;if(!confirmed)use.title='Confirm the visible prerequisite first.';c.actions.append(use);}appendAction(c.node,blocked);
    }
  }
  for(const multiattack of sheet.actions.filter((candidate):candidate is Extract<CreatureAction,{type:'multiattack'}>=>candidate.type==='multiattack')){
    const directCards=()=>Array.from(root.children).filter((node):node is HTMLElement=>node instanceof HTMLElement&&node.classList.contains('item-card'));
    const main=directCards().find(node=>node.querySelector('.item-head strong')?.textContent===multiattack.name);if(!main)continue;
    const componentNames=[...new Set([...(multiattack.sequence??[]),...(multiattack.variants??[]).flatMap(variant=>variant.sequence)])].map(id=>sheet.actions.find(candidate=>candidate.id===id)?.name).filter((name):name is string=>Boolean(name));
    const componentNodes=componentNames.map(name=>directCards().find(node=>node.querySelector('.item-head strong')?.textContent===name)).filter((node):node is HTMLElement=>Boolean(node));if(!componentNodes.length)continue;
    const choices=document.createElement('details');choices.className='action-choice-group multiattack-components';const summary=document.createElement('summary');summary.append(text('strong','Single attacks & alternatives'),text('small',`${componentNames.join(', ')} can also be used alone when legal`));const list=document.createElement('div');list.className='action-choice-list';componentNodes.forEach(node=>list.append(node));choices.append(summary,list);main.after(choices);
  }
  if(unarmedCount){const choices=document.createElement('details');choices.className='action-choice-group';const summary=document.createElement('summary');summary.append(text('strong','Unarmed Strike'),text('small','Choose Damage, Grapple, or Shove'));choices.append(summary,unarmedChoices);root.append(choices);}
  if(unavailable.childElementCount){const details=document.createElement('details');details.className='unavailable-actions';details.open=availableCount===0;const summary=document.createElement('summary');summary.textContent=`Unavailable right now (${unavailable.childElementCount})`;details.append(summary,unavailable);root.append(details);}
}
function renderRolls(){
  const root=$('#tab-content');clear(root);const initiative=sheet.initiative;const initiativeSource=sheet.form?`Current form: ${sheet.form.name}. ${initiative.source}.`:`Base form. ${initiative.source}.`;const initiativeCard=card(`Initiative ${signed(initiative.modifier)}`,sheet.form?.name??'Base Form',`${initiativeSource} Initiative is a Dexterity check when combat starts. If you transform after rolling, keep the existing Initiative order.`);
  initiativeCard.options.append(initiativeModePicker());initiativeCard.actions.append(button('Roll Initiative',rollInitiative,'button primary action-roll'));root.append(text('h3','Initiative'),initiativeCard.node);
  const saveTitle=text('h3','Saving Throws');root.append(saveTitle);const saves=document.createElement('div');saves.className='roll-grid';
  for(const value of Object.values(sheet.saves)){const row=document.createElement('div');row.className='roll-row';const info=document.createElement('div');const ruleMode=resolveAdvantage({advantage:value.advantageSources??[],disadvantage:value.disadvantageSources??[]}).mode as 'normal'|'advantage'|'disadvantage';const notes=[value.source,...(value.advantageSources?.length?[`Advantage: ${value.advantageSources.join(', ')}`]:[]),...(value.disadvantageSources?.length?[`Disadvantage: ${value.disadvantageSources.join(', ')}`]:[]),...(value.minimumTotal!==undefined?[`${value.minimumSource}: minimum total ${value.minimumTotal}`]:[]),...(state.receivedEffects.some(effect=>effect.kind==='bless')?['Bless adds 1d4 automatically.']:[]),...(value.automaticFailure?[value.automaticFailure]:[])];info.append(text('strong',`${value.name} ${signed(value.modifier)}`),text('small',notes.join(' · ')));const roll=button(value.automaticFailure?'Automatic Failure':'Roll',()=>d20(value.modifier,combinedMode(ruleMode),value.name,value.minimumD20,value.minimumTotal,value.minimumSource,undefined,'save'),'button compact');roll.disabled=Boolean(value.automaticFailure);row.append(info,roll);saves.append(row);}root.append(saves,text('h3','Skills'));
  const skills=document.createElement('div');skills.className='roll-grid';for(const value of Object.values(sheet.skills).sort((a,b)=>a.name.localeCompare(b.name))){const row=document.createElement('div');row.className='roll-row';const info=document.createElement('div');const ruleMode=resolveAdvantage({advantage:value.advantageSources??[],disadvantage:value.disadvantageSources??[]}).mode as 'normal'|'advantage'|'disadvantage';const guided=state.receivedEffects.some(effect=>effect.kind==='guidance'&&effect.skill===value.name);const detail=[value.source,...(value.advantageSources?.length?[`Advantage: ${value.advantageSources.join(', ')}`]:[]),...(value.disadvantageSources?.length?[`Disadvantage: ${value.disadvantageSources.join(', ')}`]:[]),...(value.conditionalSources?.length?[`Conditional: ${value.conditionalSources.join(', ')}`]:[]),...(value.minimumD20!==undefined?[`${value.minimumSource}: d20 minimum ${value.minimumD20}`]:[]),...(value.minimumTotal!==undefined?[`${value.minimumSource}: total minimum ${value.minimumTotal}`]:[]),...(guided?['Guidance adds 1d4 automatically.']:[]),...(value.alternate?[`Alternate ${signed(value.alternate.modifier)}: ${value.alternate.source}`]:[])].join(' · ');info.append(text('strong',`${value.name} ${signed(value.modifier)}`),text('small',detail));const actions=document.createElement('div');actions.className='inline-actions';actions.append(button('Roll',()=>d20(value.modifier,combinedMode(ruleMode),value.name,value.minimumD20,value.minimumTotal,value.minimumSource,undefined,'skill',value.name),'button compact'));if(value.alternate)actions.append(button('Use STR',()=>d20(value.alternate?.modifier??value.modifier,combinedMode(ruleMode),`${value.name} (Strength)`,value.alternate?.minimumD20,value.alternate?.minimumTotal,value.alternate?.minimumSource,undefined,'skill',value.name),'button compact'));row.append(info,actions);skills.append(row);}root.append(skills);
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
  if(spell.attackBonus!==undefined){const pseudo:AttackAction={id:`spell-${spell.name}`,name:spell.name,type:'attack',cost:'none',attackBonus:spellAttackModifier(spell),ability:spell.ability,kind:'spell',damage:spell.damage??[]};const context=rollContext(pseudo.id,attackRollSources(character,state,pseudo,sheet));const attackBase=rollD20Result(pseudo.attackBonus,context.mode),received=receivedRollBonus('attack'),attack={...attackBase,total:attackBase.total+received.total};declareAttack(state,pseudo);const sources=[...context.sources.advantage.map(value=>`Advantage: ${value}`),...context.sources.disadvantage.map(value=>`Disadvantage: ${value}`),...context.conditional.map(value=>`Conditional: ${value}`),...(received.detail?[received.detail]:[])];if(!attack.naturalOne)queueDamageRoll(spell.name,spell.damage??[],attack.critical,0,[],spell.summary?[`Spell effect: ${spell.summary}`]:[]);const presentation:RollPresentation=attack.naturalOne?{natural:1,tone:'critical-failure',label:'Natural 1 · automatic miss'}:attack.critical?{natural:attack.kept,tone:'critical-success',label:'Critical hit · damage dice doubled'}:d20Presentation(attack.kept,attack.total);showRoll(attack.naturalOne?'Natural 1':`${attack.total} to hit`,`${attackRollDetail(attack,pseudo.attackBonus,20,received.total)}
${attack.naturalOne?'No damage roll is available.':'If the spell attack hits, open Actions and use Roll Damage.'}${spell.summary?`\nSpell effect: ${spell.summary}`:''}${sources.length?`\n${sources.join(' · ')}`:''}`,`${spell.name} Attack`,presentation);return;}
  if(spell.healing){const healing=rollDice(spell.healing);showRoll(`${healing.total} healing`,`${spell.healing} = ${healing.total}. Apply it to the chosen target.${spell.summary?`\n${spell.summary}`:''}`,spell.name);return;}
  if(spell.damage?.length&&spell.resolution==='manual'){showRoll('Manual',spell.summary??'Resolve this conditional effect from your source.',spell.name);return;}
  if(spell.damage?.length){const damage=packetTotal(spell.damage);const save=spell.saveAbility?`DC ${spellSaveDc(spell)} ${spell.saveAbility.toUpperCase()} save`:`DC ${spellSaveDc(spell)} save`;const success=spell.halfOnSave?` Success: ${Math.floor(damage.total/2)} damage.`:'';showRoll(`${damage.total} effect dmg`,`${spell.resolution==='automatic'?`No attack roll or saving throw is required. ${damage.detail}`:`${save}. Failure: ${damage.total} damage.${success} ${damage.detail}`}${spell.summary?`\n${spell.summary}`:''}`,spell.name);return;}
  showRoll('Cast',spell.summary??'Spell effect activated.',spell.name);
}
function castAndResolveSpell(spell:Spell&{available:boolean;reason:string}){const castLevel=chosenSpellLevel(spell);const result=castSpell(character,state,spell.name,castLevel||undefined);const success=result.message.startsWith('Cast ');applyResult(result);if(!success)return;const immediate=spell.resolution!=='manual'&&(spell.attackBonus!==undefined||Boolean(spell.healing)||(!spell.concentration&&Boolean(spell.damage?.length)));const persistent=spellActiveEffect(spell);const timing=persistent?.id==='barkskin'?' Barkskin used your Bonus Action; your Action remains available. Wild Shape and Rage also require a Bonus Action and must wait until a later turn.':'';if(immediate)resolveSpellEffect(spell,castLevel);else showRoll('Cast',`${persistent?`${persistent.summary} Active for ${persistent.duration}.`:spell.concentration?'Concentration started. Use Resolve Effect whenever the spell deals damage or healing.':spell.summary??'Spell activated.'}${timing}`,spell.name);}
function spellCard(spell:Spell&{available:boolean;reason:string}){
  const slotLevel=spell.slotLevel??spell.level;const chosen=chosenSpellLevel(spell);const persistent=spellActiveEffect(spell);const resolution=spell.damage?.length&&spell.attackBonus===undefined?(spell.resolution==='automatic'?'Automatic damage':spell.resolution==='manual'?'Conditional/manual effect':`Save DC ${spellSaveDc(spell)}${spell.saveAbility?` ${spell.saveAbility.toUpperCase()}`:''}${spell.halfOnSave?' · half on success':''}`):'';const stats=[actionCostLabel(spell.castingTime),slotLevel===0?'Cantrip':`Level ${slotLevel}`,spell.concentration?'Concentration':'',persistent?.acMinimum!==undefined?`AC minimum ${persistent.acMinimum}`:'',persistent?.duration?`Duration ${persistent.duration}`:'',spell.components?`Components ${spell.components}`:'',spell.attackBonus!==undefined?`Spell attack ${signed(spellAttackModifier(spell))}`:'',spell.healing?`Healing ${spell.healing}`:'',resolution].filter(Boolean).join(' · ');const timing=persistent?.id==='barkskin'?'2024 timing: Barkskin, Wild Shape, and Rage each use a Bonus Action, so they cannot be activated together on one turn. Barkskin lasts 1 hour; cast it before combat or on an earlier turn, then transform or Rage later.':'';const detail=[stats,spell.reason,persistent?.summary??spell.summary??'',timing].filter(Boolean).join('\n');const badge=spell.specialAccess==='circle-of-the-moon'?(spell.available?'Circle · Ready':'Circle · Blocked'):(spell.available?'Ready':'Unavailable');const c=card(spell.name,badge,detail,spell.available?'available':'unavailable');c.badge.className=`badge ${spell.available?'active':'inactive'}`;
  const levels=availableSpellSlotLevels(character,state,slotLevel);if(slotLevel>0&&levels.length){const picker=document.createElement('label');picker.className='slot-picker';picker.append(text('span','Cast using'));const select=document.createElement('select');select.setAttribute('aria-label',`${spell.name} spell slot level`);const scales=Boolean(spell.higherSlotHealing||spell.higherSlotDamage?.length);for(const level of levels){const option=document.createElement('option');option.value=String(level);option.textContent=`Level ${level} slot${level>slotLevel?scales?' · scaled effect':' · higher-level slot':''}`;option.selected=level===chosen;select.append(option);}select.disabled=!spell.available;select.addEventListener('change',()=>{selectedSpellSlots.set(spellKey(spell),Number(select.value));renderSpells();renderNextStepGuide();});picker.append(select);c.options.append(picker);}if(spell.attackBonus!==undefined)c.options.append(rollModePicker(`spell-${spell.name}`,spell.name));
  const immediate=spell.resolution!=='manual'&&(spell.attackBonus!==undefined||Boolean(spell.healing)||(!spell.concentration&&Boolean(spell.damage?.length)));const castLabel=persistent?.id==='barkskin'?'Cast Barkskin on Self':immediate?`Cast & Roll ${spell.name}`:`Cast ${spell.name}`;const cast=button(spell.available?castLabel:spell.reason,()=>castAndResolveSpell(spell),spell.available?'button primary action-roll':'button secondary');cast.disabled=!spell.available;c.actions.append(cast);const activeEffect=state.concentration?.name===spell.name&&spell.resolution!=='manual'&&Boolean(spell.damage?.length||spell.healing);if(activeEffect)c.actions.append(button(`Resolve ${spell.name} Effect`,()=>resolveSpellEffect(spell,state.concentration?.castLevel??slotLevel),'button secondary'));return c.node;
}
function renderSpells(){
  const root=$('#tab-content');clear(root);if(sheet.spells.length===0){root.append(text('div','No spells were imported for this character.','empty'));return;}
  const circleInForm=sheet.profile==='wildshape'&&isMoonDruid();root.append(text('p',state.rage.active?'Rage blocks all spells, including Circle of the Moon spells. End Rage before casting.':circleInForm?'While Wild Shaped, Circle spells using the Magic Action remain usable whenever your Action is available. Wild Shape used your Bonus Action, not your Action.':'Choose a spell and, when relevant, the spell-slot level. You can still use both an Action and a Bonus Action, but 2024 rules allow only one spell-slot expenditure to cast a spell per turn.','tab-help'));
  const ready=sheet.spells.filter(spell=>spell.available).sort((a,b)=>Number(Boolean(b.specialAccess))-Number(Boolean(a.specialAccess))||a.level-b.level||a.name.localeCompare(b.name));const blocked=sheet.spells.filter(spell=>!spell.available).sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name));
  if(ready.length){root.append(text('h3',`Available now (${ready.length})`));for(const spell of ready)root.append(spellCard(spell));}else root.append(text('div','No spell can be cast right now. The reasons are shown below.','empty'));
  if(blocked.length){const details=document.createElement('details');details.className='unavailable-spells';if(ready.length===0)details.open=true;const summary=document.createElement('summary');summary.textContent=`Unavailable right now (${blocked.length})`;details.append(summary);for(const spell of blocked)details.append(spellCard(spell));root.append(details);}
}
function featureReferenceSection(title:string,helper:string,open:boolean){const section=document.createElement('details');section.className='feature-reference-section';section.open=open;const summary=document.createElement('summary');const copy=document.createElement('span');copy.append(text('strong',title),text('small',helper));summary.append(copy);const content=document.createElement('div');content.className='feature-reference-content';section.append(summary,content);return {section,content};}
function equipmentAppliesNow(){return sheet.profile==='base'||sheet.profile==='overlay'||(state.equipment.transformBehavior==='wear'&&state.equipment.formCanWear===true);}
function itemEffectLabel(effect:NonNullable<Character['items'][number]['effects']>[number]){const amount=`${effect.value>=0?'+':''}${effect.value}`;const labels={'armor-class':`${amount} Armor Class`,'saving-throws':`${amount} to saving throws`,'natural-attack-rolls':`${amount} to natural and unarmed attack rolls`,'natural-attack-damage':`${amount} natural and unarmed attack damage`};return `${labels[effect.kind]}${effect.includedInImportedTotals?' (included in imported totals)':''}`;}
function equipmentSection(){
  const equipped=character.items.filter(item=>item.equipped),stored=character.items.length-equipped.length;const group=featureReferenceSection(`Equipment & effects (${equipped.length})`,character.items.length?`${equipped.length} equipped · ${stored} stored · effects shown once`:'No inventory records · re-import to load equipment',true);group.section.classList.add('equipment-feature-section');
  if(!character.items.length){group.content.append(card('Equipment was not imported','Not loaded','Re-import this public D&D Beyond character from A menu → Import. Altered will preserve equipped weapons and supported numeric item effects without applying imported totals twice.','warning').node);return group.section;}
  const retained=equipmentAppliesNow();for(const item of equipped){const attunementMissing=item.requiresAttunement&&!item.attuned;const applied=retained&&!attunementMissing;const action=sheet.actions.find(entry=>entry.id===`item-attack-${item.id}`);const status:UiStatus=attunementMissing?'unavailable':applied?'active':'inactive';const badge=attunementMissing?'Needs attunement':applied?'Applied now':'Melded in form';const effects=(item.effects??[]).map(itemEffectLabel);const weapon=action?.type==='attack'?`${action.attackBonus>=0?'+':''}${action.attackBonus} to hit · ${action.damage.map(packet=>`${packet.expression} ${packet.type}`).join(' + ')}`:item.attack?`${item.attack.damage} ${item.attack.damageType} weapon`:'';const explanation=attunementMissing?'No attunement-dependent effects are active.':!retained?'This gear is merged into the current form, so its attacks and effects are inactive.':effects.length?'Supported effects are reflected in the values and rolls shown by Altered.':'Equipped and available; no separate numeric effect was supplied by the character source.';const c=card(item.name,badge,[item.type,weapon,...effects,explanation].filter(Boolean).join(' · '),status);c.node.classList.add('equipment-effect-card');group.content.append(c.node);}
  if(stored){const note=document.createElement('p');note.className='equipment-stored-note';note.textContent=`${stored} stored item${stored===1?' is':'s are'} preserved in the character record and hidden here to keep this page compact.`;group.content.append(note);}return group.section;
}
function featureHowToUse(feature:EvaluatedFeature,ownedFeat:boolean){
  if(feature.status==='inactive')return feature.reason;
  if(feature.status==='ruling'&&feature.name.trim().toLowerCase()==='weapon mastery')return 'Reference only—not an error. Altered found Weapon Mastery, but the imported source did not identify this character’s chosen mastery weapons. Weapon attack and damage totals remain correct; confirm the chosen mastery effect from your character source when it triggers.';
  if(ownedFeat)return 'Reference entry only. Altered preserves the name and imported totals; configure private mechanics or consult your authorized character source for its choices and triggers.';
  if(feature.status==='ruling')return 'Reference only—not an error. Altered found this character option but does not have enough structured information to execute its choices or triggers automatically. Its imported totals remain unchanged.';
  if(feature.id==='rage')return state.rage.active?'Rage is active. Use End Rage when you want to stop it.':'Tap Start Rage below. It spends one Rage use and your Bonus Action.';
  if(feature.id==='wild-shape')return state.activeTransform?.option.profile==='wildshape'?'Your selected form is active. Use Forms to change or end it.':'Tap Choose Form below, select a legal form, then Transform.';
  if(feature.id==='wild-resurgence')return 'Choose one exchange below. Each disabled button explains which resource or limit prevents it.';
  if(feature.id==='large-form')return state.overlays.includes('goliath-large-form')?'Large Form is active. Open Forms to end or review it.':'Tap Open Forms, select Large Form, then activate it.';
  if(feature.status==='active')return 'Automatic. Altered is applying this benefit now; no activation button is required.';
  if(feature.activation&&feature.activation!=='none')return `Use the button below. It spends ${feature.activation==='bonus'?'your Bonus Action':feature.activation==='action'?'your Action':feature.activation==='reaction'?'your Reaction':'no action'}.`;
  return 'Conditional. Altered applies it when the app can detect the trigger; battlefield or target conditions must be confirmed on the relevant roll or action.';
}
type PriorityAbilityState={state:'ready'|'blocked'|'active';reason:string};
function priorityAbilityState(feature:EvaluatedFeature):PriorityAbilityState|undefined{
  if(feature.id==='rage'){
    if(state.rage.active)return {state:'active',reason:'Rage is active now.'};
    const error=rageStartError(character,state);
    return error?{state:'blocked',reason:error}:{state:'ready',reason:'Rage use and Bonus Action are available.'};
  }
  if(feature.id==='wild-shape'){
    if(state.activeTransform?.option.profile==='wildshape')return {state:'active',reason:`${state.activeTransform.option.label} is active now.`};
    const options=availableTransformations(character,state).filter(option=>option.profile==='wildshape'&&!option.deactivate);
    const ready=options.find(option=>option.usable&&!actionCostError(state,option.actionCost,sheet.conditionImmunities));
    if(ready)return {state:'ready',reason:'At least one legal form and the required action are available.'};
    const legal=options.find(option=>option.usable);
    const reason=legal?actionCostError(state,legal.actionCost,sheet.conditionImmunities):options[0]?.reason;
    return {state:'blocked',reason:reason||'No legal Wild Shape form is available right now.'};
  }
  return undefined;
}
function appendFeatureControls(feature:EvaluatedFeature,actions:HTMLElement,priority?:PriorityAbilityState){
  if(feature.id==='rage'){
    const error=state.rage.active?null:rageStartError(character,state);const control=button(state.rage.active?'End Rage':'Start Rage · Bonus Action',()=>applyResult(state.rage.active?endRage(state):startRage(character,state)),`button priority-ability-control ${priority?.state??'ready'}`);control.disabled=Boolean(error);control.title=priority?.reason??error??'';actions.append(control);return;
  }
  if(feature.id==='wild-shape'||feature.id==='large-form'){const control=button(feature.id==='wild-shape'?'Choose Form':'Open Forms',()=>setWorkspace('forms'),feature.id==='wild-shape'?`button priority-ability-control ${priority?.state??'ready'}`:'button primary');if(priority)control.title=priority.reason;actions.append(control);return;}
  if(feature.id==='cunning-action'||feature.id==='fast-hands'){const control=button(feature.id==='fast-hands'?'Choose Fast Hands option':'Choose Cunning Action',()=>setWorkspace('task','actions','play'),'button primary');control.title='Open Actions, then choose the exact Dash, Disengage, Hide, Sleight of Hand, Utilize, or Magic Item option Altered has verified for this character.';actions.append(control);return;}
  if(feature.id==='wild-resurgence'){
    const toShapeError=wildResurgenceError(character,state,'slot-to-shape');const toShape=button('Slot → Wild Shape',()=>applyResult(useWildResurgence(character,state,'slot-to-shape')),toShapeError?'button secondary':'button primary');toShape.disabled=Boolean(toShapeError);if(toShapeError)toShape.title=toShapeError;
    const toSlotError=wildResurgenceError(character,state,'shape-to-slot');const toSlot=button('Wild Shape → L1 Slot',()=>applyResult(useWildResurgence(character,state,'shape-to-slot')),toSlotError?'button secondary':'button primary');toSlot.disabled=Boolean(toSlotError);if(toSlotError)toSlot.title=toSlotError;appendControlReason(actions,toShape,toShapeError,'wild-resurgence-slot-to-shape-reason');appendControlReason(actions,toSlot,toSlotError,'wild-resurgence-shape-to-slot-reason');return;
  }
  if(feature.id.startsWith('private-')&&feature.activation&&feature.activation!=='none'&&feature.status!=='inactive'){
    const error=actionCostError(state,feature.activation,sheet.conditionImmunities);const use=button(`Use ${feature.name} · ${actionCostLabel(feature.activation)}`,()=>{const failure=spendActionCost(state,feature.activation!,sheet.conditionImmunities);if(failure){notify(failure);render();return;}showRoll('Activated',`${feature.summary} Resolve target or battlefield prerequisites from your authorized source.`,feature.name);render();},error?'button secondary':'button primary');use.disabled=Boolean(error);if(error)use.title=error;appendControlReason(actions,use,error,`${feature.id}-blocked-reason`);
  }
}
function featureCard(feature:EvaluatedFeature){
  const ownedFeat=feature.source==='Feat'&&feature.status==='ruling';const priority=priorityAbilityState(feature);const featureStatus:UiStatus=priority?.state==='ready'?'available':priority?.state==='blocked'?'unavailable':priority?.state==='active'?'active':feature.status==='active'?'active':feature.status==='conditional'?'warning':feature.status==='inactive'?'inactive':'reference';const badge=priority?.state==='ready'?'Available now':priority?.state==='blocked'?'Unavailable now':priority?.state==='active'?'Active now':feature.status==='active'?'Applied now':feature.status==='conditional'?'Ready / conditional':feature.status==='inactive'?'Unavailable now':ownedFeat?'Owned · reference':'Reference only';const c=card(feature.name,badge,'',featureStatus);c.badge.className=`badge ${priority?`priority-${priority.state}`:ownedFeat?'owned':feature.status}`;if(priority){c.node.classList.add('priority-ability',`priority-${priority.state}`);c.node.dataset.priorityState=priority.state;c.node.setAttribute('aria-label',`${feature.name}: ${badge}. ${priority.reason}`);}const paragraph=c.node.querySelector(':scope > p');if(paragraph){paragraph.className='feature-explanation';const instructions=priority?.state==='blocked'?`Blocked: ${priority.reason}`:featureHowToUse(feature,ownedFeat);paragraph.append(text('span','What it does','feature-explanation-label'),text('span',feature.summary),text('span','How to use it','feature-explanation-label'),text('span',instructions));}appendFeatureControls(feature,c.actions,priority);return c.node;
}
function renderFeatures(){
  const root=$('#tab-content');clear(root);let count=0;
  const intro=document.createElement('div');intro.className='feature-page-intro';intro.append(text('strong','Abilities, explained'),text('p','Open a group below. Every entry says what it does and whether you press a button, confirm a trigger, or do nothing because Altered applies it automatically.'));const legend=document.createElement('div');legend.className='feature-status-legend';legend.append(statusChip('warning','Use or confirm'),statusChip('active','Applied automatically'),statusChip('reference','Reference only'),statusChip('inactive','Unavailable now'));intro.append(legend);root.append(intro);
  if(sheet.form?.traits.length){const group=featureReferenceSection(`${sheet.form.name} traits`,'Supplied by the current form; battlefield triggers still require confirmation',true);for(const trait of sheet.form.traits){const conditional=trait.name.trim().toLowerCase()==='pack tactics';const detail=conditional?`${trait.summary} Altered cannot know where allies and targets are. Confirm Pack Tactics in the attack's Roll options when this is true.`:trait.summary;const c=card(trait.name,conditional?'Confirm for each attack':'Applied automatically',detail,conditional?'warning':'active');c.badge.className=conditional?'badge warning':'badge active';group.content.append(c.node);count++;}root.append(group.section);}
  if(state.overlays.length){const group=featureReferenceSection('Active transformation effects','Currently modifying the character or form',true);for(const id of state.overlays){const grant=character.transformationGrants?.find(item=>item.id===id);const c=card(grant?.label??id,'Applied automatically',grant?`${grant.source}${grant.duration?` · ${grant.duration}`:''}`:'Built-in transformation effect currently applied.','active');c.badge.className='badge active';group.content.append(c.node);count++;}root.append(group.section);}
  if(sheet.features.length){const priority=sheet.features.filter(feature=>Boolean(priorityAbilityState(feature)));const ordinary=sheet.features.filter(feature=>!priority.includes(feature));const groups=[{title:'Core abilities',helper:'Frequent controls · green is ready, red explains what blocks it',features:priority,open:true},{title:'Use or confirm',helper:'Other abilities you activate and rules with a trigger',features:ordinary.filter(feature=>feature.status==='conditional'),open:true},{title:'Applied automatically',helper:'Benefits Altered is applying now—no button required',features:ordinary.filter(feature=>feature.status==='active'),open:false},{title:'Owned references',helper:'Imported names whose private mechanics are not configured',features:ordinary.filter(feature=>feature.status==='ruling'),open:false},{title:'Unavailable now',helper:'Open to see exactly what currently blocks these features',features:ordinary.filter(feature=>feature.status==='inactive'),open:false}];for(const entry of groups){if(!entry.features.length)continue;const group=featureReferenceSection(`${entry.title} (${entry.features.length})`,entry.helper,entry.open);if(entry.title==='Core abilities')group.section.classList.add('priority-ability-section');for(const feature of entry.features){group.content.append(featureCard(feature));count++;}root.append(group.section);}}
  if(count===0)root.append(text('div','No evaluated features or active form traits.','empty'));
}
function renderEquipment(){
  const root=$('#tab-content');clear(root);root.append(text('p','Equipped gear and its current effects appear first. Open Stored inventory only when you need the rest of the character’s items. Equipped weapons and usable item actions also appear on Actions.','tab-help'),equipmentSection());const stored=character.items.filter(item=>!item.equipped);if(stored.length){const group=featureReferenceSection(`Stored inventory (${stored.length})`,'Carried or owned · not affecting current rolls',false);group.section.classList.add('stored-inventory-section');for(const item of stored){const detail=[item.type,item.attack?`${item.attack.damage} ${item.attack.damageType}`:'',item.requiresAttunement?'Requires attunement':'',item.ruleset.toUpperCase()].filter(Boolean).join(' · ');group.content.append(card(item.name,'Stored',detail,'inactive').node);}root.append(group.section);}
}
function renderRules(){
  const root=$('#tab-content');clear(root);const confidence=document.createElement('section');confidence.className='item-card rules-confidence';const confidenceState=character.provenance.ruleset==='2024'&&!character.provenance.reviewRequired?'success':'warning';confidence.append(text('strong','Rules confidence'),statusChip(confidenceState,confidenceState==='success'?'2024 character verified':'Review required'),text('p','Built-in mechanics are audited 2024 SRD rules. Character-sheet values come from the current import. Private additions remain visibly user-confirmed and are never presented as built-in rules.'),text('small',`${registrySnapshot.packs.length} audited built-in pack${registrySnapshot.packs.length===1?'':'s'} · ${installedPacks.length} private pack${installedPacks.length===1?'':'s'} · ${character.provenance.rulesetEvidence.join(' · ')||'No character ruleset evidence supplied'}`,'source-note'));root.append(confidence,text('h3','Armor Class candidates'));const list=document.createElement('div');list.className='ac-list';for(const candidate of sheet.acCandidates){const row=document.createElement('div');row.className='ac-row'+(candidate.legal?'':' invalid');const info=document.createElement('div');info.append(text('strong',candidate.name),text('div',candidate.reason,'source-note'));row.append(info,text('strong',String(candidate.value)));list.append(row);}root.append(list,text('h3','Current transformation'));const source=document.createElement('div');source.className='item-card';source.append(text('strong',state.activeTransform?.option.label??'Base Form'),text('p',state.activeTransform?`${state.activeTransform.option.source} · ${state.activeTransform.duration}${state.activeTransform.permanentUntilDispelled?' · no Concentration required':''}`:'No replacement transformation is active.'));source.append(text('p',`Creature type: ${sheet.creatureType} · Size: ${sheet.size}`));if(sheet.form)source.append(text('p',`Verified stat block: ${sheet.form.source.page} · ${sheet.form.source.verified}`));root.append(source,text('h3','Current defenses'));const defenses=document.createElement('div');defenses.className='item-card';const moonReady=sheet.profile==='wildshape'?sheet.spells.filter(spell=>spell.specialAccess==='circle-of-the-moon'&&spell.available).length:0;const casting=sheet.canCast?'Yes':moonReady?`Circle spells only (${moonReady} ready)`:'No';defenses.append(text('p',`Resistances: ${sheet.resistances.join(', ')||'None'}`),text('p',`Immunities: ${sheet.immunities.join(', ')||'None'}`),text('p',`Senses: ${sheet.senses.join(', ')||'Base character senses'}`),text('p',`Speech: ${sheet.canSpeak?'Yes':'No'} · Spellcasting: ${casting} · Concentration: ${sheet.canConcentrate?'Allowed':'Blocked'} · Attack: ${sheet.canAttack?'Yes':'No'} · Manipulate objects: ${sheet.canManipulateObjects?'Yes':'No'}`),text('p',`Condition immunities: ${sheet.conditionImmunities.join(', ')||'None'}`));root.append(defenses,text('h3','Character source and items'));const provenance=document.createElement('div');provenance.className='item-card';provenance.append(text('strong',`${character.provenance.provider==='dndbeyond'?'D&D Beyond':'Local'} · ${character.provenance.ruleset.toUpperCase()} rules`),text('p',character.provenance.rulesetEvidence.join(' · ')||'No ruleset evidence was supplied.'),text('p',`${character.items.length} item record${character.items.length===1?'':'s'}; imported numeric totals are not applied a second time.`));for(const item of character.items){provenance.append(text('p',`${item.name} · ${item.type} · ${item.equipped?'equipped':'not equipped'}${item.requiresAttunement?item.attuned?' · attuned':' · attunement required':''} · ${item.ruleset.toUpperCase()} · ${item.mechanics.replaceAll('-',' ')}`,'source-note'));}root.append(provenance,text('h3','Rules databank'));const registry=document.createElement('div');registry.className='item-card';registry.append(text('p',`${registrySnapshot.packs.length} built-in packs and ${installedPacks.length} private local packs are available. The engine, shared rules, private owned content, imported character, and mutable combat state are stored as separate layers.`));renderContentRegistry(registry,true);root.append(registry);
}
function syncTabState(){
  let activeTab:HTMLButtonElement|undefined;
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach(tab=>{const active=tab.dataset.tab===currentTab;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active)activeTab=tab;});
  if(activeTab)$('#tab-content').setAttribute('aria-labelledby',activeTab.id);
  syncWorkspaceChrome();
}
function renderTab(){sheet=resolveSheet(character,state);syncTabState();if(currentTab==='actions')renderActions();else if(currentTab==='rolls')renderRolls();else if(currentTab==='spells')renderSpells();else if(currentTab==='features')renderFeatures();else if(currentTab==='equipment')renderEquipment();else renderRules();}
function activateTab(tab:HTMLButtonElement,focus=false){currentTab=tab.dataset.tab??'actions';renderTab();syncWorkspaceChrome();renderNextStepGuide();if(focus)tab.focus();}
function syncBattlefieldFacts(){
  const controls:[BattlefieldFact,string][]=[['ally-near-target','#fact-ally-near-target'],['attacker-unseen','#fact-attacker-unseen'],['target-unseen','#fact-target-unseen']];
  for(const [fact,selector] of controls)$<HTMLInputElement>(selector).checked=nextAttackFacts.has(fact);
  const count=nextAttackFacts.size;$('#battlefield-facts-summary').textContent=count?`${count} set for next attack`:'Automatic rules only';$('#battlefield-facts').classList.toggle('tracked-active',count>0);
}
function renderConditions(){
  const list=$('#condition-list');clear(list);for(const condition of state.conditions){const label=condition==='Exhaustion'?`Exhaustion ${state.exhaustionLevel} −1`:`${condition} ×`;const chip=button(label,()=>applyResult(removeCondition(state,condition)),'condition-chip tracked-active');chip.setAttribute('aria-label',condition==='Exhaustion'?`Reduce Exhaustion from level ${state.exhaustionLevel}`:`Remove ${condition} condition`);list.append(chip);}
  const effects=$('#received-effect-list');clear(effects);$('#received-effect-count').textContent=state.receivedEffects.length?`${state.receivedEffects.length} active`:'None active';
  if(!state.receivedEffects.length)effects.append(text('p','No received buffs are active.','empty compact-empty'));
  for(const effect of state.receivedEffects){const card=document.createElement('article');card.className='received-effect-entry tracked-active';const copy=document.createElement('div');copy.append(text('strong',effect.name),text('small',receivedEffectSummary(effect)));const actions=document.createElement('div');actions.className='received-effect-actions';if(effect.kind==='bardic-inspiration'||effect.kind==='heroic-inspiration')actions.append(button(effect.kind==='bardic-inspiration'?`Use d${effect.die??6}`:'Reroll d20',()=>consumeReceivedEffect(effect),'button compact primary'));actions.append(button('End',()=>applyResult(endReceivedEffect(state,effect.id)),'button compact secondary'));card.append(copy,actions);effects.append(card);}
  const hasAnything=state.receivedEffects.length>0||state.conditions.length>0||state.activeSpellEffects.length>0||Boolean(state.concentration)||state.rage.active||Boolean(state.activeTransform);$('#open-active-effects').classList.toggle('tracked-active',hasAnything);
}
function syncReceivedEffectFields(){const kind=$<HTMLSelectElement>('#received-effect-kind').value as ReceivedEffectKind;$('#received-effect-die-field').hidden=kind!=='bardic-inspiration';$('#add-received-effect-button').textContent=`Add ${RECEIVED_EFFECTS[kind].name}`;}
function createReceivedEffect(){const kind=$<HTMLSelectElement>('#received-effect-kind').value as ReceivedEffectKind,info=RECEIVED_EFFECTS[kind];const effect:ReceivedEffect={id:`received:${kind}:${Date.now()}`,kind,name:info.name,source:'Received buff',addedTurn:state.turn.number,duration:info.duration,...(kind==='guidance'?{autoChooseSkill:true}:{}),...(kind==='bardic-inspiration'?{die:Number($<HTMLSelectElement>('#received-effect-die').value) as 6|8|10|12}:{})};applyResult(addReceivedEffect(state,effect));$<HTMLDetailsElement>('#add-received-effect').open=false;}
function renderLog(){const root=$('#activity-log');clear(root);$<HTMLButtonElement>('#clear-activity').disabled=state.log.length===0;if(state.log.length===0){root.append(text('div','No activity yet.','log-row'));return;}for(const item of state.log)root.append(text('div',item,'log-row'));}
type NextStepSuggestion={title:string;copy:string;target:HTMLElement;reveal?:()=>HTMLElement};
function taskControl(label:string){const control=Array.from(document.querySelectorAll<HTMLButtonElement>('#tab-content button')).find(candidate=>candidate.textContent?.toLowerCase().includes(label.toLowerCase()));if(control){control.closest('details')?.setAttribute('open','');return control;}return $<HTMLElement>('#task-view-title');}
function revealTask(tab:string,label?:string){return ()=>{setWorkspace('task',tab,'play');return label?taskControl(label):$<HTMLElement>('#task-view-title');};}
function recommendationSafeControl(control:HTMLButtonElement){
  const label=control.textContent?.trim().replace(/\s+/g,' ')??'';
  if(!label||/^(end|stop|remove|clear|delete|reset|undo|release|sign out)\b/i.test(label))return false;
  if(latestRollTab===currentTab&&latestRollTitle!=='Ready'){
    const recent=latestRollTitle.toLowerCase().replace(/^roll\s+/,'').replace(/\s+(attack|damage)$/,'').trim();
    const candidate=label.toLowerCase().replace(/^roll\s+/,'').replace(/\s+(attack|damage)$/,'').trim();
    if(recent&&candidate.includes(recent))return false;
  }
  return true;
}
function recommendNextStep():NextStepSuggestion|null{
  if(currentWorkspace==='forms'){
    const transform=$<HTMLButtonElement>('#transform-button');const selected=currentOption();const active=state.activeTransform?.option;
    if(!transform.hidden&&transform.disabled){
      const needsTurn=/already used|remain/i.test(transform.title);
      if(needsTurn)return {title:'Finish this turn',copy:'The required action is spent. End this turn; a new turn will restore it.',target:transform,reveal:()=>{setWorkspace('play');return $<HTMLElement>('#persistent-end-turn');}};
      return {title:'Review transformation requirements',copy:transform.title||'The selected form explains what is currently missing.',target:transform};
    }
    if(!transform.hidden&&!transform.disabled)return {title:transform.textContent||'Transform',copy:'The selected form is legal and its required action is available.',target:transform};
    if(active&&selected?.id===active.id)return {title:`Use ${active.label}`,copy:'Your form is active. Return to Play to use its actions, spells, checks, and abilities.',target:$<HTMLElement>('#nav-play'),reveal:()=>{setWorkspace('play');return $<HTMLElement>('#open-actions-view');}};
    const end=$<HTMLButtonElement>('#end-form-button');if(active&&selected?.profile==='base'&&!end.hidden)return end.disabled?{title:'Finish this turn',copy:'Ending this form needs an available Bonus Action. End this turn, then release the form on the next one.',target:end,reveal:()=>{setWorkspace('play');return $<HTMLElement>('#persistent-end-turn');}}:{title:`Return to ${character.name}`,copy:'Base Form is selected. End the current form when you are ready to return to normal.',target:end};
    return {title:'Choose a form',copy:'Select a form to see whether your character can use it now.',target:$<HTMLElement>('#form-select')};
  }
  if(currentWorkspace==='task'){
    if(currentTab==='rolls'&&latestRollTab==='rolls'&&latestRollTitle==='Initiative')return {title:'Initiative is set',copy:'Return to Play and take your turn. Roll Initiative again only if your table asks for a reroll.',target:$<HTMLElement>('#nav-play')};
    if(currentTab==='features'&&state.rage.active)return {title:'Use Rage — choose an attack',copy:'Rage is already active. Keep it running and return to Play to choose your next useful action.',target:$<HTMLElement>('#nav-play'),reveal:revealTask('actions')};
    const available=Array.from(document.querySelectorAll<HTMLButtonElement>('#tab-content button:not(:disabled)')).find(control=>!control.hidden&&recommendationSafeControl(control));
    if(available)return {title:available.textContent?.trim().replace(/\s+/g,' ')||'Use this option',copy:`This is an available ${TASK_TITLES[currentTab]?.toLowerCase()??'character'} option. You can still choose any other legal action.`,target:available};
    return {title:'Return to Play',copy:'No new beneficial option is recommended in this section. Keep active effects running and choose another useful action.',target:$<HTMLElement>('#nav-play')};
  }
  if(currentWorkspace==='play'){
    const abilities=$<HTMLElement>('#open-features-view');
    if(state.pendingRelentlessRage)return {title:'Resolve Relentless Rage',copy:`Your survival check against DC ${state.pendingRelentlessRage.dc} is unresolved and takes priority.`,target:abilities,reveal:revealTask('features','Relentless Rage')};
    if(state.hp===0&&!state.life.dead&&!state.life.stable)return {title:'Roll a death save',copy:'The character is at 0 HP and has an unresolved Death Saving Throw.',target:abilities,reveal:revealTask('features','Death Saving Throw')};
    if(state.concentrationChecks.length)return {title:'Resolve Concentration',copy:`Resolve the pending Constitution save against DC ${state.concentrationChecks[0]?.dc??10} before relying on the spell.`,target:abilities,reveal:revealTask('features','Concentration')};
    if(state.turn.attackAction?.remaining)return {title:'Complete Extra Attack',copy:`The Attack action has ${state.turn.attackAction.remaining} attack${state.turn.attackAction.remaining===1?'':'s'} remaining.`,target:$<HTMLElement>('#open-actions-view'),reveal:revealTask('actions')};
    const rage=state.resources['rage'];
    if(state.activeTransform&&classLevel(character,'Barbarian')>0&&!state.rage.active&&!state.concentration&&state.turn.bonusRemaining>0&&(rage?.current??0)>0)return {title:'Consider Rage, then attack',copy:'Rage can improve durability and Strength checks or saves, while leaving your Action free. Beast stat-block attacks do not add Rage Damage.',target:abilities,reveal:revealTask('features','Start Rage')};
    const multiattack=sheet.actions.find(action=>action.type==='multiattack'&&!actionExecutionError(character,state,action,sheet.conditionImmunities));
    if(state.activeTransform&&state.turn.actionsRemaining>0&&multiattack)return {title:`Use ${multiattack.name}`,copy:'This form action makes its listed attack sequence efficiently. Battlefield position and target choice still matter.',target:$<HTMLElement>('#open-actions-view'),reveal:revealTask('actions',multiattack.name)};
    const barkskin=sheet.spells.find(spell=>spell.name.toLowerCase()==='barkskin'&&spell.available);
    if(!state.activeTransform&&isMoonDruid()&&sheet.ac<17&&state.turn.bonusRemaining>0&&barkskin)return {title:'Consider Barkskin',copy:'It can raise AC to 17 and continue through Wild Shape. Because both use a Bonus Action, transform on a later turn.',target:$<HTMLElement>('#open-spells-view'),reveal:revealTask('spells','Barkskin')};
    const usableBonus=sheet.features.find(feature=>feature.activation==='bonus'&&feature.status!=='inactive'&&!actionCostError(state,'bonus',sheet.conditionImmunities));
    if(state.turn.actionsRemaining===0&&state.turn.bonusRemaining>0&&usableBonus)return {title:`Consider ${usableBonus.name}`,copy:'Your Action is spent, but a Bonus Action remains. This is one currently available option.',target:abilities,reveal:revealTask('features',usableBonus.name)};
    if(turnReadyToEnd())return {title:'End this turn',copy:'All tracked turn actions and required resolutions are complete. Finish any movement or free interaction, then End Turn; your Reaction remains available off-turn.',target:$<HTMLElement>('#persistent-end-turn')};
    return {title:'Open Actions',copy:state.activeTransform?'Review the attacks and actions available in your current form.':'Review attacks and other actions available to this character.',target:$<HTMLElement>('#open-actions-view'),reveal:revealTask('actions')};
  }
  return null;
}
function renderNextStepGuide(){
  document.querySelectorAll<HTMLElement>('.next-step-target').forEach(control=>control.classList.remove('next-step-target'));
  nextStepTarget=null;nextStepReveal=null;const guide=$('#next-step-guide');
  if(!guidedNextStep){guide.hidden=true;return;}
  const suggestion=recommendNextStep();if(!suggestion){guide.hidden=true;return;}
  nextStepTarget=suggestion.target;nextStepReveal=suggestion.reveal??null;suggestion.target.classList.add('next-step-target');
  $('#next-step-title').textContent=suggestion.title;$('#next-step-copy').textContent=suggestion.copy;guide.hidden=false;
}
function revealNextStep(){
  if(!nextStepTarget)return;
  const reveal=nextStepReveal;let target=nextStepTarget;
  if(reveal){document.querySelectorAll<HTMLElement>('.next-step-target').forEach(control=>control.classList.remove('next-step-target'));target=reveal();nextStepTarget=target;nextStepReveal=null;}
  target.closest('details')?.setAttribute('open','');target.classList.add('next-step-target');
  // Once the requested destination is visible, the guide has completed its job.
  // Reclaim its dashboard row so compact and folding displays can show the whole control.
  $('#next-step-guide').hidden=true;
  window.requestAnimationFrame(()=>{
    target.scrollIntoView({block:'center',behavior:reduceMotion?'auto':'smooth'});
    window.setTimeout(()=>{if(!target.isConnected){renderNextStepGuide();target=nextStepTarget??$('#next-step-guide');}target.focus({preventScroll:true});},reduceMotion?0:180);
  });
}
function render(){sheet=resolveSheet(character,state);document.documentElement.dataset.alteredCharacter=character.name;syncAuraState();renderCharacterStrip();renderTransformSelector();renderArt();renderMetrics();renderQuickReceivedEffects();renderResources();renderQuickFeatures();renderActiveEffects();renderTab();renderConditions();renderLog();renderNextStepGuide();persist();}

function openImportCenter(message?:string){
  renderInstalledPacks();void refreshPrivatePdfLibrary();
  if(message)setImportStatus(message);
  else if(pendingDdbImport){renderDdbReview(pendingDdbImport);setImportStatus(`Saved setup found for ${pendingDdbImport.character.name}. Resume it below or start a different import.`);}
  else setImportStatus('Import from a public D&D Beyond character link, or use a validated Altered JSON backup.');
  $<HTMLDialogElement>('#import-dialog').showModal();
}

function endCurrentForm(){
  if(!state.activeTransform&&state.overlays.length){const options=availableTransformations(character,state);const overlay=[...options].reverse().find(option=>option.profile==='overlay'&&option.deactivate);if(overlay){selectedOptionId=overlay.id;applyResult(startTransformation(character,state,overlay));return;}}
  const wasActive=Boolean(state.activeTransform);const recordsExternalEnd=state.activeTransform?.option.profile==='true-polymorph'&&state.activeTransform.permanentUntilDispelled;const result=endTransformation(state,!recordsExternalEnd,character);if(wasActive&&!state.activeTransform){selectedOptionId='base';radiantActions.clear();selectedOptionalBonuses.clear();selectedRollModes.clear();selectedMultiattackVariants.clear();}applyResult(result);
}
function initializeControls(){
  const damage=$<HTMLSelectElement>('#damage-type');for(const type of damageTypes){const option=document.createElement('option');option.value=type;option.textContent=type;damage.append(option);}damage.value='Slashing';
  const conditions=$<HTMLSelectElement>('#condition-select');for(const condition of commonConditions){const option=document.createElement('option');option.value=condition;option.textContent=condition;conditions.append(option);}
  syncReceivedEffectFields();
  syncBattlefieldFacts();
  $('#new-user-import-ddb').addEventListener('click',()=>{
    const source=$<HTMLInputElement>('#new-user-ddb-source').value.trim();
    if(!source){$('#new-user-character-status').textContent='Paste the public D&D Beyond character link or numeric ID first.';$<HTMLInputElement>('#new-user-ddb-source').focus();return;}
    $<HTMLInputElement>('#dndbeyond-source').value=source;
    $<HTMLDialogElement>('#new-user-character-dialog').close();
    openImportCenter('Checking the public D&D Beyond character. Altered will show a review before adding it.');
    void fetchDdbCharacter();
  });
  $('#new-user-ddb-source').addEventListener('keydown',event=>{if((event as KeyboardEvent).key==='Enter'){event.preventDefault();$<HTMLButtonElement>('#new-user-import-ddb').click();}});
  $('#new-user-other-import').addEventListener('click',()=>{$<HTMLDialogElement>('#new-user-character-dialog').close();openImportCenter('Choose a reviewed Altered JSON backup or a character PDF below. Nothing replaces the current demo until you confirm it.');});
  $('#new-user-use-demo').addEventListener('click',()=>{finishFirstCharacterSetup();$<HTMLDialogElement>('#new-user-character-dialog').close();setStatus(`${character.name} demo loaded. Add your own character anytime from the A menu → Import.`);persist();startWalkthrough();});
  $('#new-user-character-dialog').addEventListener('cancel',()=>{finishFirstCharacterSetup();setStatus(`${character.name} demo loaded. Add your own character anytime from the A menu → Import.`);persist();});
  $('#toggle-app-menu').addEventListener('click',()=>setAppMenuOpen($<HTMLButtonElement>('#toggle-app-menu').getAttribute('aria-expanded')!=='true'));
  $('#top-actions').addEventListener('click',event=>{if((event.target as Element).closest('button,a'))setAppMenuOpen(false);});
  document.addEventListener('pointerdown',event=>{const topbar=document.querySelector<HTMLElement>('.topbar');if(topbar?.classList.contains('menu-open')&&!topbar.contains(event.target as Node))setAppMenuOpen(false);});
  $('#nav-play').addEventListener('click',()=>setWorkspace('play',undefined,taskOrigin,$('#play-view-title')));
  $('#nav-forms').addEventListener('click',()=>setWorkspace('forms',undefined,taskOrigin,$('#forms-view-title')));
  $('#nav-sheet').addEventListener('click',()=>openTask('features','sheet'));
  $('#nav-more').addEventListener('click',()=>setWorkspace('more',undefined,taskOrigin,$('#more-view-title')));
  $('#open-persistent-form').addEventListener('click',()=>setWorkspace('forms',undefined,taskOrigin,$('#forms-view-title')));
  document.querySelectorAll<HTMLElement>('.workspace-home').forEach(control=>control.addEventListener('click',()=>setWorkspace('play',undefined,taskOrigin,$('#nav-play'))));
  $('#close-task-view').addEventListener('click',()=>setWorkspace('play',undefined,taskOrigin,$('#nav-play')));
  document.querySelectorAll<HTMLButtonElement>('[data-open-tab]').forEach(control=>control.addEventListener('click',()=>openTask(control.dataset.openTab??'actions','play')));
  $('#open-active-effects').addEventListener('click',()=>{openTask('features','play');$<HTMLDetailsElement>('#active-effects').open=true;});
  $('#open-latest-result').addEventListener('click',()=>openTask(latestRollTab,'play'));
  $('#open-damage-view').addEventListener('click',()=>openMoreDrawer('Damage'));
  $('#open-conditions-view').addEventListener('click',()=>openMoreDrawer('Effects & Conditions'));
  $('#play-end-form').addEventListener('click',endCurrentForm);
  $('#quick-guidance').addEventListener('click',quickGuidance);
  $('#quick-inspiration').addEventListener('click',quickInspiration);
  $('#quick-initiative').addEventListener('click',rollInitiative);
  $('#more-resume-setup').addEventListener('click',resumePrivateSetup);
  $('#more-delete-character').addEventListener('click',()=>{$('#delete-character-name').textContent=character.name;$('#delete-character-status').textContent=baseCharacters.length<=1?'Import or keep at least one other character before deleting this one.':'';$<HTMLDialogElement>('#delete-character-dialog').showModal();});
  $('#create-homebrew-ability').addEventListener('click',()=>openManualPrivateMechanic());
  $('#create-homebrew-transformation').addEventListener('click',()=>$<HTMLButtonElement>('#open-transform-builder').click());
  $('#manage-private-content').addEventListener('click',()=>{$<HTMLButtonElement>('#open-import-center').click();window.setTimeout(()=>$('#installed-pack-list').scrollIntoView({block:'nearest'}),0);});
  const compactFormQuery=window.matchMedia('(max-width:700px)');syncCharacterFormDrawer();compactFormQuery.addEventListener('change',syncCharacterFormDrawer);window.addEventListener('resize',()=>{if(innerWidth>700)setAppMenuOpen(false);syncCharacterFormDrawer();});
  $('#sample-character').addEventListener('change',event=>{const id=(event.target as HTMLSelectElement).value;const found=characters.find(c=>c.id===id);if(found){setCharacter(found);void refreshLinkedCharacter(false,true);}});
  $('#form-select').addEventListener('change',event=>{selectedOptionId=(event.target as HTMLSelectElement).value;renderTransformSelector();renderArt();renderNextStepGuide();});
  $('#form-search').addEventListener('input',event=>{formSearch=(event.target as HTMLInputElement).value;renderTransformSelector();renderArt();renderNextStepGuide();});
  $('#form-filter').addEventListener('change',event=>{formFilter=(event.target as HTMLSelectElement).value;renderTransformSelector();renderArt();renderNextStepGuide();});
  $('#transform-button').addEventListener('click',()=>{const option=currentOption();if(option)applyResult(startTransformation(character,state,option));});
  $('#end-form-button').addEventListener('click',endCurrentForm);
  const tabs=Array.from(document.querySelectorAll<HTMLButtonElement>('.tab'));
  tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>activateTab(tab));tab.addEventListener('keydown',(event:KeyboardEvent)=>{let next:number|undefined;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;if(next===undefined)return;event.preventDefault();const target=tabs[next];if(target)activateTab(target,true);});});
  $('#apply-damage').addEventListener('click',()=>{const amount=Number($<HTMLInputElement>('#damage-amount').value);const type=$<HTMLSelectElement>('#damage-type').value as DamageType;applyResult(applyDamage(state,resolveSheet(character,state),amount,type,character));});
  $('#apply-healing').addEventListener('click',()=>applyResult(heal(state,character,Number($<HTMLInputElement>('#damage-amount').value))));
  const clearPendingDamage=()=>{if(pendingDamageRolls.size){addActivity(`${pendingDamageRolls.size} unresolved damage roll${pendingDamageRolls.size===1?' was':'s were'} cleared at the turn boundary.`);pendingDamageRolls.clear();}},newTurn=()=>{captureTurnUndo();clearPendingDamage();applyResult(startNewTurn(state));},finishTurn=()=>{captureTurnUndo();clearPendingDamage();applyResult(endTurn(character,state));};$('#new-turn').addEventListener('click',newTurn);$('#persistent-new-turn').addEventListener('click',newTurn);$('#end-turn').addEventListener('click',finishTurn);$('#persistent-end-turn').addEventListener('click',finishTurn);$('#persistent-undo-turn').addEventListener('click',undoTurnChange);$('#short-rest').addEventListener('click',()=>applyResult(shortRest(state)));$('#long-rest').addEventListener('click',()=>applyResult(longRest(character,state)));
  $('#add-condition').addEventListener('click',()=>applyResult(applyCondition(character,state,$<HTMLSelectElement>('#condition-select').value)));$('#clear-conditions').addEventListener('click',()=>applyResult(clearConditions(state)));
  $('#received-effect-kind').addEventListener('change',syncReceivedEffectFields);$('#add-received-effect-button').addEventListener('click',createReceivedEffect);
  for(const [fact,selector] of [['ally-near-target','#fact-ally-near-target'],['attacker-unseen','#fact-attacker-unseen'],['target-unseen','#fact-target-unseen']] as const)$<HTMLInputElement>(selector).addEventListener('change',event=>{const checked=(event.target as HTMLInputElement).checked;checked?nextAttackFacts.add(fact):nextAttackFacts.delete(fact);syncBattlefieldFacts();});
  $('#clear-activity').addEventListener('click',()=>{state.log=[];$('#status-message').textContent='Recent activity cleared.';$('#play-status').textContent='Recent activity cleared.';renderLog();persist();});
  $('#open-help').addEventListener('click',()=>{filterHelpTopics();const dialog=$<HTMLDialogElement>('#help-dialog');dialog.showModal();$<HTMLInputElement>('#help-search').focus();});
  $('#close-help').addEventListener('click',()=>$<HTMLDialogElement>('#help-dialog').close());
  $('#help-search').addEventListener('input',filterHelpTopics);
  $('#start-walkthrough').addEventListener('click',startWalkthrough);
  $('#skip-walkthrough').addEventListener('click',()=>finishWalkthrough('Walkthrough skipped. Restart it anytime from Help.'));
  $('#walkthrough-back').addEventListener('click',()=>{walkthroughStepIndex--;renderWalkthroughStep();});
  $('#walkthrough-next').addEventListener('click',()=>{const available=availableWalkthroughSteps();if(walkthroughStepIndex>=available.length-1)finishWalkthrough('Walkthrough complete. Help remains available from the top bar.');else{walkthroughStepIndex++;renderWalkthroughStep();}});
  window.addEventListener('keydown',event=>{if(event.key!=='Escape'||document.querySelector('dialog[open]'))return;if(!$('#walkthrough').hidden)finishWalkthrough('Walkthrough closed. Restart it anytime from Help.');else if($<HTMLButtonElement>('#toggle-app-menu').getAttribute('aria-expanded')==='true')setAppMenuOpen(false,true);else if(currentWorkspace!=='play')setWorkspace('play',undefined,taskOrigin,$('#nav-play'));});
  $('#import-file').addEventListener('change',async event=>{const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{renderJsonReview(parseCharacter(safeJsonParse(await file.text())));setImportStatus('JSON validated. Review the summary and warnings, then confirm the import.');}catch(error){const message=`Import failed: ${error instanceof Error?error.message:'Unknown error'}`;notify(message);setImportStatus(message);}finally{input.value='';}});
  $('#confirm-json-import').addEventListener('click',()=>{if(!pendingJsonImport)return;applyImportedCharacter(pendingJsonImport);pendingJsonImport=null;$('#json-import-review').hidden=true;});
  $('#cancel-json-import').addEventListener('click',()=>{pendingJsonImport=null;$('#json-import-review').hidden=true;setImportStatus('JSON import canceled; the current character was not changed.');});
  $('#pdf-character-file').addEventListener('change',async event=>{const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{await preparePdfImport(file);}catch(error){const message=`PDF import failed: ${error instanceof Error?error.message:'Unknown error'}`;setImportStatus(message);$('#pdf-import-progress').textContent=message;}finally{input.value='';}});
  $('#run-pdf-ocr').addEventListener('click',()=>void runPdfOcr().catch(error=>{$('#pdf-import-progress').textContent=`OCR failed: ${error instanceof Error?error.message:'Unknown error'}`;}));
  $('#confirm-pdf-import').addEventListener('click',()=>{try{confirmPdfImport();}catch(error){const message=`Review needed: ${error instanceof Error?error.message:'Unknown error'}`;setImportStatus(message);$('#pdf-import-progress').textContent=message;}});
  $('#cancel-pdf-import').addEventListener('click',()=>{pendingPdfFile=null;pendingPdfDraft=null;$('#pdf-import-review').hidden=true;$('#pdf-import-progress').textContent='PDF import canceled; the current character was not changed.';});
  $('#fetch-dndbeyond').addEventListener('click',()=>void fetchDdbCharacter());
  $('#dndbeyond-source').addEventListener('keydown',event=>{if((event as KeyboardEvent).key==='Enter'){event.preventDefault();void fetchDdbCharacter();}});
  $('#open-private-mechanics').addEventListener('click',()=>openPrivateMechanics());
  $('#close-private-mechanics').addEventListener('click',()=>$<HTMLDialogElement>('#private-mechanics-dialog').close());
  $('#close-private-pdf-review').addEventListener('click',()=>$<HTMLDialogElement>('#private-pdf-review-dialog').close());
  $('#cancel-private-pdf-review').addEventListener('click',()=>$<HTMLDialogElement>('#private-pdf-review-dialog').close());
  $('#apply-private-pdf-matches').addEventListener('click',()=>void applyPrivatePdfMatches());
  const closePrivatePdfResult=()=>{pendingPrivatePdfResultRecord=null;$<HTMLDialogElement>('#private-pdf-result-dialog').close();};
  $('#close-private-pdf-result').addEventListener('click',closePrivatePdfResult);
  $('#done-private-pdf-result').addEventListener('click',closePrivatePdfResult);
  $('#scan-private-pdf-result').addEventListener('click',()=>{const record=pendingPrivatePdfResultRecord;closePrivatePdfResult();if(record)void readPrivatePdfForCharacter(record);});
  $('#private-pdf-manual-setup').addEventListener('click',()=>{const review=pendingPrivatePdfReview;if(!review)return;$<HTMLDialogElement>('#private-pdf-review-dialog').close();openManualPrivateMechanic(`Private PDF: ${review.record.name}`);});
  $('#copy-chatgpt-request').addEventListener('click',()=>void copyChatGptRequest());
  $('#private-pdf-chatgpt-help').addEventListener('click',()=>{const review=pendingPrivatePdfReview;if(!review)return;void copyChatGptRequest(`Private PDF: ${review.record.name}`);});
  $('#assistant-proposal-file').addEventListener('change',event=>{const input=event.target as HTMLInputElement;const file=input.files?.[0];if(file)void reviewAssistantProposal(file).finally(()=>{input.value='';});});
  $('#private-mechanic-need').addEventListener('change',syncPrivateMechanicFields);
  $('#private-mechanic-mode').addEventListener('change',syncPrivateMechanicMode);
  $('#private-mechanics-form').addEventListener('submit',event=>{event.preventDefault();void (async()=>{try{await savePrivateMechanic();}catch(error){$('#private-mechanics-status').textContent=`Could not save mechanic: ${error instanceof Error?error.message:'Unknown error'}`;}})();});
  $('#private-mechanic-transformation').addEventListener('click',()=>{if(manualPrivateMechanic){const label=$<HTMLInputElement>('#private-mechanic-name').value.trim();$<HTMLDialogElement>('#private-mechanics-dialog').close();populateBuilderClassOptions();$<HTMLInputElement>('#builder-pack-name').value=`${character.name} Private Mechanics`;$<HTMLInputElement>('#builder-source').value=manualPrivateSource;$<HTMLInputElement>('#builder-label').value=label;$<HTMLSelectElement>('#builder-match').value='character';syncBuilderGuidance();setBuilderStatus('Add only mechanics confirmed by your private source. The source PDF remains separate from the executable pack.');$<HTMLDialogElement>('#transform-builder-dialog').showModal();return;}if(!pendingDdbImport)return;if(pendingDdbImport.blocked){$('#private-mechanics-status').textContent=pendingDdbImport.blockReason??'This character cannot be imported under the 2024-only policy.';return;}const need=pendingDdbImport.setupNeeds.find(entry=>entry.id===$<HTMLSelectElement>('#private-mechanic-need').value);if(character.id!==pendingDdbImport.character.id)applyImportedCharacter(pendingDdbImport.character);$<HTMLDialogElement>('#private-mechanics-dialog').close();populateBuilderClassOptions();$<HTMLInputElement>('#builder-pack-name').value=`${character.name} Private Mechanics`;$<HTMLInputElement>('#builder-source').value=`D&D Beyond character ${pendingDdbImport.sourceId} — user-confirmed`;$<HTMLInputElement>('#builder-label').value=need?.label??'';$<HTMLSelectElement>('#builder-match').value='character';syncBuilderGuidance();setBuilderStatus('The reviewed character is loaded. Add only the activation, duration, and effects you confirmed in your authorized source.');$<HTMLDialogElement>('#transform-builder-dialog').showModal();});
  $('#confirm-dndbeyond-import').addEventListener('click',()=>{if(!pendingDdbImport){setImportStatus('Fetch and review a D&D Beyond character first.');return;}if(pendingDdbImport.blocked){setImportStatus(pendingDdbImport.blockReason??'This character is blocked by the 2024-only rules policy.');return;}const imported=applyImportedCharacter(pendingDdbImport.character);confirmedDdbSourceId=pendingDdbImport.sourceId;renderDdbReview(pendingDdbImport);setImportStatus(`${imported.name} imported after review. You can complete any remaining private mechanics here, then close this window.`);});
  $('#download-dndbeyond-json').addEventListener('click',()=>{if(!pendingDdbImport){setImportStatus('Fetch and review a D&D Beyond character first.');return;}downloadJson(pendingDdbImport.character,`${slug(pendingDdbImport.character.name)}-altered.json`);});
  $('#export-character').addEventListener('click',()=>downloadJson(character,`${character.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'altered-character'}.json`));
  $('#open-import-center').addEventListener('click',()=>openImportCenter());
  $('#close-import-center').addEventListener('click',()=>$<HTMLDialogElement>('#import-dialog').close());
  $('#resume-private-setup').addEventListener('click',resumePrivateSetup);
  $('#start-new-import').addEventListener('click',()=>{void clearPendingDdbImport();$<HTMLInputElement>('#dndbeyond-source').value='';setImportStatus('Ready for a different public D&D Beyond character link or ID.');$<HTMLInputElement>('#dndbeyond-source').focus();});
  const closeDelete=()=>$<HTMLDialogElement>('#delete-character-dialog').close();$('#close-delete-character').addEventListener('click',closeDelete);$('#cancel-delete-character').addEventListener('click',closeDelete);$('#confirm-delete-character').addEventListener('click',deleteCurrentCharacter);
  $('#owned-pack-file').addEventListener('change',async event=>{const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){setImportStatus('That is a PDF. Use “Upload Owned PDF” below; Altered will store it privately and cross-reference it with the selected character.');$<HTMLInputElement>('#private-pdf-file').focus();return;}const pack=safeOwnedContentParse(await file.text());const result=await installAndApplyPack(pack);setImportStatus(result.applied?`${pack.metadata.name} installed and applied to ${character.name}. ${packCounts(pack)}.`:`${pack.metadata.name} installed. It does not match ${character.name}, so the current sheet was not changed.`);renderSettings();}catch(error){setImportStatus(`JSON rules-pack installation failed: ${error instanceof Error?error.message:'Unknown error'}`);}finally{input.value='';}});
  $('#private-pdf-file').addEventListener('change',async event=>{const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{const record=await uploadPrivatePdf(file);await refreshPrivatePdfLibrary();$<HTMLDialogElement>('#import-dialog').close();showPrivatePdfResult('PDF saved — scan next',`${record.name} is safely stored in your Altered account. No character rules were added yet.`,[`Saved ${formatFileSize(record.size)} for this login across devices.`,`Next: scan it against ${character.name}, review any exact matches, then choose what to add.`],record);}catch(error){privatePdfStatus(`Upload failed: ${error instanceof Error?error.message:'Unknown error'}`);}finally{input.value='';}});
  $('#download-pack-template').addEventListener('click',()=>downloadJson(ownedContentTemplate(character),`${slug(character.name)}-private-content-template.json`));
  $('#open-transform-builder').addEventListener('click',()=>{populateBuilderClassOptions();syncBuilderGuidance();setBuilderStatus('Start with Quick setup, then keep only mechanics confirmed by your source. Advanced fields are optional.');$<HTMLDialogElement>('#transform-builder-dialog').showModal();});
  $('#close-transform-builder').addEventListener('click',()=>$<HTMLDialogElement>('#transform-builder-dialog').close());
  $('#cancel-transform-builder').addEventListener('click',()=>$<HTMLDialogElement>('#transform-builder-dialog').close());
  $('#apply-builder-template').addEventListener('click',applyBuilderTemplate);
  $('#transform-builder-form').addEventListener('input',syncBuilderGuidance);
  $('#transform-builder-form').addEventListener('submit',event=>{event.preventDefault();void (async()=>{try{const pack=createPackFromBuilder();const result=await installAndApplyPack(pack);setBuilderStatus(`${pack.metadata.name} created and installed. ${result.applied?'The transformation is now available on this character.':'The pack was saved but did not match the current character.'}`);setImportStatus(`${pack.metadata.name} installed from the private transformation builder.`);renderSettings();}catch(error){setBuilderStatus(`Could not create transformation: ${error instanceof Error?error.message:'Unknown error'}`);}})();});
  $('#keep-current-thp').addEventListener('click',()=>{if(pendingTempChoice)resolveTempHpChoice(state,'current',pendingTempChoice.incoming,pendingTempChoice.source);pendingTempChoice=null;$<HTMLDialogElement>('#temp-hp-dialog').close();notify('Kept current Temporary Hit Points.');render();});
  $('#keep-new-thp').addEventListener('click',()=>{if(pendingTempChoice)resolveTempHpChoice(state,'incoming',pendingTempChoice.incoming,pendingTempChoice.source);pendingTempChoice=null;$<HTMLDialogElement>('#temp-hp-dialog').close();notify('Replaced Temporary Hit Points with the new source.');render();});
  const bindArtworkInput=(selector:string,target:()=>({targetId:string;label:string}|null))=>$(selector).addEventListener('change',async event=>{const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;const chosen=target();try{if(!chosen)throw new Error('Choose or activate a form before uploading separate form artwork.');await saveArtwork(file,chosen);}catch(error){notify(`Artwork could not be saved: ${error instanceof Error?error.message:'Unknown error'}`);}finally{input.value='';}});
  bindArtworkInput('#art-file',()=>artTargetInfo());bindArtworkInput('#character-art-file',()=>({targetId:'base',label:character.name}));bindArtworkInput('#current-form-art-file',()=>currentFormArtTarget());
  $('#reset-art').addEventListener('click',()=>void resetArtwork(artTargetInfo()));$('#more-reset-art').addEventListener('click',()=>void resetArtwork(artTargetInfo()));
  $('#open-settings').addEventListener('click',()=>{renderSettings();$<HTMLDialogElement>('#settings-dialog').showModal();});
  $('#refresh-character').addEventListener('click',()=>void refreshLinkedCharacter(true,true));
  $('#settings-refresh-character').addEventListener('click',()=>void refreshLinkedCharacter(true,true));
  $('#close-settings').addEventListener('click',()=>$<HTMLDialogElement>('#settings-dialog').close());
  $('#refresh-srd-catalog').addEventListener('click',()=>void refreshSrdCatalogStatus());
  $('#show-next-step').addEventListener('click',revealNextStep);
  $('#magic-effects-enabled').addEventListener('change',event=>{magicEffectsEnabled=(event.target as HTMLInputElement).checked;void saveBooleanSetting('magic-effects-enabled',magicEffectsEnabled);syncAuraState();});
  $('#reduce-motion').addEventListener('change',event=>{reduceMotion=(event.target as HTMLInputElement).checked;void saveBooleanSetting('reduce-motion',reduceMotion);syncAuraState();});
  $('#guided-next-step').addEventListener('change',event=>{guidedNextStep=(event.target as HTMLInputElement).checked;void saveBooleanSetting('guided-next-step-v1',guidedNextStep);renderNextStepGuide();});
  $('#auto-refresh-character').addEventListener('change',event=>{autoRefreshCharacter=(event.target as HTMLInputElement).checked;void saveBooleanSetting(AUTO_REFRESH_CHARACTER_SETTING,autoRefreshCharacter);setCharacterRefreshStatus(autoRefreshCharacter?'Automatic character refresh is on. Checking the selected linked character now…':'Automatic character refresh is off. Altered will keep the saved character version until you refresh manually.');if(autoRefreshCharacter)void refreshLinkedCharacter(false,true);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshLinkedCharacter(false,false);});
  window.addEventListener('online',()=>void refreshLinkedCharacter(false,true));
  window.addEventListener('beforeunload',persist);
  if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
    const hadController=Boolean(navigator.serviceWorker.controller);
    const updateReloadKey=`altered-update-reload-${APP_VERSION}`;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(!hadController||sessionStorage.getItem(updateReloadKey)==='1')return;
      sessionStorage.setItem(updateReloadKey,'1');location.reload();
    });
    navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{});
  }
}

async function boot(){
  let setupState:string|null=null;try{setupState=localStorage.getItem(FIRST_CHARACTER_SETUP_KEY);}catch{/* storage is optional */}
  const restored=restore();
  if(!restored){firstRunCharacterSetup=true;try{localStorage.setItem(FIRST_CHARACTER_SETUP_KEY,'pending');}catch{/* storage is optional */}}
  else if(setupState==='pending')firstRunCharacterSetup=true;
  else{firstRunCharacterSetup=false;if(!setupState)try{localStorage.setItem(FIRST_CHARACTER_SETUP_KEY,'complete');}catch{/* storage is optional */}}
  // Paint a complete built-in sheet before waiting on IndexedDB. Some mobile
  // browsers can delay storage initialization after an authenticated redirect;
  // the core app must remain usable while private packs and settings hydrate.
  initializeControls();filterHelpTopics();renderSettings();renderInstalledPacks();
  setStatus(`Altered loaded for ${character.name}. Built-in rules and forms are ready.`);render();
  document.documentElement.dataset.alteredReady='true';
  if(firstRunCharacterSetup){
    const dialog=$<HTMLDialogElement>('#new-user-character-dialog');dialog.showModal();
    window.requestAnimationFrame(()=>$<HTMLInputElement>('#new-user-ddb-source').focus());
  }
  void loadHostedAccount();
  installedPacks=await loadValidatedInstalledPacks();
  const savedPending=savedDdbReport(await loadJsonSetting<unknown>(PENDING_DDB_SETTING));if(savedPending){pendingDdbImport=savedPending;renderDdbReview(savedPending);}else renderPendingSetupAccess();
  rebuildEffectiveCharacterLibrary(true);
  if(pendingActiveSnapshot?.option?.id){const option=availableTransformations(character,state).find(candidate=>candidate.id===pendingActiveSnapshot?.option?.id);if(option)state.activeTransform={option,startedTurn:boundedWhole(pendingActiveSnapshot.startedTurn,state.turn.number,1,1_000_000),duration:safeSavedText(pendingActiveSnapshot.duration,'',200),tempHpSource:Boolean(pendingActiveSnapshot.tempHpSource),...(pendingActiveSnapshot.spellConcentration?{spellConcentration:true}:{}),...(pendingActiveSnapshot.permanentUntilDispelled?{permanentUntilDispelled:true}:{})};}
  magicEffectsEnabled=await loadBooleanSetting('magic-effects-enabled',true);
  reduceMotion=await loadBooleanSetting('reduce-motion',reduceMotion);
  guidedNextStep=await loadBooleanSetting('guided-next-step-v1',true);
  autoRefreshCharacter=await loadBooleanSetting(AUTO_REFRESH_CHARACTER_SETTING,true);
  const walkthroughCompleted=await loadBooleanSetting(WALKTHROUGH_SETTING,false);
  renderSettings();renderInstalledPacks();
  const repairNote=invalidPackCount?` ${invalidPackCount} damaged private pack${invalidPackCount===1?' was':'s were'} removed safely.`:'';const migrationNote=restoredDataRepairs.length?` ${restoredDataRepairs.join(' ')}`:'';
  setStatus(`Altered loaded for ${character.name}. ${installedPacks.length} private content pack${installedPacks.length===1?'':'s'} available.${repairNote}${migrationNote}`);render();
  if(!firstRunCharacterSetup&&!walkthroughCompleted)startWalkthrough();
  void refreshSrdCatalogStatus();
  void refreshLinkedCharacter(false,true);
}
void boot().catch(error=>{console.error(error);document.documentElement.dataset.alteredReady='error';const status=document.querySelector<HTMLElement>('#status-message');if(status)status.textContent=`Altered could not start: ${error instanceof Error?error.message:'Unknown error'}`;});
