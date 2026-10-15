# Credits

| What | Author | Licence | Where |
|---|---|---|---|
| Pictograms of the keys, the profiles and the plugin's icons (`plugin/com.david-digitis.farline-companion.sdPlugin/imgs/symbols/`, drawn into `imgs/actions/` and `imgs/plugin/`) | Google, Material Symbols Sharp (weight 400), via the npm package `@material-symbols/svg-400` 0.48.0 | Apache License 2.0 | https://github.com/google/material-design-icons |

Only the glyphs the icon table (`src/icons.ts`) names are shipped; `npm run symbols` copies them from
`node_modules`. The licence text: https://www.apache.org/licenses/LICENSE-2.0

Fonts are not shipped: a key asks for Chakra Petch (numbers) and DM Mono (labels), both under the SIL
Open Font License, and falls back to the system's fonts when the player does not have them.
