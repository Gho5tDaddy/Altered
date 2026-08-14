import type {Character,OwnedContentPack} from './types.js';
import {matchesOwnedContentPack,parseOwnedContentPack} from './owned-content.js';

export interface AssistantNeed {
  id:string;
  name:string;
  kind:string;
  detail:string;
}

export interface AssistantVerification {
  claim:string;
  sourceType:'official-2024'|'srd-5.2.1'|'user-owned';
  url?:string;
  note:string;
}

function fencedJson(raw:string){
  const trimmed=raw.trim();
  const match=trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]??trimmed;
}

export function parseAssistantProposal(raw:string,character:Character):OwnedContentPack{
  if(raw.length>2_000_000)throw new Error('ChatGPT proposal exceeds the 2 MB safety limit.');
  let value:unknown;
  try{value=JSON.parse(fencedJson(raw));}catch{throw new Error('ChatGPT proposal must be one JSON object, without extra explanation.');}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('ChatGPT proposal must be one JSON object.');
  const envelope=value as {verification?:unknown;pack?:unknown};
  if(!Array.isArray(envelope.verification)||envelope.verification.length===0)throw new Error('ChatGPT proposal is missing its 2024 verification record.');
  for(const [index,entry] of envelope.verification.entries()){
    if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error(`verification[${index}] must be an object.`);
    const item=entry as Partial<AssistantVerification>;if(typeof item.claim!=='string'||!item.claim.trim()||typeof item.note!=='string'||!item.note.trim())throw new Error(`verification[${index}] needs a claim and short note.`);
    if(!['official-2024','srd-5.2.1','user-owned'].includes(item.sourceType??''))throw new Error(`verification[${index}] has an unsupported source type.`);
    if(item.sourceType!=='user-owned'){
      let url:URL;try{url=new URL(item.url??'');}catch{throw new Error(`verification[${index}] needs a valid HTTPS source URL.`);}if(url.protocol!=='https:')throw new Error(`verification[${index}] needs a valid HTTPS source URL.`);
      const host=url.hostname.toLowerCase();const official=host==='dndbeyond.com'||host.endsWith('.dndbeyond.com')||host==='wizards.com'||host.endsWith('.wizards.com');const srd=host==='open5e.com'||host.endsWith('.open5e.com');
      if(item.sourceType==='official-2024'&&!official)throw new Error(`verification[${index}] must use an official D&D Beyond or Wizards source.`);
      if(item.sourceType==='srd-5.2.1'&&!srd&&!official)throw new Error(`verification[${index}] must use the SRD 5.2.1 catalog or an official source.`);
      if(!/2024|5\.2\.1/i.test(item.note))throw new Error(`verification[${index}] must state the checked 2024 or SRD 5.2.1 version.`);
    }
  }
  const pack=parseOwnedContentPack(envelope.pack);
  if(!pack.appliesTo.some(match=>match.characterId===character.id))throw new Error(`This proposal is not locked to ${character.name}. Ask ChatGPT to use characterId "${character.id}".`);
  if(!matchesOwnedContentPack(character,pack))throw new Error(`This proposal does not match ${character.name}'s current class, subclass, species, or level.`);
  return pack;
}

export function assistantRequestText(character:Character,source:string,needs:AssistantNeed[]){
  const request={
    task:'Help Altered complete only the unresolved 2024 D&D 5e mechanics that apply to this character. Return one JSON object only.',
    privacy:'Use only a source the user owns or an excerpt they provide. Do not reproduce book prose. Summarize only mechanics needed during play.',
    authority:'You are proposing data for review. Altered remains the rules engine and validates everything before installation.',
    ruleset:'D&D 5e 2024 only. Reject 2014, legacy, mixed, unofficial wiki, forum, and unsourced rules.',
    source,
    character:{
      id:character.id,name:character.name,species:character.species,totalLevel:character.totalLevel,
      classes:character.classes,abilities:character.abilities,knownForms:character.knownForms,
      existingFeatures:character.features.map(feature=>feature.name),
      existingSpells:character.spells.map(spell=>spell.name),
      equippedItems:character.items.filter(item=>item.equipped).map(item=>item.name)
    },
    unresolvedNeeds:needs,
    requiredBehavior:[
      'Include only options this exact character owns and can use at its current class/subclass/species level.',
      'Include applicable features, spells, equipped-item mechanics, transformations, enhancements, and form stat blocks when the supplied source supports them.',
      'Use appliesTo with this exact characterId. Add class/subclass/species and level gates when relevant.',
      'Do not duplicate imported AC, HP, ability scores, saves, or item bonuses already represented in the character snapshot.',
      'For a replacement form, include a customForms entry and a transformationGrants entry that references it.',
      'For an enhancement that keeps the current body, use an overlay transformation grant.',
      'If the source is ambiguous, omit that mechanic instead of guessing.'
      ,'Cross-check every publicly verifiable rule against an official 2024 source or SRD 5.2.1 and include its HTTPS URL. Never use a wiki, forum, search snippet, or fan summary as authority.'
      ,'For a paid mechanic that has no public official text, mark it user-owned and verify it only from the excerpt or document the user supplied.'
      ,'When a name exists in both 2014 and 2024 rules, compare activation, prerequisites, level, duration, action economy, dice, and effects; use only the confirmed 2024 version.'
      ,'If sources conflict, prefer the official 2024 rules over summaries. Do not merge wording or mechanics across editions.'
    ],
    outputContract:{
      verification:[{claim:'One concise claim per mechanic',sourceType:'official-2024 | srd-5.2.1 | user-owned',url:'Required HTTPS URL for public official/SRD sources; omit for user-owned',note:'Short comparison result; no copied prose'}],
      pack:{
        schemaVersion:1,kind:'altered-owned-content-pack',
        metadata:{id:'chatgpt-assisted-unique-id',name:`${character.name} — reviewed private mechanics`,version:'1.0.0',source,description:'Short mechanical summaries proposed by ChatGPT and reviewed by the user.',privateUse:true,createdAt:'ISO-8601 timestamp'},
        appliesTo:[{characterId:character.id}],
        content:{customForms:[],knownForms:[],seenForms:[],transformationGrants:[],features:[],resources:[],spells:[]}
      }
    }
  };
  return `I am using Altered, a deterministic D&D 5e 2024 character and transformation dashboard. I will attach or quote a source I own. Analyze only the entries listed in unresolvedNeeds. Fill the outputContract arrays using concise mechanical summaries and return the completed JSON object only.\n\n${JSON.stringify(request,null,2)}`;
}
