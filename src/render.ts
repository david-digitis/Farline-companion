// What a key shows, drawn as an SVG (144 x 144, the Stream Deck's @2x key) and handed to
// setImage as a data URI. The game's style: a dark screen, cut corners, 1 px strokes, three
// accents (palette.ts). No glow, no gradient, no rounded corner.

import { accentOf, BG, CORAL, INK, INK_DIM, INK_OFF, MINT } from "./palette.js";
import type { Field, Value } from "./schema.js";

const SIZE = 144;
const CUT = 18;
const FONT = "DM Mono, Consolas, monospace";

function escape(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The key's frame: a box with two cut corners, its stroke in `stroke`. */
function frame(stroke: string): string {
	const s = SIZE - 6;
	const points = `3,${3 + CUT} ${3 + CUT},3 ${s + 3},3 ${s + 3},${s + 3 - CUT} ${s + 3 - CUT},${s + 3} 3,${s + 3}`;
	return `<rect width="${SIZE}" height="${SIZE}" fill="${BG}"/>`
		+ `<polygon points="${points}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
}

function text(x: number, y: number, size: number, colour: string, body: string, weight = 400): string {
	return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" `
		+ `fill="${colour}" text-anchor="middle">${escape(body)}</text>`;
}

function svg(body: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${body}</svg>`;
}

/** Up to three short lines of a label, cut at word boundaries, about 11 characters each. */
export function wrap(label: string, width = 11, lines = 3): string[] {
	const out: string[] = [];
	let line = "";
	for (const word of label.split(/\s+/).filter((w) => w !== "")) {
		const next = line === "" ? word : `${line} ${word}`;
		if (next.length <= width || line === "") {
			line = next;
		} else {
			out.push(line);
			line = word;
		}
	}
	if (line !== "") {
		out.push(line);
	}
	if (out.length > lines) {
		out.length = lines;
		out[lines - 1] = `${out[lines - 1].slice(0, width - 1)}…`;
	}
	return out.map((l) => (l.length > width ? `${l.slice(0, width - 1)}…` : l));
}

const MAX_TEXT = 10;

/** A number as a key shows it: whole for %, m, m/s, mm; one decimal for g and s; two at most otherwise. */
export function numberText(value: number, unit: string): string {
	if (["%", "m", "m/s", "mm"].includes(unit)) {
		return String(Math.round(value));
	}
	if (unit === "g" || unit === "s") {
		return value.toFixed(1);
	}
	return String(Math.round(value * 100) / 100);
}

function capped(text: string): string {
	return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
}

/** The shown form of a value: "142 m/s", "ON", "—". */
export function shown(field: Field | undefined, value: Value | undefined): { big: string; unit: string; colour: string } {
	const id = field?.id ?? "";
	if (value === null || value === undefined) {
		return { big: "—", unit: "", colour: INK_DIM };
	}
	if (typeof value === "boolean") {
		return { big: value ? "ON" : "OFF", unit: "", colour: value ? MINT : INK };
	}
	if (typeof value === "number") {
		return { big: capped(numberText(value, field?.unit ?? "")), unit: field?.unit ?? "", colour: accentOf(id) };
	}
	return { big: capped(value.toUpperCase()), unit: "", colour: accentOf(id) };
}

/** A value key: the value large, its unit, the label small above. */
export function valueKey(field: Field | undefined, value: Value | undefined, label: string, off = false): string {
	const v = shown(field, value);
	const size = v.big.length <= 4 ? 46 : v.big.length <= 6 ? 34 : 22;
	const head = wrap(label, 14, 2).map((line, i) => text(72, 30 + i * 16, 14, INK_DIM, line)).join("");
	const unit = v.unit !== "" ? text(72, 124, 16, INK_DIM, v.unit) : "";
	return svg(frame(off ? INK_OFF : INK_DIM) + head + text(72, 96, size, off ? INK_OFF : v.colour, v.big, 600) + unit);
}

/** A command key: its short label in the box (the provisional pictogram until the real icons). */
export function commandKey(label: string, off = false): string {
	const lines = wrap(label);
	const top = 72 - ((lines.length - 1) * 22) / 2 + 7;
	const body = lines.map((line, i) => text(72, top + i * 22, 20, off ? INK_OFF : INK, line)).join("");
	return svg(frame(off ? INK_OFF : MINT) + body);
}

/** A refused press: the key in coral for a moment, the reason small. */
export function refusedKey(label: string, why: string): string {
	const lines = wrap(label, 11, 2).map((line, i) => text(72, 54 + i * 22, 20, INK, line)).join("");
	return svg(frame(CORAL) + lines + text(72, 120, 16, CORAL, why.toUpperCase(), 600));
}

/** The game is not running, or not paired: one word on a dimmed key. */
export function idleKey(word: string): string {
	const lines = wrap(word, 11, 2).map((line, i) => text(72, 70 + i * 22, 18, INK_OFF, line)).join("");
	return svg(frame(INK_OFF) + lines);
}

/** An SVG as setImage takes it. */
export function dataUri(svgText: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svgText, "utf8").toString("base64")}`;
}
