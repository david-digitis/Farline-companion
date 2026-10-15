// Copies the glyphs the icon table uses from @material-symbols/svg-400 (sharp) into the plugin's
// imgs/symbols/, and removes the ones it no longer uses: a line added to src/icons.ts is enough.
// Then draws the plugin's fixed pictures in the keys' style (the action list, the category, the
// marketplace, the default key faces), from the same glyphs and without text.
//
//   npm run symbols        (after `tsc`, it reads build/icons.js)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";

import { allIcons, NAV_ICONS } from "../build/icons.js";
import { navKey } from "../build/render.js";
import { fileOf, glyph, useSymbols } from "../build/symbols.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "node_modules", "@material-symbols", "svg-400", "sharp");
export const TARGET = path.join(ROOT, "plugin", "com.david-digitis.farline-companion.sdPlugin", "imgs", "symbols");

const wanted = new Set(allIcons().map((icon) => fileOf(icon.symbol, icon.fill)));
fs.mkdirSync(TARGET, { recursive: true });
const missing = [];
for (const name of [...wanted].sort()) {
	const from = path.join(SOURCE, `${name}.svg`);
	if (!fs.existsSync(from)) {
		missing.push(name);
		continue;
	}
	fs.copyFileSync(from, path.join(TARGET, `${name}.svg`));
}
for (const file of fs.readdirSync(TARGET)) {
	if (!wanted.has(file.replace(/\.svg$/, ""))) {
		fs.rmSync(path.join(TARGET, file));
	}
}
if (missing.length > 0) {
	console.error(`not in @material-symbols/svg-400: ${missing.join(", ")}`);
	process.exit(1);
}
console.log(`${wanted.size} glyphs in ${path.relative(ROOT, TARGET)}`);

const IMGS = path.dirname(TARGET);
useSymbols(TARGET);

/** A glyph alone, in ink on nothing: what the software's lists show (actions, category). */
function bare(icon) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">${glyph(icon.symbol, icon.fill, 0, 0, 48, "#ece8e1")}</svg>`;
}

function png(svgText, size, file) {
	const data = new Resvg(svgText, { fitTo: { mode: "width", value: size }, font: { loadSystemFonts: false } }).render().asPng();
	fs.writeFileSync(path.join(IMGS, file), data);
}

const { command, value, plugin } = NAV_ICONS;
const pictures = [
	["actions/command", bare(command), 20], ["actions/value", bare(value), 20],
	["actions/command-key", navKey(command), 72], ["actions/value-key", navKey(value), 72],
	["plugin/category", bare(plugin), 28], ["plugin/marketplace", navKey(plugin, true), 256],
];
for (const [name, svgText, size] of pictures) {
	png(svgText, size, `${name}.png`);
	png(svgText, size * 2, `${name}@2x.png`);
}
console.log(`${pictures.length * 2} fixed pictures in ${path.relative(ROOT, IMGS)}`);
