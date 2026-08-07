# Altered v0.24.3 QA report

## v0.24.3 account and compact-dashboard verification

- Anonymous page requests receive only the sign-in screen; authenticated requests receive the application with private, non-caching HTML.
- Account status exposes only the display name and email to the client. The platform identity ID stays server-side, and Altered stores no passwords.
- Every hosted data route requires authenticated identity plus the same-origin application marker. Direct anonymous requests return 401; authenticated non-app requests return 403.
- The hosted service worker keeps authenticated HTML and navigation responses out of Cache Storage.
- Four existing side controls use keyboard-accessible native disclosures, and optional form lookup/artwork controls use one additional disclosure without changing control IDs or handlers.
- The document is viewport-bound at desktop and phone sizes; the active tab and opened disclosure panels own overflow.
- Strict TypeScript checking, clean build, **150/150 automated tests**, exact-worker desktop/phone startup, and live rendered interaction checks pass.

## v0.24.2 public-link security verification

- Public access changes only the site gate; application saves and private packs remain browser-local and retain their existing schemas.
- D&D Beyond and SRD routes require the app's same-origin request marker, reject cross-site browser requests, apply bounded best-effort per-address request limits, and return `no-store` responses.
- Upstream routes remain fixed-host, numeric/source constrained, response-size limited, timed out, non-credentialed, and excluded from the service-worker cache.
- Cross-origin opener/resource policies and existing content, framing, referrer, permissions, and transport security headers are applied by the hosted worker.

## v0.24.1 hosted-release verification

- Strict TypeScript typecheck, clean PWA/standalone/worker build, and audit-evidence generation: passing.
- Automated engine, schema, import, storage, content, UI-contract, PWA, proxy, accessibility-contract, and security checks: **149/149 passing**.
- Exact generated hosted worker startup: passing at 1280 × 900 desktop and 390 × 844 phone dimensions.
- Production-only bundle corruption was reproduced and fixed; the regression now executes the generated worker and asserts a ready Ferocitus sheet rather than checking source text alone.
- Live public Ferocitus D&D Beyond import completed through the hosted route, including its review gate, six selected forms, thirteen spells, and private item records.
- Brown Bear Multiattack produced independent Bite and Claw d20 attack totals and damage; the active-form aura remained visible through actions until the form ended.
- Barkskin used a Bonus Action, retained the Action, set the Armor Class minimum to 17, and persisted through Wild Shape.
- Circle of the Moon spells remained available in Wild Shape and became visibly blocked by Rage. Rage resistance reduced incoming Slashing damage before Temporary HP.
- Help search, settings, reduced-motion/aura controls, Initiative, all five sheet tabs, SRD status, form exit, new turns, and import confirmation executed without a runtime error.
- Current 2024 Player's Handbook errata behavior for Polymorph, True Polymorph, Shapechange, and Animal Shapes is locked by direct regression coverage.
- Compatibility: existing character saves, combat-state migrations, Altered JSON import/export, private owned-content packs, standalone downloads, and built-in artwork remain unchanged.
- Runtime dependencies remain TypeScript-only; no new production dependency or client network origin was added.

## v0.24.0 rules-audit verification

- Strict TypeScript typecheck: passing.
- Automated engine, schema, import, content, storage, UI-contract, PWA, proxy, and security checks: 141 passing before live browser QA.
- New truth-table coverage: Exhaustion, spell-slot turn limit, Relentless Rage, 0 HP and Death Saves, feature-retention leakage, Feral Senses, Jack of All Trades, Reliable Talent, Slippery Mind, Indomitable Might, Mindless Rage, Champion Survivor, item provenance, and 2024-only import blocking.
- Reproducible evidence: `npm run audit` generates `AUDIT_EVIDENCE.json`, including content-pack record counts and SHA-256 hashes plus the rule/function interaction matrix.
- Remaining conditional and unsupported boundaries are recorded in `AUDIT_GAP_REGISTER.md`; none are presented as fully calculated.

## v0.24.0 final live browser verification

The generated `dist` PWA was loaded from the local production server and exercised through the visible browser UI.

Verified:

- The searchable Help center opens from the persistent top-bar control, filters its fifteen concise topics, exposes a visible no-results state, and can restart the walkthrough.
- The five walkthrough targets advance in order, remain non-modal, can be skipped or closed, produce no runtime errors, and stay completed after a full reload.
- Form search returns the expected form while retaining Base Form and the current selection for recovery; status chips explain selection, active state, missing requirements, and action cost.
- All six supplied form images load under the exact matching creature ID, expose useful alternative text, preserve their aspect ratio with cover cropping, and remain available in both PWA and standalone builds. Tiger was also verified as the active pulsing form with no browser warnings or errors.
- A storage-clean launch now selects bundled Ferocitus automatically with 80/80 HP, full Wild Shape and Rage resources, all six forms, and no browser warnings or errors.
- A startup production-bundle failure caused by a missing newly imported module was reproduced, fixed by automatically bundling every compiled source module, and regression-checked with a clean page load.
- Final fresh-page browser diagnostics contained zero console/runtime errors.
- Barkskin spent its Bonus Action, left the Action available, raised Armor Class to 17, and continued through Wild Shape.
- Brown Bear Moon Wild Shape exposed Starry Wisp, Cure Wounds, Moonbeam, and Conjure Animals while the Magic Action was available; Rage blocked spellcasting with a visible explanation.
- Brown Bear Multiattack produced independent Bite and Claw attack rolls, to-hit totals, damage packets, on-hit guidance, and a potential-damage total.
- Wild Shape and Rage retained independent Action/Bonus Action state, resource spending, and disabled-state explanations.
- The transformed portrait ran three continuous visual effects (`alteredLivingAura`, `alteredPortraitPulse`/`alteredPortraitGlow`, and `alteredVisibleFormPulse`) with infinite iteration until form release; Base Form retained only the one-time dissipation animation.
- Exhaustion level 2 reduced every displayed D20 Test by 4 and every Speed by 10 feet, and exposed a clear one-level reduction control.
- Import & Content, Settings, all five sheet tabs, rules-catalog status checking, Export, and Clear Activity executed without a browser error. Clear Activity preserved non-log state and disabled itself when empty.
- The live SRD support status remained current at 1,808 legal SRD 5.2.1 records.
- The desktop viewport had no horizontal overflow. The existing 390 × 844 responsive regression remained covered by the prior live pass and the current CSS/UI contract checks.
- A partially unmarked D&D Beyond payload now remains importable only with an explicit ruleset-review warning; Legacy and mixed payloads remain blocked from the 2024-only engine.

Final automated result after the bundled Ferocitus pass: **146/146 passing**.

## Previous v0.23.2 QA evidence

## Automated verification

- Strict TypeScript compilation: pass
- Reproducible standalone and PWA build: pass
- Node test suite: 129/129 pass
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
- Independent d20 rolls for every Multiattack attack, with clear to-hit totals and component damage.
- Natural 1 automatic misses, natural 20 automatic hits/critical hits, Champion 19–20 and 18–20 critical ranges, and eligible damage-dice doubling.
- Situational Advantage/Disadvantage combined with automatic condition sources, including correct cancellation.
- On-hit Prone/Grappled/Restrained effects, failed-save effects, escape DCs, size limits, and durations.
- Lion’s two-Rend and Rend + Roar Multiattack options.
- Giant Goat Charge’s selectable prerequisite, extra 2d4 damage, and Prone rider.
- Base-form Unarmed Strike damage, Grapple, and Shove options using the 2024 attack/save procedures.
- Live SRD fixed-damage, secondary-damage, replacement-Multiattack, and half-on-success normalization.
- Primary-source corrections for upstream Cat-size and Panther-Stealth parsing errors.
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
- Final v0.23.2 live pass: Brown Bear replacement form and Goliath Large Form overlay each displayed the stronger two-second pulse with an infinite running animation; ending each transformation removed the pulse and restored the unlit Base Form. Brown Bear Initiative changed from base Dexterity +2 to form Dexterity +1. No browser errors were recorded.

Runtime page errors during the final interaction pass: 0.

## Deliberate boundaries

Unsupported or target-dependent mechanics remain visible and conservative instead of being guessed. See `RULES_COVERAGE.md` for the exact automation boundary.
