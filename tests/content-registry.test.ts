import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTENT_PACKS,CONDITIONS,TRANSFORMATION_PROFILES,contentRegistrySnapshot} from '../src/content-registry.js';

test('content registry exposes unique versioned packs',()=>{
  const ids=CONTENT_PACKS.map(pack=>pack.metadata.id);
  assert.equal(new Set(ids).size,ids.length);
  for(const pack of CONTENT_PACKS){
    assert.ok(pack.metadata.version);
    assert.ok(pack.metadata.ruleset);
    assert.ok(pack.metadata.verified);
    assert.ok(Object.keys(pack.records).length>=0);
  }
});

test('content registry snapshot counts core domains',()=>{
  const snapshot=contentRegistrySnapshot();
  assert.equal(snapshot.packs.length,CONTENT_PACKS.length);
  assert.ok(snapshot.counts.creatures>0);
  assert.ok(snapshot.counts['class-features']>0);
  assert.ok(snapshot.counts['species-features']>0);
  assert.equal(snapshot.counts.conditions,Object.keys(CONDITIONS).length);
  assert.equal(snapshot.counts['transformation-profiles'],Object.keys(TRANSFORMATION_PROFILES).length);
});

test('every supported transformation profile has explicit retention rules',()=>{
  for(const profile of Object.values(TRANSFORMATION_PROFILES)){
    assert.equal(typeof profile.retains.hp,'boolean');
    assert.equal(typeof profile.retains.classFeatures,'boolean');
    assert.equal(typeof profile.retains.spellcasting,'boolean');
    assert.ok(profile.summary.length>20);
  }
});
