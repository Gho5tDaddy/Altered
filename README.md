# Altered

Altered is a rules-aware adaptive character sheet for 2024 fifth-edition transformations. It keeps the imported base character as the source of truth and generates the active transformed sheet from the character's class levels, subclass, species, proficiencies, spells, features, resources, and selected legal form.

## Use it now

### Hosted app

Open [Altered](https://altered-ferocitus.ghostdaddy.chatgpt.site) from a phone, tablet, or computer. The hosted build is the recommended test route because it does not depend on the PC being awake, Windows localhost, or a particular Wi-Fi network. Anyone with the link can sign in or create a free ChatGPT account; Altered never receives the password. Character saves, combat state, settings, artwork overrides, and private packs remain in that browser and are not shared with other visitors.

### Android

Download `altered-standalone.html`, open it from Downloads, and choose Chrome or Samsung Internet.

### Windows

Double-click `altered-standalone.html` and open it in Edge, Chrome, or Firefox.

### macOS

Open `altered-standalone.html` in Safari, Chrome, or Firefox.

The same standalone file is used on all three platforms. The `dist` directory contains the hostable Progressive Web App and its bounded server worker.

Fresh downloads open with the validated Ferocitus character already loaded at full resources. The specially named `altered-ferocitus.html` package is identical to the main standalone build and is provided to make the phone-ready download unambiguous.

## Help and first launch

The always-available **Help** command opens a searchable, compact guide to importing, browsing and activating forms, turn resources, images, settings, troubleshooting, and the app's scope. It stays in the desktop top bar and inside the labeled phone Menu. New browser profiles receive a short optional walkthrough. It can be skipped or closed at any time, remembers completion without changing character saves, and can be restarted from Help.

## Core table workflow

1. Import a public D&D Beyond character link/ID, import an Altered JSON backup, or select a bundled character.
2. Choose one of the forms generated from that character's legal abilities.
3. Press Transform.
4. Press the named attack, spell, save, or skill button. Altered rolls the correct dice and modifiers automatically. Use the clearly labeled situational selector when the target or battlefield grants Advantage or Disadvantage; Altered combines it with automatic condition rules and cancels opposing sources correctly.
5. Press End Form when a legal exit is available. Wild Shape voluntary exit requires a Bonus Action, so the button clearly explains when that Bonus Action is unavailable.

The **Active now** panel explains the effects that currently change the sheet. Barkskin raises Armor Class to its 2024 minimum and remains visible through Wild Shape until ended. In Moon Wild Shape the panel lists the Circle spells that can still be cast; during Rage it shows the active resistances and Strength benefits and explains why spells are blocked.

Brown Bear, Dire Wolf, Giant Octopus, Giant Spider, Lion, and Tiger include matching built-in artwork. Uploaded per-character or per-form art still takes priority, and Reset Art restores the bundled image. The PWA caches these images for offline play, while the standalone HTML embeds them directly.

The turn strip tracks the Action, Bonus Action, Reaction, and the 2024 one-slot-spell-per-turn limit separately. Spending an Action never consumes the Bonus Action, and a cantrip does not consume the slot-spell limit. Barkskin, Wild Shape, and Rage each require a Bonus Action, so Altered keeps the Action available after Barkskin while clearly requiring Wild Shape or Rage to wait for another turn.

Multiattack displays a separate d20-to-hit or saving-throw result for every component, followed by each component's damage, on-hit effects, and a clearly labeled potential damage total. Legal alternatives such as the Lion's Rend + Roar sequence are selectable without spending a second Action. Natural 1, natural 20, Champion critical ranges, doubled critical dice, fixed damage, secondary damage packets, failed-save effects, and half-damage-on-success outcomes use the 2024 rules. Conditional riders such as Giant Goat Charge must be explicitly selected after their prerequisite is met.

Base form exposes all three 2024 Unarmed Strike options: a damage attack roll, Grapple with a Strength-or-Dexterity save, and Shove with the same save choice. The Saves & Skills tab includes Initiative, automatically using the current form's Dexterity plus supported retained features and condition rules; Surprise can be selected explicitly. Every non-base transformation—including replacement forms and additive overlays—uses a strong animated portrait ring and interface aura that continues until all forms end; if Reduce motion is enabled, the Active now panel explains why the aura is static.

## Development

```bash
npm run verify
```

This runs strict TypeScript compilation, builds both browser packages, and runs the automated tests.

For the full reproducible rules audit:

```bash
npm run audit
```

This also regenerates `AUDIT_EVIDENCE.json` with the source-ledger summary, rule/function interaction matrix, content-record counts, and SHA-256 pack hashes. Resolved and deliberately bounded findings are in `AUDIT_GAP_REGISTER.md`.

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

The automated D&D Beyond fetch requires the local/hosted Altered server. A standalone HTML file can still import a previously reviewed Altered JSON backup, but it cannot safely proxy D&D Beyond on its own. D&D Beyond's structured character service is undocumented, so Altered validates its response and leaves unsupported mechanics for review instead of guessing. Altered records private item identity and equipped/attuned state without copying paid descriptions or applying imported totals twice. Clearly Legacy or mixed-rules characters are blocked because this app is intentionally 2024-only.

The hosted app exposes the same bounded import route as the local server: numeric character IDs only, a fixed D&D Beyond host, no forwarded credentials, response limits, timeouts, `no-store` caching, same-origin application-request checks, and best-effort per-address rate limits. A character must still be Public during import; it can be made Private again after an Altered backup is exported.

### Legal rules support

Altered keeps the full reusable SRD support catalog behind the transformation sheet instead of turning the interface into a general encyclopedia. The running server checks the live SRD 5.2.1 catalog and loads only records needed to validate an import or execute a transformation. The current verified catalog baseline is 1,808 records across rules, classes/subclasses, species, backgrounds, feats, equipment, magic-item variants, weapons, armor, creatures, spells, and weapon properties.

Validated built-in transformation rules remain usable offline. Live SRD responses and D&D Beyond character responses are never placed in the service-worker cache.
