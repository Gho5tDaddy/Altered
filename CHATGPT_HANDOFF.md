# Altered - ChatGPT Project Handoff

Source conversation: [Beast Form Tracker App](https://chatgpt.com/c/6a663801-3e34-83ea-be27-75f266943bff)

Imported into this Codex workspace on July 29, 2026. The source chat contains 47 user turns. It began as a 2024 D&D 5e Circle of the Moon beast-form tracker and evolved into a universal transformation character sheet named **Altered**.

## Product goal

Altered should eliminate the need to switch between a character sheet and separate creature/form pages during play. It should combine the imported base character, current transformation, class and subclass features, species traits, feats, spells, equipment, conditions, resources, and active effects into one resolved, beginner-friendly sheet.

It must support **all forms a character can assume**, not only Beast forms or Druids. Legal choices must be derived from the imported character's actual level, classes, subclasses, species, known forms, and private owned content.

The intended platforms are Windows, macOS, Android, and the web.

## Core user-experience requirements

- Keep the interface quick, clean, interactive, and usable during live play.
- Show only legal transformations for the current character.
- Recalculate the resolved sheet automatically when a form or overlay is activated.
- Put form-specific attacks, spells, and actions on direct buttons that roll the correct randomized dice and modifiers.
- Keep temporary hit points distinct in the rules engine but visually integrate them with the main damage buffer.
- Apply incoming damage, resistance, immunity, vulnerability, temporary HP, concentration checks, and form-ending rules automatically.
- End Form must fully restore the base presentation and resolved base statistics.
- Display the active form's portrait, allow user-supplied art, and eventually provide original non-infringing defaults.
- Use a dark ancient basalt/onyx relic visual style with restrained magical energy moving through carved channels.
- Change active-form magic colors by transformation type.
- Preserve accessibility, reduced-motion support, and performance; avoid heavy particle, canvas, or WebGL effects.

## Data and rules model

The planned resolution model is:

```text
imported character
+ bundled SRD mechanics
+ private owned-content modules
+ active conditions and resources
+ current transformation profile
= resolved Altered sheet
```

Public releases may bundle SRD 5.2.1 material, original assets, user-created content, and properly licensed third-party material.

Paid mechanics should use private, local **Owned Content Packs**. Altered must not request D&D Beyond credentials, scrape the site, depend on undocumented endpoints, copy paid books, bundle official artwork, or redistribute imported paid content.

A character PDF can identify many features but may not contain enough mechanical detail to execute them. Unsupported paid mechanics must be confirmed through a guided local setup instead of being guessed.

## Build history

- v0.1-v0.4 established the prototype and then rebuilt it around a tested TypeScript rules engine.
- v0.5-v0.9 improved cross-platform behavior, direct action rolls, HP/damage handling, form reversion, storage, transformation visuals, and content architecture.
- v0.10-v0.15 iterated on the ancient basalt/onyx interface and lightweight form-dependent magical glow.
- v0.15 was the last fully linked downloadable release in the source chat. It reported 50 passing automated tests.
- The source chat then began a release-hardening audit. It reported a compiling v0.16 audit build with 50 passing tests and worked through private content, non-Beast transformations, schema changes, rendering, rules corrections, and broader tests in v0.17/v0.18.
- The final online run's reasoning log reported a 70-test/typecheck baseline while hardening v0.18, but the run ended without posting a final answer or download link. Treat v0.18 as an unimported work-in-progress until its files are recovered and independently verified.

## Known audit gaps

- Reusable private owned-content packs need full workflow and durability testing.
- Imported forms must support complete private stat blocks.
- Transformation support must not be restricted to the original core class set.
- Non-Beast replacement forms and additive/overlay transformations need broader coverage.
- Transformation retention rules, action economy, class/subclass/species interactions, persistence, and canonicalization need continued verification.
- Tests must cover owned content, custom forms, non-Beast profiles, reload durability, and real browser behavior.
- Version metadata, packaging cleanliness, service-worker caching, release notes, integrity hashes, and final browser QA need confirmation.

## Latest user direction

> Keep going until it is usable and only needs bug testing.

The next implementation pass should recover the newest source package if possible, verify its provenance and integrity, place it under version control here, run all typechecks/tests locally, perform browser QA, and continue release hardening without regressing the v0.15 visual direction.
