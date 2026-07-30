export type Ability = 'str'|'dex'|'con'|'int'|'wis'|'cha';
export type DamageType = 'Acid'|'Bludgeoning'|'Cold'|'Fire'|'Force'|'Lightning'|'Necrotic'|'Piercing'|'Poison'|'Psychic'|'Radiant'|'Slashing'|'Thunder';
export type ActionCost = 'action'|'bonus'|'reaction'|'free'|'magic-action'|'none';
export type TransformProfile = 'base'|'wildshape'|'polymorph'|'true-polymorph'|'shapechange'|'animal-shapes'|'overlay'|'custom';
export type ProficiencyRank = 0|1|2;
export type FeatureStatus = 'active'|'conditional'|'inactive'|'ruling';

export interface Abilities {str:number;dex:number;con:number;int:number;wis:number;cha:number}
export interface Speeds {walk?:number;climb?:number;swim?:number;fly?:number;burrow?:number}
export interface DamagePacket {expression:string;type:DamageType;label?:string;doubleOnCritical?:boolean}
export interface ConditionEffect {condition:string;duration?:string;escapeDc?:number;targetSizeMax?:string;note?:string}
export interface ActionUseLimit {max:number;recovery:'long'}

export interface AttackAction {
  id:string;name:string;type:'attack';cost:ActionCost;attackBonus:number;ability:Ability;
  kind:'beast'|'weapon'|'unarmed'|'spell';reach?:number;range?:string;
  damage:DamagePacket[];effects?:ConditionEffect[];recharge?:{min:number;max:number};uses?:ActionUseLimit;notes?:string;
}
export interface SaveAction {
  id:string;name:string;type:'save';cost:ActionCost;saveAbility:Ability;dc:number;
  range?:string;damageOnFail?:DamagePacket[];damageOnSuccess?:DamagePacket[];
  effectsOnFail?:ConditionEffect[];recharge?:{min:number;max:number};uses?:ActionUseLimit;notes?:string;
}
export interface AutomaticAction {
  id:string;name:string;type:'automatic';cost:ActionCost;damage?:DamagePacket[];
  effects?:ConditionEffect[];recharge?:{min:number;max:number};uses?:ActionUseLimit;prerequisite?:string;notes?:string;
}
export interface MultiattackAction {id:string;name:string;type:'multiattack';cost:'action';sequence:string[];notes?:string}
export type CreatureAction = AttackAction|SaveAction|AutomaticAction|MultiattackAction;

export interface Creature {
  id:string;name:string;type:string;tags?:string[];cr:number;size:string;ac:number;hp:number;hitDice:string;
  abilities:Abilities;saves:Partial<Record<Ability,number>>;skills:Record<string,number>;
  speeds:Speeds;senses:string[];resistances:DamageType[];immunities:DamageType[];vulnerabilities:DamageType[];conditionImmunities?:string[];
  traits:{name:string;summary:string}[];actions:CreatureAction[];artKey:string;
  source:{ruleset:string;page:string;verified:string};
}

export interface CharacterClass {name:string;level:number;subclass?:string|null}
export interface Spell {
  id?:string;name:string;level:number;sourceClass:string;ability:Ability;prepared?:boolean;
  castingTime:ActionCost;concentration?:boolean;components?:string;materialCost?:boolean;materialConsumed?:boolean;
  attackBonus?:number;saveDc?:number;damage?:DamagePacket[];healing?:string;resolution?:'save'|'automatic'|'manual';slotLevel?:number;summary?:string;
}

export interface RetentionPolicy {
  hp:boolean;hitDice:boolean;mentalAbilities:boolean;proficiencies:boolean;creatureType:boolean;
  classFeatures:boolean;feats:boolean;spellcasting:boolean;speech:boolean;
}
export interface TransformationEffects {
  size?:string;creatureType?:string;
  abilitySet?:Partial<Record<Ability,number>>;
  abilityMinimum?:Partial<Record<Ability,number>>;
  abilityBonus?:Partial<Record<Ability,number>>;
  speedSet?:Speeds;
  speedBonus?:Speeds;
  speedEqualToWalk?: ('climb'|'swim'|'fly'|'burrow')[];
  acBonus?:number;
  acFormula?:{base:number;abilities:Ability[]};
  resistances?:DamageType[];immunities?:DamageType[];vulnerabilities?:DamageType[];
  senses?:string[];actions?:CreatureAction[];
  checkAdvantage?:Ability[];checkDisadvantage?:Ability[];saveAdvantage?:Ability[];saveDisadvantage?:Ability[];
  conditionImmunities?:string[];canSpeak?:boolean;canCast?:boolean;canConcentrate?:boolean;canAttack?:boolean;canManipulateObjects?:boolean;endsAtZeroHp?:boolean;endsAtZeroTemporaryHp?:boolean;endsOnIncapacitated?:boolean;
  attackDamageModifier?:{expression:string;mode:'add'|'subtract';appliesTo:('weapon'|'unarmed')[];minimumDamage?:number};
  temporaryHp?:{mode:'fixed'|'form-hp'|'expression';value?:number;expression?:string};
}
export interface TransformationGrant {
  id:string;label:string;profile:TransformProfile;formIds:string[];source:string;actionCost:ActionCost;
  endActionCost?:ActionCost;duration?:string;resourceId?:string;resourceCost?:number;concentration?:boolean;spellName?:string;spellLevel?:number;switchGroup?:string;
  availableProfiles?:TransformProfile[];retention?:Partial<RetentionPolicy>;effects?:TransformationEffects;
}

export interface ImportedFeatureRule {
  id:string;name:string;source:string;level?:number;summary:string;
  retention?:Partial<Record<Exclude<TransformProfile,'base'>,boolean>>;
  requires?:{spellcasting?:boolean;concentration?:boolean;speech?:boolean;weapon?:boolean;unarmed?:boolean;strengthAttack?:boolean;noArmor?:boolean;noShield?:boolean};
  grants?:{speedBonus?:number;resistances?:DamageType[];immunities?:DamageType[];saveBonusAbility?:Ability;saveBonusFromAbility?:Ability;acFormula?:{base:number;abilities:Ability[]}};
  activation?:ActionCost;
}
export interface ResourcePool {id:string;name:string;current:number;max:number;recovery:'short-one'|'short-all'|'long-all'|'manual'}
export interface EquipmentState {armorCategory:'none'|'light'|'medium'|'heavy';shield:boolean;transformBehavior:'merge'|'drop'|'wear';formCanWear?:boolean}

export interface Character {
  schemaVersion:1;id:string;name:string;species:string;legacyRace?:string;creatureType:string;size:string;totalLevel:number;
  classes:CharacterClass[];abilities:Abilities;hp:{current:number;max:number};ac:number;speed:number;
  proficiencies:{saves:Partial<Record<Ability,ProficiencyRank>>;skills:Record<string,ProficiencyRank>};
  skillBonuses?:Record<string,number>;saveBonuses?:Partial<Record<Ability,number>>;
  knownForms:string[];seenForms:string[];spells:Spell[];spellSlots:Record<string,{current:number;max:number}>;
  feats:string[];features:ImportedFeatureRule[];resources:ResourcePool[];equipment:EquipmentState;
  transformationGrants?:TransformationGrant[];customForms:Record<string,Creature>;
}

export interface TransformationOption {id:string;label:string;profile:TransformProfile;formId?:string|undefined;grantId?:string|undefined;source:string;actionCost:ActionCost;usable:boolean;reason?:string|undefined;duration?:string|undefined;endActionCost?:ActionCost|undefined;resourceId?:string|undefined;resourceCost?:number|undefined;concentration?:boolean|undefined;retention?:Partial<RetentionPolicy>|undefined;effects?:TransformationEffects|undefined;deactivate?:boolean|undefined;spellName?:string|undefined;spellLevel?:number|undefined;switchGroup?:string|undefined}
export interface RageState {active:boolean;endsAtTurn:number;usedThisTurn:boolean;recklessDeclared:boolean;extendedThisTurn:boolean}
export interface TurnState {number:number;actionsRemaining:number;surgeActionsRemaining:number;bonusRemaining:number;reactionRemaining:number;attackRollsMade:number;oncePerTurn:Record<string,boolean>}
export interface ConcentrationState {name:string;source:string}
export interface ActiveTransform {option:TransformationOption;startedTurn:number;duration:string;tempHpSource:boolean;spellConcentration?:boolean;permanentUntilDispelled?:boolean}
export interface ActionRecharge {name:string;min:number;max:number}
export interface GameState {
  stateVersion:2;hp:number;tempHp:number;tempHpSource?:string;activeTransform?:ActiveTransform;concentration?:ConcentrationState;
  concentrationChecks:{dc:number;damage:number;source:string}[];
  rage:RageState;turn:TurnState;resources:Record<string,ResourcePool>;spellSlots:Record<string,{current:number;max:number}>;
  conditions:string[];equipment:EquipmentState;overlays:string[];recharges:Record<string,ActionRecharge>;actionUses:Record<string,number>;log:string[];
}

export interface DerivedRoll {name:string;modifier:number;source:string;proficiency:ProficiencyRank;beastModifier?:number;advantageSources?:string[];disadvantageSources?:string[];conditionalSources?:string[];automaticFailure?:string;alternate?:{modifier:number;source:string}}
export interface EvaluatedFeature {id:string;name:string;source:string;status:FeatureStatus;reason:string;summary:string;activation?:ActionCost}
export interface AcCandidate {name:string;value:number;legal:boolean;reason:string}
export interface ResolvedSheet {
  profile:TransformProfile;form?:Creature;creatureType:string;size:string;abilities:Abilities;ac:number;acSource:string;acCandidates:AcCandidate[];speeds:Speeds;
  saves:Record<Ability,DerivedRoll>;skills:Record<string,DerivedRoll>;actions:CreatureAction[];
  resistances:DamageType[];immunities:DamageType[];vulnerabilities:DamageType[];senses:string[];
  canSpeak:boolean;canCast:boolean;canConcentrate:boolean;canAttack:boolean;canManipulateObjects:boolean;conditionImmunities:string[];attackDamageModifiers:NonNullable<TransformationEffects['attackDamageModifier']>[];features:EvaluatedFeature[];spells:(Spell&{available:boolean;reason:string})[];
}

export interface TransitionResult {state:GameState;message:string;choice?:{kind:'temporary-hit-points';current:number;incoming:number;source:string}}

export type ContentDomain='creatures'|'class-features'|'species-features'|'feats'|'spells'|'items'|'conditions'|'transformation-profiles';
export interface ContentPackMetadata {
  id:string;name:string;version:string;ruleset:string;domain:ContentDomain;priority:number;
  license:string;source:string;verified:string;builtIn:boolean;description:string;
}
export interface ConditionDefinition {
  id:string;name:string;summary:string;tags:string[];
  blocksActions?:boolean;blocksBonusActions?:boolean;blocksReactions?:boolean;speedBecomesZero?:boolean;
  endsConcentration?:boolean;endsWildShape?:boolean;endsRage?:boolean;
  attackAdvantageAgainst?:boolean;attackDisadvantage?:boolean;abilityCheckDisadvantage?:boolean;
  saveDisadvantage?:Ability[];automaticSaveFailure?:Ability[];
}
export interface TransformationProfileDefinition {
  id:TransformProfile;name:string;summary:string;
  retains:RetentionPolicy;
  usesTemporaryHp:boolean;equipment:'unchanged'|'effect-defined'|'merged-or-worn';
}
export interface ContentPack<T> {metadata:ContentPackMetadata;records:Record<string,T>}
export interface ContentRegistrySnapshot {
  packs:ContentPackMetadata[];
  counts:Record<ContentDomain,number>;
  verifiedThrough:string;
}
export interface CatalogEntry {id:string;name:string;summary:string;source:string;tags?:string[]}

export interface OwnedContentMatch {
  characterId?:string;
  className?:string;
  subclass?:string;
  minimumClassLevel?:number;
  maximumClassLevel?:number;
  species?:string;
}
export interface OwnedContentPackMetadata {
  id:string;
  name:string;
  version:string;
  source:string;
  description?:string;
  privateUse:boolean;
  createdAt?:string;
}
export interface OwnedContentPackContent {
  customForms:Creature[];
  knownForms:string[];
  seenForms:string[];
  transformationGrants:TransformationGrant[];
  features:ImportedFeatureRule[];
  resources:ResourcePool[];
  spells:Spell[];
}
export interface OwnedContentPack {
  schemaVersion:1;
  kind:'altered-owned-content-pack';
  metadata:OwnedContentPackMetadata;
  appliesTo:OwnedContentMatch[];
  content:OwnedContentPackContent;
}
export interface OwnedContentApplyResult {
  character:Character;
  applied:boolean;
  added:{forms:number;knownForms:number;seenForms:number;transformations:number;features:number;resources:number;spells:number};
  notes:string[];
}
