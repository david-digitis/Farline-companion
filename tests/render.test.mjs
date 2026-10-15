// What a key draws: a number with its unit, a flag, a value gone, a long label.

import assert from "node:assert/strict";
import { test } from "node:test";

import { BLUE, CORAL, INK, MINT } from "../build/palette.js";
import { commandKey, dataUri, shown, valueKey, wrap } from "../build/render.js";

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
	assert.match(svg, />Speed</);
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

test("no rounded corner, no gradient, no glow", () => {
	const svg = valueKey(speed, 142, "Speed") + commandKey("Landing gear down / up");
	assert.doesNotMatch(svg, /rx=|ry=|Gradient|filter|blur/);
});

test("labels wrap at words, three lines at most, and text is escaped", () => {
	assert.deepEqual(wrap("Landing gear down / up"), ["Landing", "gear down /", "up"]);
	assert.equal(wrap("one two three four five six seven eight").length, 3);
	assert.match(commandKey("A <b> & c"), /A &lt;b&gt; &amp; c/);
	assert.match(dataUri("<svg/>"), /^data:image\/svg\+xml;base64,/);
});
