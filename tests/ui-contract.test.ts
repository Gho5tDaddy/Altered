import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('static shell exposes accessible tabs, dialogs, and condition input',()=>{
  const html=readFileSync('public/index.html','utf8');
  assert.match(html,/role="tablist"/);
  assert.equal((html.match(/role="tab"/g)??[]).length,5);
  assert.match(html,/id="tab-content"[^>]*role="tabpanel"[^>]*aria-labelledby="tab-actions"/);
  assert.match(html,/for="condition-select">Condition<\/label>/);
  for(const id of ['help-dialog','import-dialog','transform-builder-dialog','settings-dialog','temp-hp-dialog']){
    assert.match(html,new RegExp(`<dialog id="${id}"[^>]*aria-labelledby="${id.replace(/-dialog$/,'')}(?:-dialog)?-title"`));
  }
});

test('every static button is connected to an application control path',()=>{
  const html=readFileSync('public/index.html','utf8');
  const source=readFileSync('src/app.ts','utf8');
  const ids=Array.from(html.matchAll(/<button\b[^>]*\bid="([^"]+)"/g),match=>match[1]).filter((id):id is string=>Boolean(id));
  assert.ok(ids.length>30);
  for(const id of ids){
    const connected=id.startsWith('tab-')?source.includes("document.querySelectorAll<HTMLButtonElement>('.tab')"):source.includes(`#${id}`);
    assert.ok(connected,`${id} has no application control path`);
  }
});

test('help and first-launch walkthrough remain optional, searchable, and restartable',()=>{
  const html=readFileSync('public/index.html','utf8');
  const source=readFileSync('src/app.ts','utf8');
  const styles=readFileSync('public/styles.css','utf8');
  assert.match(html,/id="open-help"[^>]*>Help<\/button>/);
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
  for(const state of ['available','active','inactive','locked','unavailable','requirements','selected','favorite','new','importing','loading','success','warning','error'])assert.match(source,new RegExp(`${state}:\\{icon:`));
  assert.match(styles,/\.ui-status\.available/);
  assert.match(styles,/\.ui-status\.locked/);
  assert.match(styles,/\.main-form-art img,.preview-art img/);
  assert.match(styles,/\.top-actions\{width:100%;margin-left:0;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles,/\.help-topic summary:focus-visible/);
});

test('the six current forms ship with app-ready artwork in both builds',()=>{
  const source=readFileSync('src/app.ts','utf8');
  const serviceWorker=readFileSync('public/sw.js','utf8');
  const standalone=readFileSync('dist/altered-standalone.html','utf8');
  for(const [form,file] of [['brown-bear','form-brown-bear.jpg'],['dire-wolf','form-dire-wolf.jpg'],['giant-octopus','form-giant-octopus.jpg'],['giant-spider','form-giant-spider.jpg'],['lion','form-lion.jpg'],['tiger','form-tiger.jpg']]){
    assert.match(source,new RegExp(`'form:${form}':'${file}'`));
    assert.ok(serviceWorker.includes(`'./${file}'`));
    assert.ok(readFileSync(`dist/${file}`,'utf8').length>100_000);
    assert.ok(!standalone.includes(`'${file}'`));
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
  assert.match(source,/Built-in rules and forms are ready\.`\);render\(\);\s*document\.documentElement\.dataset\.alteredReady='true';\s*installedPacks=await/);
  assert.match(build,/replace\('<script src="app\.bundle\.js"><\/script>',\(\)=>/);
  assert.equal(pkg.scripts?.['browser:audit'],'node scripts/browser-audit.mjs');
  assert.ok(worker.includes(String.raw`\/api\/dndbeyond\/character`));
  assert.ok(worker.includes("url.pathname==='/api/srd/status'"));
  assert.ok(worker.includes("url.pathname==='/api/srd/catalog'"));
  assert.match(worker,/character-service\.dndbeyond\.com/);
  assert.match(worker,/api\.open5e\.com/);
  assert.match(source,/credentials:'same-origin'/);
  assert.match(worker,/fetch\(String\(url\)/);
  assert.match(worker,/redirect:'manual'/);
  assert.ok(!worker.includes('Live imports are unavailable'));
});

test('recent activity exposes a clear control that preserves non-log state',()=>{
  const html=readFileSync('public/index.html','utf8');
  const source=readFileSync('src/app.ts','utf8');
  assert.match(html,/id="clear-activity"[^>]*>Clear Activity<\/button>/);
  assert.match(source,/\$\('#clear-activity'\)\.addEventListener\('click',\(\)=>\{state\.log=\[\];/);
  assert.match(source,/Recent activity cleared\./);
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
  assert.match(source,/actionCostError\(state,action\.cost,sheet\.conditionImmunities\)/);
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
