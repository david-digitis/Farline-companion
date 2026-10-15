// The icon table stays true: every identifier of the schema has a glyph or is a label alone on
// purpose, and every glyph the table names is shipped in the plugin's imgs/symbols/.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { allIcons, COMMAND_ICONS, FIELD_ICONS, LABEL_ONLY, TAB_ICONS } from "../build/icons.js";
import { fileOf } from "../build/symbols.js";

const schema = JSON.parse(fs.readFileSync("schema.json", "utf8"));
const SYMBOLS = path.join("plugin", "com.david-digitis.farline-companion.sdPlugin", "imgs", "symbols");

test("every command has a glyph or is listed as a label alone", () => {
	const missing = schema.commands.filter((c) => !(c.id in COMMAND_ICONS) && !LABEL_ONLY.has(c.id)).map((c) => c.id);
	assert.deepEqual(missing, [], "add these commands to src/icons.ts (COMMAND_ICONS or LABEL_ONLY)");
});

test("every field and every tab has a glyph", () => {
	assert.deepEqual(schema.fields.filter((f) => !(f.id in FIELD_ICONS)).map((f) => f.id), []);
	assert.deepEqual(schema.tabs.filter((t) => !(t.id in TAB_ICONS)).map((t) => t.id), []);
});

test("a label alone has no glyph too, and the table names only known identifiers", () => {
	for (const id of LABEL_ONLY) {
		assert.ok(!(id in COMMAND_ICONS), `${id} is both a label alone and a glyph`);
	}
	const commands = new Set(schema.commands.map((c) => c.id));
	const fields = new Set(schema.fields.map((f) => f.id));
	assert.deepEqual(Object.keys(COMMAND_ICONS).filter((id) => !commands.has(id)), []);
	assert.deepEqual(Object.keys(FIELD_ICONS).filter((id) => !fields.has(id)), []);
});

test("every glyph of the table is shipped, and nothing else", () => {
	const wanted = new Set(allIcons().map((i) => `${fileOf(i.symbol, i.fill)}.svg`));
	const shipped = new Set(fs.readdirSync(SYMBOLS));
	assert.deepEqual([...wanted].filter((f) => !shipped.has(f)), [], "run npm run symbols");
	assert.deepEqual([...shipped].filter((f) => !wanted.has(f)), [], "run npm run symbols");
});

test("the state a command shows by default is a field of the schema, and its command exists", async () => {
	const { STATE_OF } = await import("../build/states.js");
	const commands = new Set(schema.commands.map((c) => c.id));
	const fields = new Set(schema.fields.map((f) => f.id));
	for (const [command, field] of Object.entries(STATE_OF)) {
		assert.ok(commands.has(command), `${command} is not a command of the schema`);
		assert.ok(fields.has(field), `${command} shows ${field}, not a field of the schema`);
		assert.ok(command in COMMAND_ICONS, `${command} has no pictogram to light up`);
	}
});
