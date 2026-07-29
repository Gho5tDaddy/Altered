# Changelog

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
