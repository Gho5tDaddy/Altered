# Rules coverage — v0.18.1

## Fully calculated in the bundled rules pack

- Base Form and the verified bundled creature records.
- 2024 Wild Shape eligibility by Druid level, known-form count, Challenge Rating, Beast type, and Fly Speed access.
- Circle of the Moon Challenge Rating, Temporary HP, Circle Forms Armor Class, Improved Circle Forms Constitution-save bonus, Radiant damage option, and legal Moon-spell visibility.
- Wild Shape replacement of physical abilities and retention of mental abilities, character HP, Proficiency Bonus, skill/save proficiencies, class features, and feats.
- Higher creature-versus-character skill and saving-throw modifier selection.
- Polymorph and Shapechange core profiles and their transformation Temporary HP endings.
- Polymorph form eligibility without a seen-form requirement; Shapechange retains its separate seen-form restriction.
- Rage activation, resource use, physical damage resistance, spellcasting/Concentration conflict, duration extension, Persistent Rage, and rest behavior.
- Reckless Attack qualification for Strength-based attack rolls, including advantage/disadvantage cancellation.
- Barbarian and Monk Unarmored Defense competition.
- Built-in Barbarian, Monk, and Ranger movement calculations.
- Action Surge's extra non-Magic action and once-per-turn limit.
- Second Wind, Lay On Hands, Wild Resurgence exchanges, spell slots, and common resource recovery.
- Damage resistances, immunities, vulnerabilities, Temporary HP conflicts, healing, and damage-triggered Concentration checks.
- Core condition effects used by the sheet: action blocking, speech/Concentration consequences, zero Speed, attack/check/save disadvantage, and automatic Strength/Dexterity save failures.
- Attack-roll, saving-throw, automatic, and Multiattack creature actions.

## Calculated only when the imported sheet declares the feature

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

## Not yet automated

- Direct D&D Beyond account integration.
- General-purpose PDF character-sheet extraction.
- Complete paid-book subclass, feat, spell, and magic-item automation.
- Nested replacement transformations.
- Exhaustion levels and target-specific relationships such as Frightened line of sight or grapple source distance.
- Full equipment/anatomy simulation.
- Automatic real-time duration expiration outside the app's turn state.
- Shared campaigns and cloud synchronization.

Altered does not silently invent mechanics for unsupported features. An unknown replacement transformation is disabled until assigned an explicit supported profile.
