# Altered v0.18.1 QA report

## Automated verification

- Strict TypeScript compilation: pass
- Reproducible standalone and PWA build: pass
- Node test suite: 83/83 pass
- Schema, content-registry, storage, owned-content, data-integrity, and rules-engine suites: pass
- Runtime dependencies: project-local Node.js v24.18.0 and TypeScript 5.8.3

## Live browser verification

The hostable PWA was tested from a local HTTP origin against the generated `dist` output.

Verified:

- Initial load, character switching, reload persistence, settings persistence, and clean console output.
- Wild Shape selection, activation, direct form changes, legal exit costs, and form-resource spending.
- Attack, save-based, automatic, and Multiattack action renderers.
- Advantage, Disadvantage, Reckless Attack, critical damage, optional Radiant damage, and action-economy blocking.
- Damage, resistance, Temporary HP overflow, healing, and both Temporary HP conflict choices.
- Saves, skills, spells, ongoing spell effects, concentration checks, and voluntary concentration ending.
- Polymorph restrictions and ending behavior.
- Shapechange spellcasting, form switching, and non-refreshing transformation Temporary HP.
- Conditions, condition removal, clearing all conditions, turn changes, Short Rest, and Long Rest.
- Rage, Rage extension, Wild Resurgence exchanges, and rest recovery.
- Character JSON import/export and private-pack template export.
- Private transformation creation, application, persistence, export, activation, deactivation, and removal.
- Artwork upload, optimization/storage, and reset.
- Every dialog open/close/cancel path.
- Updated additive-transformation `Activate` and explicit `End …` labels.
- Service-worker update path loads a newly built bundle while preserving offline fallbacks.

Runtime page errors during the final interaction pass: 0.

## Deliberate boundaries

Unsupported or target-dependent mechanics remain visible and conservative instead of being guessed. See `RULES_COVERAGE.md` for the exact automation boundary.
