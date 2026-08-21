import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const packageMetadata=JSON.parse(await readFile(path.join(projectRoot,'package.json'),'utf8'));
if(typeof packageMetadata.version!=='string'||!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(packageMetadata.version)){
  throw new Error('package.json must contain a valid release version.');
}

export const appVersion=packageMetadata.version;
export const releaseArtifacts=Object.freeze([
  Object.freeze({id:'android',fileName:`Altered-Android-v${appVersion}.apk`,contentType:'application/vnd.android.package-archive',delivery:'redirect'}),
  Object.freeze({id:'windows',fileName:`Altered-Windows-Setup-v${appVersion}.exe`,contentType:'application/vnd.microsoft.portable-executable',delivery:'asset'}),
  Object.freeze({id:'desktop-mac',fileName:`Altered-Desktop-Mac-v${appVersion}.zip`,contentType:'application/zip',delivery:'asset'}),
]);
export const androidReleaseArtifact=releaseArtifacts.find(artifact=>artifact.id==='android');
export const staticReleaseArtifacts=releaseArtifacts.filter(artifact=>artifact.delivery==='asset');
export const publicReleaseDirectory=path.join(projectRoot,'public','downloads');
export const deploymentLimits=Object.freeze({
  workerBytes:8*1024*1024,
  stagedDownloadsBytes:16*1024*1024,
  distBytes:40*1024*1024,
});

if(!androidReleaseArtifact)throw new Error('Android release artifact configuration is missing.');
