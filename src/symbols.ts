// The pictograms a key draws: Material Symbols Sharp (Apache 2.0), the family of the game's own
// screens. Only the glyphs the table uses are shipped, as SVG files in imgs/symbols/ (copied from
// node_modules by tools/sync-symbols.mjs). Each file holds one path in a 960 x 960 box whose top is
// at y = -960; a key draws it as a <path> moved and scaled, never as a nested <svg>.

import fs from "node:fs";
import path from "node:path";

const paths = new Map<string, string>();
let folder = "";

/** Where the symbol files are: the plugin's imgs/symbols, or the same folder from a tool. */
export function useSymbols(dir: string): void {
	folder = dir;
	paths.clear();
}

/** The file name of a glyph: `flight_land`, or `flight_land-fill` for its filled form. */
export function fileOf(symbol: string, fill: boolean): string {
	return fill ? `${symbol}-fill` : symbol;
}

/** The path data of a glyph, read once; null when the file is not there. */
export function pathOf(symbol: string, fill: boolean): string | null {
	const name = fileOf(symbol, fill);
	const known = paths.get(name);
	if (known !== undefined) {
		return known;
	}
	if (folder === "") {
		return null;
	}
	let d: string | null;
	try {
		const text = fs.readFileSync(path.join(folder, `${name}.svg`), "utf8");
		d = /\sd="([^"]+)"/.exec(text)?.[1] ?? null;
	} catch {
		d = null;
	}
	if (d !== null) {
		paths.set(name, d);
	}
	return d;
}

/** A glyph drawn at (x, y), `size` px square, in `colour`; "" when it is missing. */
export function glyph(symbol: string, fill: boolean, x: number, y: number, size: number, colour: string): string {
	const d = pathOf(symbol, fill);
	if (d === null) {
		return "";
	}
	const k = size / 960;
	return `<path transform="translate(${x} ${y + size}) scale(${k})" fill="${colour}" d="${d}"/>`;
}
