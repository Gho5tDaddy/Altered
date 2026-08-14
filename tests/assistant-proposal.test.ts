import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantRequestText,parseAssistantProposal} from '../src/assistant-proposal.js';
import {parseCharacter} from '../src/schema.js';
import {SAMPLE_CHARACTERS} from '../src/sample-data.js';

const character=parseCharacter(SAMPLE_CHARACTERS[0]);
const proposal=(characterId=character.id)=>({verification:[{claim:'Activation and effect verified from owned source',sourceType:'user-owned',note:'Matches the user-provided 2024 excerpt.'}],pack:{
  schemaVersion:1,kind:'altered-owned-content-pack',metadata:{id:'assistant-moon',name:'Assistant Moon',version:'1.0.0',source:'Private PDF — user reviewed',privateUse:true},
  appliesTo:[{characterId}],content:{customForms:[],knownForms:[],seenForms:[],transformationGrants:[{id:'assistant-overlay',label:'Assistant Overlay',profile:'overlay',formIds:[],source:'Private PDF — user reviewed',actionCost:'bonus',effects:{speedBonus:{walk:10}}}],features:[],resources:[],spells:[]}
}
});

test('assistant request is character-scoped and explicitly covers forms and enhancements',()=>{
  const text=assistantRequestText(character,'Private PDF: owned.pdf',[{id:'need',name:'Owned Feature',kind:'Subclass',detail:'Needs review'}]);
  assert.match(text,new RegExp(character.id));assert.match(text,/transformations, enhancements, and form/i);assert.match(text,/current class\/subclass\/species level/i);assert.match(text,/JSON object only/i);
});

test('assistant proposal accepts fenced JSON but requires the exact character',()=>{
  const pack=parseAssistantProposal(`\`\`\`json\n${JSON.stringify(proposal())}\n\`\`\``,character);
  assert.equal(pack.appliesTo[0]?.characterId,character.id);
  assert.throws(()=>parseAssistantProposal(JSON.stringify(proposal('someone-else')),character),/not locked/);
});

test('assistant proposal remains subject to the owned-content schema',()=>{
  const malformed=proposal();malformed.pack.content={customForms:[],knownForms:[],seenForms:[],transformationGrants:[],features:[],resources:[],spells:[]};
  assert.throws(()=>parseAssistantProposal(JSON.stringify(malformed),character),/does not contain any/);
});

test('assistant proposal requires verification and HTTPS for public sources',()=>{
  const missing={pack:proposal().pack};assert.throws(()=>parseAssistantProposal(JSON.stringify(missing),character),/verification record/);
  const unsafe:Record<string,unknown>=proposal();unsafe.verification=[{claim:'Public rule',sourceType:'official-2024',note:'Checked',url:'http://example.com'}];
  assert.throws(()=>parseAssistantProposal(JSON.stringify(unsafe),character),/HTTPS/);
  const wiki:Record<string,unknown>=proposal();wiki.verification=[{claim:'Public rule',sourceType:'official-2024',note:'Checked against 2024 rules.',url:'https://example.com/rule'}];
  assert.throws(()=>parseAssistantProposal(JSON.stringify(wiki),character),/official D&D Beyond or Wizards/);
});
