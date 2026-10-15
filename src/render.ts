// What a key shows, drawn as an SVG (144 x 144, the Stream Deck's @2x key) and handed to
// setImage as a data URI. The game's Tactical style, as Hatalar chose it on the board of
// 2026-10-15 (style 4): no frame, a large Material Symbols Sharp pictogram, everything in ink and
// the accent only on the state (ON in mint, the shield in blue, a refusal in coral), a value as a
// number with its track below. No glow, no gradient, no rounded corner, no shadow.
// Fonts are the system's: Chakra Petch / DM Mono when the player has them (an embedded font made
// each image 80 times heavier), Bahnschrift / Consolas otherwise.

import { accentOf, BG, CORAL, CORAL_TINT, fill, INK, INK_DIM, INK_OFF, INK_TRACK, MINT } from "./palette.js";
import type { Field, Value } from "./schema.js";
import { glyph } from "./symbols.js";

const SIZE = 144;
const CUT = 16;
const NUM_FONT = "Chakra Petch, Bahnschrift, DIN Alternate, Arial Narrow, sans-serif";
const LABEL_FONT = "DM Mono, Consolas, Menlo, monospace";

/** A pictogram from the table (icons.ts): a Material Symbols Sharp name, filled or line. */
export type Icon = { symbol: string; fill: boolean };

function escape(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The key's dark screen, tinted inside its cut corners for a coral block. */
function ground(tint = ""): string {
	const s = SIZE - 4;
	const cut = `2,${2 + CUT} ${2 + CUT},2 ${s + 2},2 ${s + 2},${s + 2 - CUT} ${s + 2 - CUT},${s + 2} 2,${s + 2}`;
	return `<rect width="${SIZE}" height="${SIZE}" fill="${BG}"/>` + (tint !== "" ? `<polygon points="${cut}" ${fill(tint)}/>` : "");
}

function text(x: number, y: number, size: number, colour: string, body: string, opts: { num?: boolean; anchor?: string } = {}): string {
	const font = opts.num ? `font-family="${NUM_FONT}" font-weight="700"` : `font-family="${LABEL_FONT}" font-weight="400"`;
	return `<text x="${x}" y="${y}" ${font} font-size="${size}" ${fill(colour)} text-anchor="${opts.anchor ?? "middle"}">${escape(body)}</text>`;
}

function svg(body: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${body}</svg>`;
}

/** Up to `lines` short lines of a label, cut at word boundaries, `width` characters each. */
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

/** A label as a key prints it: capitals, without what is in brackets. */
export function caption(label: string): string {
	return label.replace(/\s*\([^)]*\)/g, "").toUpperCase();
}

/** Lines of text centred around `mid`, `step` apart. */
function block(lines: string[], mid: number, size: number, step: number, colour: string): string {
	const top = mid - ((lines.length - 1) * step) / 2 + size * 0.35;
	return lines.map((line, i) => text(72, top + i * step, size, colour, line)).join("");
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

function capped(body: string): string {
	return body.length > MAX_TEXT ? `${body.slice(0, MAX_TEXT - 1)}…` : body;
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

/** How full a value's track is (0..1), or null when it has none (a number without a known top). */
export function fillOf(field: Field | undefined, value: Value | undefined): number | null {
	if (typeof value === "boolean") {
		return value ? 1 : 0;
	}
	if (typeof value === "number" && field?.unit === "%") {
		return Math.max(0, Math.min(1, value / 100));
	}
	return null;
}

/** The size of a number or a word so that it fits `room` px: a bold character is about 0.62 of its size. */
function numberSize(big: string, max: number, room = 124): number {
	return Math.min(max, Math.floor(room / (Math.max(1, big.length) * 0.62)));
}

/** A value key: its pictogram and label on top, the value large in its accent, a % or a flag with its track. */
export function valueKey(field: Field | undefined, value: Value | undefined, label: string, icon: Icon | null = null): string {
	const v = shown(field, value);
	const colour = v.colour;
	const head = icon !== null
		? glyph(icon.symbol, icon.fill, 14, 14, 22, INK_DIM) + text(42, 31, 12, INK_DIM, wrap(caption(label), 12, 1)[0] ?? "", { anchor: "start" })
		: text(72, 30, 12, INK_DIM, wrap(caption(label), 16, 1)[0] ?? "");
	const track = fillOf(field, value);
	if (track === null) {
		const unit = v.unit !== "" ? text(72, 124, 15, INK_DIM, v.unit) : "";
		return svg(ground() + head + text(72, 96, numberSize(v.big, 52), colour, v.big, { num: true }) + unit);
	}
	const w = 112;
	const bar = `<rect x="16" y="112" width="${w}" height="8" ${fill(INK_TRACK)}/>`
		+ (track > 0 ? `<rect x="16" y="112" width="${Math.round(w * track)}" height="8" ${fill(colour)}/>` : "");
	const num = v.unit !== ""
		? text(100, 92, numberSize(v.big, 46, 84), colour, v.big, { num: true, anchor: "end" })
		: text(72, 92, numberSize(v.big, 46), colour, v.big, { num: true });
	const unit = v.unit !== "" ? text(104, 92, 15, INK_DIM, v.unit, { anchor: "start" }) : "";
	return svg(ground() + head + num + unit + bar);
}

/** A command key: its pictogram large and its label below, or its label alone when it has no
 *  pictogram; `detail` (a chosen value with its unit, "500 m") follows the label as it is. */
export function commandKey(label: string, icon: Icon | null = null, detail = ""): string {
	const words = detail !== "" ? `${caption(label)} ${detail}` : caption(label);
	if (icon === null) {
		return svg(ground() + block(wrap(words, 11, 3), 72, 15, 21, INK));
	}
	const lines = wrap(words, 15, 2);
	return svg(ground() + glyph(icon.symbol, icon.fill, 40, lines.length > 1 ? 14 : 20, 64, INK)
		+ block(lines, lines.length > 1 ? 112 : 116, 12, 15, INK_DIM));
}

/** A key of the profiles drawn once (a folder, Back, Next): its pictogram, room below for the
 *  software's title, and for a folder the accent ››› of the game's panel titles, drawn as strokes
 *  (no text: the same picture on every machine, whatever its fonts). */
export function navKey(icon: Icon, folder = false): string {
	const chevrons = [60, 70, 80].map((x) => `M${x} 92L${x + 5} 97L${x} 102`).join("");
	const mark = folder ? `<path d="${chevrons}" fill="none" stroke="${MINT}" stroke-width="2"/>` : "";
	return svg(ground() + glyph(icon.symbol, icon.fill, 44, 18, 56, INK) + mark);
}

/** A refused press: the key tinted coral for a moment, its pictogram (or label) and the reason. */
export function refusedKey(label: string, why: string, icon: Icon | null = null): string {
	const face = icon !== null ? glyph(icon.symbol, icon.fill, 48, 22, 48, CORAL) : block(wrap(caption(label), 11, 2), 60, 15, 21, INK);
	return svg(ground(CORAL_TINT) + face + text(72, 112, 14, CORAL, why.toUpperCase()));
}

/** The game is not running, or not paired: one word on a dimmed key. */
export function idleKey(word: string, icon: Icon | null = null): string {
	const pic = icon !== null ? glyph(icon.symbol, icon.fill, 52, 30, 40, INK_OFF) : "";
	return svg(ground() + pic + block(wrap(word.toUpperCase(), 11, 2), pic !== "" ? 100 : 72, 14, 19, INK_OFF));
}

/** An SVG as setImage takes it. */
export function dataUri(svgText: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svgText, "utf8").toString("base64")}`;
}
