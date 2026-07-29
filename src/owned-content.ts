import type {
  Character,OwnedContentApplyResult,OwnedContentMatch,OwnedContentPack,OwnedContentPackContent,
  OwnedContentPackMetadata,ResourcePool,Spell,TransformationGrant,ImportedFeatureRule,Creature
} from './types.js';
import {parseCharacter} from './schema.js';
import {CREATURES} from './content-registry.js';

const isObject=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const text=(value:unknown,path:string,max=240)=>{
  if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`${path} must be non-empty text under ${max} characters.`);
  return value.trim();
};
const optionalText=(value:unknown,max:number)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):undefined;
const PACK_ID=/^[a-z0-9][a-z0-9._-]{0,119}$/i;

function parseMatch(value:unknown,index:number):OwnedContentMatch{
  if(!isObject(value))throw new Error(`appliesTo[${index}] must be an object.`);
  const match:OwnedContentMatch={};
  if(value.characterId!==undefined)match.characterId=text(value.characterId,`appliesTo[${index}].characterId`,120);
  if(value.className!==undefined)match.className=text(value.className,`appliesTo[${index}].className`,80);
  if(value.subclass!==undefined)match.subclass=text(value.subclass,`appliesTo[${index}].subclass`,120);
  if(value.species!==undefined)match.species=text(value.species,`appliesTo[${index}].species`,80);
  if(value.minimumClassLevel!==undefined){if(typeof value.minimumClassLevel!=='number'||!Number.isInteger(value.minimumClassLevel)||value.minimumClassLevel<1||value.minimumClassLevel>20)throw new Error(`appliesTo[${index}].minimumClassLevel must be an integer from 1 to 20.`);match.minimumClassLevel=value.minimumClassLevel;}
  if(value.maximumClassLevel!==undefined){if(typeof value.maximumClassLevel!=='number'||!Number.isInteger(value.maximumClassLevel)||value.maximumClassLevel<1||value.maximumClassLevel>20)throw new Error(`appliesTo[${index}].maximumClassLevel must be an integer from 1 to 20.`);match.maximumClassLevel=value.maximumClassLevel;}
  if(match.minimumClassLevel&&match.maximumClassLevel&&match.minimumClassLevel>match.maximumClassLevel)throw new Error(`appliesTo[${index}] has a minimum class level above its maximum.`);
  return match;
}

function validationCharacter(contentRaw:Record<string,unknown>):Character{
  return parseCharacter({
    schemaVersion:1,id:'owned-content-validation',name:'Owned Content Validation',species:'Human',
    classes:[{name:'Fighter',level:20,subclass:null}],totalLevel:20,
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},hp:{current:100,max:100},ac:10,speed:30,
    proficiencies:{saves:{},skills:{}},knownForms:[],seenForms:[],spellSlots:{},feats:[],equipment:{armorCategory:'none',shield:false,transformBehavior:'merge'},
    customForms:Array.isArray(contentRaw.customForms)?contentRaw.customForms:[],
    transformationGrants:Array.isArray(contentRaw.transformationGrants)?contentRaw.transformationGrants:[],
    features:Array.isArray(contentRaw.features)?contentRaw.features:[],
    resources:Array.isArray(contentRaw.resources)?contentRaw.resources:[],
    spells:Array.isArray(contentRaw.spells)?contentRaw.spells:[]
  });
}

export function parseOwnedContentPack(input:unknown):OwnedContentPack{
  if(!isObject(input))throw new Error('Owned-content pack must contain one JSON object.');
  if(input.kind!=='altered-owned-content-pack')throw new Error('This is not an Altered owned-content pack.');
  if(input.schemaVersion!==1)throw new Error('Only owned-content pack schemaVersion 1 is supported.');
  if(!isObject(input.metadata))throw new Error('metadata must be an object.');
  const id=text(input.metadata.id,'metadata.id',120);if(!PACK_ID.test(id))throw new Error('metadata.id may contain only letters, numbers, periods, underscores, and hyphens.');
  if(input.metadata.privateUse!==true)throw new Error('metadata.privateUse must be true. Paid or personal content packs are local private-use data.');
  const metadata:OwnedContentPackMetadata={
    id,name:text(input.metadata.name,'metadata.name',160),version:text(input.metadata.version,'metadata.version',40),
    source:text(input.metadata.source,'metadata.source',200),privateUse:true
  };
  const description=optionalText(input.metadata.description,500);if(description)metadata.description=description;
  const createdAt=optionalText(input.metadata.createdAt,40);if(createdAt)metadata.createdAt=createdAt;
  if(!Array.isArray(input.appliesTo)||input.appliesTo.length===0||input.appliesTo.length>50)throw new Error('appliesTo must contain 1 to 50 matching rules. Use an empty object to apply to every character.');
  const appliesTo=input.appliesTo.map(parseMatch);
  if(!isObject(input.content))throw new Error('content must be an object.');
  const checked=validationCharacter(input.content);
  const requestedResourceIds=new Set((Array.isArray(input.content.resources)?input.content.resources:[]).filter(isObject).map(entry=>typeof entry.id==='string'?entry.id:''));
  const forms=Object.values(checked.customForms);const availableFormIds=new Set([...Object.keys(CREATURES),...forms.map(form=>form.id)]);
  const formIds=(value:unknown,path:string)=>{if(value==null)return [];if(!Array.isArray(value))throw new Error(`${path} must be an array.`);return [...new Set(value.map((entry,index)=>{if(typeof entry!=='string'||!entry.trim())throw new Error(`${path}[${index}] must be a form id.`);const id=entry.trim();if(!availableFormIds.has(id))throw new Error(`${path}[${index}] references a form not present in the SRD or this pack: ${id}.`);return id;}))].slice(0,500);};
  const content:OwnedContentPackContent={
    customForms:forms,
    knownForms:formIds(input.content.knownForms,'content.knownForms'),
    seenForms:formIds(input.content.seenForms,'content.seenForms'),
    transformationGrants:checked.transformationGrants??[],
    features:checked.features,
    resources:checked.resources.filter(resource=>requestedResourceIds.has(resource.id)),
    spells:checked.spells
  };
  const count=content.customForms.length+content.knownForms.length+content.seenForms.length+content.transformationGrants.length+content.features.length+content.resources.length+content.spells.length;
  if(count===0)throw new Error('The pack does not contain any forms, known/seen form references, transformations, features, resources, or spells.');
  return {schemaVersion:1,kind:'altered-owned-content-pack',metadata,appliesTo,content};
}

export function safeOwnedContentParse(raw:string):OwnedContentPack{
  if(raw.length>2_000_000)throw new Error('Owned-content pack exceeds the 2 MB safety limit.');
  return parseOwnedContentPack(JSON.parse(raw));
}

export function matchesOwnedContentPack(character:Character,pack:OwnedContentPack):boolean{
  return pack.appliesTo.some(rule=>{
    if(rule.characterId&&rule.characterId!==character.id)return false;
    if(rule.species&&rule.species.toLowerCase()!==character.species.toLowerCase())return false;
    if(rule.className||rule.subclass||rule.minimumClassLevel||rule.maximumClassLevel){
      const matchingClass=character.classes.find(entry=>{
        if(rule.className&&entry.name.toLowerCase()!==rule.className.toLowerCase())return false;
        if(rule.subclass&&(entry.subclass??'').toLowerCase()!==rule.subclass.toLowerCase())return false;
        if(rule.minimumClassLevel&&entry.level<rule.minimumClassLevel)return false;
        if(rule.maximumClassLevel&&entry.level>rule.maximumClassLevel)return false;
        return true;
      });
      if(!matchingClass)return false;
    }
    return true;
  });
}

const keyed=<T>(values:T[],key:(value:T)=>string)=>new Map(values.map(value=>[key(value),value]));
const spellKey=(spell:Spell)=>`${spell.id??spell.name.toLowerCase()}::${spell.sourceClass.toLowerCase()}`;

function mergeKnownForms(character:Character,forms:Record<string,Creature>,incoming:string[]){
  const druid=character.classes.find(entry=>entry.name.toLowerCase()==='druid');
  const limit=!druid||druid.level<2?0:druid.level>=8?8:druid.level>=4?6:4;
  const moon=Boolean(druid&&druid.level>=3&&(druid.subclass??'').toLowerCase()==='circle of the moon');
  const maxCr=!druid?0:moon?Math.floor(druid.level/3):druid.level>=8?1:druid.level>=4?.5:.25;
  const fly=Boolean(druid&&druid.level>=8);const merged=[...character.knownForms];const skipped:string[]=[];
  for(const id of incoming){
    if(merged.includes(id))continue;const form=forms[id]??CREATURES[id];
    if(!druid||!form||form.type.toLowerCase()!=='beast'||form.cr>maxCr||Boolean(form.speeds.fly)&&!fly||merged.length>=limit){skipped.push(id);continue;}
    merged.push(id);
  }
  return {knownForms:merged,skipped};
}

export function applyOwnedContentPack(character:Character,pack:OwnedContentPack):OwnedContentApplyResult{
  if(!matchesOwnedContentPack(character,pack))return {character,applied:false,added:{forms:0,knownForms:0,seenForms:0,transformations:0,features:0,resources:0,spells:0},notes:[`${pack.metadata.name} does not match this character.`]};
  const forms:Record<string,Creature>={...character.customForms};
  let formAdds=0;for(const form of pack.content.customForms){if(!(form.id in forms))formAdds++;forms[form.id]=form;}
  const knownMerge=mergeKnownForms(character,forms,pack.content.knownForms);const knownForms=knownMerge.knownForms;const knownFormAdds=knownForms.length-character.knownForms.length;
  const seenForms=[...new Set([...character.seenForms,...pack.content.seenForms,...pack.content.knownForms])];const seenFormAdds=seenForms.length-character.seenForms.length;
  const grants=keyed(character.transformationGrants??[],grant=>grant.id);let grantAdds=0;for(const grant of pack.content.transformationGrants){if(!grants.has(grant.id))grantAdds++;grants.set(grant.id,grant);}
  const features=keyed(character.features,feature=>feature.id);let featureAdds=0;for(const feature of pack.content.features){if(!features.has(feature.id))featureAdds++;features.set(feature.id,feature);}
  const resources=keyed(character.resources,resource=>resource.id);let resourceAdds=0;for(const resource of pack.content.resources){const existing=resources.get(resource.id);if(!existing)resourceAdds++;resources.set(resource.id,{...resource,current:existing?Math.min(existing.current,resource.max):resource.current});}
  const spells=keyed(character.spells,spellKey);let spellAdds=0;for(const spell of pack.content.spells){const key=spellKey(spell);if(!spells.has(key))spellAdds++;spells.set(key,spell);}
  const merged=parseCharacter({...character,customForms:Object.values(forms),knownForms,seenForms,transformationGrants:[...grants.values()],features:[...features.values()],resources:[...resources.values()],spells:[...spells.values()]});
  return {
    character:merged,applied:true,
    added:{forms:formAdds,knownForms:knownFormAdds,seenForms:seenFormAdds,transformations:grantAdds,features:featureAdds,resources:resourceAdds,spells:spellAdds},
    notes:[`${pack.metadata.name} v${pack.metadata.version} applied from private local content.`,...(knownMerge.skipped.length?[`${knownMerge.skipped.length} known-form addition(s) were kept in the private library but not added to this character because of Wild Shape level, creature, flight, CR, or known-form limits.`]:[])]
  };
}

export function applyOwnedContentPacks(character:Character,packs:OwnedContentPack[]):OwnedContentApplyResult{
  let current=character;let applied=false;const notes:string[]=[];const added={forms:0,knownForms:0,seenForms:0,transformations:0,features:0,resources:0,spells:0};
  for(const pack of packs){const result=applyOwnedContentPack(current,pack);if(!result.applied)continue;current=result.character;applied=true;notes.push(...result.notes);for(const key of Object.keys(added) as (keyof typeof added)[])added[key]+=result.added[key];}
  return {character:current,applied,added,notes};
}

export function ownedContentTemplate(character?:Character):OwnedContentPack{
  const match:OwnedContentMatch=character?{characterId:character.id}:{};
  return {
    schemaVersion:1,kind:'altered-owned-content-pack',
    metadata:{id:'my-private-transformation-pack',name:'My Private Transformation Pack',version:'1.0.0',source:'Content I own',description:'Private local mechanics used by Altered. Do not redistribute copyrighted text or artwork.',privateUse:true,createdAt:new Date().toISOString()},
    appliesTo:[match],
    content:{
      customForms:[],knownForms:[],seenForms:[],
      transformationGrants:[{
        id:'example-transformation',label:'Example Transformation',profile:'overlay',formIds:[],source:'Content I own',actionCost:'bonus',endActionCost:'bonus',duration:'10 minutes',
        effects:{size:'Large',creatureType:'Humanoid',abilityMinimum:{str:18},speedBonus:{walk:10},resistances:['Necrotic'],canSpeak:true,canCast:true,canConcentrate:true}
      }],
      features:[],resources:[],spells:[]
    }
  };
}
