# Character import schema

The importer accepts one JSON object with `schemaVersion: 1`. See `dist/sample-character.json`.

Required fields:

- `name`, `species`
- `classes`: base class, class level, optional subclass
- six `abilities`
- `hp.current`, `hp.max`, `ac`, `speed`
- skill and saving-throw `proficiencies`
- `knownForms` and `seenForms`
- `spells` and `spellSlots`
- `feats`, `features`, and `equipment`

Class levels must total 1–20. Creature IDs must exist in the versioned rules pack. Imported final skill/save bonuses are used in Base Form; transformed values are recalculated from the retained proficiency, current form ability, and character Proficiency Bonus.

Structured custom features can define:

- retention by transformation profile
- spellcasting, Concentration, speech, weapon, Unarmed Strike, Strength-attack, armor, and Shield requirements
- speed, resistance, immunity, save, and Armor Class effects
- activation action type

Unrecognized prose is displayed as conditional information; it is not converted into a mechanical bonus automatically.
