# Altered v0.27.2 audit gap register

This register distinguishes an incorrect result from a deliberately conditional or reference-only result. Altered must never present a reference-only mechanic as calculated.

## Resolved in v0.27.2

| Finding | Severity | Resolution | Regression evidence |
|---|---:|---|---|
| D&D Beyond could return an unfinished feat chooser as though it were an owned feat | High | Exclude a feat definition when its own chooser exists but has no selected value; retain ordinary granted feats and completed choices | D&D Beyond importer selection regression and live Ferocitus payload comparison |
| Owned feats and conditional class features were labeled `Requirements missing` | High | Separate owned reference, conditional trigger, active, and unavailable-now presentation states | engine feature-state and UI contract regressions |
| A previously saved false feat required JSON editing or a full character reset | Medium | Add a scoped imported-feat review/removal control under More → Customize with an explicit re-import recovery path | UI contract, persistence-compatible character replacement, and browser interaction checks |

## Resolved in v0.25.1

| Finding | Severity | Resolution | Regression evidence |
|---|---:|---|---|
| The fixed phone dashboard left too little height for the selected Actions or Spells content | High | Reused the complete portrait/form panel inside a phone-only native disclosure whose compact summary identifies the current selection | 390 × 844 collapsed/expanded interaction metrics, desktop regression check, and UI contract test |

## Resolved in v0.25.0

| Finding | Severity | Resolution | Regression evidence |
|---|---:|---|---|
| Imported paid or campaign-shared options could be named but had no simple path to become usable without a hand-authored pack | High | Added character-local `Needs Setup` detection and a compact private mechanic completion editor using the existing schema-v1 pack system | D&D Beyond detection, owned-content application, persistence, and live Ferocitus browser checks |
| Broad import warnings could falsely imply ordinary weapons or supported core features required private setup | Medium | Limited setup requests to unsupported executable mechanics and excluded known built-in feat/subclass coverage | D&D Beyond importer regression tests |

## Resolved in v0.24.5

| Finding | Severity | Resolution | Regression evidence |
|---|---:|---|---|
| Selecting a creature before transformation squeezed a second image over the Base Form portrait on narrow screens | High | Reused the full portrait frame for selected-form preview, labeled it separately from active state, and removed the overflowing miniature overlay | 390 × 844 and 1440 × 900 live viewport metrics plus UI contract tests |

## Resolved in v0.24.4

| Finding | Severity | Resolution | Regression evidence |
|---|---:|---|---|
| Phone resource and turn strips could flex-shrink to nearly zero height | High | Reserved compact strip height, removed exposed scrollbar tracks, and reclaimed the tall secondary-command header behind an accessible Menu | 390 Ã— 844 live viewport metrics and UI contract tests |
| The first actionable card and table drawer content were obscured by avoidable guidance or empty expansion | Medium | Reduced mobile tab guidance to one line and made disclosures size to content without changing their actions | desktop/phone browser audit |
| Walkthrough focus could remain on its hidden Skip button | Medium | Deferred focus recovery and selected a visible desktop or phone fallback | live keyboard/focus verification |

## Resolved in v0.24.3

| Finding | Severity | Resolution | Regression evidence |
|---|---:|---|---|
| The public release did not require the requested per-user sign-in | High | Added platform-managed account authentication, server-side route enforcement, identity-safe status, and non-caching authenticated navigation | hosted worker runtime audit and `account identity and compact dashboard...` |
| Full-page scrolling obscured core table controls on smaller screens | Medium | Bound the shell to the viewport and converted secondary controls into native disclosures with localized overflow | desktop/phone browser audit and UI contract tests |

## Resolved in v0.24.2

| Finding | Severity | Resolution | Regression evidence |
|---|---:|---|---|
| Public link access could expose bounded proxy routes to casual cross-site use or excessive repeated requests | High | Added same-origin app-request checks, best-effort per-address limits, fixed upstream allowlists, `no-store`, and cross-origin security headers | hosted worker runtime audit and `SRD support proxy is fixed-host...` |

## Resolved in v0.24.1

| Finding | Severity | Resolution | Regression evidence |
|---|---:|---|---|
| The generated hosted/standalone script could be corrupted by JavaScript replacement tokens and open as a blank page | Critical | Replaced string-substitution callbacks, rendered bundled data before optional storage hydration, and added exact-worker browser execution checks | `the exact hosted build executes before optional mobile storage hydration` and `browser:audit` |
| Hosted use lacked local-server parity for public D&D Beyond import and live SRD support | Critical | Added bounded fixed-host worker routes with numeric/source validation, timeouts, response limits, and no API caching | `D&D Beyond proxy is fixed-host...` and `SRD support proxy is fixed-host...` |
| Transformation-spell THP endings could be compared against superseded printed text | High | Re-verified the four affected spells against current official PHB errata and locked their distinct behaviors | `post-printing transformation corrections remain sourced to official errata` |

## Resolved in v0.24.0

| Finding | Severity | Resolution | Regression evidence |
|---|---:|---|---|
| Exhaustion was a flat condition and did not affect D20 Tests or Speed | Critical | Added levels 0–6, cumulative penalties, Long Rest recovery, and death at level 6 | `Exhaustion levels reduce every D20 Test...` |
| The engine allowed more than one spell-slot expenditure in a turn through transformation spells | Critical | Shared the 2024 slot-spell turn gate across ordinary and transformation spells | `transformation spells obey the one-slot-spell-per-turn rule...` |
| Reaching 0 HP had no complete life-state flow | Critical | Added instant death, Unconscious, Death Saves, stabilization, damage at 0 HP, natural 1/20, and healing reset | `0 HP, massive damage...` |
| Relentless Rage was displayed but not executable | High | Added the pending Constitution save, twice-level HP result, increasing DC, and rest reset | `2024 Relentless Rage queues its save...` |
| Class features could leak into replacement forms that do not retain class features | High | Gated Rage Damage, Radiant Strikes, Champion critical range, senses, and related calculations on the active retention policy | `retained class features govern...` |
| Ranger Feral Senses and Rogue/Bard/Barbarian roll floors were missing | High | Added Feral Senses, Reliable Talent, Slippery Mind, Jack of All Trades, and Indomitable Might | `2024 Jack of All Trades...` |
| D&D Beyond item identity and ruleset provenance were discarded | High | Added private item metadata, ruleset evidence, no-double-application labels, and a hard block for Legacy/mixed imports | `blocks clearly legacy or mixed...` |
| SRD subclass features had no consistent calculated/conditional/reference classification | Medium | Added all twelve SRD subclass feature sets with explicit automation status; executed Mindless Rage and Survivor where the engine has complete state | `SRD subclass features are classified honestly...` |

## Open, deliberately bounded

| Area | Status | User-visible behavior | Reason |
|---|---|---|---|
| Target position, line of sight, cover, nearby allies, and grappler identity | Conditional | The relevant card explains the fact the user must supply; situational Advantage/Disadvantage controls remain available | Altered has no battle map and must not invent spatial state |
| Paid non-SRD subclass, feat, spell, and magic-item prose | Reference or private structured pack | Imported identity and already-included numeric totals are shown; unsupported text effects remain review-required | Private-use integration must not redistribute paid descriptions |
| Tool checks | Reference only | Imported skill checks are executable; tool-specific checks are not presented as calculated | The current character schema does not contain tool check totals |
| Death effects requiring revival | External ending event | Dead state blocks ordinary healing and actions | Revival spell targeting and material costs are outside the current self-sheet workflow |
| Shared combatants, target HP, and battlefield durations | Unsupported | Altered reports its own effects and reminders only | The product remains an adaptive personal character sheet, not a virtual tabletop |
| Android Gradle 9 migration | Maintenance only | No current user-visible impact; the signed Android release builds successfully with the pinned toolchain | The wrapper reports upstream Gradle deprecations. A coordinated wrapper/plugin upgrade is safer as a separate, fully tested maintenance release |

No open item above changes a displayed numeric result without being labeled conditional, reference-only, or unsupported.
