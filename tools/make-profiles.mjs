// Writes the master profiles from the game's schema, one file per Stream Deck model, all with the
// same layout drawn for the Mini's 6 keys (3 x 2): a player who wants everything takes the profile,
// the others copy the blocks they like into their own.
//
//   node tools/make-profiles.mjs schema.json [--out dist/profiles] [--lang en|fr|all]
//
// Root: one folder per tab of the game's Controls page (only the tabs with something to press or
// show), five a page, the sixth key "Next" opening the rest. A tab's page: Back at (0,0), then its
// keys, paginated the same way. Composed blocks open their tab: a pair on the top row, a triple on
// the bottom row (convergence - / value / +). Format: Stream Deck 7 profiles (Version 3.0, read
// from profiles the software exported); see PROTOCOL.md for the actions. Folders, Back and Next
// carry a picture in the keys' style (a pictogram, no text: the software writes the title), in the
// page's Images/ as the software stores them. Needs `tsc` first (it draws with build/render.js).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Resvg } from "@resvg/resvg-js";

import { NAV_ICONS, TAB_ICONS } from "../build/icons.js";
import { navKey } from "../build/render.js";
import { useSymbols } from "../build/symbols.js";
import { writeZip } from "./zip.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
useSymbols(path.join(ROOT, "plugin", "com.david-digitis.farline-companion.sdPlugin", "imgs", "symbols"));

export const PLUGIN = "com.david-digitis.farline-companion";
export const COMMAND = `${PLUGIN}.command`;
export const VALUE = `${PLUGIN}.value`;
const PLUGIN_INFO = { Name: "Farline", UUID: PLUGIN, Version: "0.1.0.0" };
const OPEN = "com.elgato.streamdeck.profile.openchild";
const BACK = "com.elgato.streamdeck.profile.backtoparent";
const NONE_PAGE = "00000000-0000-0000-0000-000000000000";

/** Device.Model as the software writes it (read from exported profiles), the keys, the dials. */
export const MODELS = [
	{ name: "Mini", model: "20GAI9901", dials: false },
	{ name: "Classic", model: "20GBA9901", dials: false },
	{ name: "XL", model: "20GAT9901", dials: false },
	{ name: "Plus", model: "20GBD9901", dials: true },
	{ name: "Neo", model: "20GBJ9901", dials: false },
];

/** Blocks that open a tab: [command | value] keys side by side. */
export const BLOCKS = {
	"Combat": [[{ c: "convergence_down" }, { v: "convergence" }, { c: "convergence_up" }]],
	"Ship commands": [[{ c: "landing_gear" }, { v: "gear" }], [{ c: "engine_toggle" }, { v: "engines" }],
		[{ c: "headlights" }, { v: "headlights" }]],
	"Flight controls": [[{ v: "speed" }, { v: "throttle" }, { v: "g" }]],
	"General": [[{ c: "view_toggle" }, { v: "view_cockpit" }]],
};
const TOP = ["1,0", "2,0"];
const BOTTOM = ["0,1", "1,1", "2,1"];
const NEXT_SLOT = "2,1";

/** A stable UUID from a name: the same schema gives the same file, byte for byte. */
export function uuidOf(name) {
	const h = crypto.createHash("sha1").update(`farline-companion/${name}`).digest("hex");
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function label(item, lang) {
	return lang === "fr" ? item.label_fr : item.label_en;
}

function state(title, image) {
	const out = { FontSize: 11, ShowTitle: title !== "", Title: title, TitleAlignment: "bottom", TitleColor: "#ece8e1" };
	return image ? { ...out, Image: `Images/${image.name}` } : out;
}

/** A picture of the profile: a pictogram drawn as the plugin draws a key, 144 px, named from what it shows. */
export function pictureOf(icon, folder = false) {
	const h = crypto.createHash("sha1").update(`${icon.symbol}/${icon.fill}/${folder}`).digest("hex").toUpperCase();
	const data = new Resvg(navKey(icon, folder), { fitTo: { mode: "width", value: 144 }, font: { loadSystemFonts: false } }).render().asPng();
	return { name: `${h.slice(0, 25)}Z.png`, data };
}

/** The picture data of a key, kept out of its JSON. */
const PICTURES = new WeakMap();

/** A key; `where` (its page and slot) makes its ActionID unique in the profile. */
function key(where, name, uuid, settings, title = "", plugin = PLUGIN_INFO, image = null) {
	const out = { ActionID: uuidOf(`${where}/${name}/${JSON.stringify(settings)}`), LinkedTitle: true, Name: name,
		Resources: null, Settings: settings, State: 0, States: [state(title, image)], UUID: uuid };
	if (image) {
		PICTURES.set(out, image.data);
	}
	if (plugin) {
		out.Plugin = plugin;
	}
	return out;
}

/** The key of a block's entry: a Command (its id) or a Value (its field). */
function entryKey(where, k) {
	return k.c !== undefined ? key(where, "Command", COMMAND, { id: k.c })
		: key(where, "Value", VALUE, { field: k.v });
}

/** The units of a tab: its blocks, then its commands not already in a block, one key each. */
export function unitsOf(tab, schema) {
	const blocks = BLOCKS[tab] ?? [];
	const taken = new Set(blocks.flat().filter((k) => k.c !== undefined).map((k) => k.c));
	// A "set" command needs a value chosen by the player (the convergence distance): not a key of its own here.
	const commands = schema.commands.filter((c) => c.tab === tab && (c.kind === "press" || c.kind === "delta")
		&& !c.deprecated && !taken.has(c.id));
	return [...blocks, ...commands.map((c) => [{ c: c.id }])];
}

/** Where "Next" goes on a full page: the last key, unless a block holds it (then the top row's). */
function nextSlot(placed) {
	const last = placed.find((p) => p.at.includes(NEXT_SLOT));
	return last && last.unit.length > 1 ? "2,0" : NEXT_SLOT;
}

/** Fills one row with the units that fit, in order; a unit too long for a top row waits. */
function fillRow(row, left, placed) {
	let free = [...row];
	for (let i = 0; i < left.length && free.length > 0;) {
		if (left[i].length <= free.length) {
			const unit = left.splice(i, 1)[0];
			placed.push({ unit, at: free.slice(0, unit.length) });
			free = free.slice(unit.length);
		} else if (row !== BOTTOM) {
			i++;
		} else {
			break;
		}
	}
}

/** Places units on pages of 6 keys: [{slots: {"x,y": entry}, more, next}]. A root page has no
 *  Back key, so its top row starts at (0,0). */
export function paginate(units, root = false) {
	const pages = [];
	const left = [...units];
	while (left.length > 0) {
		const placed = [];
		fillRow(root && pages.length === 0 ? ["0,0", ...TOP] : TOP, left, placed);
		fillRow(BOTTOM, left, placed);
		if (placed.length === 0) {
			throw new Error(`a block of ${left[0].length} keys fits no row of 3: ${JSON.stringify(left[0])}`);
		}
		let next = NEXT_SLOT;
		if (left.length > 0) {
			next = nextSlot(placed);
			const holder = placed.find((p) => p.at.includes(next));
			if (holder) {
				placed.splice(placed.indexOf(holder), 1);
				left.unshift(holder.unit);
			}
		}
		const slots = {};
		for (const p of placed) {
			p.unit.forEach((k, i) => { slots[p.at[i]] = k; });
		}
		pages.push({ slots, more: left.length > 0, next });
	}
	return pages;
}

function controllers(actions, dials) {
	const out = [{ Actions: actions, Type: "Keypad" }];
	if (dials) {
		out.push({ Actions: null, Type: "Encoder" });
	}
	return out;
}

/** Writes a chain of pages (Back first unless root, Next last when more): their ids and files. */
function chain(name, pages, toKeys, root, files, dials, lang) {
	const ids = pages.map((_, i) => uuidOf(`${name}/${i}`));
	pages.forEach((page, i) => {
		const actions = {};
		if (!root || i > 0) {
			actions["0,0"] = key(`${ids[i]}/0,0`, "Parent Folder", BACK, {}, "", null, pictureOf(NAV_ICONS.back));
		}
		Object.assign(actions, toKeys(page.slots, ids[i]));
		if (page.more) {
			actions[page.next] = key(`${ids[i]}/${page.next}`, "Create Folder", OPEN, { ProfileUUID: ids[i + 1] }, lang === "fr" ? "Suite" : "Next",
				{ Name: "Create Folder", UUID: OPEN, Version: "1.0" }, pictureOf(NAV_ICONS.next));
		}
		files.push({ id: ids[i], manifest: { Controllers: controllers(actions, dials), Icon: "", Name: "" }, images: imagesOf(actions) });
	});
	return ids[0];
}

/** The pages of one profile: [{id, manifest}], the root page id first. */
export function pagesOf(schema, lang, dials) {
	const files = [];
	const tabs = schema.tabs.filter((t) => unitsOf(t.id, schema).length > 0);
	const folders = tabs.map((t) => {
		const pages = paginate(unitsOf(t.id, schema));
		const first = chain(`tab/${t.id}/${lang}/${dials}`, pages, slotKeys, false, files, dials, lang);
		return [{ folder: label(t, lang), page: first, icon: TAB_ICONS[t.id] ?? null }];
	});
	const rootPages = paginate(folders, true);
	const root = chain(`root/${lang}/${dials}`, rootPages, (slots, page) => Object.fromEntries(Object.entries(slots).map(
		([at, f]) => [at, key(`${page}/${at}`, "Create Folder", OPEN, { ProfileUUID: f.page }, f.folder,
			{ Name: "Create Folder", UUID: OPEN, Version: "1.0" }, f.icon ? pictureOf(f.icon, true) : null)])), true, files, dials, lang);
	files.sort((a, b) => (a.id === root ? -1 : b.id === root ? 1 : 0));
	return files;
}

/** The pictures a page's keys name, once each, in a stable order. */
function imagesOf(actions) {
	const out = new Map();
	for (const a of Object.values(actions)) {
		const image = a.States[0].Image;
		if (image && !out.has(image)) {
			out.set(image, PICTURES.get(a));
		}
	}
	return [...out.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function slotKeys(slots, page) {
	return Object.fromEntries(Object.entries(slots).map(([at, k]) => [at, entryKey(`${page}/${at}`, k)]));
}

/** One .streamDeckProfile: {name, buffer}. */
export function profileOf(schema, model, lang) {
	const pages = pagesOf(schema, lang, model.dials);
	const profileId = uuidOf(`profile/${model.model}/${lang}`).toUpperCase();
	const empty = uuidOf(`default/${model.model}/${lang}`);
	const base = `Profiles/${profileId}.sdProfile/`;
	const json = (v) => Buffer.from(JSON.stringify(v), "utf8");
	const entries = [
		{ name: "package.json", data: json({ AppVersion: "7.4.0", DeviceModel: model.model, DeviceSettings: null,
			FormatVersion: 1, OSType: "Windows", OSVersion: "10.0", RequiredPlugins: [PLUGIN] }) },
		{ name: "Profiles/" }, { name: base },
		{ name: `${base}manifest.json`, data: json({ Device: { Model: model.model, UUID: uuidOf(`device/${model.model}`) },
			Name: "Farline", Pages: { Current: NONE_PAGE, Default: empty, Pages: [pages[0].id] }, Version: "3.0" }) },
		{ name: `${base}Profiles/` },
	];
	for (const page of [...pages, { id: empty, manifest: { Controllers: controllers(null, model.dials), Icon: "", Name: "" } }]) {
		const dir = `${base}Profiles/${page.id.toUpperCase()}/`;
		entries.push({ name: dir }, { name: `${dir}Images/` },
			...(page.images ?? []).map(([name, data]) => ({ name: `${dir}${name}`, data })),
			{ name: `${dir}manifest.json`, data: json(page.manifest) });
	}
	const suffix = lang === "fr" ? "-FR" : "";
	return { name: `Farline-${model.name}${suffix}.streamDeckProfile`, buffer: writeZip(entries) };
}

function main(argv) {
	const schemaPath = argv.find((a) => !a.startsWith("--")) ?? "schema.json";
	const out = argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : "dist/profiles";
	const langArg = argv.includes("--lang") ? argv[argv.indexOf("--lang") + 1] : "all";
	const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
	fs.mkdirSync(out, { recursive: true });
	for (const lang of langArg === "all" ? ["en", "fr"] : [langArg]) {
		for (const model of MODELS) {
			const profile = profileOf(schema, model, lang);
			fs.writeFileSync(path.join(out, profile.name), profile.buffer);
			console.log(`wrote ${path.join(out, profile.name)}`);
		}
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	main(process.argv.slice(2));
}
