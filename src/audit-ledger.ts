import type {
  FunctionInventoryEntry,RuleAuditDomain,RuleAutomationState,RuleLedgerEntry,
  RuleSourceKind,RuleSourceReference,RulesAuditSnapshot
} from './types.js';
import {RULES_VERSION} from './rules-data.js';

const SRD='https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf';
const BASIC='https://www.dndbeyond.com/sources/dnd/br-2024';
const GLOSSARY='https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary';
const ERRATA='https://www.dndbeyond.com/sources/dnd/sae/players-handbook';
const REVIEWED=RULES_VERSION.reviewed;

function source(kind:RuleSourceKind,title:string,url:string):RuleSourceReference{
  return {
    kind,title,ruleset:RULES_VERSION.label,url,
    license:kind==='srd'?'CC BY 4.0':kind==='owned-character'?'User-owned character data; not redistributed':'Official comparison reference; descriptive text is not redistributed'
  };
}
const srd=(title:string)=>source('srd',title,SRD);
const basic=(title:string,url=GLOSSARY)=>source('basic-rules',title,url);
const errata=(title:string)=>source('errata',title,ERRATA);
const owned=(title:string)=>source('owned-character',title,'https://www.dndbeyond.com/characters');

function rule(
  id:string,name:string,domain:RuleAuditDomain,automation:RuleAutomationState,
  reference:RuleSourceReference,behavior:string,implementation:string[],tests:string[]
):RuleLedgerEntry{return {id,name,domain,automation,source:reference,behavior,implementation,tests,reviewed:REVIEWED};}

export const RULE_LEDGER:ReadonlyArray<RuleLedgerEntry>=Object.freeze([
  rule('core.action-economy','Action economy','core','calculated',srd('Actions and combat'),
    'Tracks the Action, Bonus Action, Reaction, Action Surge action, and their restrictions independently.',
    ['engine.actionCostError','engine.spendActionCost','engine.actionExecutionError','engine.spendActionExecution','engine.extraAttackCount','engine.useActionSurge'],['engine: action and Bonus Action remain independent','engine: Extra Attack sequences and multiclass non-stacking','engine: Action Surge restrictions']),
  rule('core.slot-spell-limit','One spell-slot expenditure per turn','core','calculated',srd('Casting Time'),
    'Prevents a second spell-slot expenditure on the same turn without blocking cantrips or non-spell features.',
    ['engine.castSpell','engine.startTransformation'],['engine: one slot spell per turn','engine: transformation spells share slot limit']),
  rule('core.d20-tests','D20 Tests and proficiency','core','calculated',basic('D20 Tests and Proficiency',BASIC),
    'Calculates attacks, saves, checks, Initiative, proficiency, and Expertise-compatible imported ranks.',
    ['engine.resolveSheet','engine.rollAttackD20'],['engine: transformed saves and skills','engine: deterministic d20 attacks']),
  rule('core.advantage','Advantage and Disadvantage','core','calculated',basic('Advantage and Disadvantage'),
    'Combines any number of sources and cancels opposing Advantage and Disadvantage.',
    ['engine.resolveAdvantage','engine.attackRollSources'],['engine: advantage cancellation']),
  rule('core.critical-hits','Natural rolls and critical hits','core','calculated',srd('Attack Rolls and Critical Hits'),
    'Applies natural 1, natural 20, supported expanded critical ranges, and doubles eligible damage dice.',
    ['engine.rollAttackD20','engine.criticalHitThreshold','engine.criticalDiceExpression'],['engine: natural rolls and expanded criticals']),
  rule('core.damage','Damage, healing, and defenses','core','calculated',basic('Damage and Healing',BASIC),
    'Applies immunity, resistance, vulnerability, Temporary HP, HP, healing, and Concentration checks in rules order.',
    ['engine.applyDamage','engine.heal','engine.concentrationCheckDc'],['engine: Rage resistance damage','engine: Temporary HP choice']),
  rule('core.zero-hp','Zero HP, death, and stabilization','core','calculated',basic('Dropping to 0 Hit Points',BASIC),
    'Handles massive damage, Unconscious, Death Saves, damage at 0 HP, stabilization, natural 1/20, healing recovery, and Champion Survivor.',
    ['engine.applyDamage','engine.resolveDeathSave','engine.deathSaveMode','engine.heal'],['engine: 0 HP and Death Saving Throws','engine: Champion Survivor']),
  rule('core.temporary-hp','Temporary Hit Points','core','calculated',srd('Temporary Hit Points'),
    'Never stacks Temporary HP; asks which pool to keep and removes source-bound pools when their effect ends.',
    ['engine.applyIncomingTempHp','engine.resolveTempHpChoice','engine.endTransformation'],['engine: Temporary HP choice','engine: transformation THP endings']),
  rule('core.concentration','Concentration','core','calculated',basic('Concentration'),
    'Tracks one Concentration effect, damage checks, incapacitation, Rage conflicts, replacement, and ending cleanup.',
    ['engine.endConcentration','engine.concentrationSaveMode','engine.resolveConcentrationCheck'],['engine: Concentration queue and failure','engine: War Caster and Eldritch Mind']),
  rule('core.rests','Short and Long Rests','core','calculated',basic('Short Rest and Long Rest'),
    'Restores only eligible resources, enforces the Long Rest HP prerequisite, removes one Exhaustion level, and expires effects by duration.',
    ['engine.shortRest','engine.longRest'],['engine: rest budgets and conditions','engine: Long Rest prerequisites and Exhaustion']),
  rule('core.initiative','Initiative and Surprise','core','calculated',basic('Initiative and Surprise'),
    'Uses current Dexterity and supported retained features, conditions, Exhaustion, and explicit Surprise.',
    ['engine.resolveInitiative','app.initiativeModePicker'],['engine: Initiative form Dexterity','engine: Initiative conditions and Exhaustion']),
  rule('core.unarmed-strike','2024 Unarmed Strike','core','calculated',basic('Unarmed Strike'),
    'Exposes damage, Grapple, and Shove with target save choice, size limit, free-hand guidance, and escape DC.',
    ['engine.baseActions'],['engine: 2024 Unarmed Strike']),
  rule('core.multiattack','Creature Multiattack','core','calculated',srd('Creature Stat Blocks and Multiattack'),
    'Resolves every referenced attack or save separately while spending the parent Action only once.',
    ['srd-catalog.multiattackAction','app.renderActions'],['srd-catalog: Multiattack normalization','engine: creature golden actions']),

  rule('condition.exhaustion','Exhaustion','conditions','calculated',basic('Exhaustion'),
    'Tracks levels 0–6, subtracts twice the level from every D20 Test, reduces each Speed by five feet per level, removes one level on a Long Rest, and blocks play at level 6 death.',
    ['engine.applyCondition','engine.exhaustionPenalty','engine.longRest'],['engine: Exhaustion levels']),
  rule('condition.incapacitated','Incapacitated and inherited conditions','conditions','calculated',basic('Incapacitated'),
    'Blocks actions, Bonus Actions, Reactions, speech, and Concentration; applies Initiative Disadvantage and feature-ending triggers.',
    ['engine.actionCostError','engine.applyCondition','engine.resolveInitiative'],['engine: conditions block actions','engine: Initiative conditions']),
  rule('condition.visibility','Blinded, Invisible, and sight exceptions','conditions','conditional',basic('Blinded and Invisible'),
    'Applies ordinary attack/Initiative effects and tells the user when special sight or target visibility can change the result.',
    ['engine.attackRollSources','engine.resolveInitiative'],['engine: visibility condition modes']),
  rule('condition.frightened','Frightened','conditions','conditional',basic('Frightened'),
    'Surfaces line-of-sight-dependent attack and ability-check Disadvantage without guessing battlefield state.',
    ['engine.attackRollSources','engine.resolveSkills','engine.resolveInitiative'],['engine: conditional Frightened effects']),
  rule('condition.grappled','Grappled','conditions','conditional',errata('2024 Grappling errata'),
    'Sets Speed to 0, surfaces the other-target attack condition, and presents escape and ending guidance.',
    ['engine.resolveSpeeds','engine.attackRollSources','engine.baseActions'],['engine: Grappled condition']),
  rule('condition.other-core','Other core conditions','conditions','calculated',basic('Conditions'),
    'Applies the automated portions of Poisoned, Restrained, Paralyzed, Petrified, Stunned, Prone, and Unconscious.',
    ['content-registry.CONDITIONS','engine.resolveSheet'],['engine: condition matrix']),

  rule('form.wild-shape','Wild Shape','forms','calculated',srd('Druid: Wild Shape'),
    'Enforces level, known forms, CR, Fly Speed, resource, retained statistics, higher proficiencies, Moon AC/THP, action cost, and endings.',
    ['engine.wildShapeLimits','engine.availableTransformations','engine.startTransformation','engine.resolveSheet'],['engine: Wild Shape legality','engine: Moon Wild Shape sheet']),
  rule('form.polymorph','Polymorph','forms','calculated',errata('Polymorph errata'),
    'Uses legal Beast forms, replacement statistics, retained type/HP/Hit Dice, anatomy limits, melded equipment, source-bound THP, and Concentration endings.',
    ['engine.availableTransformations','engine.startTransformation','engine.applyDamage'],['engine: Polymorph lifecycle']),
  rule('form.true-polymorph','True Polymorph','forms','calculated',errata('True Polymorph errata'),
    'Supports creature-to-creature mode, replacement statistics, one-hour Concentration, reviewed THP behavior, and permanence until dispelled.',
    ['engine.availableTransformations','engine.completeTruePolymorph'],['engine: True Polymorph lifecycle']),
  rule('form.shapechange','Shapechange','forms','calculated',errata('Shapechange errata'),
    'Enforces seen forms, CR, excluded types, retained statistics and Spellcasting, errata-correct first-form THP, and later Magic-action switches.',
    ['engine.availableTransformations','engine.resolveSheet','engine.startTransformation'],['engine: Shapechange lifecycle']),
  rule('form.animal-shapes','Animal Shapes','forms','calculated',errata('Animal Shapes errata'),
    'Enforces Beast CR/size, retained statistics, first-form THP after errata, later Magic-action switches, and Bonus Action ending.',
    ['engine.availableTransformations','engine.startTransformation'],['engine: Animal Shapes lifecycle']),
  rule('form.overlays','Additive transformations','forms','calculated',srd('Shape-shifting and spell effects'),
    'Combines only explicitly declared ability, size, speed, defense, action, and ending effects with the active sheet.',
    ['engine.builtInOverlayOption','engine.effectList'],['engine: Alter Self, Enlarge/Reduce, and Gaseous Form']),
  rule('form.custom','Private custom transformations','forms','conditional',owned('Private owned-content transformation'),
    'Requires an explicit structured profile and retention policy; unknown replacements remain disabled.',
    ['schema.parseTransformationGrant','owned-content.applyOwnedContentPacks'],['schema: custom profile validation','owned-content: private transformation']),

  rule('class.barbarian','Barbarian interactions','classes','calculated',srd('Barbarian'),
    'Calculates Rage, Rage Damage qualification, Reckless Attack, Danger Sense, Unarmored Defense, Fast Movement, Primal Knowledge, Relentless Rage, Indomitable Might, and duration rules where surfaced.',
    ['rules-data.CLASS_FEATURES.Barbarian','engine.startRage','engine.resolveRelentlessRage','engine.attackBonuses'],['engine: Barbarian interaction suite','engine: 2024 Relentless Rage']),
  rule('class.bard','Bard interactions','classes','conditional',srd('Bard'),
    'Calculates 2024 Jack of All Trades for untrained skill checks and classifies target, communication, proficiency, and form prerequisites without inventing them.',
    ['rules-data.CLASS_FEATURES.Bard','engine.evaluateFeatures'],['audit-ledger: twelve classes']),
  rule('class.cleric','Cleric interactions','classes','conditional',srd('Cleric'),
    'Retains imported Cleric features and classifies Channel Divinity, symbol, weapon, cantrip, and target prerequisites.',
    ['rules-data.CLASS_FEATURES.Cleric','engine.evaluateFeatures'],['audit-ledger: twelve classes']),
  rule('class.druid','Druid interactions','classes','calculated',srd('Druid'),
    'Calculates Wild Shape, Wild Resurgence, Primal Strike, Beast Spells, and supported Circle interactions.',
    ['rules-data.CLASS_FEATURES.Druid','engine.availableTransformations','engine.useWildResurgence'],['engine: Druid interaction suite']),
  rule('class.fighter','Fighter interactions','classes','calculated',srd('Fighter'),
    'Calculates Second Wind, Action Surge restrictions, Champion Initiative/criticals, and correct Extra Attack versus Multiattack guidance.',
    ['rules-data.CLASS_FEATURES.Fighter','engine.useSecondWind','engine.useActionSurge'],['engine: Fighter interaction suite']),
  rule('class.monk','Monk interactions','classes','conditional',srd('Monk'),
    'Calculates Unarmored Defense, movement, Martial Arts die, and separate Unarmed Strikes; other Focus actions remain prerequisite-guided.',
    ['rules-data.CLASS_FEATURES.Monk','engine.monkDie','engine.resolveSheet'],['engine: Monk form interactions']),
  rule('class.paladin','Paladin interactions','classes','calculated',srd('Paladin'),
    'Calculates Lay On Hands, Aura of Protection, and Radiant Strikes qualification; target/symbol options remain conditional.',
    ['rules-data.CLASS_FEATURES.Paladin','engine.useLayOnHands','engine.attackBonuses'],['engine: Paladin form interactions']),
  rule('class.ranger','Ranger interactions','classes','conditional',srd('Ranger'),
    'Calculates Roving and Feral Senses and retains eligible Concentration; target-specific Hunter’s Mark and feature actions remain conditional.',
    ['rules-data.CLASS_FEATURES.Ranger','engine.resolveSpeeds','engine.evaluateFeatures'],['engine: Ranger form interactions']),
  rule('class.rogue','Rogue interactions','classes','conditional',srd('Rogue'),
    'Calculates Reliable Talent and Slippery Mind, excludes ordinary Beast attacks from Sneak Attack, and guides Cunning Action, reactions, and Evasion.',
    ['rules-data.CLASS_FEATURES.Rogue','engine.evaluateFeatures'],['engine: Rogue form interactions']),
  rule('class.sorcerer','Sorcerer interactions','classes','conditional',srd('Sorcerer'),
    'Gates Innate Sorcery and Metamagic on spellcasting and calculates supported Draconic Sorcery overlays.',
    ['rules-data.CLASS_FEATURES.Sorcerer','engine.restoreDragonWings'],['engine: Draconic Sorcery wings']),
  rule('class.warlock','Warlock interactions','classes','conditional',srd('Warlock'),
    'Gates Pact Magic and invocations on imported prerequisites and calculates Eldritch Mind Concentration Advantage only when that invocation is positively imported.',
    ['rules-data.CLASS_FEATURES.Warlock','engine.concentrationSaveMode'],['engine: Eldritch Mind']),
  rule('class.wizard','Wizard interactions','classes','conditional',srd('Wizard'),
    'Gates Spellcasting by form profile and retains it only where the transformation explicitly permits it.',
    ['rules-data.CLASS_FEATURES.Wizard','engine.canNormallyCast'],['engine: Shapechange spellcasting']),

  rule('subclass.circle-moon','Circle of the Moon','subclasses','calculated',owned('Circle of the Moon character features'),
    'Calculates Circle Forms, Moon THP, Improved Circle Forms, Circle spell access, Primal Strike, and Lunar Form when the owned character declares them.',
    ['engine.wildShapeLimits','engine.moonSpellAllowed','engine.attackBonuses'],['engine: Circle of the Moon suite']),
  rule('subclass.srd-and-owned','Other subclasses','subclasses','conditional',owned('Imported subclass features'),
    'Classifies the twelve SRD subclasses feature-by-feature and uses explicit private structured grants for owned subclasses; paid or unknown prose is never guessed.',
    ['rules-data.SUBCLASS_FEATURES','engine.evaluateFeatures','owned-content.applyOwnedContentPacks'],['engine: SRD subclass classification','owned-content: subclass matching']),

  rule('spell.transformations','Transformation spells','spells','calculated',errata('2024 transformation-spell errata'),
    'Calculates supported replacement and overlay spell profiles, casting/slot economy, Concentration, switching, and endings.',
    ['engine.availableTransformations','engine.startTransformation'],['engine: transformation spell suite']),
  rule('spell.imported','Imported spells','spells','conditional',owned('Owned character spells'),
    'Executes structured attack, save, damage, healing, scaling, and active-effect fields; ambiguous effects remain manual.',
    ['dndbeyond.parseSpells','engine.castSpell','app.spellCard'],['dndbeyond: spell normalization','engine: spell casting suite']),
  rule('item.equipment','Armor, Shields, and form equipment','items','conditional',srd('Equipment'),
    'Uses imported AC and equipment state, enforces armor/Shield prerequisites, and prevents merged gear from benefiting replacement forms.',
    ['dndbeyond.parseDefense','engine.armorActive','engine.resolveAc'],['dndbeyond: defense normalization','engine: form AC formulas']),
  rule('item.owned-effects','Owned magic-item effects','items','conditional',owned('Owned character item effects'),
    'Preserves validated imported numeric totals and exposes item provenance without reproducing paid descriptive text or double-applying modifiers.',
    ['dndbeyond.parseItems','dndbeyond.parseEquipmentAndAc'],['dndbeyond: item provenance']),

  rule('import.ddb','Public D&D Beyond import','import','conditional',owned('Public owned character payload'),
    'Validates identity and ruleset-sensitive character fields, reports verified/missing/review data, and never guesses unsupported mechanics.',
    ['dndbeyond.importDdbCharacter','schema.parseCharacter'],['dndbeyond: Ferocitus fixture','dndbeyond: malformed response rejection']),
  rule('import.provenance','2024-only provenance','import','conditional',basic('2024 and Legacy source separation',BASIC),
    'Classifies imported definition ruleset markers and source labels, blocks Legacy or mixed characters, and flags unidentified mechanics for review.',
    ['dndbeyond.rulesetAssessment','dndbeyond.importDdbCharacter'],['dndbeyond: 2024 provenance']),
  rule('product.rules-update','Reviewed rules updates','product','calculated',errata('Sage Advice and Errata'),
    'Compares the live legal catalog with the pinned reviewed baseline and never silently promotes changed records into production calculations.',
    ['srd-catalog.parseSrdCatalogStatus','app.refreshSrdCatalog'],['srd-catalog: baseline status','ui-contract: fixed source proxy']),
  rule('product.offline-integrity','Offline and private-data integrity','product','calculated',srd('SRD 5.2.1 offline baseline'),
    'Keeps validated built-in rules offline while excluding character, private-pack, and changing API responses from service-worker storage.',
    ['public.sw','storage'],['ui-contract: API cache bypass','storage: corruption recovery'])
]);

export const FUNCTION_INVENTORY:ReadonlyArray<FunctionInventoryEntry>=Object.freeze([
  {id:'transform-select',label:'Select and activate a form',kind:'control',ruleIds:['core.action-economy','core.slot-spell-limit','form.wild-shape','form.polymorph','form.true-polymorph','form.shapechange','form.animal-shapes','form.overlays'],stateRead:['character','active form','resources','spell slots','turn','conditions'],stateChanged:['active form','overlays','resources','spell slots','turn','Concentration','Temporary HP'],failureStates:['illegal form','resource empty','action unavailable','casting blocked','unsupported profile']},
  {id:'end-form',label:'End active form',kind:'control',ruleIds:['core.action-economy','form.wild-shape','form.polymorph','form.true-polymorph','form.shapechange','form.animal-shapes'],stateRead:['active form','turn','conditions'],stateChanged:['active form','turn','Concentration','Temporary HP'],failureStates:['no active form','required action unavailable','permanent True Polymorph']},
  {id:'creature-action',label:'Resolve creature action or Multiattack',kind:'control',ruleIds:['core.action-economy','core.d20-tests','core.advantage','core.critical-hits','core.multiattack','condition.exhaustion'],stateRead:['resolved sheet','turn','conditions','recharge','uses'],stateChanged:['turn','recharge','uses','once-per-turn','activity'],failureStates:['action unavailable','recharging','uses exhausted','attacks blocked']},
  {id:'spell-cast',label:'Cast an imported spell',kind:'control',ruleIds:['core.action-economy','core.slot-spell-limit','core.concentration','spell.imported','condition.exhaustion'],stateRead:['resolved spells','turn','slots','Rage','conditions'],stateChanged:['turn','slots','Concentration','active effects','activity'],failureStates:['unprepared','slot unavailable','casting blocked','action unavailable','unsupported resolution']},
  {id:'roll-save-skill-initiative',label:'Roll save, skill, or Initiative',kind:'control',ruleIds:['core.d20-tests','core.advantage','core.initiative','condition.exhaustion','condition.visibility','condition.frightened'],stateRead:['resolved roll','conditions','situational mode'],stateChanged:['latest result','activity'],failureStates:['automatic failure','dead at Exhaustion 6']},
  {id:'rage',label:'Start, extend, or end Rage',kind:'control',ruleIds:['core.action-economy','core.concentration','class.barbarian'],stateRead:['class','turn','resources','armor','conditions','active form'],stateChanged:['Rage','turn','resources','Concentration'],failureStates:['no feature','no resource','Heavy armor','action unavailable','feature not retained']},
  {id:'class-resources',label:'Use supported class resources',kind:'control',ruleIds:['class.druid','class.fighter','class.paladin','class.sorcerer'],stateRead:['class','resources','turn','active form'],stateChanged:['resources','turn','HP','slots'],failureStates:['no feature','resource empty','action unavailable','feature not retained']},
  {id:'damage-healing',label:'Apply damage or healing',kind:'control',ruleIds:['core.damage','core.zero-hp','core.temporary-hp','core.concentration'],stateRead:['resolved defenses','HP','Temporary HP','life state','Concentration','active effects'],stateChanged:['HP','Temporary HP','Death Saves','life state','Concentration checks','form','active effects'],failureStates:['non-finite input','dead character']},
  {id:'zero-hp-resolution',label:'Resolve Relentless Rage or Death Saving Throws',kind:'control',ruleIds:['core.zero-hp','class.barbarian'],stateRead:['HP','life state','class','Rage','current save DC'],stateChanged:['HP','life state','Death Saves','conditions','Rage'],failureStates:['no pending trigger','already Stable','dead character']},
  {id:'conditions',label:'Apply, reduce, or clear conditions',kind:'control',ruleIds:['condition.exhaustion','condition.incapacitated','condition.visibility','condition.frightened','condition.grappled','condition.other-core'],stateRead:['conditions','condition immunities','active effects'],stateChanged:['conditions','Exhaustion','form','Rage','Concentration','overlays'],failureStates:['condition immunity','maximum Exhaustion']},
  {id:'turns-rests',label:'Start/end turn and take rests',kind:'control',ruleIds:['core.action-economy','core.rests','class.barbarian'],stateRead:['turn','resources','HP','conditions','durations'],stateChanged:['turn','resources','slots','HP','Exhaustion','forms','effects'],failureStates:['Long Rest at 0 HP']},
  {id:'ddb-import',label:'Import public owned D&D Beyond character',kind:'import',ruleIds:['import.ddb','import.provenance','item.owned-effects'],stateRead:['public character ID','source payload','live SRD catalog'],stateChanged:['pending reviewed character'],failureStates:['private character','identity mismatch','legacy/unidentified source','malformed payload','catalog unavailable']},
  {id:'json-owned-content',label:'Import/export character and private packs',kind:'import',ruleIds:['form.custom','subclass.srd-and-owned','product.offline-integrity'],stateRead:['selected files','schema'],stateChanged:['characters','private packs'],failureStates:['oversized file','invalid schema','non-private pack','unknown profile']},
  {id:'persistence',label:'Persist and restore local combat state',kind:'persistence',ruleIds:['product.offline-integrity'],stateRead:['character','combat state','settings'],stateChanged:['local storage'],failureStates:['storage unavailable','corrupt or stale state']},
  {id:'rules-status',label:'Check reviewed rules catalog',kind:'control',ruleIds:['product.rules-update'],stateRead:['pinned baseline','live catalog status'],stateChanged:['rules status only'],failureStates:['offline','source changed','unexpected document']},
  {id:'automatic-effect-cleanup',label:'End dependent effects automatically',kind:'automatic',ruleIds:['core.concentration','core.temporary-hp','form.wild-shape','form.polymorph','form.overlays'],stateRead:['HP','Temporary HP','conditions','Concentration','durations'],stateChanged:['form','overlays','Concentration','Temporary HP'],failureStates:[]}
]);

function countBy<T extends string>(values:readonly T[],keys:readonly T[]):Record<T,number>{
  return Object.fromEntries(keys.map(key=>[key,values.filter(value=>value===key).length])) as Record<T,number>;
}

export function rulesAuditSnapshot():RulesAuditSnapshot{
  const states:RuleAutomationState[]=['calculated','conditional','reference','unsupported'];
  const domains:RuleAuditDomain[]=['core','conditions','classes','subclasses','forms','spells','items','import','product'];
  return {
    rules:RULE_LEDGER.length,functions:FUNCTION_INVENTORY.length,
    counts:countBy(RULE_LEDGER.map(entry=>entry.automation),states),
    domains:countBy(RULE_LEDGER.map(entry=>entry.domain),domains),
    verifiedThrough:REVIEWED
  };
}

export function ruleById(id:string):RuleLedgerEntry|undefined{return RULE_LEDGER.find(entry=>entry.id===id)}
