# Altered v0.21.0 QA report

## Automated verification

- Strict TypeScript compilation: pass
- Reproducible standalone and PWA build: pass
- Node test suite: 116/116 pass
- Schema, content-registry, storage, owned-content, data-integrity, and rules-engine suites: pass
- Runtime dependencies: project-local Node.js v24.18.0 and TypeScript 5.8.3

## Live browser verification

The hostable PWA was tested from a local HTTP origin against the generated `dist` output.

Verified:

- Initial load, character switching, reload persistence, settings persistence, and clean console output.
- Character changes reset the Latest Result panel so another character's roll cannot remain visible.
- Tab-state synchronization after character changes and keyboard navigation across every sheet tab.
- Accessible dialog names and an accessible condition selector.
- Wild Shape selection, activation, direct form changes, legal exit costs, and form-resource spending.
- Attack, save-based, automatic, and Multiattack action renderers.
- Recharge actions lock after use, persist across reloads, report failed turn-start rolls, and unlock on a qualifying roll.
- Recharging attack, save, and automatic actions share the same enforcement path.
- Per-day form actions show remaining uses, lock when spent, remain scoped to the form, and recover on a Long Rest.
- Mixed Multiattacks resolve attack and saving-throw child actions without charging the parent Action more than once.
- Advantage, Disadvantage, Reckless Attack, critical damage, optional Radiant damage, and action-economy blocking.
- Damage, resistance, Temporary HP overflow, healing, and both Temporary HP conflict choices.
- Saves, skills, spells, ongoing spell effects, concentration checks, and voluntary concentration ending.
- Polymorph restrictions and ending behavior.
- Shapechange spellcasting, form switching, and non-refreshing transformation Temporary HP.
- Conditions, condition removal, clearing all conditions, turn changes, Short Rest, and Long Rest.
- Short and Long Rests restore the full turn budget after actions have been spent.
- Rage, Rage extension, Wild Resurgence exchanges, and rest recovery.
- Character JSON import/export and private-pack template export.
- Public D&D Beyond structured import, import review, numeric-ID parsing, and private-character guidance.
- D&D Beyond proxy fixed-host routing, response bounds, `no-store` behavior, successful public response, and safe 403 handling.
- SRD support proxy fixed-host routing, domain whitelist, source filter, 25-record result bound, `no-store` behavior, and invalid-domain rejection.
- Live SRD catalog health: 1,808 records across all 12 expected SRD 5.2.1 domains.
- Full live catalog normalization: 331/331 creatures, including 91 Beasts and 989 executable actions, followed by 331/331 Altered schema validations.
- Ferocitus-shaped importer regression: 80 HP, AC 16, exact saves and skills, 4/3/2 spell slots, Rage/Wild Shape/Large Form resources, prepared spells, and six legal forms.
- Live public Ferocitus import: STR 15, DEX 14, CON 16, INT 12, WIS 16, CHA 12; Strength and Constitution save proficiency only; 4 skills, 9 payload spells plus 4 restored Circle spells, and all six selected forms.
- Imported Tiger workflow: transformation, Moon Druid AC/Temporary HP, spell blocking, Rend attack roll, voluntary form exit, and Long Rest recovery.
- Private transformation creation, application, persistence, export, activation, deactivation, and removal.
- Artwork upload, optimization/storage, and reset.
- Every dialog open/close/cancel path.
- Updated additive-transformation `Activate` and explicit `End …` labels.
- Service-worker update path loads a newly built bundle while preserving offline fallbacks.
- Service worker bypasses every `/api/` request so character payloads and changing SRD records never enter offline storage.
- Transformation controls expose current action-economy blockers before the user clicks.
- Wild Resurgence controls are disabled when the required resource/slot state is not met.
- Non-finite combat inputs and malformed persisted state are bounded or discarded without corrupting the sheet.
- Damaged stored private-pack records are removed safely during startup.
- The 390 × 844 responsive layout has no horizontal overflow.
- GET/HEAD behavior, rejected methods, missing-file handling, cache policy, security headers, and both fixed-host proxies were checked against the running local server.
- Opt-in LAN mode binds to all private interfaces while ordinary startup remains loopback-only; the app, SRD status, and public D&D Beyond import returned HTTP 200 through the PC's Wi-Fi address.
- Clear Activity removes only the persisted recent-activity history, reports success, disables itself when empty, and preserves HP, resources, conditions, and transformation state.
- Circle of the Moon subclass spells are restored when omitted by the D&D Beyond payload without duplicating spells already present.
- Moon Wild Shape exposes only its legal Circle spell exceptions; Rage blocks those exceptions and visibly explains why.
- Higher-level spell slots remain valid after a base-level slot is expended, with explicit slot selection and supported upcast dice.
- Action and spell buttons disable immediately when their action-economy cost is unavailable and show the blocker before a click.
- Rage activation produces a persistent effect summary and applies resistance/Strength benefits without incorrectly adding Rage Damage to beast stat-block attacks.
- Live Ferocitus Brown Bear workflow: four Circle spells initially ready; level 3 Cure Wounds rolled 6d8 + 3; level 3 Moonbeam rolled 3d10 with Constitution-save/half-damage guidance; Starry Wisp rolled its level-scaled attack; Conjure Animals became unavailable only after its level 3 slots were spent.

Runtime page errors during the final interaction pass: 0.

## Deliberate boundaries

Unsupported or target-dependent mechanics remain visible and conservative instead of being guessed. See `RULES_COVERAGE.md` for the exact automation boundary.
