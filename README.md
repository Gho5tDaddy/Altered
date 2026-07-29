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

1. Import or select the character.
2. Choose one of the forms generated from that character's legal abilities.
3. Press Transform.
4. Press the named attack, spell, save, or skill button. Altered rolls the correct dice and modifiers automatically.
5. Press End Form when a legal exit is available. Wild Shape voluntary exit requires a Bonus Action, so the button clearly explains when that Bonus Action is unavailable.

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
