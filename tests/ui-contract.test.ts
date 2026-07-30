import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('static shell exposes accessible tabs, dialogs, and condition input',()=>{
  const html=readFileSync('public/index.html','utf8');
  assert.match(html,/role="tablist"/);
  assert.equal((html.match(/role="tab"/g)??[]).length,5);
  assert.match(html,/id="tab-content"[^>]*role="tabpanel"[^>]*aria-labelledby="tab-actions"/);
  assert.match(html,/for="condition-select">Condition<\/label>/);
  for(const id of ['import-dialog','transform-builder-dialog','settings-dialog','temp-hp-dialog']){
    assert.match(html,new RegExp(`<dialog id="${id}"[^>]*aria-labelledby="${id.replace(/-dialog$/,'')}(?:-dialog)?-title"`));
  }
});

test('recent activity exposes a clear control that preserves non-log state',()=>{
  const html=readFileSync('public/index.html','utf8');
  const source=readFileSync('src/app.ts','utf8');
  assert.match(html,/id="clear-activity"[^>]*>Clear Activity<\/button>/);
  assert.match(source,/\$\('#clear-activity'\)\.addEventListener\('click',\(\)=>\{state\.log=\[\];/);
  assert.match(source,/Recent activity cleared\./);
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
