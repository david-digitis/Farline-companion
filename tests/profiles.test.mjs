// The master profiles: every file reads back as a zip, every key is an action of this plugin
// (with an id the schema knows) or a folder key of the Stream Deck, every folder leads to a page
// of the profile, every page but the root has its Back key, and the convergence block is there.

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { COMMAND, MODELS, paginate, PLUGIN, profileOf, unitsOf, VALUE } from "../tools/make-profiles.mjs";
import { readZip } from "../tools/zip.mjs";

const schema = JSON.parse(fs.readFileSync(new URL("../schema.json", import.meta.url), "utf8"));
const manifest = JSON.parse(fs.readFileSync(
	new URL("../plugin/com.david-digitis.farline-companion.sdPlugin/manifest.json", import.meta.url), "utf8"));
const OPEN = "com.elgato.streamdeck.profile.openchild";
const BACK = "com.elgato.streamdeck.profile.backtoparent";
const commandIds = new Set(schema.commands.filter((c) => c.kind === "press" || c.kind === "delta").map((c) => c.id));
const fieldIds = new Set(schema.fields.map((f) => f.id));

function pagesOf(files) {
	const top = Object.keys(files).find((n) => /^Profiles\/[^/]+\.sdProfile\/manifest\.json$/.test(n));
	const profile = JSON.parse(files[top].toString("utf8"));
	const pages = {};
	for (const [name, data] of Object.entries(files)) {
		const m = name.match(/\.sdProfile\/Profiles\/([0-9A-F-]+)\/manifest\.json$/);
		if (m) {
			pages[m[1]] = JSON.parse(data.toString("utf8"));
		}
	}
	return { profile, pages };
}

test("the plugin declares both actions the profiles use", () => {
	const uuids = manifest.Actions.map((a) => a.UUID);
	assert.ok(uuids.includes(COMMAND) && uuids.includes(VALUE));
	assert.equal(manifest.UUID, PLUGIN);
});

for (const model of MODELS) {
	for (const lang of ["en", "fr"]) {
		test(`profile ${model.name} (${lang}): reads back, every key known, every folder reachable`, () => {
			const { buffer } = profileOf(schema, model, lang);
			const files = readZip(buffer);
			const pkg = JSON.parse(files["package.json"].toString("utf8"));
			assert.deepEqual(pkg.RequiredPlugins, [PLUGIN]);
			assert.equal(pkg.DeviceModel, model.model);
			const { profile, pages } = pagesOf(files);
			assert.equal(profile.Version, "3.0");
			const root = profile.Pages.Pages[0].toUpperCase();
			assert.ok(pages[root], "the root page is in the file");
			for (const [id, page] of Object.entries(pages)) {
				const actions = page.Controllers[0].Actions ?? {};
				if (id !== root && Object.keys(actions).length > 0) {
					assert.equal(actions["0,0"]?.UUID, BACK, `page ${id} has its Back key`);
				}
				for (const [at, key] of Object.entries(actions)) {
					assert.match(at, /^[0-2],[0-1]$/, "inside the Mini's 3 x 2");
					if (key.UUID === COMMAND) {
						assert.ok(commandIds.has(key.Settings.id), `command ${key.Settings.id}`);
					} else if (key.UUID === VALUE) {
						assert.ok(fieldIds.has(key.Settings.field), `field ${key.Settings.field}`);
					} else if (key.UUID === OPEN) {
						assert.ok(pages[key.Settings.ProfileUUID.toUpperCase()], "the folder's page exists");
					} else {
						assert.equal(key.UUID, BACK);
					}
					if (key.UUID === OPEN || key.UUID === BACK) {
						const image = key.States[0].Image;
						assert.match(image ?? "", /^Images\/[0-9A-Z]{25}Z\.png$/, `${at}: a folder, Back or Next has its picture`);
						const file = Object.keys(files).find((n) => n.endsWith(`/Profiles/${id}/${image}`));
						assert.ok(file && files[file].subarray(1, 4).toString() === "PNG", `${image} is in the page, as a PNG`);
					}
				}
			}
		});
	}
}

test("every command a key may send is in some page of the profile", () => {
	const { pages } = pagesOf(readZip(profileOf(schema, MODELS[0], "en").buffer));
	const placed = new Set();
	for (const page of Object.values(pages)) {
		for (const key of Object.values(page.Controllers[0].Actions ?? {})) {
			if (key.UUID === COMMAND) {
				placed.add(key.Settings.id);
			}
		}
	}
	const missing = [...commandIds].filter((id) => !placed.has(id) && schema.commands.find((c) => c.id === id).tab !== "");
	assert.deepEqual(missing, []);
});

test("Combat opens on the convergence block, side by side on the bottom row", () => {
	const pages = paginate(unitsOf("Combat", schema));
	assert.deepEqual([pages[0].slots["0,1"], pages[0].slots["1,1"], pages[0].slots["2,1"]],
		[{ c: "convergence_down" }, { v: "convergence" }, { c: "convergence_up" }]);
	assert.equal(pages[0].next, "2,0");
});

test("every key of a profile has its own ActionID", () => {
	const { pages } = pagesOf(readZip(profileOf(schema, MODELS[0], "en").buffer));
	const ids = Object.values(pages).flatMap((p) => Object.values(p.Controllers[0].Actions ?? {}).map((k) => k.ActionID));
	assert.equal(new Set(ids).size, ids.length);
});

test("a block too long for a row fails loudly instead of looping", () => {
	assert.throws(() => paginate([[{ c: "a" }, { c: "b" }, { c: "c" }, { c: "d" }]]), /fits no row/);
});

test("the same schema gives the same bytes", () => {
	assert.ok(profileOf(schema, MODELS[0], "fr").buffer.equals(profileOf(schema, MODELS[0], "fr").buffer));
});
