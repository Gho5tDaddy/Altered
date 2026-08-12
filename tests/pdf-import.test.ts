import test from 'node:test';
import assert from 'node:assert/strict';
import {characterFromPdfReview,parseClassLines,parsePdfCharacterText} from '../src/pdf-import.js';

test('PDF text parser extracts core sheet values without inventing missing mechanics',()=>{
  const draft=parsePdfCharacterText(`Character Name: Thalia\nSpecies: Elf\nClass & Level: Druid 5 - Circle of the Moon / Monk 1\nSTR 10 DEX 16 CON 14 INT 12 WIS 18 CHA 8\nHP 37/42\nArmor Class 17\nSpeed 35 ft\n2024 rules`);
  assert.equal(draft.name,'Thalia');assert.equal(draft.species,'Elf');assert.deepEqual(draft.abilities,{str:10,dex:16,con:14,int:12,wis:18,cha:8});assert.deepEqual(draft.hp,{current:37,max:42});assert.equal(draft.ac,17);assert.equal(draft.speed,35);assert.equal(draft.ruleset,'2024');
});

test('class review supports multiclass and subclass lines',()=>{
  assert.deepEqual(parseClassLines('Druid 5 — Circle of the Moon\nBarbarian 1'),[{name:'Druid',level:5,subclass:'Circle of the Moon'},{name:'Barbarian',level:1,subclass:null}]);
});

test('reviewed PDF creates a schema-validated 2024 character',()=>{
  const character=characterFromPdfReview({name:'Thalia',species:'Elf',classLines:'Monk 1\nDruid 1',abilities:{str:10,dex:16,con:14,int:12,wis:18,cha:8},hp:{current:18,max:18},ac:16,speed:35,ruleset:'2024'});
  assert.equal(character.totalLevel,2);assert.equal(character.provenance.ruleset,'2024');assert.deepEqual(character.knownForms,[]);
});
