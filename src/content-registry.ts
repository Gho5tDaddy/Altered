import type {
  CatalogEntry,ConditionDefinition,ContentDomain,ContentPack,ContentPackMetadata,
  ContentRegistrySnapshot,Creature,ImportedFeatureRule,TransformationProfileDefinition
} from './types.js';
import {
  CLASS_FEATURES as RAW_CLASS_FEATURES,CREATURES as RAW_CREATURES,MOON_FORM_SPELL_LEVELS,SUBCLASS_FEATURES as RAW_SUBCLASS_FEATURES,
  RULES_VERSION,SKILL_ABILITIES,SPECIES_FEATURES as RAW_SPECIES_FEATURES,classLevel,subclass
} from './rules-data.js';

const metadata=(value:ContentPackMetadata)=>Object.freeze(value);
const records=<T>(value:Record<string,T>)=>Object.freeze({...value});
const featureRecord=(source:Record<string,ImportedFeatureRule[]>)=>{
  const out:Record<string,ImportedFeatureRule>={};
  for(const [group,features] of Object.entries(source))for(const feature of features){
    const key=`${group.toLowerCase().replaceAll(/[^a-z0-9]+/g,'-')}:${feature.id}`;
    if(out[key])throw new Error(`Duplicate feature record ${key}.`);
    out[key]=Object.freeze({...feature});
  }
  return records(out);
};

export const CONDITIONS:Record<string,ConditionDefinition>=records({
  Blinded:{id:'blinded',name:'Blinded',summary:'Cannot see. Attack rolls are hindered and attacks against the creature are helped.',tags:['sense','attack'],attackAdvantageAgainst:true,attackDisadvantage:true},
  Charmed:{id:'charmed',name:'Charmed',summary:'Cannot attack the charmer and the charmer has social influence.',tags:['mental']},
  Deafened:{id:'deafened',name:'Deafened',summary:'Cannot hear and automatically fails checks that require hearing.',tags:['sense']},
  Exhaustion:{id:'exhaustion',name:'Exhaustion',summary:'Cumulative levels reduce every D20 Test by 2 and Speed by 5 feet per level. Level 6 causes death.',tags:['level','check','save','attack','movement'],cumulative:true,maximumLevel:6,d20PenaltyPerLevel:2,speedPenaltyPerLevel:5},
  Frightened:{id:'frightened',name:'Frightened',summary:'Has Disadvantage on checks and attacks while the source of fear is visible and cannot willingly move closer.',tags:['mental','attack']},
  Grappled:{id:'grappled',name:'Grappled',summary:'Speed becomes 0; attacks against a target other than the grappler have Disadvantage.',tags:['movement','attack'],speedBecomesZero:true},
  Incapacitated:{id:'incapacitated',name:'Incapacitated',summary:'Cannot take actions, Bonus Actions, or Reactions; Concentration ends.',tags:['action','concentration'],blocksActions:true,blocksBonusActions:true,blocksReactions:true,endsConcentration:true,endsWildShape:true},
  Invisible:{id:'invisible',name:'Invisible',summary:'Cannot be seen without special senses or magic.',tags:['sense','attack']},
  Paralyzed:{id:'paralyzed',name:'Paralyzed',summary:'Incapacitated, speed 0, and automatically fails Strength and Dexterity saves.',tags:['action','movement','save'],blocksActions:true,blocksBonusActions:true,blocksReactions:true,speedBecomesZero:true,endsConcentration:true,endsWildShape:true,automaticSaveFailure:['str','dex'],attackAdvantageAgainst:true},
  Petrified:{id:'petrified',name:'Petrified',summary:'Transformed into stone, Incapacitated, speed 0, and automatically fails Strength and Dexterity saves.',tags:['action','movement','save'],blocksActions:true,blocksBonusActions:true,blocksReactions:true,speedBecomesZero:true,endsConcentration:true,endsWildShape:true,automaticSaveFailure:['str','dex'],attackAdvantageAgainst:true},
  Poisoned:{id:'poisoned',name:'Poisoned',summary:'Disadvantage on attack rolls and ability checks.',tags:['attack','check'],attackDisadvantage:true,abilityCheckDisadvantage:true},
  Prone:{id:'prone',name:'Prone',summary:'Movement and attack interactions change until the creature stands.',tags:['movement','attack']},
  Restrained:{id:'restrained',name:'Restrained',summary:'Speed 0, attacks are hindered, attacks against are helped, and Dexterity saves have Disadvantage.',tags:['movement','attack','save'],speedBecomesZero:true,attackAdvantageAgainst:true,attackDisadvantage:true,saveDisadvantage:['dex']},
  Stunned:{id:'stunned',name:'Stunned',summary:'Incapacitated, speed 0, and automatically fails Strength and Dexterity saves.',tags:['action','movement','save'],blocksActions:true,blocksBonusActions:true,blocksReactions:true,speedBecomesZero:true,endsConcentration:true,endsWildShape:true,automaticSaveFailure:['str','dex'],attackAdvantageAgainst:true},
  Unconscious:{id:'unconscious',name:'Unconscious',summary:'Incapacitated, speed 0, drops held items, and automatically fails Strength and Dexterity saves.',tags:['action','movement','save'],blocksActions:true,blocksBonusActions:true,blocksReactions:true,speedBecomesZero:true,endsConcentration:true,endsWildShape:true,endsRage:true,automaticSaveFailure:['str','dex'],attackAdvantageAgainst:true}
});

export const TRANSFORMATION_PROFILES:Record<string,TransformationProfileDefinition>=records({
  base:{id:'base',name:'Base Form',summary:'The imported character sheet without a replacement transformation.',retains:{hp:true,hitDice:true,mentalAbilities:true,proficiencies:true,creatureType:true,classFeatures:true,feats:true,spellcasting:true,speech:true},usesTemporaryHp:false,equipment:'unchanged'},
  wildshape:{id:'wildshape',name:'Wild Shape',summary:'Uses the Beast stat block while retaining the statistics explicitly named by Wild Shape.',retains:{hp:true,hitDice:true,mentalAbilities:true,proficiencies:true,creatureType:true,classFeatures:true,feats:true,spellcasting:false,speech:true},usesTemporaryHp:true,equipment:'merged-or-worn'},
  polymorph:{id:'polymorph',name:'Polymorph',summary:'Uses the chosen Beast stat block under the spell’s more restrictive replacement rules.',retains:{hp:true,hitDice:true,mentalAbilities:false,proficiencies:false,creatureType:true,classFeatures:false,feats:false,spellcasting:false,speech:false},usesTemporaryHp:true,equipment:'effect-defined'},
  'true-polymorph':{id:'true-polymorph',name:'True Polymorph',summary:'Creature-to-creature mode replaces game statistics while retaining Hit Points and Hit Point Dice. Object modes remain manual.',retains:{hp:true,hitDice:true,mentalAbilities:false,proficiencies:false,creatureType:false,classFeatures:false,feats:false,spellcasting:false,speech:false},usesTemporaryHp:true,equipment:'effect-defined'},
  shapechange:{id:'shapechange',name:'Shapechange',summary:'Uses the chosen creature while retaining the statistics named by Shapechange, including creature type and Spellcasting.',retains:{hp:true,hitDice:true,mentalAbilities:true,proficiencies:true,creatureType:true,classFeatures:false,feats:false,spellcasting:true,speech:true},usesTemporaryHp:true,equipment:'effect-defined'},
  'animal-shapes':{id:'animal-shapes',name:'Animal Shapes',summary:'Uses a Large or smaller Beast of CR 4 or lower while retaining the statistics named by Animal Shapes.',retains:{hp:true,hitDice:true,mentalAbilities:true,proficiencies:false,creatureType:true,classFeatures:false,feats:false,spellcasting:false,speech:true},usesTemporaryHp:true,equipment:'effect-defined'},
  overlay:{id:'overlay',name:'Additive Transformation',summary:'Changes only the properties named by the effect and leaves the rest of the character sheet intact.',retains:{hp:true,hitDice:true,mentalAbilities:true,proficiencies:true,creatureType:true,classFeatures:true,feats:true,spellcasting:true,speech:true},usesTemporaryHp:false,equipment:'unchanged'},
  custom:{id:'custom',name:'Custom Profile',summary:'Requires an explicit imported definition. Altered does not guess replacement or retention rules.',retains:{hp:true,hitDice:true,mentalAbilities:true,proficiencies:false,creatureType:false,classFeatures:false,feats:false,spellcasting:false,speech:false},usesTemporaryHp:false,equipment:'effect-defined'}
});

const spellEntries:Record<string,CatalogEntry>={
  'starry-wisp':{id:'starry-wisp',name:'Starry Wisp',summary:'Moon-form spell reference; exact mechanics are supplied by the character or licensed rule pack.',source:'2024 character import',tags:['moon-form']},
  'cure-wounds':{id:'cure-wounds',name:'Cure Wounds',summary:'Healing spell reference used by imported characters.',source:'2024 character import',tags:['healing','moon-form']},
  moonbeam:{id:'moonbeam',name:'Moonbeam',summary:'Concentration spell reference used by imported characters.',source:'2024 character import',tags:['concentration','moon-form']},
  'conjure-animals':{id:'conjure-animals',name:'Conjure Animals',summary:'2024 spectral-pack spell reference used by imported characters.',source:'2024 character import',tags:['concentration','moon-form']},
  'fount-of-moonlight':{id:'fount-of-moonlight',name:'Fount of Moonlight',summary:'Moon-form spell reference used by imported characters.',source:'2024 character import',tags:['concentration','moon-form']},
  'mass-cure-wounds':{id:'mass-cure-wounds',name:'Mass Cure Wounds',summary:'Area healing spell reference used by imported characters.',source:'2024 character import',tags:['healing','moon-form']},
  'alter-self':{id:'alter-self',name:'Alter Self',summary:'Additive physical transformation spell with three selectable modes.',source:'SRD 5.2.1',tags:['transformation','concentration']},
  'animal-shapes':{id:'animal-shapes',name:'Animal Shapes',summary:'Group Beast replacement transformation spell.',source:'SRD 5.2.1',tags:['transformation']},
  'enlarge-reduce':{id:'enlarge-reduce',name:'Enlarge/Reduce',summary:'Size-changing overlay with Strength and attack-damage modifiers.',source:'SRD 5.2.1',tags:['transformation','concentration']},
  'gaseous-form':{id:'gaseous-form',name:'Gaseous Form',summary:'Misty cloud overlay with movement, defense, and action restrictions.',source:'SRD 5.2.1',tags:['transformation','concentration']},
  polymorph:{id:'polymorph',name:'Polymorph',summary:'Replacement transformation spell profile.',source:'SRD 5.2.1',tags:['transformation','concentration']},
  'true-polymorph':{id:'true-polymorph',name:'True Polymorph',summary:'Creature-to-creature replacement transformation profile.',source:'SRD 5.2.1',tags:['transformation','concentration']},
  shapechange:{id:'shapechange',name:'Shapechange',summary:'High-level replacement transformation spell profile.',source:'2024 character import',tags:['transformation','concentration']}
};

const featEntries:Record<string,CatalogEntry>={
  'war-caster':{id:'war-caster',name:'War Caster',summary:'Recognized by Altered for Concentration-save Advantage when present on the imported sheet.',source:'2024 character import',tags:['concentration']}
};

const itemEntries:Record<string,CatalogEntry>={};

const PACK_VERSION='0.27.0';
const PACKS=[
  {metadata:metadata({id:'altered-srd-creatures',name:'SRD 5.2.1 Creature Forms',version:PACK_VERSION,ruleset:RULES_VERSION.label,domain:'creatures',priority:100,license:'CC BY 4.0 source data; original Altered presentation',source:'Official SRD 5.2.1',verified:RULES_VERSION.reviewed,builtIn:true,description:'Verified creature stat blocks available to bundled transformations.'}),records:records(RAW_CREATURES)},
  {metadata:metadata({id:'altered-core-class-features',name:'Core Class and Subclass Interaction Rules',version:PACK_VERSION,ruleset:RULES_VERSION.label,domain:'class-features',priority:100,license:'CC BY 4.0 mechanical summaries authored for Altered',source:'Official SRD 5.2.1',verified:RULES_VERSION.reviewed,builtIn:true,description:'Structured transformation-relevant mechanics for the twelve SRD classes and their SRD subclasses; additional owned subclasses can be supplied by private packs.'}),records:featureRecord({...RAW_CLASS_FEATURES,...Object.fromEntries(Object.entries(RAW_SUBCLASS_FEATURES).map(([name,features])=>[`Subclass ${name}`,features]))})},
  {metadata:metadata({id:'altered-core-species-features',name:'Core Species Interaction Rules',version:PACK_VERSION,ruleset:RULES_VERSION.label,domain:'species-features',priority:100,license:'CC BY 4.0 mechanical summaries authored for Altered',source:'Official SRD 5.2.1',verified:RULES_VERSION.reviewed,builtIn:true,description:'Structured transformation-relevant mechanics for SRD species.'}),records:featureRecord(RAW_SPECIES_FEATURES)},
  {metadata:metadata({id:'altered-core-feat-hooks',name:'Recognized Feat Hooks',version:PACK_VERSION,ruleset:RULES_VERSION.label,domain:'feats',priority:100,license:'Altered schema and transformation logic',source:'Validated character import hooks',verified:RULES_VERSION.reviewed,builtIn:true,description:'Minimal feat identifiers currently evaluated by the rules engine.'}),records:records(featEntries)},
  {metadata:metadata({id:'altered-spell-hooks',name:'Transformation Spell Hooks',version:PACK_VERSION,ruleset:RULES_VERSION.label,domain:'spells',priority:100,license:'CC BY 4.0 mechanical summaries; validated import hooks',source:'Official SRD 5.2.1 and character imports',verified:RULES_VERSION.reviewed,builtIn:true,description:'Spell identifiers used by the engine; relevant SRD data is available from the support catalog and owned content can be supplied by private packs.'}),records:records(spellEntries)},
  {metadata:metadata({id:'altered-item-hooks',name:'Item Rule Hooks',version:PACK_VERSION,ruleset:RULES_VERSION.label,domain:'items',priority:100,license:'Altered schema',source:'Validated character imports',verified:RULES_VERSION.reviewed,builtIn:true,description:'Imported item provenance and numeric-total integration without redistributing owned descriptive text.'}),records:records(itemEntries)},
  {metadata:metadata({id:'altered-core-conditions',name:'Core Conditions',version:PACK_VERSION,ruleset:RULES_VERSION.label,domain:'conditions',priority:100,license:'CC BY 4.0 mechanical summaries authored for Altered',source:'Official SRD 5.2.1',verified:RULES_VERSION.reviewed,builtIn:true,description:'Condition records used by combat-state evaluation.'}),records:CONDITIONS},
  {metadata:metadata({id:'altered-transformation-profiles',name:'Transformation Profiles',version:PACK_VERSION,ruleset:RULES_VERSION.label,domain:'transformation-profiles',priority:100,license:'CC BY 4.0 mechanical summaries authored for Altered',source:'Official SRD 5.2.1',verified:RULES_VERSION.reviewed,builtIn:true,description:'Replacement and retention policies for supported SRD transformations; private packs can add owned-content mechanics.'}),records:TRANSFORMATION_PROFILES}
] satisfies ContentPack<unknown>[];

function validatePacks(packs:readonly ContentPack<unknown>[]):void{
  const ids=new Set<string>();
  for(const pack of packs){
    if(ids.has(pack.metadata.id))throw new Error(`Duplicate content pack id: ${pack.metadata.id}`);ids.add(pack.metadata.id);
    if(!pack.metadata.version||!pack.metadata.ruleset||!pack.metadata.verified)throw new Error(`Incomplete content pack metadata: ${pack.metadata.id}`);
    for(const [id,record] of Object.entries(pack.records)){if(!id.trim()||record==null)throw new Error(`Invalid record in ${pack.metadata.id}.`);}
  }
}
validatePacks(PACKS);

export const CONTENT_PACKS=Object.freeze(PACKS);
export const CREATURES:Record<string,Creature>=RAW_CREATURES;
export const CLASS_FEATURES=RAW_CLASS_FEATURES;
export const SUBCLASS_FEATURES=RAW_SUBCLASS_FEATURES;
export const SPECIES_FEATURES=RAW_SPECIES_FEATURES;
export {MOON_FORM_SPELL_LEVELS,RULES_VERSION,SKILL_ABILITIES,classLevel,subclass};

export function contentRegistrySnapshot():ContentRegistrySnapshot{
  const domains:ContentDomain[]=['creatures','class-features','species-features','feats','spells','items','conditions','transformation-profiles'];
  const counts=Object.fromEntries(domains.map(domain=>[domain,CONTENT_PACKS.filter(pack=>pack.metadata.domain===domain).reduce((total,pack)=>total+Object.keys(pack.records).length,0)])) as Record<ContentDomain,number>;
  return {packs:CONTENT_PACKS.map(pack=>pack.metadata),counts,verifiedThrough:RULES_VERSION.reviewed};
}

export function contentPackById(id:string):ContentPack<unknown>|undefined{return CONTENT_PACKS.find(pack=>pack.metadata.id===id)}
export function moonFormSpellLevel(name:string):number|undefined{const key=Object.keys(MOON_FORM_SPELL_LEVELS).find(entry=>entry.toLowerCase()===name.trim().toLowerCase());return key?MOON_FORM_SPELL_LEVELS[key]:undefined}
