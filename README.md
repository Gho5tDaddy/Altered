# Altered

Altered is a rules-aware adaptive character sheet for 2024 fifth-edition transformations. It keeps the imported base character as the source of truth and generates the active transformed sheet from the character's class levels, subclass, species, proficiencies, spells, features, resources, and selected legal form.

## Use it now

### Android

Download `altered-standalone.html`, open it from Downloads, and choose Chrome or Samsung Internet.

### Windows

Double-click `altered-standalone.html` and open it in Edge, Chrome, or Firefox.

### macOS

Open `altered-standalone.html` in Safari, Chrome, or Firefox.

The same standalone file is used on all three platforms. The `dist` directory is the hostable Progressive Web App version.

## Core table workflow

1. Import a public D&D Beyond character link/ID, import an Altered JSON backup, or select a bundled character.
2. Choose one of the forms generated from that character's legal abilities.
3. Press Transform.
4. Press the named attack, spell, save, or skill button. Altered rolls the correct dice and modifiers automatically.
5. Press End Form when a legal exit is available. Wild Shape voluntary exit requires a Bonus Action, so the button clearly explains when that Bonus Action is unavailable.

The **Active now** panel explains the effects that currently change the sheet. Barkskin raises Armor Class to its 2024 minimum and remains visible through Wild Shape until ended. In Moon Wild Shape the panel lists the Circle spells that can still be cast; during Rage it shows the active resistances and Strength benefits and explains why spells are blocked.

The turn strip tracks the Action, Bonus Action, Reaction, and the 2024 one-slot-spell-per-turn limit separately. Spending an Action never consumes the Bonus Action, and a cantrip does not consume the slot-spell limit.

## Development

```bash
npm run verify
```

This runs strict TypeScript compilation, builds both browser packages, and runs the automated tests.

For a local browser session:

```bash
npm start
```

Then open `http://127.0.0.1:4173`.

To use Altered from a phone on the same private Wi-Fi network:

```bash
npm run start:lan
```

Open one of the `http://192.168.x.x:4173` addresses printed by the server on the phone. A phone cannot use the PC's `127.0.0.1` address, and ChatGPT Remote does not tunnel Windows localhost pages. LAN access is opt-in; the ordinary `npm start` command remains limited to this computer.

### Importing from D&D Beyond

1. In D&D Beyond, open the character builder's Home tab, set Character Privacy to Public, and save.
2. In Altered, open **Import & Content**.
3. Paste the public character link or numeric ID.
4. Review every verified, missing, or flagged area, then confirm the import.
5. Set the D&D Beyond character private again if desired and export an Altered JSON backup.

The automated D&D Beyond fetch requires the local/hosted Altered server. A standalone HTML file can still import a previously reviewed Altered JSON backup, but it cannot safely proxy D&D Beyond on its own. D&D Beyond's structured character service is undocumented, so Altered validates its response and leaves unsupported mechanics for review instead of guessing.

### Legal rules support

Altered keeps the full reusable SRD support catalog behind the transformation sheet instead of turning the interface into a general encyclopedia. The running server checks the live SRD 5.2.1 catalog and loads only records needed to validate an import or execute a transformation. The current verified catalog baseline is 1,808 records across rules, classes/subclasses, species, backgrounds, feats, equipment, magic-item variants, weapons, armor, creatures, spells, and weapon properties.

Validated built-in transformation rules remain usable offline. Live SRD responses and D&D Beyond character responses are never placed in the service-worker cache.
