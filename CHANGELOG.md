# Changelog

## 0.1.0 - unreleased

- Stream Deck plugin with two generic actions: **Command** (presses one of the game's commands) and
  **Value** (shows one value the game pushes), pairing from the Property Inspector.
- Master profiles for Mini, Classic (15 keys), XL, Plus and Neo, in English and French, generated
  from the game's schema: one folder per tab, laid out for the Mini's 6 keys.
- Keys in the game's Tactical style, chosen on a board of six (`docs/board-2026-10-15.png`, style 4):
  no frame, a large Material Symbols Sharp pictogram, ink everywhere and the accent only on the state
  (ON in mint, the shield in blue, a refusal in coral), a % or a flag with its track.
- One pictogram per command, field and tab of the schema (`src/icons.ts`, two commands keep their
  label alone), shipped by `npm run symbols`; folders, Back and Next of the profiles in the same style.
- `npm run board`: every state of a key on one PNG, to look at the style in service.
