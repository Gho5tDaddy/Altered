import test from 'node:test';
import assert from 'node:assert/strict';
import {installExtensionPack,listExtensionPackRecords,listExtensionPacks,loadArtOverride,loadBooleanSetting,removeArtOverride,removeExtensionPack,saveArtOverride,saveBooleanSetting,setStorageFailureHandler} from '../src/storage.js';
import {ownedContentTemplate,parseOwnedContentPack} from '../src/owned-content.js';

test('settings use the in-memory fallback when browser storage is unavailable',async()=>{
  assert.equal(await loadBooleanSetting('test-setting',false),false);
  await saveBooleanSetting('test-setting',true);
  assert.equal(await loadBooleanSetting('test-setting',false),true);
});

test('in-memory-only writes report that the change is not durable',async()=>{
  const messages:string[]=[];setStorageFailureHandler(message=>messages.push(message));
  await saveBooleanSetting('durability-warning-test',true);
  setStorageFailureHandler(undefined);
  assert.equal(messages.length,1);assert.match(messages[0]??'',/may disappear after reload/);
  assert.equal(await loadBooleanSetting('durability-warning-test',false),true);
});

test('walkthrough completion persists independently from character data',async()=>{
  assert.equal(await loadBooleanSetting('walkthrough-completed-v1',false),false);
  await saveBooleanSetting('walkthrough-completed-v1',true);
  assert.equal(await loadBooleanSetting('walkthrough-completed-v1',false),true);
});

test('art overrides can be stored and removed through the fallback layer',async()=>{
  const image='data:image/png;base64,iVBORw0KGgo=';
  await saveArtOverride('character','form:wolf',image);
  assert.equal(await loadArtOverride('character','form:wolf'),image);
  await removeArtOverride('character','form:wolf');
  assert.equal(await loadArtOverride('character','form:wolf'),undefined);
});

test('art storage rejects non-image data',async()=>{
  let rejected=false;try{await saveArtOverride('character','base','data:text/plain;base64,SGVsbG8=');}catch{rejected=true;}
  assert.equal(rejected,true);
});


test('private content packs can be installed, listed, and removed',async()=>{
  const pack=parseOwnedContentPack(ownedContentTemplate());pack.metadata.id='storage-test-private-pack';pack.metadata.name='Storage Test Private Pack';
  await installExtensionPack(pack);
  const installed=await listExtensionPacks();assert.ok(installed.some(entry=>entry.metadata.id===pack.metadata.id));
  const records=await listExtensionPackRecords();assert.ok(records.some(entry=>entry.id===pack.metadata.id));
  await removeExtensionPack(pack.metadata.id);
  const removed=await listExtensionPacks();assert.equal(removed.some(entry=>entry.metadata.id===pack.metadata.id),false);
});
