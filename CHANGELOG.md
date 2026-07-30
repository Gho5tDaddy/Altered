# Changelog

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
