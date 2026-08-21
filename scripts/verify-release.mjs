import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {
  androidReleaseArtifact,
  appVersion,
  deploymentLimits,
  projectRoot,
  publicReleaseDirectory,
  releaseArtifacts,
  staticReleaseArtifacts,
} from './release-config.mjs';

const sourceOnly=process.argv.includes('--source-only');
const read=relative=>readFile(path.join(projectRoot,relative),'utf8');

function capturedVersion(source,pattern,label){
  const value=source.match(pattern)?.[1];
  assert.ok(value,`${label} does not expose an auditable version marker.`);
  return value;
}

async function directoryBytes(directory){
  let total=0;
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const target=path.join(directory,entry.name);
    total+=entry.isDirectory()?await directoryBytes(target):(await stat(target)).size;
  }
  return total;
}

async function isFile(target){
  try{return (await stat(target)).isFile();}catch(error){if(error&&typeof error==='object'&&'code' in error&&error.code==='ENOENT')return false;throw error;}
}

const [appSource,serviceWorker,hostedServiceWorker,buildSource,workerTemplate,installerSource,androidBuild,installGuide]=await Promise.all([
  read('src/app.ts'),read('public/sw.js'),read('public/sw-hosted.js'),read('scripts/build.mjs'),
  read('scripts/hosted-worker.template.js'),read('scripts/build-windows-installer.ps1'),
  read('android-wrapper/twa/app/build.gradle'),read('INSTALL.md'),
]);
const twaManifest=JSON.parse(await read('android-wrapper/twa/twa-manifest.json'));
const [major,minor,patch]=appVersion.split('-')[0].split('.').map(Number);
const expectedAndroidVersionCode=major*1000000+minor*1000+patch;

assert.equal(capturedVersion(appSource,/const APP_VERSION='([^']+)'/,'src/app.ts'),appVersion,'App version must match package.json.');
assert.equal(capturedVersion(serviceWorker,/const CACHE='altered-v([0-9]+\.[0-9]+\.[0-9]+)(?:-[^']+)?'/,'public/sw.js'),appVersion,'Local service-worker version must match package.json.');
assert.equal(capturedVersion(hostedServiceWorker,/const CACHE='altered-hosted-v([^']+)'/,'public/sw-hosted.js'),appVersion,'Hosted service-worker version must match package.json.');
assert.equal(twaManifest.appVersion,appVersion,'TWA manifest version must match package.json.');
assert.equal(twaManifest.appVersionCode,expectedAndroidVersionCode,'TWA versionCode must follow the package-version formula.');
assert.match(buildSource,/from '\.\/release-config\.mjs'/,'The build must derive artifact names from release-config.mjs.');
assert.match(installerSource,/ConvertFrom-Json/,'The Windows installer must read package.json when no version override is supplied.');
assert.doesNotMatch(installerSource,/param\(\[string\]\$Version\s*=\s*'[0-9]+\.[0-9]+\.[0-9]+'/,'The Windows installer cannot default to a hard-coded version.');
assert.match(androidBuild,/packageMetadata\.version/,'Android versionName must derive from package.json.');
assert.doesNotMatch(workerTemplate,/DOWNLOAD_ASSETS/,'Desktop installers must not be embedded in the Worker.');
assert.doesNotMatch(buildSource,/__ALTERED_DOWNLOAD_ASSETS__/,'Desktop installers must not be base64-embedded by the build.');
assert.doesNotMatch(installGuide,/Altered-(?:Android|Windows-Setup|Desktop-Mac)-v[0-9]/,'Install documentation cannot pin a stale artifact version.');

if(sourceOnly){
  console.log(`Release source metadata is consistent at ${appVersion}.`);
  process.exit(0);
}

const dist=path.join(projectRoot,'dist');
const distDownloads=path.join(dist,'downloads');
const expectedNames=releaseArtifacts.map(artifact=>artifact.fileName).sort();
const sourceNames=[];
for(const artifact of releaseArtifacts){
  const source=path.join(publicReleaseDirectory,artifact.fileName);
  assert.ok(await isFile(source),`Missing current release artifact: ${artifact.fileName}`);
  sourceNames.push(artifact.fileName);
}
assert.deepEqual(sourceNames.sort(),expectedNames);
const stagedNames=(await readdir(distDownloads,{withFileTypes:true})).filter(entry=>entry.isFile()).map(entry=>entry.name).sort();
assert.deepEqual(stagedNames,expectedNames,'dist/downloads must contain exactly the three current advertised artifacts.');

const workerPath=path.join(dist,'server','index.js');
const worker=(await readFile(workerPath,'utf8'));
assert.ok(worker.includes(`/downloads/${androidReleaseArtifact.fileName}`),'Hosted Worker must advertise the current Android artifact.');
for(const artifact of staticReleaseArtifacts)assert.ok(worker.includes(`/downloads/${artifact.fileName}`),`Hosted Worker must allow ${artifact.fileName}.`);
assert.ok((await stat(workerPath)).size<=deploymentLimits.workerBytes,`Hosted Worker exceeds ${deploymentLimits.workerBytes} bytes.`);
assert.ok(await directoryBytes(distDownloads)<=deploymentLimits.stagedDownloadsBytes,`Staged downloads exceed ${deploymentLimits.stagedDownloadsBytes} bytes.`);
assert.ok(await directoryBytes(dist)<=deploymentLimits.distBytes,`Deployment exceeds ${deploymentLimits.distBytes} bytes.`);
console.log(`Release ${appVersion} verified: three artifacts, consistent versions, bounded deployment.`);
