// The control board: every state of a key, drawn by the plugin's own renderer (build/render.js)
// at real size (144 x 144) shown twice as large, as one PNG to look at on a phone. The style is
// the one in service (chosen on the board of 2026-10-15, docs/board-2026-10-15.png).
//
//   npm run board          (after `tsc`; writes dist/board/board.png)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";

import { commandIcon, fieldIcon, NAV_ICONS, TAB_ICONS } from "../build/icons.js";
import { comboKey, commandKey, idleKey, navKey, refusedKey, valueKey } from "../build/render.js";
import { useSymbols } from "../build/symbols.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
useSymbols(path.join(ROOT, "plugin", "com.david-digitis.farline-companion.sdPlugin", "imgs", "symbols"));

const speed = { id: "speed", type: "number", unit: "m/s" };
const gear = { id: "gear", type: "bool", unit: "" };
const shield = { id: "energy_shield", type: "number", unit: "%" };
const convergence = { id: "convergence", type: "number", unit: "m" };

/** The keys, two rows, with their captions. */
const ROWS = [
	[
		["Command", commandKey("Landing gear down / up", commandIcon("landing_gear"))],
		["No pictogram", commandKey("Next squad member", commandIcon("target_squad_next"))],
		["Number", valueKey(speed, 142, "Speed", fieldIcon("speed"))],
		["Flag ON", valueKey(gear, true, "Landing gear", fieldIcon("gear"))],
		["Flag OFF", valueKey(gear, false, "Landing gear", fieldIcon("gear"))],
		["Shield", valueKey(shield, 80, "Shield", fieldIcon("energy_shield"))],
	],
	[
		["Metres", valueKey(convergence, 500, "Convergence", fieldIcon("convergence"))],
		["Folder", navKey(TAB_ICONS.Combat, true)],
		["Back", navKey(NAV_ICONS.back)],
		["Next", navKey(NAV_ICONS.next)],
		["Refused", refusedKey("Landing gear down / up", "menu", commandIcon("landing_gear"))],
		["Game off", idleKey("Game off", NAV_ICONS.idle)],
	],
	[
		["Combined ON", comboKey("Landing gear down / up", commandIcon("landing_gear"), gear, true)],
		["Combined OFF", comboKey("Landing gear down / up", commandIcon("landing_gear"), gear, false)],
		["Notch + metres", comboKey("Convergence farther (one notch)", commandIcon("convergence_up"), convergence, 500)],
		["Set 800 m", comboKey("Convergence distance", commandIcon("convergence"), convergence, 500, "800 m")],
		["Energy %", comboKey("Energy to shield", commandIcon("tri_shield"), shield, 40)],
		["Unknown", comboKey("Landing gear down / up", commandIcon("landing_gear"), gear, null)],
	],
];

const SCALE = 2;
const KEY = 144 * SCALE;
const GAP = 24;
const MARGIN = 48;
const CAPTION = 44;
const COLS = Math.max(...ROWS.map((r) => r.length));
const WIDTH = MARGIN * 2 + COLS * KEY + (COLS - 1) * GAP;
const ROW = CAPTION + KEY + GAP;

function inner(svg) {
	return svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
}

const parts = [];
ROWS.forEach((row, r) => row.forEach(([name, svg], i) => {
	const x = MARGIN + i * (KEY + GAP);
	const y = MARGIN + r * ROW;
	parts.push(`<text x="${x + KEY / 2}" y="${y + 28}" font-family="Bahnschrift, Segoe UI, sans-serif" font-size="22" fill="#ece8e199" text-anchor="middle">${name.toUpperCase()}</text>`,
		`<g transform="translate(${x} ${y + CAPTION}) scale(${SCALE})">${inner(svg)}</g>`);
}));
const height = MARGIN * 2 + ROWS.length * ROW - GAP;
const board = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}"><rect width="100%" height="100%" fill="#0b0e11"/>${parts.join("")}</svg>`;
const png = new Resvg(board, { font: { loadSystemFonts: true, defaultFontFamily: "Segoe UI" } }).render().asPng();
const out = path.join(ROOT, "dist", "board", "board.png");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log(`${out} (${WIDTH} x ${height}, ${Math.round(png.length / 1024)} KB)`);
