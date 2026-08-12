# Changelog

## v0.25.1

- Moved the existing portrait and form chooser into a phone-only `Character & Form` disclosure, keeping the desktop presentation unchanged.
- Defaulted the phone disclosure closed after startup and walkthrough completion, increasing the Base Form action workspace from 112 to 256 pixels at the audited 390 × 844 viewport.
- Kept the selected or active form visible in the disclosure summary and retained the existing chooser, search, filters, status explanation, transformation controls, artwork, and aura.
- Added responsive, accessibility, interaction, and regression coverage without changing gameplay, saves, imports, exports, or private packs.

## v0.25.0

- Added a compact `Needs Setup` review for imported paid, campaign-shared, and homebrew character options that are not part of Altered's distributable SRD rules.
- Added a guided private-mechanics editor for reminders, conditional mechanics, Speed bonuses, damage resistance/immunity, Armor Class formulas, and activated transformations.
- Kept private confirmations character-specific, browser-local, schema-v1 compatible, exportable, and automatically reapplied after later character imports.
- Avoided requesting D&D Beyond credentials, scraping protected pages, copying book descriptions, or double-counting numeric totals already imported from the character sheet.
- Reduced false setup flags for built-in feat hooks, Ability Score Improvement, ordinary weapons, and the already-supported Circle of the Moon subclass.

## v0.24.5

- Replaced the clipped mobile selected-form thumbnail with a full-frame portrait preview that behaves consistently at phone and desktop sizes.
- Added an explicit `FORM PREVIEW` state before transformation while preserving `ACTIVE FORM` and its continuous pulse only after the transformation succeeds.
- Kept form selection, action economy, save data, imports, exports, and transformation rules unchanged.

## v0.24.4

- Replaced the tall phone header with one accessible Menu disclosure while preserving every existing account, Help, import, export, and settings control.
- Prevented action-economy, quick-feature, and resource strips from collapsing on small screens and kept the first action visible sooner inside the focused sheet tab.
- Renamed the unclear Why? tab to Rules, made open table drawers fit their content, and restored keyboard focus after the optional walkthrough closes.
- Kept standalone form artwork embedded while making hosted artwork load on demand, reducing authenticated page delivery without changing image availability or offline caching.

## v0.24.3

- Added a secure public account gate using Sign in with ChatGPT. Anyone with the link can sign in or create a free account; Altered never receives or stores passwords.
- Added an authenticated account indicator and sign-out control without changing browser-local character saves or private-content storage.
- Reworked the existing table controls into compact native disclosure panels and constrained the app to the viewport, leaving scrolling inside the active sheet tab or opened control only.
- Moved optional form search, filters, and artwork management into one compact disclosure while keeping transform status and primary actions visible.
- Prevented the hosted service worker from caching authenticated HTML or navigation responses and added runtime coverage for anonymous, authenticated, and direct-API access.

## v0.24.2

- Enabled public link access while keeping every visitor's saves, combat state, settings, artwork, and private packs isolated in that browser.
- Added same-origin application-request guards and bounded best-effort per-address rate limits to the public D&D Beyond and SRD support routes.
- Added cross-origin isolation headers, retained the fixed upstream allowlists and response limits, and continued excluding every API response from browser caches.
- Added runtime audit coverage for rejected direct API requests and kept all existing character, backup, private-pack, and standalone formats compatible.

## v0.24.1

- Fixed a production-only blank page caused by replacement-token expansion while assembling the standalone and hosted bundles.
- Made first paint independent of optional IndexedDB/private-pack hydration, with explicit ready/error startup markers and a bundled Ferocitus fallback.
- Added a dedicated hosted worker with bounded, fixed-host D&D Beyond and SRD 5.2.1 routes so public character import and live catalog support work away from the development PC.
- Split the hosted service worker from the local one and kept all `/api/` responses out of offline caches.
- Added an executable browser audit that starts the exact generated worker and verifies a ready Ferocitus sheet at desktop and 390 × 844 phone dimensions.
- Rechecked Polymorph, True Polymorph, Shapechange, and Animal Shapes against the current official 2024 Player's Handbook errata and locked their distinct Temporary HP endings in regression tests.
- Live-tested Ferocitus import, Brown Bear Multiattack rolls, Barkskin, Wild Shape, Rage, Moon spell access, Help, settings, Initiative, resource spending, and active-form aura behavior.
- Expanded the deterministic suite to 149 passing tests and retained the existing save, import/export, standalone, and private-pack formats.

## v0.24.0

- Bundled the validated Ferocitus character as the fresh-install default with full resources and all six selected forms, so the standalone phone file no longer depends on an earlier local import.
- Added app-ready built-in artwork for Brown Bear, Dire Wolf, Giant Octopus, Giant Spider, Lion, and Tiger in both the PWA and self-contained standalone build.
- Added an always-available, searchable Help center with compact guidance for setup, importing, forms, controls, resources, artwork, settings, troubleshooting, FAQ, and app scope.
- Added an optional five-step first-launch walkthrough that never blocks the sheet, skips unavailable targets, can be closed at any time, persists completion separately from character data, and can be restarted from Help.
- Added compact form search and purpose filters, clearer selected/active/available/requirements-missing states, and consistent icon-plus-label status chips that never depend on color alone.
- Improved portrait cropping and lazy loading, touch targets, focus treatment, reduced-motion handling, responsive Help layout, and restrained fantasy panel accents without adding runtime dependencies.
- Added a source-linked rules ledger, state-changing function inventory, content manifest generator, interaction matrix, and gap register.
- Added cumulative 2024 Exhaustion and the complete player-character 0 HP, instant-death, Unconscious, Death Save, stabilization, and healing flow.
- Made Relentless Rage executable with its increasing Constitution-save DC and twice-level HP result.
- Enforced the one-spell-slot-expenditure-per-turn rule across ordinary spells and transformation spells while keeping Actions and Bonus Actions independent.
- Added Jack of All Trades, Reliable Talent, Slippery Mind, Indomitable Might, Feral Senses, Mindless Rage, and Champion Survivor.
- Added all twelve SRD subclass feature sets with honest calculated, conditional, reference-only, or unsupported classifications.
- Prevented Rage Damage, Radiant Strikes, Champion critical ranges, and other class mechanics from leaking into forms that replace class features.
- Added D&D Beyond item provenance and 2024 ruleset evidence, with a hard import block for clearly Legacy or mixed-rules characters.
- Added persistent life-state and Relentless Rage migration to local saves, plus prominent zero-HP controls and explanations.
- Expanded automated coverage to 146 rules, import, schema, UI, storage, service-worker, catalog, artwork, and security checks.

## v0.23.2

- Extended the strong persistent pulsing glow to every non-base transformation, including replacement forms and additive spell, class, species, item, and private overlays.
- Active overlays now identify themselves as active forms around the portrait instead of leaving the portrait labeled Base Form.
- Increased pulse brightness, saturation, ring thickness, and outer glow while retaining the Reduce Motion and aura-disable accessibility controls.
- Verified live with Goliath Large Form and Brown Bear; both pulse indefinitely and return to an unlit Base Form when ended.

## v0.23.1

- Added a dedicated Initiative roller that uses the current form's Dexterity, Alert proficiency, Feral Instinct, Remarkable Athlete, conditions, and Surprise Advantage/Disadvantage rules.
- Clarified that changing form after Initiative is rolled does not change the established combat order.
- Made the active-form pulse lifecycle explicit: it runs continuously through form actions and rerenders, honors the Reduce Motion setting, and ends only when the transformation ends.
- Added deterministic Initiative and persistent-aura regression coverage; 129 automated tests pass.

## v0.23.0

- Re-audited every bundled creature action against Wizards’ official SRD 5.2.1 and added locked corrections for known upstream catalog errors.
- Added deterministic attack-roll resolution for normal rolls, Advantage, Disadvantage, natural 1, natural 20, and Champion critical ranges.
- Added a situational Advantage/Disadvantage selector that combines with automatic rules and cancels opposing sources correctly.
- Made attack and Multiattack results surface all on-hit conditions, escape DCs, target-size limits, durations, and conditional notes.
- Made Multiattack apply damage conversions and eligible optional damage correctly, and added legal variants such as Lion Rend + Roar.
- Added executable conditional attack riders, including Giant Goat Charge’s extra damage and Prone effect.
- Added all three 2024 Unarmed Strike choices: damage, Grapple, and Shove.
- Fixed the live SRD normalizer for fixed-damage attacks, secondary damage packets, Multiattack replacement clauses, target-size limits, and half damage on a successful save.
- Labeled ongoing damage at its actual timing and retained spell effect text in resolved spell-attack results.
- Corrected form-selection cleanup whenever damage, conditions, rest, or another rule ends a transformation.
- Expanded the deterministic regression suite to 128 passing tests and live-tested base attacks, condition cancellation, Brown Bear Multiattack, Lion Rend + Roar, and Moon-form spell attacks.

## v0.21.0

- Restored the 2024 Circle of the Moon always-prepared spell list when D&D Beyond omits subclass-granted spells from its character payload.
- Added executable Starry Wisp, Cure Wounds, Moonbeam, Conjure Animals, Fount of Moonlight, and Mass Cure Wounds records at their correct Circle of the Moon Druid levels.
- Kept Circle spells available while Wild Shaped and made Rage’s universal spellcasting block explicit.
- Added legal higher-level spell-slot selection and supported higher-slot damage/healing scaling for the Circle spell records.
- Added saving-throw abilities, half-damage guidance, and stored cast level for ongoing Concentration effects.
- Added a prominent Active Now panel explaining Rage, Moon Wild Shape, Temporary HP, spell access, and Concentration.
- Made Rage activation visibly change state and explain its resistances, Strength benefits, spell restriction, and weapon/Unarmed-Strike-only Rage Damage.
- Disabled spent Action, Bonus Action, Reaction, and Magic Action controls before a click and displayed the exact blocker on every action or spell.
- Reorganized spells into Available Now and an expandable Unavailable Right Now section with clear Circle spell badges and slot selectors.
- Expanded the regression suite to 116 tests covering missing Circle spells, duplicate prevention, higher-level slots, action availability, Rage in beast form, and the user-facing combat-state contract.

## v0.20.0

- Added explicit `start:lan` and `serve:lan` commands for same-Wi-Fi phone access without weakening the default loopback-only server.
- Added a persistent `Clear Activity` control that leaves all character and combat state untouched.
- Added a fixed-host, source-filtered SRD 5.2.1 support catalog with a 1,808-record health baseline across 12 legal content domains.
- Added on-demand enrichment for selected legal Beast forms missing from the built-in registry during public D&D Beyond import.
- Removed PDF import from the user workflow; the primary route is a temporary-public D&D Beyond link/ID with review before import.
- Hardened SRD creature normalization across all 331 current catalog creatures and schema-validated every normalized result.
- Correctly parses save DCs, fixed damage, condition effects, range bands, mixed Multiattacks, recharge limits, and per-day use limits.
- Added action-use persistence, visible remaining-use counts, Long Rest recovery, and recharge support for attacks and automatic actions.
- Added pre-click action-economy guidance for transformation controls and prerequisite-aware Wild Resurgence buttons.
- Prevented D&D Beyond and SRD API responses from entering the offline service-worker cache.
- Added live Content Security Policy and browser permissions response headers.
- Corrected bundled source metadata and attribution to use SRD 5.2.1 as the reusable official source.
- Expanded the automated regression suite to 110 passing tests and completed live interaction coverage for the primary character, combat, transformation, import, private-pack, settings, accessibility, activity-history, and LAN-access workflows.

## v0.19.0

- Added guided D&D Beyond character import from a public character link, numeric ID, or original exported PDF filename.
- Added a fixed-host local proxy with numeric-ID validation, response size and timeout limits, no credential forwarding, and no server caching.
- Added deterministic mapping for identity, multiclass levels, ability scores, HP, Armor Class, speed, save/skill proficiency and totals, equipped numeric modifiers, spell slots, prepared/known spells, feats, limited-use resources, and recognized Wild Shape forms.
- Hardened live-data normalization for selected-origin ability increases, HP overrides, multiclass starting-save components, current resource usage, and D&D Beyond action-name aliases.
- Added verified 2024 Giant Octopus, Lion, and Tiger records so every form selected on the tested Ferocitus sheet is executable.
- Added a review gate that separates verified, missing, and manual-review fields before the current character can change.
- Unknown creatures, custom defense adjustments, homebrew, item text, and attack-only item bonuses are flagged instead of guessed.
- Enforced creature recharge actions across turns, including visible failed/successful recharge rolls and reload-safe state.
- Reset the Latest Result panel when switching characters so rolls never appear under the wrong sheet.
- Added Ferocitus-shaped regression coverage and proxy/UI security-contract checks.

## v0.18.2

- Kept tab highlighting and accessibility state synchronized when changing characters.
- Added keyboard arrow, Home, and End navigation for character-sheet tabs.
- Added accessible names for dialogs and the condition selector.
- Hardened restored combat state against non-finite numbers, invalid conditions, oversized log entries, and malformed turn or Concentration data.
- Automatically removes damaged private-pack records instead of allowing them to break startup.
- Prevented non-finite damage, healing, Second Wind, Lay On Hands, and Concentration inputs from corrupting combat state.
- Short and Long Rests now restore a usable turn budget, including a spent Bonus Action or Reaction.
- Added a local-only Content Security Policy, stronger development-server headers, stable PWA identity metadata, and update-friendly caching.
- Expanded automated verification to cover the static UI/security contract.

## v0.18.1

- Made cleanup and builds work on Windows, macOS, and Linux without a platform-specific `rm` command.
- Added a local development server and documented `npm start`.
- Changed the service worker to prefer fresh network assets while retaining its offline fallback, preventing a newly deployed bundle from being hidden behind stale cache entries.
- Clarified additive transformation controls with `Activate` and explicit `End …` labels.
- Corrected stale standalone-file instructions.

## v0.8

- Combined current HP and Temporary HP into one prominent Available Health total.
- Preserved separate HP and Temporary HP breakdowns for rules-correct damage and healing.
- Added a highlighted Temporary HP source and mobile-responsive vitality layout.

- Replaced manual Fast Dice with contextual one-tap rolls.
- Combined attack and damage resolution into one action button.
- Added critical-hit dice doubling and natural-1 handling.
- Added automatic spell attack, spell healing, and ongoing spell-effect resolution.
- Added Base Form artwork with selected-form preview.
- Added ACTIVE FORM visual state.
- Fixed successful End Form resetting the selector and portrait.
- Made Wild Shape exit restrictions explicit when the Bonus Action is unavailable.
- Improved mobile and desktop result presentation.
- Updated offline cache to v0.8.

## v0.4

See earlier release materials for the rules-engine hardening history.

## 0.8.1

- Renamed the combat input panel to **Damage Received & Healing**.
- Renamed **Apply Damage** to **Take Damage**.
- Added helper text clarifying that this control records incoming damage, while outgoing attacks and spells roll from their own action buttons.
