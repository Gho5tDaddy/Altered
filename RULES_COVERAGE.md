# Rules coverage — v0.24.5

## Fully calculated in the bundled rules pack

- Base Form and the verified bundled creature records.
- 2024 Wild Shape eligibility by Druid level, known-form count, Challenge Rating, Beast type, and Fly Speed access.
- Circle of the Moon Challenge Rating, Temporary HP, Circle Forms Armor Class, Improved Circle Forms Constitution-save bonus, Radiant damage option, always-prepared Circle spell restoration, and legal Circle spellcasting while Wild Shaped.
- Wild Shape replacement of physical abilities and retention of mental abilities, character HP, Proficiency Bonus, skill/save proficiencies, class features, and feats.
- Higher creature-versus-character skill and saving-throw modifier selection.
- Polymorph ends when its transformation Temporary HP reaches 0. Under the current official Player's Handbook errata, True Polymorph's Temporary HP vanish when the spell ends, while Shapechange and Animal Shapes grant transformation Temporary HP only for the first form and do not end merely because that pool reaches 0.
- Polymorph form eligibility without a seen-form requirement; Shapechange retains its separate seen-form restriction.
- Rage activation, resource use, physical damage resistance, Strength-check/save Advantage, weapon-or-Unarmed-Strike Rage Damage limits, spellcasting/Concentration conflict, duration extension, Persistent Rage, and rest behavior.
- Reckless Attack qualification for Strength-based attack rolls, including advantage/disadvantage cancellation.
- Barbarian and Monk Unarmored Defense competition.
- Built-in Barbarian, Monk, and Ranger movement calculations.
- Action Surge's extra non-Magic action and once-per-turn limit.
- Second Wind, Lay On Hands, Wild Resurgence exchanges, base-or-higher spell-slot spending, supported Circle-spell higher-slot scaling, and common resource recovery.
- Damage resistances, immunities, vulnerabilities, Temporary HP conflicts, healing, and damage-triggered Concentration checks.
- Exhaustion levels 0–6, their D20 Test and Speed penalties, Long Rest recovery, and death at level 6.
- The complete player-character 0 HP flow: massive damage, Unconscious, Death Saves, damage while at 0 HP, stabilization, natural 1/20, and healing recovery.
- 2024 Relentless Rage, including its Constitution save, twice-Barbarian-level HP result, increasing DC, and Short/Long Rest reset.
- Jack of All Trades on eligible untrained skill checks, Reliable Talent on proficient skills, Slippery Mind save proficiencies, Indomitable Might roll floors, Feral Senses, Mindless Rage, and Champion Survivor.
- Core condition effects used by the sheet: action blocking, speech/Concentration consequences, zero Speed, attack/check/save disadvantage, and automatic Strength/Dexterity save failures.
- Attack-roll, saving-throw, automatic, and mixed-action Multiattack creature actions, including start-of-turn recharge rolls and lockout.
- Natural 1 automatic misses, natural 20 automatic hits and critical hits, Champion expanded critical ranges for weapons and Unarmed Strikes, and critical doubling of eligible damage dice only.
- Rules-aware situational Advantage/Disadvantage that combines with automatic sources and cancels opposing sources.
- Independent Multiattack attack rolls, legal replacement sequences, attack damage conversions, optional once-per-turn damage, and target effects.
- Attack riders with declared prerequisites, extra damage, and on-hit conditions.
- 2024 Unarmed Strike damage, Grapple, and Shove procedures, including target-selected Strength or Dexterity saves.
- Failed-save effects, half damage from the same roll rounded down, and ongoing-damage timing labels.
- Per-day creature-action use tracking with Long Rest recovery.
- Live SRD 5.2.1 support-catalog validation across 1,808 reusable records. Relevant selected Beast forms can be normalized into executable local form data during character import.

## Calculated only when the imported sheet declares the feature

- Public D&D Beyond character data is normalized into Altered's schema for identity, classes, abilities, HP, AC, speed, proficiencies, exact save/skill totals, equipped numeric modifiers, spell slots, prepared/known spells, feats, limited-use resources, and recognizable legal forms.
- Imported D&D Beyond items retain private identity, equipped/attuned state, source IDs, ruleset markers, and whether their numeric effects are already included. Legacy and mixed-rules characters are blocked from the 2024-only engine.
- Primal Strike and similar selected class options.
- Imported structured speed bonuses, resistances, immunities, save bonuses, and Armor Class formulas.
- War Caster, Eldritch Mind, and other named features that require presence on the character.
- Explicit custom transformation grants with a supported profile.

## Evaluated conservatively

These remain visible and receive active, conditional, inactive, or table-ruling status when target selection, anatomy, equipment, or exact subclass text is required:

- Bardic Inspiration and communication-dependent features.
- Cleric and Paladin Channel Divinity options involving symbols, weapons, or option-specific wording.
- Fighting Styles, Weapon Mastery, Sneak Attack, Blessed Strikes, Martial Arts, Extra Attack versus Multiattack, and equipment-dependent attacks.
- Species body traits during replacement transformations; already-active timed effects can persist as overlays when declared.
- Imported feats, subclasses, magic items, legacy content, and homebrew features without a structured grant definition.
- Every SRD 5.2.1 subclass is listed feature-by-feature with an explicit calculated, conditional, or reference-only classification. Paid non-SRD subclass mechanics still require imported structured data.

## Not yet automated

- Private or account-authenticated D&D Beyond characters; both the hosted and local structured adapters require the character's privacy setting to be Public during import.
- PDF character-sheet extraction. The primary workflow is a temporary-public D&D Beyond link/ID or an Altered JSON backup.
- Complete paid-book subclass, feat, spell, and magic-item automation.
- Nested replacement transformations.
- Target-specific relationships such as Frightened line of sight or grapple source distance.
- Full equipment/anatomy simulation.
- Automatic real-time duration expiration outside the app's turn state.
- Shared campaigns and cloud synchronization.
- Tool-specific ability checks and automatic battlefield position, cover, target HP, or area-effect tracking.

Altered does not silently invent mechanics for unsupported features. An unknown replacement transformation is disabled until assigned an explicit supported profile.

## Catalog boundary

The legal catalog is supporting infrastructure, not the app's primary interface. Altered surfaces a catalog record only when it is relevant to the imported character or a transformation. A healthy status means the live SRD 5.2.1 source meets or exceeds the verified baseline; it is not a promise that an undocumented third-party service can never change. If the catalog is unavailable or fails validation, the app keeps its validated built-in rules and warns instead of importing uncertain data.
