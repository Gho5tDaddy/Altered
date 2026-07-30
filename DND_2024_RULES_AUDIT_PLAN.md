# Altered — D&D 5e 2024 rules audit plan

## Objective

Prove that every mechanic Altered exposes behaves according to the current 2024 fifth-edition rules, while keeping the app focused on its purpose: a rules-aware adaptive character sheet for transformations.

The audit covers:

- core turn, action, roll, damage, healing, condition, duration, rest, and resource mechanics;
- all twelve 2024 base classes where their features interact with the active sheet or a form;
- supported subclasses, with a complete audit of SRD subclasses and an explicit validation path for user-owned subclasses;
- weapons, armor, shields, adventuring gear, magic items, attunement, charges, and equipment/form compatibility where they affect displayed or executable mechanics;
- replacement forms, additive forms, form-changing spells, creature stat blocks, and all retained or replaced character statistics;
- import fidelity, rules provenance, user-facing explanations, mobile behavior, accessibility, persistence, and failure handling.

The audit must not turn Altered into a general rules encyclopedia. Content is surfaced only when it affects the imported character, the active form, or an executable table action.

## Authority and legal-content boundary

Use sources in this order:

1. **SRD 5.2.1 under CC BY 4.0** — canonical redistributable rules and content baseline.
2. **Current D&D Beyond Basic Rules** — official public implementation reference. Use for comparison; do not assume that all page text is licensed for redistribution.
3. **Official Sage Advice and 2024 core-rulebook errata** — corrections and official rulings that override earlier text when applicable.
4. **User-owned D&D Beyond character data** — authoritative for that character's selected classes, subclass, spells, items, features, and numeric totals. Import only the character data the user requests; do not bulk-copy, cache, or redistribute paid compendium text.
5. **User-owned book review or a private rules pack** — validation path for non-SRD mechanics that are not fully represented in the character payload.

Community wikis, search snippets, forum opinions, and third-party APIs may identify a possible issue but may not close an audit finding.

Every implemented rule must record:

- stable rule ID and feature name;
- ruleset and source version;
- official URL or book/page reference;
- license/provenance class: SRD, public reference, or user-owned;
- the exact structured behavior Altered implements;
- implementation location;
- automated test IDs;
- last reviewed date and review result.

## Required audit artifacts

Create and maintain these artifacts during execution:

1. **Rules ledger** — one row for every automated or displayed rule.
2. **Interaction matrix** — every rule crossed with every state that can change it.
3. **Content manifest** — counts and hashes for SRD classes, subclasses, items, spells, creatures, and rules records.
4. **Import fidelity report** — source values versus normalized Altered values, including omissions and conservative fallbacks.
5. **Gap register** — severity, evidence, affected controls, fix, regression tests, and resolution commit.
6. **Release evidence** — typecheck, unit, integration, catalog, browser, mobile, accessibility, offline, and security results.

The ledger should use four honest automation states:

- **Calculated** — Altered can execute the mechanic completely.
- **Conditional** — Altered can execute it after the user supplies a target or battlefield fact.
- **Reference only** — visible with accurate guidance but not executable.
- **Unsupported** — clearly identified and never guessed.

## Pass 1 — Inventory every intended function

Build an inventory from the running UI, schema, engine, rules data, importer, storage, service worker, and server.

For every button, menu item, selector, field, automatic transition, and displayed total, record:

- when it appears;
- its prerequisite and action cost;
- state read and state changed;
- resource spent or restored;
- roll formula and result format;
- conditions, durations, concentration, and ending triggers;
- form behavior;
- persistence behavior;
- user-visible success, disabled, and error states;
- existing tests and missing tests.

This inventory is the audit's scope contract. A control with no ledger entry is a defect.

## Pass 2 — Core 2024 engine audit

Audit these rules before class or form features because every later result depends on them:

### Turn and action economy

- Action, Bonus Action, Reaction, movement, free interactions, and once-per-turn gates.
- Magic action versus spell casting time.
- One spell-slot expenditure per turn and cantrip interaction.
- Extra Action restrictions, especially Action Surge.
- Ready, Opportunity Attack, Dash, Disengage, Dodge, Help, Hide, Influence, Search, Study, and Utilize when Altered exposes them.
- Multiattack versus the Attack action and Extra Attack.

### D20 tests and rolls

- Ability checks, saving throws, attack rolls, Initiative, proficiency, Expertise, and Jack of All Trades.
- Advantage/Disadvantage accumulation and cancellation.
- natural 1, natural 20, critical ranges, critical damage dice, fixed damage, and half damage.
- attack-roll, saving-throw, automatic, recharge, limited-use, and mixed Multiattack actions.
- Grapple, Shove, escape procedures, target size, reach, and conditional riders.

### Combat state

- Armor Class candidates and non-stacking formulas.
- Hit Points, Temporary Hit Points, damage types, resistance, immunity, vulnerability, healing, and zero-HP transitions.
- Concentration checks and every way Concentration ends.
- all 2024 conditions, including Exhaustion levels and target-dependent limitations.
- movement modes, difficult terrain, forced movement, size, reach, senses, cover, and visibility where represented.
- Short Rest, Long Rest, per-turn, recharge, per-rest, and per-day recovery.

Each rule receives truth-table tests for legal, illegal, boundary, and conflicting states.

## Pass 3 — Class and subclass interaction audit

Audit all twelve 2024 base classes: Barbarian, Bard, Cleric, Druid, Fighter, Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, and Wizard.

For each class level and feature that can affect the active sheet, verify:

- acquisition level and scaling;
- action cost and use frequency;
- resource maximum, spending, recovery, and multiclass behavior;
- required ability, proficiency, equipment, anatomy, speech, target, or spellcasting capability;
- whether the feature is retained, usable, modified, or irrelevant in each transformation profile;
- interactions with Rage, Concentration, conditions, armor, shields, weapons, and form attacks;
- whether it modifies an Attack action, any attack, a weapon attack, an Unarmed Strike, a Beast attack, a spell, a save, a check, movement, AC, HP, or Temporary HP;
- whether the UI can execute it, must request a condition, or must present it as reference only.

Subclass coverage is divided into:

- **SRD subclasses:** fully source-ledgered and regression-tested.
- **User-owned 2024 subclasses:** validate imported feature identity and numeric effects; add executable behavior through structured private rules definitions without reproducing paid descriptive text.
- **Legacy/homebrew subclasses:** reject from the 2024-only path or label explicitly; never silently apply 2024 mechanics to an incompatible legacy feature.

Priority deep audits:

1. Druid and Circle of the Moon.
2. Barbarian and all Rage interactions.
3. Monk, Fighter, Rogue, Paladin, and Ranger attack/equipment interactions.
4. all spellcasting classes and form-specific spell restrictions.
5. remaining retained passive, reaction, and resource features.

## Pass 4 — Forms and transformation audit

Audit every supported profile:

- Base Form.
- Wild Shape.
- Polymorph.
- True Polymorph.
- Shapechange.
- Animal Shapes.
- additive overlays.
- supported custom/private transformations.

For each profile, create a replace/retain matrix covering:

- six abilities;
- Proficiency Bonus;
- skill and saving-throw proficiencies and exact modifiers;
- Initiative;
- AC and every competing formula;
- HP and Temporary HP;
- size, speeds, senses, creature type, languages, and speech;
- attacks, Multiattack, weapon properties, Unarmed Strike, and natural weapons;
- class, subclass, species, feat, background, and item features;
- spellcasting, prepared spells, Circle spells, costly/consumed components, and Concentration;
- equipment worn, carried, merged, dropped, or unusable due to anatomy;
- conditions, ongoing effects, Rage, resources, and action economy;
- transformation eligibility, known/seen-form rules, CR limits, duration, switching, voluntary ending, incapacitation, zero-HP endings, dispelling, and rest behavior.

### Creature-form data checks

For every SRD creature that can become a legal form:

- compare type, CR, size, AC, HP, abilities, saves, skills, speeds, senses, resistances, immunities, vulnerabilities, traits, actions, Bonus Actions, Reactions, recharge, and limited uses;
- parse every action into attack, save, automatic, or Multiattack components;
- require an attack roll for every action whose official stat block requires one;
- verify attack bonus, reach/range, target count, damage packets, conditions, escape DC, and replacement choices;
- quarantine any record that fails schema validation or disagrees with a pinned correction.

High-risk regression scenarios include Circle Forms AC, Moon temporary HP, Moon spell access, Beast Spells, Primal Strike, Lunar Form, Rage in Wild Shape, Multiattack, initiative changes, active overlays, and overlapping transformation effects.

## Pass 5 — Spells, items, and equipment audit

### Spells

First audit every spell that:

- changes form, size, anatomy, movement, AC, HP, Temporary HP, condition, resistance, or available actions;
- continues through a transformation;
- creates an attack or save used by Altered;
- is available through Circle of the Moon or Beast Spells;
- conflicts with Rage or Concentration.

Verify casting time, range/target prompt, components, duration, Concentration, slot level, upcasting, roll formula, save/attack type, damage, healing, active effect, and ending trigger.

### Items and equipment

Audit all SRD weapons, mastery properties, armor, shields, tools, adventuring gear, and magic items that Altered imports or exposes.

For each relevant item verify:

- equipped, held, worn, carried, attuned, charged, and active state;
- proficiency/training and ability used;
- attack, damage, range, reach, mastery, ammunition, loading, and thrown behavior;
- AC formula, Dexterity cap, Strength requirement, Stealth effect, and shield rules;
- action cost, charges, recharge timing, saving throw, spell effect, resistance, bonus, and conditional effect;
- form compatibility based on equipment disposition and anatomy;
- whether a numerical modifier was already included by D&D Beyond, preventing double application.

Paid items may be executed only from validated owned-character data or a private structured definition. Unknown effects remain visible but inactive.

## Pass 6 — Import and provenance audit

Create representative public D&D Beyond characters covering:

- every base class;
- every SRD subclass;
- multiclass combinations;
- each supported transformation profile;
- armor, shields, weapon mastery, magic items, feats, resistances, immunities, spellcasting, limited uses, and custom modifiers;
- levels 1, subclass entry, major scaling breakpoints, and level 20.

For every fixture, compare D&D Beyond with Altered field by field:

- class/subclass identity and levels;
- abilities, PB, HP, AC, Initiative, saves, skills, speeds, senses, and defenses;
- inventory, equipped/attuned state, attacks, spells, slots, prepared state, feats, resources, and legal forms;
- source/ruleset identity so 2014 content cannot enter a 2024-only calculation unnoticed.

The import review must show verified, inferred, missing, unsupported, and conflicting fields before confirmation. Unknown data must never be converted into a guessed mechanical grant.

Sanitize fixtures to avoid committing private character payloads or paid rules text. Keep only the minimum structured facts necessary for tests.

## Pass 7 — Automated and live-product verification

### Automated layers

- schema and migration tests;
- pure rules-engine unit tests with injected deterministic dice;
- table-driven rule truth tests;
- pairwise and high-risk multi-state interaction tests;
- catalog counts, hashes, provenance, normalization, and quarantines;
- importer contract and redacted fixture tests;
- persistence and corrupted-state recovery;
- build reproducibility and standalone/PWA parity;
- server proxy host allowlists, response limits, no-store behavior, and failure handling.

Use property-based invariants where useful:

- resources never drop below zero or exceed their maximum;
- spending one Action never spends a Bonus Action;
- Temporary HP never stacks;
- opposing Advantage and Disadvantage cancel;
- a form switch never refreshes Temporary HP unless the rule says it does;
- ending the source effect removes all dependent modifiers;
- the displayed formula and engine result always agree;
- unsupported content never becomes executable.

### Live browser matrix

Test desktop and 390 × 844 phone layouts with mouse, touch, and keyboard:

- every button and menu path;
- all enabled/disabled transitions and explanations;
- transform, switch form, attack, cast, take damage, save Concentration, end effect, rest, reload, export, and re-import workflows;
- no horizontal overflow, trapped dialog focus, missing accessible names, stale result, hidden blocker, console error, or state divergence;
- reduced-motion behavior and persistent non-base form aura;
- offline startup with pinned built-in rules and explicit warnings when live sources are unavailable.

## Pass 8 — Gap correction and release gates

Classify findings:

- **P0:** incorrect resource, action economy, attack/save, damage, AC/HP, form ending, or unauthorized content behavior.
- **P1:** incorrect class/subclass/item/form interaction, import omission, misleading availability, or persistence error.
- **P2:** incomplete guidance, usability, accessibility, layout, or low-risk reference issue.
- **P3:** polish or future automation outside the present intended scope.

Fix in this order: shared engine defect, form engine defect, importer defect, content-data defect, UI explanation, polish.

Every fix requires:

1. an official-source ledger entry;
2. a failing regression test written before or with the fix;
3. engine/schema correction;
4. UI-state and explanation verification;
5. full verification suite;
6. updated coverage report and release evidence.

No release is acceptable unless:

- all P0 and P1 findings are closed;
- every executable control has an official-source ledger entry and positive/negative tests;
- the twelve-class/form interaction matrix is complete;
- all supported form profiles pass their replace/retain matrices;
- catalog validation has zero unreviewed mismatches;
- TypeScript, build, automated tests, live desktop, and live mobile tests pass;
- browser console errors are zero;
- unsupported and user-owned content boundaries are accurate and visible;
- the app reports its rules baseline and last successful audit date.

## Keeping the rules current

Pin production calculations to a reviewed rules release; do not silently change gameplay from a live response.

Add a rules-update checker that:

- detects a new official SRD version, SRD file hash, Basic Rules change, Sage Advice update, or core-book errata;
- creates a review report showing affected ledger entries;
- blocks promotion of changed data until relevant tests and human review pass;
- preserves the last validated offline rules pack when a source is unavailable or malformed;
- records source version, hash, review date, and Altered release in the UI.

“Current” should mean **latest official version that has passed Altered's audit**, not unreviewed automatic mutation.

## Recommended execution order

1. Create the rules ledger and complete the UI/function inventory.
2. Close core-engine gaps, especially Exhaustion and target-dependent conditions.
3. Complete the form replace/retain matrices and creature-action audit.
4. Complete Druid/Circle of the Moon and Barbarian interaction audits.
5. Audit the other eleven base classes and all SRD subclasses.
6. Audit transformation-relevant spells, then equipment and items.
7. Expand representative import fixtures and 2024/legacy detection.
8. Run the full automated, desktop, and phone audit.
9. Fix findings by severity and repeat until all release gates pass.
10. Publish the ledger, gap report, coverage report, and reproducible release evidence with the next version.

