// What a key draws: a number with its unit, a flag, a value gone, a long label.

import assert from "node:assert/strict";
import { test } from "node:test";

import path from "node:path";

import { NAV_ICONS, TAB_ICONS } from "../build/icons.js";
import { BLUE, CORAL, INK, MINT } from "../build/palette.js";
import { caption, commandKey, dataUri, fillOf, idleKey, navKey, refusedKey, shown, valueKey, wrap } from "../build/render.js";
import { useSymbols } from "../build/symbols.js";

useSymbols(path.join("plugin", "com.david-digitis.farline-companion.sdPlugin", "imgs", "symbols"));
const gearIcon = { symbol: "flight_land", fill: false };

const speed = { id: "speed", type: "number", unit: "m/s", label_en: "Speed", label_fr: "Vitesse" };
const gear = { id: "gear", type: "bool", unit: "", label_en: "Landing gear", label_fr: "Train" };
const shield = { id: "energy_shield", type: "number", unit: "%", label_en: "Shield", label_fr: "Bouclier" };
const g = { id: "g", type: "number", unit: "g", label_en: "G load", label_fr: "Charge" };

test("a number: large, in its accent, with its unit", () => {
	assert.deepEqual(shown(speed, 142), { big: "142", unit: "m/s", colour: MINT });
	assert.equal(shown(shield, 80).colour, BLUE);
	assert.equal(shown(g, 4.5).colour, CORAL);
	const svg = valueKey(speed, 142, "Speed");
	assert.match(svg, />142</);
	assert.match(svg, />m\/s</);
	assert.match(svg, />SPEED</);
});

test("numbers are rounded by unit, long words are cut", () => {
	assert.equal(shown(g, 4.237891).big, "4.2");
	assert.equal(shown(speed, 141.7).big, "142");
	assert.equal(shown({ id: "x", type: "number", unit: "", label_en: "", label_fr: "" }, 1 / 3).big, "0.33");
	assert.equal(shown({ id: "target", type: "string", unit: "", label_en: "", label_fr: "" }, "Pirate interceptor").big, "PIRATE IN…");
});

test("a flag: ON in mint, OFF in ink", () => {
	assert.deepEqual(shown(gear, true), { big: "ON", unit: "", colour: MINT });
	assert.deepEqual(shown(gear, false), { big: "OFF", unit: "", colour: INK });
});

test("a value gone (null) or never sent: a dash", () => {
	assert.equal(shown(speed, null).big, "—");
	assert.equal(shown(speed, undefined).big, "—");
	assert.match(valueKey(speed, null, "Speed"), />—</);
});

test("every state: no rounded corner, no gradient, no glow, no shadow", () => {
	const states = {
		"command with a glyph": commandKey("Landing gear down / up", gearIcon),
		"command without": commandKey("Next squad member"),
		"number": valueKey(speed, 142, "Speed", { symbol: "speed", fill: false }),
		"flag": valueKey(gear, true, "Landing gear", gearIcon),
		"shield": valueKey(shield, 80, "Shield", { symbol: "shield", fill: true }),
		"refused": refusedKey("Landing gear down / up", "menu", gearIcon),
		"game off": idleKey("Game off", NAV_ICONS.idle),
		"folder": navKey(TAB_ICONS.Combat, true),
		"back": navKey(NAV_ICONS.back),
	};
	for (const [name, svg] of Object.entries(states)) {
		assert.doesNotMatch(svg, /rx=|ry=|Gradient|filter|blur|shadow|[^-]opacity|<image|<svg[^>]*>.*<svg/, name);
		assert.doesNotMatch(svg, /#[0-9a-f]{8}"/, `${name}: no #rrggbbaa (Qt reads it as #aarrggbb)`);
		assert.match(svg, /^<svg [^>]*width="144" height="144"/, name);
	}
});

test("a glyph is drawn as a path, and a missing one draws nothing rather than failing", () => {
	assert.match(commandKey("Landing gear", gearIcon), /<path transform="translate\(40 /);
	assert.doesNotMatch(commandKey("Landing gear", { symbol: "no_such_glyph", fill: false }), /<path/);
});

test("the accent only on the state: ON in mint, a shield in blue, a refusal in coral, a command in ink", () => {
	assert.match(valueKey(gear, true, "Gear", gearIcon), new RegExp(`fill="${MINT}" d=|width="112" height="8" fill="${MINT}"`));
	assert.match(valueKey(shield, 80, "Shield"), new RegExp(`height="8" fill="${BLUE}"`));
	assert.match(refusedKey("Gear", "menu", gearIcon), new RegExp(`fill="${CORAL}" d=`));
	assert.match(commandKey("Gear", gearIcon), new RegExp(`fill="${INK}" d=`));
});

test("a track for a % and a flag only, full or empty", () => {
	assert.equal(fillOf(shield, 80), 0.8);
	assert.equal(fillOf(shield, 140), 1);
	assert.equal(fillOf(gear, false), 0);
	assert.equal(fillOf(speed, 142), null);
	assert.doesNotMatch(valueKey(speed, 142, "Speed"), /height="8"/);
});

test("a % of three digits ends before its unit; a long word fits the key; a chosen value keeps its unit", () => {
	assert.match(valueKey(shield, 100, "Shield"), /x="100" [^>]*text-anchor="end">100</);
	const where = { id: "context", type: "string", unit: "" };
	const size = Number(/font-size="(\d+)"[^>]*>SPACE_EVA…</.exec(valueKey(where, "space_eva_long", "Where"))?.[1]);
	assert.ok(size * 0.62 * 10 <= 124, `a 10-character word at ${size} px`);
	assert.match(commandKey("Convergence distance", null, "500 m"), />500 m</);
});

test("a caption: capitals, without brackets", () => {
	assert.equal(caption("Photo: take the picture (no interface on it)"), "PHOTO: TAKE THE PICTURE");
});

test("labels wrap at words, three lines at most, and text is escaped", () => {
	assert.deepEqual(wrap("Landing gear down / up"), ["Landing", "gear down /", "up"]);
	assert.equal(wrap("one two three four five six seven eight").length, 3);
	assert.match(commandKey("A <b> & c"), /A &lt;B&gt; &amp; C/);
	assert.match(dataUri("<svg/>"), /^data:image\/svg\+xml;base64,/);
});
