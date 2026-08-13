# Altered v0.27.8 release notes

## Clearer enhancements and forms

The private transformation builder now begins by distinguishing an **Enhancement**—such as a stance, summoned limbs, aura, or wings—from a **Replacement form** that supplies another body or stat block. A compact quick setup can fill the existing validated fields for ability substitution, movement, or replacement mechanics. The live summary states exactly which sheet, check, save, attack, damage, and movement rules will change before the pack is installed.

For an Astral-style enhancement, the starting point configures Strength checks and saves to use Wisdom and unarmed attack and damage rolls to use Wisdom. The user remains responsible for adjusting activation, duration, save DC, damage, and resources to match content they own. This release changes no transformation architecture or saved-data format.

# Altered v0.27.7 release notes

## Guided visual next steps

The selected form's Transform button now pulses bright magical green when it can be used immediately and bright red when it is currently blocked. Its written reason, tooltip, disabled state, and screen-reader description remain present, so the cue never relies on color alone. Reduced-motion users receive the same high-contrast static glow without animation.

Settings now includes a Suggested next step guide, on by default and easy to disable. It prioritizes unresolved survival and Concentration rolls, unfinished Extra Attack sequences, compatible form/class combinations, usable Action and Bonus Action options, and correct End Turn flow. Recommendations use only facts Altered knows; battlefield position, targets, and player intent remain the user's choice. It never performs an action or spends a resource. Show me only navigates to and focuses the suggested control.

# Altered v0.27.6 release notes

## Custom transformations and usability release

Additive transformations such as Astral Arms now remain fully scrollable and always provide an End control from Play. The guided transformation builder can substitute one ability for another on checks or saves, use a chosen ability for weapon or Unarmed Strike attack and damage rolls, and describe an activation saving throw with damage and half-on-success behavior. These structured mechanics are character-local and remain compatible with existing schema-v1 private packs.

Navigation labels, More shortcuts, phone touch targets, and the Abilities page are clearer and more consistent. Resource counts remain visible, while ability activation now lives on the relevant explained card instead of appearing in a duplicate quick-control bank. All 188 automated tests, the desktop/phone hosted browser audit, and the 48-rule/16-function release audit pass.

# Altered v0.27.5 release notes

## Full 2024 rules and compatibility audit

The release audit now executes a complete matrix across all 12 supported base classes, all 12 bundled SRD subclasses, all 10 supported species, every bundled transformation profile, and all 16 built-in creature forms. It also repeats strict type checking, clean builds, import/export and persistence tests, hosted phone/desktop browser checks, security checks, and generated rule-to-function evidence.

Extra Attack is now executable instead of reference-only. A single Attack action correctly permits two attacks for level-5 Barbarian, Fighter, Monk, Paladin, and Ranger characters; Fighter levels 11 and 20 receive three and four attacks. Multiclass Extra Attack features do not stack, Grapple or Shove can replace an eligible Unarmed Strike, individual Beast-form attacks can be selected, Action Surge supplies a fresh Attack action, and a form's defined Multiattack sequence remains a separate alternative that never stacks. Existing schema-v1 characters and state-v5 saves remain compatible; an optional in-progress attack sequence is additive and safely absent from older saves.

# Altered v0.27.4 release notes

## Equipment and understandable abilities

Equipped weapons imported from a public D&D Beyond character now become ordinary attack cards. Their ability, proficiency, attack bonus, damage dice, damage type, range, weapon properties, and magic bonus are represented structurally; other equipped gear remains visible in a compact reference drawer. Existing Ferocitus saves are upgraded locally with the known Handaxe and Greataxe actions, so no reset is required.

Unarmored Defense now checks whether armor is actually worn. Being in Base Form no longer incorrectly marks the feature unavailable. The Features view separates abilities the player can use or confirm, automatic benefits, owned references, and currently unavailable mechanics. Each card states what it does and how it is used, with supported activation controls placed on the card.

## Early Ferocitus save repair

The automatic `Dark Bargain` cleanup now recognizes early bundled Ferocitus saves by their stable character ID even when those saves predate D&D Beyond provenance metadata. Only the stale feat name is removed; portrait overrides, AC, current HP, turn state, and all other imported data remain intact.

## Saved-character repair

Older Ferocitus data already stored by a browser or Android installation is upgraded automatically. The known unfinished `Dark Bargain` chooser is removed on startup and the corrected character is saved again. Fresh imports were already protected by the v0.27.2 importer fix; v0.27.3 closes the remaining persistence gap.

## Import integrity and honest feature states

Altered now distinguishes a selected D&D Beyond feat from an unfinished feat chooser. D&D Beyond can return a placeholder feat entry whose matching choice has no selected value; Altered excludes that entry, records an explanatory import notice, and never creates a private-content setup task for it. The bundled Ferocitus data was corrected through the same rule.

Owned imported feats are now labeled `Owned · reference`, while class mechanics that depend on a trigger or selected attack are labeled `Conditional`. A true runtime blocker is labeled `Unavailable now`. None of these states are presented as `Requirements missing` merely because Altered does not automate the complete effect.

Previously saved characters can be corrected without editing JSON: open **More → Customize → Imported character details** and remove a feat name that is absent from the source sheet. Re-importing the public source character restores any intentionally removed feat. Character schema v1, saved combat state, artwork, imports/exports, private packs, standalone builds, and hosted account behavior remain compatible.

# Altered v0.27.1 release notes

## Visible customization and verifiable SRD checks

More now has one clear Customize drawer. Users can upload a character portrait, upload separate artwork for the selected or active form, restore the current built-in image, create a private ability or feature without JSON, create a private transformation, and manage/export/remove installed private content.

The manual ability editor extends the existing validated schema-v1 private-pack system. It supports reference reminders, conditional activated controls, Speed bonuses, resistances, immunities, and Armor Class formulas. Activated private abilities now appear under Abilities, spend the selected part of the action economy, and present their result clearly. Saved characters, D&D Beyond imports, PDF/JSON imports, existing private packs, combat state, and artwork remain compatible.

The live SRD catalog button now shows an unmistakable Checking state, disables duplicate requests, and finishes with Current and verified, Needs review, or an explained offline error plus a timestamp.

# Altered v0.27.0 release notes

## Reviewed PDF/OCR imports and explicit conditional attacks

Altered can now read character PDFs directly. It uses embedded fields and text first, then offers device-side OCR for scanned or flattened sheets. Every detected core value is shown in an editable review before import, 2024 rules must be confirmed, and uncertain spells, features, items, proficiencies, or transformations are never invented. A D&D Beyond character ID found in an exported PDF filename still triggers the more complete public structured-sheet import. PDF libraries load only when needed, preserving normal startup performance.

Character JSON now follows the same validate, review, warn, and confirm flow instead of changing the active character immediately. Existing schema-v1 JSON remains compatible.

Attack and use buttons now appear immediately below each action heading. Conditional attack prerequisites use explicit checkboxes: Pack Tactics asks the player to confirm an eligible conscious ally within 5 feet before applying Advantage and names the source in the roll breakdown. The mechanism also handles current target- or line-of-sight-dependent Disadvantage conditions without guessing battlefield state.

Lion Multiattack now exposes all legal 2024 sequences: Rend → Rend, Rend → Roar, and Roar → Rend. Each selected sequence resolves in order with separate attack rolls or saving throws.

# Altered v0.26.6 release notes

## Always-visible turns and resumable character setup

New Turn and End Turn now live in the persistent form panel on phones, so they remain visible on Play, Forms, Sheet, and More instead of falling below the scroll area. The existing desktop turn controls remain unchanged, and both control paths use the same combat-state functions.

Unfinished D&D Beyond private-content setup now saves locally on the current device. Returning after closing the questionnaire, switching screens, refreshing, or reopening Altered exposes a clear Resume Content Setup button in More and a resume card in Import. Starting a different import is explicit, completed private mechanics remain installed, and no D&D Beyond credentials or proprietary book text are stored.

More now includes clear Add / Import Character and Delete Current Character actions. Deletion requires confirmation, cannot remove the only remaining character, and preserves separately installed private mechanics for a later re-import.

Saved character, combat-state, import/export, standalone, and private-pack formats remain backward compatible.

# Altered v0.26.5 release notes

## Visible outcomes and transformation cockpit polish

Roll results now appear in a fixed, animated overlay above navigation, so a save, skill, initiative, attack, spell, or healing result remains clear without scrolling back to the top. D20 tests show the kept die, final modifier source, form- or character-derived bonuses, Advantage or Disadvantage, minimum-roll effects, and final total. Natural 1 and natural 20 receive dramatic red and electric cyan-green treatments; non-natural totals of 25 or higher receive a separate gold exceptional-total treatment without being mislabeled as automatic success.

The persistent form panel now uses its previously empty copy area for live HP, Temporary HP, Armor Class, and walking Speed on every focused screen. The mobile Play view removes the duplicate full statistic row and uses tall-screen space to make the form artwork and primary controls easier to see. Task screens keep a smaller portrait so their working controls remain close at hand.

Abilities & Features now separates activated controls, remaining resources, and passive reference material. Plain-language guidance explains which buttons spend resources and which benefits Altered applies automatically; form traits, active overlays, and character references use compact expandable groups with explicit applied, conditional, and inactive labels.

No rules-engine formulas, character schema, combat-state persistence, D&D Beyond import, export, private-pack, or standalone format changed.

# Altered v0.26.4 release notes

## Runic druid icon and packaged-app verification

Altered now uses a new app-ready icon built around a single ancient druidic capital A transforming from inert carved stone into luminous emerald natural magic, backed by a full moon and restrained clouds. The same source artwork is used for the PWA icon, Android launcher densities, adaptive maskable icon, and Android splash screen.

The Android package was rebuilt with synchronized version metadata. Release verification rechecks the public D&D Beyond import boundary, 2024-only ruleset validation, multiclass and species feature handling, subclass- and level-gated Wild Shape forms, known-form restrictions, private owned-content overlays, Help from the More page, and the restartable tutorial. The icon release does not change saved-character, combat-state, import/export, or private-pack formats.

# Altered v0.25.1 release notes

The phone dashboard now keeps the large portrait and form chooser behind one native `Character & Form` dropdown. Its compact summary always identifies the selected or active form. Tap it to choose, inspect, transform, upload artwork, or end a form; close it to return the space to Actions, Spells, Features, and Rules.

At the audited 390 × 844 layout, the collapsed Base Form workspace grows from 112 to 256 pixels while the document remains viewport-bound and free of horizontal overflow. Active Dire Wolf play retains a 192-pixel action region even with the active-effects explanation visible. Desktop and Mac layouts continue showing the complete portrait and form controls without the mobile summary.

No rules, action economy, transformations, saves, D&D Beyond imports, JSON formats, private packs, or dependencies changed.

## Previous v0.25.0 notes

Public D&D Beyond imports now identify private or unsupported character options with one compact `Needs Setup` section. The user can open the authorized character page, enter a short mechanical reminder in their own words, and choose a supported treatment such as conditional, Speed bonus, resistance, immunity, Armor Class formula, or an activated transformation. Completed items are labeled and automatically reapply to the matching character on that browser.

This provides gameplay support for paid or campaign-shared options without copying books, scraping protected pages, or asking for a D&D Beyond password or cookies. Imported Armor Class, ability scores, saves, Speed, and Hit Points remain authoritative so private entries cannot casually duplicate existing sheet totals. The existing schema-v1 owned-content pack, import/export, local persistence, hosted authentication, rules engine, and standalone formats remain compatible.

The setup detector recognizes existing Altered coverage and no longer flags ordinary weapons, Ability Score Improvement, Weapon Mastery, or Circle of the Moon as missing private rules. The complete automated suite contains 153 passing tests.

## Previous v0.24.5 notes

Selecting a beast now replaces the Base Form portrait with a full-frame preview instead of squeezing a second image into the portrait card. The portrait is labeled `FORM PREVIEW` until Transform succeeds, then changes to `ACTIVE FORM` and starts the existing continuous form aura.

The correction uses the existing responsive portrait component and is verified at both 390 × 844 phone and 1440 × 900 desktop dimensions, so it applies equally to Android, Windows, and macOS browsers. No gameplay rule, transformation state, action economy, save schema, character import/export format, or private-pack format changed.

## Previous v0.24.4 notes

The phone dashboard now prioritizes the character and turn controls. Secondary account and application commands live behind one labeled, keyboard-accessible Menu button, reducing the phone header from roughly 128 pixels to 44 pixels in the audited 390 Ã— 844 layout. Action economy, quick features, and resources can no longer collapse into bare scrollbar tracks, and the short tab guidance stays to one line so the first actual action appears sooner.

Desktop controls remain in their familiar locations. Open table drawers now size to their contents instead of creating large empty panels, the former Why? tab is labeled Rules, and the walkthrough returns focus to a visible control after Skip, Finish, or Escape.

The hosted page now requests built-in form artwork only when needed. The downloadable standalone files still embed all six images and remain self-contained. No game rules, save schema, character import/export format, private-pack format, storage system, or runtime dependency changed.

## Previous v0.24.3 notes

Anyone with the public link can now sign in to Altered or create a free ChatGPT account. Account credentials are handled by ChatGPT, so Altered never receives or stores a password. The app shows the signed-in identity and provides a direct sign-out control. Each account still receives an independent local sheet: character saves, combat state, settings, artwork overrides, and private owned-content packs remain in that browser and are not uploaded to an Altered database.

The dashboard now stays within the browser viewport. The current form, core state, action economy, and active sheet tab remain the focus; damage, turn/rest, conditions, activity, form search, filters, and artwork tools use compact native disclosure panels. Scrolling is confined to the active content or the panel the user opened.

The hosted service worker no longer caches authenticated HTML or navigation responses. Public D&D Beyond and SRD support routes now require both a signed-in identity and the existing same-origin application marker, while retaining fixed upstream hosts, response limits, timeouts, rate limits, and `no-store` responses.

## Previous v0.24.2 notes

Altered can be reached by anyone who has its link. Each visitor receives an independent local sheet: character saves, combat state, settings, artwork overrides, and private owned-content packs remain in that visitor's browser and are not uploaded to an Altered database.

## Previous v0.24.1 notes

The recommended test build is now the private hosted app at [altered-ferocitus.ghostdaddy.chatgpt.site](https://altered-ferocitus.ghostdaddy.chatgpt.site). It works independently of the development PC and local Wi-Fi. The owner remains the only allowed account until specific tester ChatGPT account emails are added.

This maintenance release fixes the hosted blank-screen failure and gives the hosted build feature parity with the local server for public D&D Beyond character import and live SRD 5.2.1 support. The proxy routes remain fixed-host, numeric/source constrained, bounded, timed out, non-caching, and credential-free.

Startup now renders the bundled Ferocitus data before optional browser-storage hydration. A browser audit executes the exact generated hosted worker at both desktop and phone dimensions, preventing a syntactically valid but non-running bundle from passing release checks.

The 2024 transformation-spell behavior was rechecked against the current official Player's Handbook errata. Polymorph still ends when its Temporary HP reaches 0; True Polymorph, Shapechange, and Animal Shapes use their corrected distinct endings, and Shapechange/Animal Shapes do not refresh transformation Temporary HP on later form changes.

The verified release passes strict TypeScript checking, reproducible builds, 149 automated tests, exact-worker desktop/phone startup checks, and live Ferocitus interaction testing.

## Previous v0.24.0 notes

Fresh installations and standalone downloads now open with the validated Ferocitus character already loaded at full resources. Ferocitus remains a local, rules-safe character record without copied source-book text and includes the six selected Wild Shape forms.

The six current Ferocitus forms—Brown Bear, Dire Wolf, Giant Octopus, Giant Spider, Lion, and Tiger—now include built-in artwork. Images load lazily in the PWA, are cached for offline use, and are embedded directly into the self-contained standalone file. Existing per-character and per-form uploads still take priority, while Reset Art restores the matching built-in image.

Altered now includes a searchable Help center and a short optional walkthrough for new users. The walkthrough focuses only on choosing a character, finding a form, reading the turn budget, using the focused sheet tabs, and operating the turn controls. It can be skipped or closed at any point, remembers completion, gracefully omits missing interface targets, and can always be restarted from Help.

Form browsing now supports compact search and purpose filters. Selected, active, available, locked, warning, and requirements-missing states use a consistent icon, label, border, and color system so the interface does not rely on color alone. Artwork presentation, focus indicators, touch targets, responsive Help cards, and reduced-motion behavior received localized polish; no gameplay engine, save schema, import/export format, or dependency architecture was replaced.

This release completes the first source-ledgered 2024 rules audit pass. The most important change is that the sheet now treats “displayed” and “automated” as different promises: every supported class and SRD subclass feature is labeled by what Altered can actually calculate.

Gameplay corrections include cumulative Exhaustion; the full 0 HP, Unconscious, Death Save, stabilization, and massive-damage flow; executable Relentless Rage; 2024 one-slot-spell-per-turn enforcement across transformation spells; and missing retained class mechanics such as Reliable Talent, Jack of All Trades, Indomitable Might, Slippery Mind, Feral Senses, Mindless Rage, and Champion Survivor.

D&D Beyond imports now retain private item provenance and ruleset evidence without copying paid descriptions or applying numeric modifiers twice. Clearly Legacy or mixed characters are blocked because Altered is intentionally 2024-only; unidentified markers remain visible for review.

Run `npm run audit` to typecheck, run the complete automated suite, and regenerate `AUDIT_EVIDENCE.json`.

## Previous v0.23.2 notes

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
