import type {Ability,Character,CharacterClass,CharacterRuleset} from './types.js';
import {parseCharacter} from './schema.js';

export interface PdfCharacterDraft {
  name:string;species:string;classes:CharacterClass[];abilities:Partial<Record<Ability,number>>;
  hp:{current?:number;max?:number};ac?:number;speed?:number;ruleset:CharacterRuleset;
  warnings:string[];method:'embedded text'|'OCR';rawText:string;
}

const ABILITIES:Record<Ability,string[]>={str:['str','strength'],dex:['dex','dexterity'],con:['con','constitution'],int:['int','intelligence'],wis:['wis','wisdom'],cha:['cha','charisma']};
const classNames=['Artificer','Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'];
const clean=(value:string)=>value.replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
const first=(text:string,patterns:RegExp[])=>{for(const pattern of patterns){const value=text.match(pattern)?.[1]?.trim();if(value)return value;}return ''};
const bounded=(value:string|undefined,min:number,max:number)=>{const number=Number(value);return Number.isFinite(number)&&number>=min&&number<=max?Math.trunc(number):undefined};

export function parseClassLines(value:string):CharacterClass[]{
  const result:CharacterClass[]=[];
  for(const raw of value.split(/[\n;/|]+/).map(line=>line.trim()).filter(Boolean)){
    const match=raw.match(/^(.+?)\s+(\d{1,2})(?:\s*(?:[-–—,:]|subclass\s*)\s*(.+))?$/i);if(!match)throw new Error(`Could not read class line “${raw}”. Use “Druid 5 — Circle of the Moon”.`);
    const level=bounded(match[2],1,20);if(!level)throw new Error(`Class level in “${raw}” must be 1–20.`);
    const typed=(match[1]??'').trim();const name=classNames.find(candidate=>candidate.toLowerCase()===typed.toLowerCase())??typed;
    result.push({name,level,subclass:match[3]?.trim()||null});
  }
  if(!result.length)throw new Error('Enter at least one class and level.');
  return result;
}

function detectClasses(text:string){
  const area=first(text,[/(?:class(?:es)?(?:\s*&\s*level)?|class level)\s*[:\-]?\s*([^\n]{3,180})/i]);
  const result:CharacterClass[]=[];const source=area||text;
  for(const name of classNames){const match=source.match(new RegExp(`\\b${name}\\b\\s*(?:level\\s*)?(\\d{1,2})(?:\\s*[-–—,:]\\s*([^\\n/;|]{3,80}))?`,'i'));const level=bounded(match?.[1],1,20);if(level)result.push({name,level,subclass:match?.[2]?.trim()||null});}
  return result;
}

export function parsePdfCharacterText(input:string,method:'embedded text'|'OCR'='embedded text'):PdfCharacterDraft{
  const text=clean(input);const abilities:Partial<Record<Ability,number>>={};
  for(const [key,names] of Object.entries(ABILITIES) as [Ability,string[]][]){
    const label=names.join('|');const match=text.match(new RegExp(`(?:^|\\b)(?:${label})\\s*[:=]?\\s*(\\d{1,2})(?:\\s*\\([+−-]?\\d+\\))?`,'im'));const value=bounded(match?.[1],1,30);if(value)abilities[key]=value;
  }
  const hpPair=text.match(/(?:hit\s*points?|hp)\s*[:=]?\s*(\d{1,4})\s*\/\s*(\d{1,4})/i);
  const maxHp=bounded(hpPair?.[2]??first(text,[/(?:hit point maximum|max(?:imum)?\s*hp)\s*[:=]?\s*(\d{1,4})/i]),1,9999);
  const currentHp=bounded(hpPair?.[1]??first(text,[/(?:current\s*(?:hit points?|hp))\s*[:=]?\s*(\d{1,4})/i]),0,9999)??maxHp;
  const ruleset:CharacterRuleset=/\b(?:2024|5\.2\.1)\b/i.test(text)?'2024':/\b(?:2014|legacy)\b/i.test(text)?'legacy':'unknown';
  const draft:PdfCharacterDraft={
    name:first(text,[/(?:character\s*name|name)\s*[:=]?\s*([^\n]{2,80})/i]),
    species:first(text,[/(?:species|race)\s*[:=]?\s*([^\n]{2,80})/i]),classes:detectClasses(text),abilities,
    hp:{...(currentHp!==undefined?{current:currentHp}:{}),...(maxHp!==undefined?{max:maxHp}:{})},
    ...(()=>{const ac=bounded(first(text,[/(?:armor\s*class|\bAC)\s*[:=]?\s*(\d{1,2})/i]),1,40);return ac===undefined?{}:{ac};})(),
    ...(()=>{const speed=bounded(first(text,[/(?:walking\s*)?speed\s*[:=]?\s*(\d{1,3})\s*(?:ft\.?|feet)?/i]),0,200);return speed===undefined?{}:{speed};})(),ruleset,warnings:[],method,rawText:text,
  };
  if(!draft.name)draft.warnings.push('Character name was not detected.');if(!draft.species)draft.warnings.push('Species was not detected.');if(!draft.classes.length)draft.warnings.push('Class and level were not detected.');
  for(const [ability] of Object.entries(ABILITIES) as [Ability,string[]][])if(draft.abilities[ability]===undefined)draft.warnings.push(`${ability.toUpperCase()} score was not detected.`);
  if(draft.hp.max===undefined)draft.warnings.push('Maximum HP was not detected.');if(draft.ac===undefined)draft.warnings.push('Armor Class was not detected.');if(draft.speed===undefined)draft.warnings.push('Speed was not detected.');
  if(draft.ruleset!=='2024')draft.warnings.push('2024 rules could not be confirmed from this PDF. Select the correct rules version after checking the sheet.');
  draft.warnings.push('PDF text can omit or misread spells, features, items, proficiencies, and transformations. Link a public D&D Beyond sheet or add reviewed private mechanics for full automation.');
  return draft;
}

export interface PdfReviewValues {name:string;species:string;classLines:string;abilities:Record<Ability,number>;hp:{current:number;max:number};ac:number;speed:number;ruleset:CharacterRuleset}
export function characterFromPdfReview(values:PdfReviewValues):Character{
  const classes=parseClassLines(values.classLines);const totalLevel=classes.reduce((total,entry)=>total+entry.level,0);
  return parseCharacter({schemaVersion:1,id:`pdf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,name:values.name,species:values.species,creatureType:'Humanoid',size:'Medium',totalLevel,classes,abilities:values.abilities,hp:values.hp,ac:values.ac,speed:values.speed,proficiencies:{saves:{},skills:{}},knownForms:[],seenForms:[],spells:[],spellSlots:{},feats:[],features:[],resources:[],equipment:{armorCategory:'none',shield:false,transformBehavior:'merge'},items:[],provenance:{provider:'local',ruleset:values.ruleset,rulesetEvidence:['User-reviewed PDF/OCR import'],reviewRequired:values.ruleset!=='2024'},customForms:{}});
}
