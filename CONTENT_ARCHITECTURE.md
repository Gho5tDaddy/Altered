# Altered content architecture

## Design goal

The rules engine must not depend on one giant character JSON file or one unversioned database. Altered separates stable shared rules, user-owned character data, and changing combat state.

## Layer 1 — deterministic rules engine

TypeScript functions calculate legal forms, replacement/retention behavior, statistics, action economy, resources, attacks, spells, conditions, Temporary Hit Points, damage, healing, rests, and transformation endings. The UI displays resolved results and does not duplicate these calculations.

## Layer 2 — versioned content packs

`src/content-registry.ts` wraps content in domains:

- creatures
- class features
- species features
- feats
- spells
- items
- conditions
- transformation profiles

Every pack includes:

- stable pack ID
- semantic version
- target ruleset
- source and license
- verification date
- load priority
- built-in/extension status
- structured records

This lets a content record be updated without rewriting character state or the user interface.

## Layer 3 — imported character

The character JSON contains only that character's classes, subclass, species, ability scores, HP maximum, proficiencies, known/seen forms, prepared spells, resources, feats, equipment, and structured custom rules. It does not contain live combat mutations.

## Layer 4 — mutable combat state

Current HP, Temporary Hit Points, resources, spell slots, action economy, active form, Rage, Concentration, conditions, overlays, and the activity log are stored separately. Ending a form never overwrites the imported base character.

## Layer 5 — local user assets and settings

IndexedDB stores custom artwork, preferences, and future extension packs. The standalone build falls back to localStorage when IndexedDB is unavailable and to session memory if browser storage is blocked.

## Runtime choice

For the current offline-first PWA, validated TypeScript/JSON content compiled into indexed JavaScript objects is faster and simpler than a server database. IndexedDB is reserved for user-generated or optional data. A hosted service can later mirror the same pack metadata in SQLite/PostgreSQL without changing the rules-engine API.

## Legal boundary

Only legally distributable content and original presentation assets should be bundled. Paid-book text and artwork are not copied into built-in packs. The engine can evaluate structured mechanics imported from a user's owned character data, but unknown mechanics remain conditional rather than guessed.
