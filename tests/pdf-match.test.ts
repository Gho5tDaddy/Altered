import test from 'node:test';
import assert from 'node:assert/strict';
import {findPdfRuleEntry,type PdfTextItem} from '../src/pdf-match';

const items=(...lines:string[]):PdfTextItem[]=>lines.map(str=>({str,hasEOL:true}));

test('rejects names that only occur in an index or option list',()=>{
  assert.equal(findPdfRuleEntry(items('FEATS','Athlete, Durable, Grappler, Sentinel, Shield Master, Tavern Brawler, Tough','CHAPTER 2'),'Sentinel','Feat'),'');
  assert.equal(findPdfRuleEntry(items('Absorb Elements','Alarm Catapult Cure Wounds Detect Magic Disguise Self Faerie Fire False Life Feather Fall Grease Identify Jump Longstrider'),'Absorb Elements','Spell'),'');
});

test('accepts a standalone heading followed by substantive mechanics',()=>{
  const summary=findPdfRuleEntry(items('Sentinel','Immediately after a creature within 5 feet of you takes the Disengage action or hits a target other than you with an attack, you can make an Opportunity Attack against that creature.','When you hit a creature with an Opportunity Attack, the creature has disadvantage on its movement until the end of the current turn.'),'Sentinel','Feat');
  assert.match(summary,/Opportunity Attack/);
});

test('requires spell-definition fields for a spell match',()=>{
  const summary=findPdfRuleEntry(items('Absorb Elements','Casting Time: Reaction','Range: Self','Components: S','Duration: 1 round','When you take acid, cold, fire, lightning, or thunder damage, you can use your reaction to gain resistance until the start of your next turn.'),'Absorb Elements','Spell');
  assert.match(summary,/Casting Time/);
});
