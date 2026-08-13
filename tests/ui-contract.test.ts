import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('static shell exposes accessible tabs, dialogs, and condition input',()=>{
  const html=readFileSync('public/index.html','utf8');
  assert.match(html,/role="tablist"/);
  assert.equal((html.match(/role="tab"/g)??[]).length,6);
  assert.match(html,/id="tab-content"[^>]*role="tabpanel"[^>]*aria-labelledby="tab-actions"/);
  assert.match(html,/for="condition-select">Condition<\/label>/);
  for(const id of ['help-dialog','import-dialog','private-mechanics-dialog','transform-builder-dialog','settings-dialog','temp-hp-dialog','delete-character-dialog']){
    assert.match(html,new RegExp(`<dialog id="${id}"[^>]*aria-labelledby="${id.replace(/-dialog$/,'')}(?:-dialog)?-title"`));
  }
});

test('paid mechanics use a compact private completion flow without credentials or copied rules text',()=>{
  const html=readFileSync('public/index.html','utf8');const source=readFileSync('src/app.ts','utf8');const importer=readFileSync('src/dndbeyond.ts','utf8');const owned=readFileSync('src/owned-content.ts','utf8');
  assert.match(html,/id="dndbeyond-private-setup"/);assert.match(html,/id="private-mechanics-dialog"/);assert.match(html,/Short mechanical reminder/);assert.match(html,/never requests your D&amp;D Beyond password or cookies/i);
  assert.match(source,/ddbSetupPackId\(report\.sourceId,need\.id\)/);assert.match(source,/privateMechanicPack\(/);assert.match(source,/reapplied automatically whenever this character is imported/);
  assert.match(html,/id="resume-private-setup"/);assert.match(html,/id="more-resume-setup"/);assert.match(source,/PENDING_DDB_SETTING='pending-ddb-import-v1'/);assert.match(source,/saveJsonSetting\(PENDING_DDB_SETTING,report\)/);assert.match(source,/loadJsonSetting<unknown>\(PENDING_DDB_SETTING\)/);
  assert.match(importer,/setupNeeds:DdbSetupNeed\[\]/);assert.match(importer,/SUBCLASS_FEATURES/);assert.match(owned,/schemaVersion:1,kind:'altered-owned-content-pack'/);
});

test('every static button is connected to an application control path',()=>{
  const html=readFileSync('public/index.html','utf8');
  const source=readFileSync('src/app.ts','utf8');
  const ids=Array.from(html.matchAll(/<button\b[^>]*\bid="([^"]+)"/g),match=>match[1]).filter((id):id is string=>Boolean(id));
  assert.ok(ids.length>30);
  for(const id of ids){
    const taskLauncher=html.match(new RegExp(`id="${id}"[^>]*data-open-tab=`));
    const connected=id.startsWith('tab-')?source.includes("document.querySelectorAll<HTMLButtonElement>('.tab')"):taskLauncher?source.includes("document.querySelectorAll<HTMLButtonElement>('[data-open-tab]')"):source.includes(`#${id}`);
    assert.ok(connected,`${id} has no application control path`);
  }
});

test('conditional automatic actions require visible confirmation or an explicit structured choice',()=>{const source=readFileSync('src/app.ts','utf8');assert.match(source,/Confirm prerequisite:/);assert.match(source,/Confirm \$\{choice\.label\}/);assert.match(source,/Use \$\{action\.name\}: \$\{choice\.label\}/);assert.match(source,/Confirm the visible prerequisite before using this option/);});

test('help and first-launch walkthrough remain optional, searchable, and restartable',()=>{
  const html=readFileSync('public/index.html','utf8');
  const source=readFileSync('src/app.ts','utf8');
  const styles=readFileSync('public/styles.css','utf8');
  assert.match(html,/id="open-help"[^>]*>Help<\/button>/);
  assert.match(html,/id="toggle-app-menu"[^>]*aria-label="Open Altered menu"/);assert.equal(/id="more-help"/.test(html),false);
  assert.match(html,/id="help-search"[^>]*type="search"/);
  assert.ok((html.match(/class="help-topic"/g)??[]).length>=15);
  for(const topic of ['What Altered is','What the app is for','Supported transformation types','Getting Started','Loading characters','Importing characters','Browsing forms, search, and filters','Activating forms','Ending forms and returning to normal','Tracking resources and turns','Images','Settings','Troubleshooting','FAQ','About'])assert.ok(html.includes(topic));
  assert.match(html,/id="walkthrough"[^>]*role="dialog"[^>]*aria-modal="false"/);
  assert.match(html,/id="start-walkthrough"/);
  assert.match(html,/id="skip-walkthrough"/);
  assert.match(source,/WALKTHROUGH_SETTING='walkthrough-completed-v1'/);
  assert.match(source,/availableWalkthroughSteps\(\)/);
  assert.match(source,/if\(!walkthroughCompleted\)startWalkthrough\(\)/);
  assert.match(source,/saveBooleanSetting\(WALKTHROUGH_SETTING,true\)/);
  assert.match(source,/selector:'\.persistent-form-visual'/);assert.match(source,/Play, Forms, Character, and Manage/);assert.match(source,/selector:'#toggle-app-menu'/);
  assert.match(source,/setTimeout\(\(\)=>focusTarget\.focus\(\{preventScroll:true\}\),0\)/);
  assert.match(styles,/\.walkthrough-target\{/);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
});

test('form browsing and visual statuses explain availability without changing form data',()=>{
  const html=readFileSync('public/index.html','utf8');
  const source=readFileSync('src/app.ts','utf8');
  const styles=readFileSync('public/styles.css','utf8');
  assert.match(html,/id="form-search"[^>]*type="search"/);
  assert.match(html,/id="form-filter"/);
  assert.match(html,/id="form-status-strip"[^>]*aria-label="Selected form status"/);
  assert.match(source,/const options=availableTransformations\(character,state\)/);
  assert.match(source,/selected form retained/);
  assert.match(source,/o\.id===activeId\?' · Active'/);
  assert.match(source,/statusChip\('selected'\)/);
  assert.match(source,/image\.loading='lazy'/);
  assert.match(source,/const displayedForm=activeForm\?\?previewForm/);
  assert.match(source,/previewing\?'FORM PREVIEW':'BASE FORM'/);
  assert.ok(!source.includes("chip.className='form-preview'"),'selected creature art must use the full portrait frame on narrow layouts');
  for(const state of ['available','active','inactive','locked','unavailable','requirements','selected','favorite','new','importing','loading','success','warning','error'])assert.match(source,new RegExp(`${state}:\\{icon:`));
  assert.match(styles,/\.ui-status\.available/);
  assert.match(styles,/\.ui-status\.locked/);
  assert.match(styles,/\.main-form-art img\{/);
  assert.match(styles,/\.form-art\.is-preview/);
  assert.match(styles,/single global A menu/);assert.match(styles,/\.topbar\.menu-open \.top-actions\{display:grid\}/);
  assert.match(styles,/\.help-topic summary:focus-visible/);
});

test('phone gameplay uses focused views while keeping the form artwork persistent',()=>{
  const html=readFileSync('public/index.html','utf8');const source=readFileSync('src/app.ts','utf8');const styles=readFileSync('public/styles.css','utf8');
  for(const view of ['play','forms','task','more'])assert.match(html,new RegExp(`data-workspace-view="${view}"`));
  for(const id of ['nav-play','nav-forms','nav-sheet','nav-more'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/class="persistent-form-visual"[\s\S]*id="form-art"[\s\S]*id="persistent-form-name"/);
  assert.equal((html.match(/id="form-art"/g)??[]).length,1,'persistent artwork must render once and stay mounted');
  assert.match(source,/type WorkspaceView='play'\|'forms'\|'task'\|'more'/);assert.match(source,/function setWorkspace\(/);assert.match(source,/renderArt\(\)/);
  assert.match(styles,/one task, one scroll region, persistent form art/);assert.match(styles,/\.workspace-view\{[^}]*overflow:auto/);assert.match(styles,/\.persistent-form-visual \.form-art/);
  assert.match(html,/id="persistent-form-state"/);assert.match(source,/container\.setAttribute\('aria-label',`\$\{stateLabel\}: \$\{displayLabel\}`\)/);
  assert.equal(/container\.append\(text\('div',stateLabel,`form-state/.test(source),false);assert.equal(/container\.append\(text\('div',[\s\S]*'art-label'\)\)/.test(source),false);
  assert.match(styles,/\.persistent-form-visual \.form-state,\.persistent-form-visual \.art-label\{display:none!important\}/);
  assert.match(styles,/@media\(max-width:700px\)\{[\s\S]*grid-template-rows:160px minmax\(0,1fr\)/);
  assert.match(styles,/use the character header instead of truncating multiclass builds/);assert.match(styles,/-webkit-line-clamp:3/);assert.match(styles,/overflow-wrap:anywhere/);
  assert.match(styles,/\.task-launcher span\{[\s\S]*?-webkit-line-clamp:2/);assert.match(styles,/\.next-step-guide p\{[\s\S]*?-webkit-line-clamp:2/);
  assert.match(styles,/\.task-view \.tab-help\{overflow:visible;text-overflow:clip;white-space:normal\}/);assert.match(styles,/grid-template-rows:176px minmax\(0,1fr\)/);
});

test('arcane glow palette keeps secondary and disabled states luminous and legible',()=>{
  const styles=readFileSync('public/styles.css','utf8');
  assert.match(styles,/arcane glow: luminous text contrast and magical state accents/);
  assert.match(styles,/--muted:#e4e9ff/);assert.match(styles,/--accent:#b478ff/);assert.match(styles,/--accent-2:#79f7ff/);
  assert.match(styles,/\.button:disabled\{opacity:\.82;color:#e0e4f7/);
  assert.match(styles,/\.economy-chip\.used\{opacity:\.9;color:#d8def2/);
  assert.match(styles,/text-shadow:0 0 5px rgba\(121,247,255,\.52\)/);
  assert.match(styles,/\.workspace-nav-button\.active\{[\s\S]*background:linear-gradient\(180deg,#3a2358,#171421\)/);
});

test('frequent core abilities expose rule-driven ready, blocked, and active states',()=>{
  const source=readFileSync('src/app.ts','utf8');const styles=readFileSync('public/styles.css','utf8');
  assert.match(source,/type PriorityAbilityState=\{state:'ready'\|'blocked'\|'active';reason:string\}/);
  assert.match(source,/feature\.id==='rage'[\s\S]*rageStartError\(character,state\)/);
  assert.match(source,/feature\.id==='wild-shape'[\s\S]*availableTransformations\(character,state\)/);
  assert.match(source,/title:'Core abilities'/);assert.match(source,/green is ready, red explains what blocks it/);
  assert.match(styles,/\.priority-ability\.priority-ready/);assert.match(styles,/\.priority-ability\.priority-blocked/);assert.match(styles,/\.priority-ability\.priority-active/);
  assert.match(styles,/\.priority-ability-control\.blocked,\.priority-ability-control\.blocked:disabled\{opacity:1/);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)\{\.priority-ability-control\.ready\{animation:none\}\}/);
});

test('the six current forms ship with app-ready artwork in both builds',()=>{
  const source=readFileSync('src/app.ts','utf8');
  const serviceWorker=readFileSync('public/sw.js','utf8');
  const standalone=readFileSync('dist/altered-standalone.html','utf8');
  const hostedWorker=readFileSync('dist/server/index.js','utf8');
  for(const [form,file] of [['brown-bear','form-brown-bear.jpg'],['dire-wolf','form-dire-wolf.jpg'],['giant-octopus','form-giant-octopus.jpg'],['giant-spider','form-giant-spider.jpg'],['lion','form-lion.jpg'],['tiger','form-tiger.jpg']]){
    assert.match(source,new RegExp(`'form:${form}':'${file}'`));
    assert.ok(serviceWorker.includes(`'./${file}'`));
    assert.ok(readFileSync(`dist/${file}`,'utf8').length>100_000);
    assert.ok(!standalone.includes(`'${file}'`));
    assert.ok(hostedWorker.includes(`/${file}`));
  }
  assert.match(source,/alt=`Built-in artwork for \$\{label\}`/);
  assert.match(standalone,/data:image\/jpeg;base64,/);
  assert.equal((standalone.match(/<\/script>/gi)??[]).length,1,'standalone must contain exactly one executable script block');
  assert.ok(!standalone.includes('<script src="app.bundle.js"></script>'),'standalone bundle must not be re-injected by replacement tokens');
  const ferocitusStandalone=readFileSync('dist/altered-ferocitus.html','utf8');
  assert.match(ferocitusStandalone,/name:\s*'Ferocitus'/);
  assert.match(ferocitusStandalone,/data:image\/jpeg;base64,/);
});

test('the exact hosted build executes before optional mobile storage hydration',()=>{
  const source=readFileSync('src/app.ts','utf8');
  const build=readFileSync('scripts/build.mjs','utf8');
  const worker=readFileSync('scripts/hosted-worker.template.js','utf8');
  const pkg=JSON.parse(readFileSync('package.json','utf8')) as {scripts?:Record<string,string>};
  assert.match(source,/Built-in rules and forms are ready\.`\);render\(\);\s*document\.documentElement\.dataset\.alteredReady='true';\s*void loadHostedAccount\(\);\s*installedPacks=await/);
  assert.match(build,/replace\('<script src="app\.bundle\.js"><\/script>',\(\)=>/);
  assert.equal(pkg.scripts?.['browser:audit'],'node scripts/browser-audit.mjs');
  assert.ok(worker.includes(String.raw`\/api\/dndbeyond\/character`));
  assert.ok(worker.includes("url.pathname==='/api/srd/status'"));
  assert.ok(worker.includes("url.pathname==='/api/srd/catalog'"));
  assert.match(worker,/character-service\.dndbeyond\.com/);
  assert.match(worker,/api\.open5e\.com/);
  assert.match(source,/credentials:'same-origin'/);
  assert.ok((source.match(/'X-Altered-Request':'app'/g)??[]).length>=5);
  assert.match(worker,/fetch\(String\(url\)/);
  assert.match(worker,/redirect:'manual'/);
  assert.match(worker,/guardApiRequest\(request,'ddb',12\)/);
  assert.match(worker,/guardApiRequest\(request,'srd-status',30\)/);
  assert.match(worker,/guardApiRequest\(request,'srd-catalog',90\)/);
  assert.match(worker,/guardApiRequest\(request,'auth-me',120\)/);
  assert.match(worker,/oai-authenticated-user-id/);
  assert.match(worker,/\/signin-with-chatgpt\?return_to=%2F/);
  assert.match(worker,/private, no-store/);
  assert.match(worker,/url\.pathname in FORM_IMAGES/);
  assert.match(worker,/Cross-Origin-Resource-Policy/);
  assert.ok(!worker.includes('Live imports are unavailable'));
});

test('hosted release downloads use the platform static-asset binding',()=>{
  const worker=readFileSync('scripts/hosted-worker.template.js','utf8');const build=readFileSync('scripts/build.mjs','utf8');
  assert.match(worker,/async fetch\(request,env\)/);
  assert.match(build,/__ALTERED_DOWNLOAD_ASSETS__/);assert.match(worker,/const DOWNLOAD_ASSETS=__ALTERED_DOWNLOAD_ASSETS__/);
  assert.match(worker,/Content-Disposition.*attachment/);
  assert.match(worker,/url\.pathname\.startsWith\('\/downloads\/'\)&&env\?\.ASSETS\?\.fetch/);
});

test('account identity and focused workspace stay incremental and accessible',()=>{
  const html=readFileSync('public/index.html','utf8');
  const source=readFileSync('src/app.ts','utf8');
  const styles=readFileSync('public/styles.css','utf8');
  const hostedServiceWorker=readFileSync('public/sw-hosted.js','utf8');
  assert.match(html,/id="account-status"[^>]*hidden/);
  assert.match(html,/id="toggle-app-menu"[^>]*aria-expanded="false"[^>]*aria-controls="top-actions"/);
  assert.match(html,/id="toggle-app-menu"[\s\S]*?<img src="icon-192\.png"/);
  assert.match(html,/id="account-name"/);
  assert.match(html,/href="\/signout-with-chatgpt\?return_to=%2F"/);
  assert.equal((html.match(/<details class="panel dashboard-drawer" name="more-controls"/g)??[]).length,4);
  assert.equal((html.match(/<details class="panel dashboard-drawer" name="more-controls" open>/g)??[]).length,0);
  assert.match(html,/class="form-tools-drawer"/);
  assert.match(source,/async function loadHostedAccount\(\)/);
  assert.match(source,/#account-name/);
  assert.match(source,/function setAppMenuOpen\(open:boolean,restoreFocus=false\)/);
  assert.match(styles,/html,body\{width:100%;height:100%;overflow:hidden\}/);
  assert.match(styles,/\.workspace-stage\{[^}]*overflow:hidden/);
  assert.match(styles,/\.workspace-view\{[^}]*overflow:auto/);
  assert.match(styles,/\.task-view \.tab-content\{[^}]*overflow:visible/);
  assert.match(styles,/\.more-view \.drawer-content\{overflow:visible/);
  assert.match(styles,/\.dashboard-drawer>summary:focus-visible/);
  assert.match(hostedServiceWorker,/event\.request\.mode==='navigate'/);
  assert.ok(!hostedServiceWorker.includes("'./index.html'"));
});

test('recent activity exposes a clear control that preserves non-log state',()=>{
  const html=readFileSync('public/index.html','utf8');
  const source=readFileSync('src/app.ts','utf8');
  assert.match(html,/id="clear-activity"[^>]*>Clear Activity<\/button>/);
  assert.match(source,/\$\('#clear-activity'\)\.addEventListener\('click',\(\)=>\{state\.log=\[\];/);
  assert.match(source,/Recent activity cleared\./);
});

test('roll outcomes remain visible, explain modifiers, and grade dramatic totals without changing rules',()=>{
  const html=readFileSync('public/index.html','utf8');
  const source=readFileSync('src/app.ts','utf8');
  const styles=readFileSync('public/styles.css','utf8');
  assert.match(html,/id="roll-toast"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(styles,/\.roll-toast\{[^}]*position:fixed[^}]*z-index:120/);
  assert.match(source,/function showFloatingRoll\(/);
  assert.match(source,/showFloatingRoll\(totalText,detail,title,presentation\)/);
  assert.match(source,/Exceptional total · all bonuses included/);
  assert.match(source,/total>=25/);
  assert.match(source,/Natural 1 · lowest possible die/);
  assert.match(source,/Natural 20 · highest possible die/);
  assert.match(source,/const resolvedSource=modifierSource\?\?save\?\.source/);
  assert.match(styles,/\.roll-toast\.tone-critical-failure/);
  assert.match(styles,/\.roll-toast\.tone-critical-success/);
  assert.match(styles,/\.roll-toast\.tone-exceptional/);
});

test('the focused workspace uses form-panel space for live stats and explains ability controls',()=>{
  const html=readFileSync('public/index.html','utf8');
  const source=readFileSync('src/app.ts','utf8');
  const styles=readFileSync('public/styles.css','utf8');
  for(const id of ['persistent-hp','persistent-temp','persistent-ac','persistent-speed','action-economy','play-end-form'])assert.match(html,new RegExp(`id="${id}"`));
  for(const id of ['persistent-new-turn','persistent-end-turn','persistent-turn-number'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/persistent-form-side[\s\S]*?id="action-economy"[\s\S]*?id="persistent-new-turn"/);
  assert.equal(/class="play-form-status"/.test(html),false);assert.match(html,/id="metric-grid"[^>]*hidden/);assert.match(html,/class="turn-bar"[^>]*hidden/);
  assert.match(source,/#persistent-hp/);
  assert.match(source,/#persistent-new-turn/);assert.match(source,/#persistent-end-turn/);assert.match(styles,/\.play-view \.turn-bar\{display:none\}/);
  assert.match(styles,/\.play-view \.metric-grid\{display:none\}/);
  assert.match(styles,/\.persistent-action-economy/);assert.match(styles,/\.persistent-turn-controls\{display:grid/);
  assert.match(styles,/@media\(min-width:820px\) and \(max-width:1180px\)/);assert.match(styles,/grid-template-columns:minmax\(240px,260px\) minmax\(0,1fr\)/);
  assert.match(styles,/@media\(min-width:820px\)[\s\S]*?\.persistent-action-economy\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(source,/classList\.toggle\('is-ready',previewReady\)/);assert.match(source,/classList\.toggle\('is-beast',beastIdentity\)/);
  assert.match(styles,/\.persistent-form-copy\.is-preview\.is-ready>strong/);assert.match(styles,/\.persistent-form-copy\.is-preview\.is-ready\.is-beast>strong/);
  assert.match(styles,/@keyframes availableFormNamePulse/);assert.match(styles,/@media\(prefers-reduced-motion:reduce\)[\s\S]*availableFormNamePulse|animation:none!important/);
  assert.match(html,/id="ability-actions-title">Use now/);assert.match(html,/aria-labelledby="ability-actions-title" hidden/);
  assert.match(html,/id="ability-resources-title">Resources left/);
  assert.match(html,/class="ability-resource-details"/);assert.match(html,/id="ability-resource-summary"/);assert.match(html,/id="persistent-stat-context"/);
  assert.match(source,/Abilities, explained/);
  assert.match(source,/featureReferenceSection/);
  assert.match(source,/Applied automatically/);
});

test('character management exposes safe add and delete paths',()=>{
  const html=readFileSync('public/index.html','utf8');const source=readFileSync('src/app.ts','utf8');
  assert.match(html,/id="open-import-center"/);assert.match(html,/id="more-delete-character"/);assert.equal(/id="more-import"/.test(html),false);
  assert.match(html,/id="delete-character-dialog"/);assert.match(source,/function deleteCurrentCharacter\(\)/);assert.match(source,/deletedCharacterIds/);assert.match(source,/baseCharacters\.length<=1/);
});

test('linked D&D Beyond characters refresh safely and can keep a saved version',()=>{
  const html=readFileSync('public/index.html','utf8');const source=readFileSync('src/app.ts','utf8');
  assert.match(html,/id="refresh-character"[^>]*>Refresh Character<\/button>/);assert.match(html,/id="auto-refresh-character"[^>]*type="checkbox"/);
  assert.match(html,/id="character-refresh-status"[^>]*aria-live="polite"/);assert.match(source,/AUTO_REFRESH_CHARACTER_SETTING='auto-refresh-ddb-character-v1'/);
  assert.match(source,/loadBooleanSetting\(AUTO_REFRESH_CHARACTER_SETTING,true\)/);assert.match(source,/cache:'no-store'/);
  assert.match(source,/document\.addEventListener\('visibilitychange'/);assert.match(source,/rebuildEffectiveCharacterLibrary\(true\)/);
  assert.match(source,/target\.id\.match\(\/\^ddb-/);
  assert.match(source,/Using the saved version/);assert.match(source,/Current combat state was preserved/);
  assert.match(source,/register\('\.\/sw\.js',\{updateViaCache:'none'\}\)/);assert.match(source,/controllerchange/);
  assert.match(source,/App \$\{APP_VERSION\} · Rules SRD/);
});

test('Windows installer packages the app icon and creates user shortcuts',()=>{
  const installer=readFileSync('scripts/build-windows-installer.ps1','utf8');const build=readFileSync('scripts/build.mjs','utf8');
  assert.match(installer,/Altered-Windows-Setup-v\$Version\.exe/);assert.match(installer,/desktop 'Altered\.lnk'/i);
  assert.match(installer,/CreateShortcut/);assert.match(installer,/Altered\.ico/);assert.match(installer,/Uninstall-Altered\.ps1/);
  assert.match(installer,/https:\/\/altered-ferocitus\.ghostdaddy\.chatgpt\.site\//);assert.match(installer,/Altered Offline\.lnk/);
  assert.match(build,/Altered-Windows-Setup-v0\.29\.2\.exe/);assert.match(build,/Altered-Desktop-Mac-v0\.29\.2\.zip/);
});

test('combat state and spell availability are explained before a click',()=>{
  const html=readFileSync('public/index.html','utf8');
  const source=readFileSync('src/app.ts','utf8');
  const styles=readFileSync('public/styles.css','utf8');
  assert.match(html,/id="active-effects"[^>]*aria-live="polite"/);
  assert.match(source,/Start Rage · Bonus Action/);
  assert.match(source,/Start Rage — Bonus Action Used/);
  assert.match(source,/Action still available: use it for an attack, another non-spell action, or a cantrip/);
  assert.match(source,/Barkskin, Wild Shape, and Rage each use a Bonus Action/);
  assert.match(source,/attack roll: \$\{attackRollDetail\(attack/);
  assert.match(source,/Potential damage if every attack hits and every save fails/);
  assert.match(source,/natural 20, automatic hit and CRITICAL HIT/);
  assert.match(source,/On a hit, apply: \$\{effectsText\(hitEffects\)\}/);
  assert.match(source,/Add Advantage/);
  assert.match(source,/Multiattack option/);
  assert.match(source,/Spell effect: \$\{spell\.summary\}/);
  assert.match(source,/previousTransformId&&!state\.activeTransform/);
  assert.match(source,/form-aura-pulse/);
  assert.match(source,/const ids=\[replacement\?\.id,\.\.\.overlays\.map\(overlay=>overlay\.id\)\]/);
  assert.match(source,/return state\.overlays\.length\?'aura-overlay':undefined/);
  assert.match(source,/classList\.toggle\('motion-forced',!reduceMotion\)/);
  assert.match(styles,/form-active:not\(\.effects-disabled\):not\(\.reduce-motion\) \.form-aura-pulse\{animation:alteredVisibleFormPulse 2s ease-in-out infinite\}/);
  assert.match(source,/Static aura is active because Reduce motion is on/);
  assert.match(source,/Initiative is a Dexterity check when combat starts/);
  assert.match(source,/Surprised \(Disadvantage\)/);
  assert.match(source,/Rage Damage applies only to Strength attacks with a weapon or Unarmed Strike/);
  assert.match(source,/Available now \(\$\{ready\.length\}\)/);
  assert.match(source,/Unavailable right now \(\$\{blocked\.length\}\)/);
  assert.match(source,/availableSpellSlotLevels\(character,state,slotLevel\)/);
  assert.match(source,/actionExecutionError\(character,state,action,sheet\.conditionImmunities\)/);
  assert.match(source,/Extra Attack: \$\{state\.turn\.attackAction\.remaining\} remaining/);
});

test('the Transform button gives accessible ready and blocked next-step cues',()=>{
  const html=readFileSync('public/index.html','utf8');
  const source=readFileSync('src/app.ts','utf8');
  const styles=readFileSync('public/styles.css','utf8');
  assert.match(html,/id="transform-button"[^>]*aria-describedby="form-reason"/);
  assert.match(source,/transform-cue-ready/);assert.match(source,/transform-cue-blocked/);
  assert.match(source,/dataset\.transformState/);assert.match(source,/Available now/);assert.match(source,/Unavailable:/);
  assert.match(styles,/#transform-button\.transform-cue-ready/);assert.match(styles,/#transform-button\.transform-cue-blocked:disabled/);
  assert.match(styles,/@keyframes transformReadyPulse/);assert.match(styles,/@keyframes transformBlockedPulse/);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)[\s\S]*#transform-button\.transform-cue-ready/);
});

test('optional next-step guidance stays contextual, non-tactical, and persistent',()=>{
  const html=readFileSync('public/index.html','utf8');const source=readFileSync('src/app.ts','utf8');const styles=readFileSync('public/styles.css','utf8');
  for(const id of ['guided-next-step','next-step-guide','next-step-title','next-step-copy','show-next-step'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/never chooses tactics, targets, or spends resources/i);
  assert.match(source,/loadBooleanSetting\('guided-next-step-v1',true\)/);assert.match(source,/saveBooleanSetting\('guided-next-step-v1'/);
  assert.match(source,/function recommendNextStep/);assert.match(source,/function renderNextStepGuide/);assert.match(source,/function revealNextStep/);
  assert.match(source,/function activateTab[\s\S]*renderNextStepGuide\(\)/);assert.match(source,/#form-select'\)\.addEventListener\('change',[\s\S]*renderNextStepGuide\(\)/);
  assert.match(source,/Your form is active\. Return to Play/);assert.match(source,/latestRollTab=currentTab/);assert.match(source,/openTask\(latestRollTab,'play'\)/);
  assert.match(source,/title:'Open Actions'[\s\S]*reveal:revealTask\('actions'\)/);
  for(const guidance of ['Resolve Relentless Rage','Roll a death save','Resolve Concentration','Complete Extra Attack','Consider Rage, then attack','Consider Barkskin','End this turn'])assert.match(source,new RegExp(guidance));
  assert.match(source,/You can still choose any other legal action/);assert.match(styles,/\.next-step-target/);assert.match(styles,/prefers-reduced-motion:reduce[\s\S]*\.next-step-target/);
});

test('active beast identity and conditional form traits remain visually and mechanically honest',()=>{
  const source=readFileSync('src/app.ts','utf8');const styles=readFileSync('public/styles.css','utf8');
  assert.match(source,/trait\.name\.trim\(\)\.toLowerCase\(\)==='pack tactics'/);assert.match(source,/Confirm for each attack/);assert.match(source,/cannot know where allies and targets are/);
  assert.match(styles,/\.persistent-form-copy\.is-active\.is-beast>strong/);assert.match(styles,/@keyframes activeBeastNamePulse/);
  assert.match(styles,/html\[data-altered-workspace="forms"\] \.app-shell\.form-active \.workspace\{grid-template-rows:315px/);
});

test('turn completion and form-family cues stay accurate, semantic, and motion-safe',()=>{
  const source=readFileSync('src/app.ts','utf8');const styles=readFileSync('public/styles.css','utf8');
  assert.match(source,/function turnReadyToEnd\(\)/);assert.match(source,/actionsRemaining===0&&state\.turn\.surgeActionsRemaining===0&&state\.turn\.bonusRemaining===0/);
  assert.match(source,/state\.turn\.attackAction\?\.remaining\?\?0/);assert.match(source,/!state\.pendingRelentlessRage/);assert.match(source,/state\.concentrationChecks\.length===0/);
  assert.match(source,/\['#end-turn','#persistent-end-turn'\]/);assert.match(source,/classList\.toggle\('turn-complete-cue',ready\)/);
  for(const family of ['aura-aquatic','aura-venom','aura-feline','aura-ursine','aura-lupine','aura-avian']){assert.match(source,new RegExp(family));assert.match(styles,new RegExp(`\\.app-shell\\.${family}`));}
  assert.match(styles,/\.turn-complete-cue/);assert.match(styles,/@keyframes turnCompletePulse/);assert.match(styles,/@keyframes feralFormNameGlow/);
  assert.match(styles,/\.app-shell\.reduce-motion \.turn-complete-cue/);assert.match(styles,/@media\(forced-colors:active\)/);assert.match(styles,/body::after[\s\S]*radial-gradient/);
});

test('static shell applies a restrictive local-only content policy',()=>{
  const html=readFileSync('public/index.html','utf8');
  const policy=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1]??'';
  assert.match(policy,/default-src 'self'/);
  assert.match(policy,/connect-src 'self'/);
  assert.match(policy,/object-src 'none'/);
  assert.match(policy,/base-uri 'none'/);
});

test('PWA manifest has a stable identity, scope, and description',()=>{
  const manifest=JSON.parse(readFileSync('public/manifest.json','utf8')) as Record<string,unknown>;
  assert.equal(manifest.id,'./');
  assert.equal(manifest.scope,'./');
  assert.ok(typeof manifest.description==='string'&&manifest.description.length>20);
});

test('More exposes local artwork and homebrew creation without requiring JSON',()=>{
  const html=readFileSync('public/index.html','utf8');const source=readFileSync('src/app.ts','utf8');
  for(const id of ['character-art-file','current-form-art-file','more-reset-art','create-homebrew-ability','create-homebrew-transformation','manage-private-content'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/Manage → Customize/);assert.match(html,/Create Ability or Feature/);assert.match(source,/function openManualPrivateMechanic/);assert.match(source,/User-created homebrew mechanic/);
  assert.match(source,/entry\.id\.startsWith\('private-'\)&&entry\.activation/);assert.match(source,/bindArtworkInput\('#character-art-file'/);assert.match(source,/bindArtworkInput\('#current-form-art-file'/);
});

test('imported feats use accurate ownership language and can be corrected without JSON',()=>{
  const html=readFileSync('public/index.html','utf8');const source=readFileSync('src/app.ts','utf8');const engine=readFileSync('src/engine.ts','utf8');
  for(const id of ['imported-feat-summary','imported-feat-list'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(source,/function renderImportedFeatManagement/);assert.match(source,/Remove from Altered/);assert.match(source,/Owned · reference/);assert.match(source,/Use or confirm/);
  assert.equal(/feature\.status==='conditional'\?'requirements'/.test(source),false);assert.match(engine,/Owned by this character and retained in the current form/);
});

test('feature view explains effects and places activation controls with the feature',()=>{
  const source=readFileSync('src/app.ts','utf8');
  assert.match(source,/Abilities, explained/);assert.match(source,/What it does/);assert.match(source,/How to use it/);
  assert.match(source,/function appendFeatureControls/);assert.match(source,/Use or confirm/);assert.match(source,/Applied automatically/);assert.match(source,/Owned references/);assert.match(source,/Unavailable now/);
});

test('equipment has a dedicated focused tab while equipped weapons remain executable actions',()=>{
  const source=readFileSync('src/app.ts','utf8');const engine=readFileSync('src/engine.ts','utf8');
  const html=readFileSync('public/index.html','utf8');assert.match(html,/data-tab="equipment"/);assert.match(source,/function renderEquipment/);assert.match(source,/Stored inventory/);assert.match(engine,/item\.equipped&&/);
  assert.match(source,/Equipment & effects/);assert.match(source,/Applied now/);assert.match(source,/Melded in form/);assert.match(source,/Needs attunement/);
});

test('spent turn economy is unavailable now, not a missing character requirement',()=>{
  const source=readFileSync('src/app.ts','utf8');
  assert.match(source,/economyError\?'unavailable':'available'/);assert.match(source,/limit\.unavailable\?'locked':'unavailable'/);assert.match(source,/selected\.usable\?'unavailable':'locked'/);
  assert.equal(/economyError\?'requirements':'available'/.test(source),false);assert.equal(/limit\.unavailable\?'locked':'requirements'/.test(source),false);
});

test('service worker never caches private or changing API responses',()=>{
  const source=readFileSync('public/sw.js','utf8');
  assert.match(source,/if\(url\.pathname\.startsWith\('\/api\/'\)\)return/);
  assert.match(source,/event\.request\.method!=='GET'/);
});

test('local server sends update-friendly cache and security headers',()=>{
  const source=readFileSync('scripts/serve.mjs','utf8');
  assert.match(source,/'Cache-Control':freshExtensions\.has\(extension\)\?'no-cache'/);
  assert.match(source,/'X-Content-Type-Options':'nosniff'/);
  assert.match(source,/'X-Frame-Options':'DENY'/);
  assert.match(source,/'Content-Security-Policy':contentSecurityPolicy/);
  assert.match(source,/'Permissions-Policy':'camera=\(\), microphone=\(\), geolocation=\(\)'/);
  assert.match(source,/request\.method!=='GET'&&request\.method!=='HEAD'/);
});

test('phone access is explicit while the default server remains loopback-only',()=>{
  const source=readFileSync('scripts/serve.mjs','utf8');
  const pkg=JSON.parse(readFileSync('package.json','utf8')) as {scripts?:Record<string,string>};
  assert.match(source,/process\.argv\.slice\(2\)\.includes\('--lan'\)/);
  assert.match(source,/lanMode\?'0\.0\.0\.0':'127\.0\.0\.1'/);
  assert.equal(pkg.scripts?.['serve:lan'],'node scripts/serve.mjs --lan');
  assert.equal(pkg.scripts?.['start:lan'],'npm run build && npm run serve:lan');
});

test('D&D Beyond proxy is fixed-host, numeric-ID-only, bounded, and non-caching',()=>{
  const source=readFileSync('scripts/serve.mjs','utf8');
  assert.match(source,/ddbRoute=\/\^\\\/api\\\/dndbeyond\\\/character\\\/\(\\d\{5,15\}\)\$\//);
  assert.match(source,/ddbOrigin='https:\/\/character-service\.dndbeyond\.com'/);
  assert.match(source,/maxDdbResponseBytes=5\*1024\*1024/);
  assert.match(source,/'Cache-Control':'no-store'/);
  assert.match(source,/redirect:'error'/);
});

test('SRD support proxy is fixed-host, source-filtered, bounded, and domain-whitelisted',()=>{
  const source=readFileSync('scripts/serve.mjs','utf8');
  assert.match(source,/srdOrigin='https:\/\/api\.open5e\.com'/);
  assert.match(source,/srdDocument='srd-2024'/);
  assert.match(source,/maxSrdResponseBytes=2\*1024\*1024/);
  assert.match(source,/if\(!\(domain in srdDomains\)\)/);
  assert.match(source,/url\.searchParams\.set\('document__key__in',srdDocument\)/);
  assert.match(source,/redirect:'error'/);
});

test('every primary workspace uses consistent names and phone-safe controls',()=>{
  const html=readFileSync('public/index.html','utf8');const source=readFileSync('src/app.ts','utf8');const styles=readFileSync('public/styles.css','utf8');
  assert.match(html,/id="nav-sheet"[^>]*aria-label="Character: abilities, rules, and sheet details"[^>]*>[\s\S]*?Character<\/button>/);
  assert.match(html,/id="tab-rolls"[^>]*aria-label="Checks: saves, skills, and initiative"[^>]*>Checks<\/button>/);assert.match(html,/id="tab-features"[^>]*>Abilities<\/button>/);
  assert.match(html,/id="more-customize"/);assert.match(source,/#more-customize'\)\.addEventListener/);assert.equal(/customize-drawer" name="more-controls" open/.test(html),false);
  assert.match(styles,/navigation clarity, touch safety, and active-overlay escape paths/);assert.match(styles,/\.persistent-turn-controls \.button[^}]*min-height:44px/);assert.match(styles,/\.app-shell\.form-active:not\(\.effects-disabled\) \.workspace-view\{overflow:auto\}/);
  assert.equal((html.match(/data-workspace-view="[^\"]+"[^>]*tabindex="0"/g)??[]).length,4);assert.match(styles,/@media\(pointer:coarse\)[\s\S]*min-block-size:44px/);
  assert.match(html,/class="brand-menu-cue"/);assert.match(styles,/\.file-button:focus-within/);assert.match(source,/document\.querySelector\('dialog\[open\]'\)/);
});

test('focused action pages prioritize executable controls without losing advanced choices',()=>{
  const source=readFileSync('src/app.ts','utf8');const styles=readFileSync('public/styles.css','utf8');
  assert.match(source,/function collapseActionOptions/);assert.match(source,/Unavailable right now \(\$\{unavailableCount\}\)/);
  assert.match(source,/c\.options\.append\(conditionalRollToggle/);assert.match(styles,/\.action-options-disclosure/);assert.match(styles,/\.unavailable-actions/);
  assert.match(source,/Applied automatically'[\s\S]*open:false/);assert.match(source,/appendControlReason\(actions,toShape/);assert.match(styles,/\.control-block-reason/);
});

test('private transformation builder supports guided ability substitutions and activation saves',()=>{
  const html=readFileSync('public/index.html','utf8');const source=readFileSync('src/app.ts','utf8');const types=readFileSync('src/types.ts','utf8');const schema=readFileSync('src/schema.ts','utf8');
  for(const id of ['builder-template','apply-builder-template','builder-mechanics-summary','builder-profile-help','builder-substitute-from','builder-substitute-to','builder-substitute-checks','builder-substitute-saves','builder-attack-ability','builder-attack-scope','builder-trigger-name','builder-trigger-save','builder-trigger-dc','builder-trigger-damage','builder-trigger-damage-type','builder-trigger-half'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(types,/checkAbilitySubstitution/);assert.match(types,/saveAbilitySubstitution/);assert.match(types,/attackAbilityOverride/);assert.match(schema,/attackAbilityOverride\.appliesTo/);assert.match(source,/Resolve this once when the transformation is activated/);
  assert.match(source,/function syncBuilderGuidance/);assert.match(source,/function applyBuilderTemplate/);assert.match(source,/ability-substitution/);assert.match(html,/Enhancement — keep the current sheet/);
});

test('additive forms always expose an end path while preserving workspace scrolling',()=>{
  const source=readFileSync('src/app.ts','utf8');const styles=readFileSync('public/styles.css','utf8');
  assert.match(source,/overlayEnd=\[\.\.\.options\]\.reverse\(\)\.find/);assert.match(source,/if\(!state\.activeTransform&&state\.overlays\.length\)/);assert.match(source,/tap End to release the latest/);assert.match(styles,/form-active:not\(\.effects-disabled\) \.workspace-view\{overflow:auto\}/);
});

test('every static form control has an accessible name',()=>{
  const html=readFileSync('public/index.html','utf8');
  for(const match of html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)){const id=/\bid="([^"]+)"/.exec(match[2]??'')?.[1];if(!id)continue;const lineStart=html.lastIndexOf('\n',match.index)+1;const lineEnd=html.indexOf('\n',match.index);const line=html.slice(lineStart,lineEnd<0?html.length:lineEnd);const before=line.slice(0,line.indexOf(match[0]));const named=new RegExp(`for="${id}"`).test(html)||/aria-label=/.test(match[2]??'')||/<label\b/.test(before);assert.ok(named,`${id} has no accessible label`);}
});
