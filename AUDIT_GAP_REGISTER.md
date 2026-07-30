# Altered v0.24.0 audit gap register

This register distinguishes an incorrect result from a deliberately conditional or reference-only result. Altered must never present a reference-only mechanic as calculated.

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

No open item above changes a displayed numeric result without being labeled conditional, reference-only, or unsupported.
