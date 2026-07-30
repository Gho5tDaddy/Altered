# Altered v0.23.2 release notes

## Status

Altered is a cross-platform local alpha for Android, Windows, and macOS browsers. It is suitable for supervised gameplay testing, not yet a commercial release.

## Combat-roll correctness and creature actions

- Every bundled creature action was checked against Wizards’ official SRD 5.2.1 rather than trusting third-party parsed values.
- Every attack that requires an attack roll now shows its own d20 total, including every component of Multiattack.
- Natural 1, natural 20, Advantage/Disadvantage cancellation, Champion critical ranges, critical damage dice, fixed damage, and secondary damage packets are resolved explicitly.
- On-hit and failed-save effects now show condition, target-size limit, escape DC, duration, and notes in the result.
- The situational selector lets the user add target/battlefield Advantage or Disadvantage without overriding automatic condition rules.
- Lion can execute either two Rends or Rend + Roar as one Multiattack Action.
- Giant Goat Charge is an explicit prerequisite-controlled rider that adds 2d4 damage and Prone only when selected.
- Base form includes the 2024 damage, Grapple, and Shove options for Unarmed Strike.
- Spell attacks repeat their non-damage effect text in the resolved result, so effects such as Starry Wisp are not lost after the roll.
- Initiative now uses the current form's Dexterity and supported 2024 modifiers, including Alert, Feral Instinct, Remarkable Athlete, conditions, and Surprise.
- Every non-base transformation, including additive overlays, receives the stronger pulse and remains visibly active through rolls and other interface updates until all forms end.

## Actions, Rage, and Circle of the Moon spells

- Public D&D Beyond imports now restore subclass-granted Circle of the Moon spells that are absent from the character-service spell arrays.
- Starry Wisp, Cure Wounds, Moonbeam, and Conjure Animals are available to the tested Druid 5 Moon character, and later Circle spells unlock at the correct Druid levels.
- Circle spells remain usable while Wild Shaped unless Rage, a spent Magic Action, missing spell slots, or another current rule blocks them.
- Level 1+ spells can use a slot of their level or higher. Supported Circle spells automatically add their documented higher-slot dice.
- The Spells tab puts usable spells first, identifies Circle spells, offers the legal slot levels, and folds blocked spells into a clearly labeled disclosure.
- Rage now has a persistent Active Now card showing physical damage resistance, Strength advantages, and the spellcasting restriction.
- The Rage card explicitly explains that Rage Damage applies to Strength attacks made with a weapon or Unarmed Strike, not beast stat-block attacks.
- Actions and spells disable as soon as their Action, Bonus Action, Reaction, or Magic Action is spent and show the exact reason.

## Public character import and legal rules support

- Import a public D&D Beyond character by pasting its share link or numeric character ID.
- Structured character data is normalized and validated locally; a review screen shows verified, missing, and manual-review areas before import.
- The importer maps core character statistics, multiclass levels, saves, skills, prepared/known spells, slots, feats, resources, equipped numeric modifiers, and recognized legal Wild Shape forms.
- A fixed-host SRD 5.2.1 support catalog fills selected legal Beast forms that are not already bundled, without exposing a distracting encyclopedia in the main interface.
- The catalog health check covers a verified 1,808-record baseline across 12 SRD domains and falls back safely to built-in rules when unavailable.
- Live D&D Beyond variants for origin ability choices, HP overrides, starting-class save components, and feature-action resource labels are normalized without duplicate counters.
- Giant Octopus, Lion, and Tiger are included as verified executable 2024 forms.
- No D&D Beyond credentials are requested or forwarded. The local server accepts numeric IDs only, contacts one fixed D&D Beyond service, limits response size and time, and marks responses `no-store`.
- D&D Beyond's structured character service is undocumented. Altered surfaces that boundary and does not guess unsupported item text, homebrew mechanics, custom defenses, or missing form selections.

## Maintenance included

- Character changes now reliably restore the Actions tab’s visual and accessibility state.
- Character changes clear the previous sheet's Latest Result, preventing stale attack or spell totals from appearing under another character.
- Recharge actions are locked after use, roll automatically at the start of each turn, persist across reloads, and become available again only on a qualifying result.
- Recharging attacks and automatic actions now use the same enforcement as save actions.
- Per-day creature actions show their remaining uses, become unavailable when spent, persist across form changes, and reset on a Long Rest.
- Mixed Multiattacks can execute attack, save, and automatic child actions rather than silently skipping non-attack components.
- Transformation buttons show action-economy blockers before a click; Wild Resurgence controls are disabled when their exchange prerequisites are not met.
- The full 331-creature SRD catalog now normalizes without schema failures, including a verified correction for a malformed upstream Octopus record.
- Character-sheet tabs support Arrow, Home, and End keyboard navigation.
- Persisted combat state and installed private packs are validated and safely repaired during startup.
- Short and Long Rests restore the full turn budget so the sheet is immediately usable after resting.
- The static shell now includes named dialogs, a labeled condition selector, a local-only content policy, stronger local-server headers, and stable PWA identity metadata.
- Builds now use a cross-platform cleanup script.
- `npm start` builds the project and serves it at `http://127.0.0.1:4173`.
- `npm run start:lan` explicitly enables same-Wi-Fi phone access while ordinary startup remains restricted to the PC.
- Recent Activity has a clearly labeled `Clear Activity` control that clears only the history and disables itself when there is nothing to remove.
- Online launches prefer current application assets while retaining the offline cache as a fallback.
- API responses are excluded from the service-worker cache so live rules stay fresh and character payloads remain private.
- The local server now sends the Content Security Policy and restrictive browser permissions as response headers.
- Additive transformations now use `Activate`; their removal option uses its explicit `End …` label.
- Standalone-file instructions now match the generated `altered-standalone.html` artifact.

## Current capabilities

- Rules-aware replacement and additive transformations, including Wild Shape, Polymorph, Shapechange, Animal Shapes, True Polymorph, and private local forms.
- Integrated action economy, attacks, saves, skills, spellcasting, conditions, damage, healing, Temporary HP choices, concentration, rests, and resources.
- Validated D&D Beyond and Altered JSON imports, plus private owned-content packs with a local transformation builder.
- Per-character and per-form artwork overrides stored locally.
- Versioned rules/content registry with source and verification metadata.

## Verification

- Strict TypeScript compilation: pass.
- Automated tests: 129/129 pass.
- Standalone and PWA generation: pass.
- Live browser interaction coverage: transformations, rolls, damage/healing, conditions, turns/rests, spells/concentration, D&D Beyond success/privacy paths, imports/exports, private packs, settings persistence, artwork upload/reset, and Temporary HP choices.
- Full live SRD creature normalization: 331/331 pass, including 91 Beast records and 989 executable actions.
