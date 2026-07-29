# Altered v0.18.1 release notes

## Status

Altered is a cross-platform local alpha for Android, Windows, and macOS browsers. It is suitable for supervised gameplay testing, not yet a commercial release.

## Maintenance update

- Builds now use a cross-platform cleanup script.
- `npm start` builds the project and serves it at `http://127.0.0.1:4173`.
- Online launches prefer current application assets while retaining the offline cache as a fallback.
- Additive transformations now use `Activate`; their removal option uses its explicit `End …` label.
- Standalone-file instructions now match the generated `altered-standalone.html` artifact.

## Current capabilities

- Rules-aware replacement and additive transformations, including Wild Shape, Polymorph, Shapechange, Animal Shapes, True Polymorph, and private local forms.
- Integrated action economy, attacks, saves, skills, spellcasting, conditions, damage, healing, Temporary HP choices, concentration, rests, and resources.
- Validated character JSON imports and private owned-content packs with a local transformation builder.
- Per-character and per-form artwork overrides stored locally.
- Versioned rules/content registry with source and verification metadata.

## Verification

- Strict TypeScript compilation: pass.
- Automated tests: 83/83 pass.
- Standalone and PWA generation: pass.
- Live browser interaction coverage: transformations, rolls, damage/healing, conditions, turns/rests, spells/concentration, imports/exports, private packs, settings persistence, artwork upload/reset, and Temporary HP choices.
- Runtime page errors during the interaction pass: 0.
