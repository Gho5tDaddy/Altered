export type Ability = 'str'|'dex'|'con'|'int'|'wis'|'cha';
export type DamageType = 'Acid'|'Bludgeoning'|'Cold'|'Fire'|'Force'|'Lightning'|'Necrotic'|'Piercing'|'Poison'|'Psychic'|'Radiant'|'Slashing'|'Thunder';
export type ActionCost = 'action'|'bonus'|'reaction'|'free'|'magic-action'|'none';
export type TransformProfile = 'base'|'wildshape'|'polymorph'|'true-polymorph'|'shapechange'|'animal-shapes'|'overlay'|'custom';
export type ProficiencyRank = 0|1|2;
export type FeatureStatus = 'active'|'conditional'|'inactive'|'ruling';
export type RuleAutomationState = 'calculated'|'conditional'|'reference'|'unsupported';
export type RuleSourceKind = 'srd'|'basic-rules'|'errata'|'owned-character';
export type RuleAuditDomain = 'core'|'conditions'|'classes'|'subclasses'|'forms'|'spells'|'items'|'import'|'product';

export interface Abilities {str:number;dex:number;con:number;int:number;wis:number;cha:number}
export interface Speeds {walk?:number;climb?:number;swim?:number;fly?:number;burrow?:number}
export interface DamagePacket {expression:string;type:DamageType;label?:string;doubleOnCritical?:boolean}
export interface ConditionEffect {condition:string;duration?:string;escapeDc?:number;targetSizeMax?:string;note?:string}
export interface AttackRider {
  id:string;label:string;prerequisite:string;damage?:DamagePacket[];effects?:ConditionEffect[];
}
export interface ActionUseLimit {max:number;recovery:'long'}
export type AutomaticActionChoiceResolution='dash'|'disengage'|'hide'|'skill-check'|'utilize'|'magic-item'|'activate';
export interface AutomaticActionChoice {
  id:string;label:string;resolution:AutomaticActionChoiceResolution;prerequisite?:string;skill?:string;notes?:string;
}

export interface AttackAction {
  id:string;name:string;type:'attack';cost:ActionCost;attackBonus:number;ability:Ability;
  kind:'beast'|'weapon'|'unarmed'|'spell';reach?:number;range?:string;
  damage:DamagePacket[];effects?:ConditionEffect[];riders?:AttackRider[];recharge?:{min:number;max:number};uses?:ActionUseLimit;notes?:string;
}
export interface SaveAction {
  id:string;name:string;type:'save';cost:ActionCost;saveAbility:Ability;dc:number;
  saveAbilityOptions?:Ability[];
  range?:string;damageOnFail?:DamagePacket[];damageOnSuccess?:DamagePacket[];
  halfOnSuccess?:boolean;effectsOnFail?:ConditionEffect[];recharge?:{min:number;max:number};uses?:ActionUseLimit;notes?:string;
}
export interface AutomaticAction {
  id:string;name:string;type:'automatic';cost:ActionCost;damage?:DamagePacket[];
  damageTiming?:string;effects?:ConditionEffect[];recharge?:{min:number;max:number};uses?:ActionUseLimit;prerequisite?:string;choices?:AutomaticActionChoice[];notes?:string;
}
export interface MultiattackVariant {id:string;label:string;sequence:string[]}
export interface MultiattackAction {id:string;name:string;type:'multiattack';cost:'action';sequence:string[];variants?:MultiattackVariant[];notes?:string}
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
  attackBonus?:number;saveDc?:number;saveAbility?:Ability;damage?:DamagePacket[];healing?:string;halfOnSave?:boolean;resolution?:'save'|'automatic'|'manual';slotLevel?:number;summary?:string;
  specialAccess?:'circle-of-the-moon';higherSlotDamage?:DamagePacket[];higherSlotHealing?:string;
  freeCastResourceId?:string;freeCastResourceCost?:number;
  activeEffect?:SpellActiveEffect;
}
export interface SpellActiveEffect {id:string;duration:string;summary:string;acMinimum?:number}

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
  senses?:string[];actions?:CreatureAction[];activationActions?:SaveAction[];
  checkAbilitySubstitution?:Partial<Record<Ability,Ability>>;
  saveAbilitySubstitution?:Partial<Record<Ability,Ability>>;
  attackAbilityOverride?:{ability:Ability;appliesTo:('weapon'|'unarmed')[]};
  attackDamageTypeOverride?:{type:DamageType;appliesTo:('weapon'|'unarmed')[]};
  attackReachMinimum?:{feet:number;appliesTo:('weapon'|'unarmed')[]};
  checkAdvantage?:Ability[];checkDisadvantage?:Ability[];saveAdvantage?:Ability[];saveDisadvantage?:Ability[];
  skillAdvantage?:string[];skillDisadvantage?:string[];
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
  automation?:RuleAutomationState;
  retention?:Partial<Record<Exclude<TransformProfile,'base'>,boolean>>;
  requires?:{spellcasting?:boolean;concentration?:boolean;speech?:boolean;weapon?:boolean;unarmed?:boolean;strengthAttack?:boolean;noArmor?:boolean;noShield?:boolean};
  grants?:{speedBonus?:number;resistances?:DamageType[];immunities?:DamageType[];saveBonusAbility?:Ability;saveBonusFromAbility?:Ability;acFormula?:{base:number;abilities:Ability[]}};
  activation?:ActionCost;
}
export interface ResourcePool {id:string;name:string;current:number;max:number;recovery:'short-one'|'short-all'|'long-all'|'manual'}
export interface EquipmentState {armorCategory:'none'|'light'|'medium'|'heavy';shield:boolean;transformBehavior:'merge'|'drop'|'wear';formCanWear?:boolean}
export type CharacterRuleset='2024'|'legacy'|'mixed'|'unknown';
export interface CharacterProvenance {provider:'local'|'dndbeyond';sourceId?:string;ruleset:CharacterRuleset;rulesetEvidence:string[];reviewRequired:boolean}
export type CharacterItemEffectKind='armor-class'|'saving-throws'|'natural-attack-rolls'|'natural-attack-damage';
export interface CharacterItemEffect {kind:CharacterItemEffectKind;value:number;includedInImportedTotals:boolean}
export interface CharacterItem {
  id:string;name:string;type:string;equipped:boolean;attuned:boolean;requiresAttunement:boolean;
  ruleset:CharacterRuleset;sourceIds:string[];mechanics:'included-in-imported-totals'|'reference-only'|'review-required';
  effects?:CharacterItemEffect[];
  attack?:{ability:Ability;damage:string;damageType:DamageType;proficient:boolean;range?:number;longRange?:number;properties:string[];magicBonus:number};
}

export interface Character {
  schemaVersion:1;id:string;name:string;species:string;legacyRace?:string;creatureType:string;size:string;totalLevel:number;
  classes:CharacterClass[];abilities:Abilities;hp:{current:number;max:number};ac:number;speed:number;
  proficiencies:{saves:Partial<Record<Ability,ProficiencyRank>>;skills:Record<string,ProficiencyRank>};
  skillBonuses?:Record<string,number>;saveBonuses?:Partial<Record<Ability,number>>;
  knownForms:string[];seenForms:string[];spells:Spell[];spellSlots:Record<string,{current:number;max:number}>;
  feats:string[];features:ImportedFeatureRule[];resources:ResourcePool[];equipment:EquipmentState;items:CharacterItem[];provenance:CharacterProvenance;
  transformationGrants?:TransformationGrant[];customForms:Record<string,Creature>;
}

export interface TransformationOption {id:string;label:string;profile:TransformProfile;formId?:string|undefined;grantId?:string|undefined;source:string;actionCost:ActionCost;usable:boolean;reason?:string|undefined;duration?:string|undefined;endActionCost?:ActionCost|undefined;resourceId?:string|undefined;resourceCost?:number|undefined;concentration?:boolean|undefined;retention?:Partial<RetentionPolicy>|undefined;effects?:TransformationEffects|undefined;deactivate?:boolean|undefined;spellName?:string|undefined;spellLevel?:number|undefined;switchGroup?:string|undefined}
export interface RageState {active:boolean;startedAtTurn:number;endsAtTurn:number;usedThisTurn:boolean;recklessDeclared:boolean;extendedThisTurn:boolean}
export interface AttackActionSequence {remaining:number;total:number;source:string}
export interface TurnState {number:number;actionsRemaining:number;surgeActionsRemaining:number;bonusRemaining:number;reactionRemaining:number;slotSpellCast:boolean;attackRollsMade:number;attackAction?:AttackActionSequence;oncePerTurn:Record<string,boolean>}
export interface ConcentrationState {name:string;source:string;castLevel?:number}
export interface PendingRelentlessRage {dc:number;damage:number;source:DamageType}
export interface LifeState {dead:boolean;stable:boolean;deathSaveSuccesses:number;deathSaveFailures:number}
export interface ActiveSpellEffect extends SpellActiveEffect {name:string;source:string;castLevel?:number;startedTurn?:number}
export type ReceivedEffectKind='guidance'|'bless'|'bardic-inspiration'|'heroic-inspiration';
export interface ReceivedEffect {
  id:string;kind:ReceivedEffectKind;name:string;source:string;addedTurn:number;
  duration:string;remindAtTurn?:number;skill?:string;autoChooseSkill?:boolean;autoUseNextRoll?:boolean;die?:4|6|8|10|12;
}
export interface ActiveTransform {option:TransformationOption;startedTurn:number;duration:string;tempHpSource:boolean;spellConcentration?:boolean;permanentUntilDispelled?:boolean}
export interface ActionRecharge {name:string;min:number;max:number}
export interface GameState {
  stateVersion:5;hp:number;tempHp:number;life:LifeState;exhaustionLevel:number;relentlessRageDc:number;pendingRelentlessRage?:PendingRelentlessRage;tempHpSource?:string;activeTransform?:ActiveTransform;concentration?:ConcentrationState;activeSpellEffects:ActiveSpellEffect[];receivedEffects:ReceivedEffect[];
  concentrationChecks:{dc:number;damage:number;source:string}[];
  rage:RageState;turn:TurnState;resources:Record<string,ResourcePool>;spellSlots:Record<string,{current:number;max:number}>;
  conditions:string[];equipment:EquipmentState;overlays:string[];recharges:Record<string,ActionRecharge>;actionUses:Record<string,number>;log:string[];
}

export interface DerivedRoll {name:string;modifier:number;source:string;proficiency:ProficiencyRank;beastModifier?:number;advantageSources?:string[];disadvantageSources?:string[];conditionalSources?:string[];automaticFailure?:string;minimumD20?:number;minimumTotal?:number;minimumSource?:string;alternate?:{modifier:number;source:string;minimumD20?:number;minimumTotal?:number;minimumSource?:string}}
export interface EvaluatedFeature {id:string;name:string;source:string;status:FeatureStatus;reason:string;summary:string;activation?:ActionCost}
export interface AcCandidate {name:string;value:number;legal:boolean;reason:string}
export interface ResolvedSheet {
  profile:TransformProfile;form?:Creature;creatureType:string;size:string;abilities:Abilities;ac:number;acSource:string;acCandidates:AcCandidate[];speeds:Speeds;
  initiative:DerivedRoll;saves:Record<Ability,DerivedRoll>;skills:Record<string,DerivedRoll>;actions:CreatureAction[];
  resistances:DamageType[];immunities:DamageType[];vulnerabilities:DamageType[];senses:string[];
  canSpeak:boolean;canCast:boolean;canConcentrate:boolean;canAttack:boolean;canManipulateObjects:boolean;conditionImmunities:string[];attackDamageModifiers:NonNullable<TransformationEffects['attackDamageModifier']>[];features:EvaluatedFeature[];spells:(Spell&{available:boolean;reason:string})[];
}

export interface TransitionResult {state:GameState;message:string;choice?:{kind:'temporary-hit-points';current:number;incoming:number;source:string};activationActions?:SaveAction[]}

export type ContentDomain='creatures'|'class-features'|'species-features'|'feats'|'spells'|'items'|'conditions'|'transformation-profiles';
export interface ContentPackMetadata {
  id:string;name:string;version:string;ruleset:string;domain:ContentDomain;priority:number;
  license:string;source:string;verified:string;builtIn:boolean;description:string;
}
export interface ConditionDefinition {
  id:string;name:string;summary:string;tags:string[];
  cumulative?:boolean;maximumLevel?:number;d20PenaltyPerLevel?:number;speedPenaltyPerLevel?:number;
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

export interface RuleSourceReference {
  kind:RuleSourceKind;
  title:string;
  ruleset:string;
  url:string;
  license:string;
}
export interface RuleLedgerEntry {
  id:string;
  name:string;
  domain:RuleAuditDomain;
  automation:RuleAutomationState;
  source:RuleSourceReference;
  behavior:string;
  implementation:string[];
  tests:string[];
  reviewed:string;
}
export interface FunctionInventoryEntry {
  id:string;
  label:string;
  kind:'control'|'automatic'|'import'|'persistence';
  ruleIds:string[];
  stateRead:string[];
  stateChanged:string[];
  failureStates:string[];
}
export interface RulesAuditSnapshot {
  rules:number;
  functions:number;
  counts:Record<RuleAutomationState,number>;
  domains:Record<RuleAuditDomain,number>;
  verifiedThrough:string;
}

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
