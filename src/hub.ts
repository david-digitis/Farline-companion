// The plugin's shared state: the one GameLink, the token kept in the plugin's global settings,
// and what every Property Inspector shows (the link's status, the pairing, the choices taken
// from the schema). The two actions read it; nothing here draws a key.

import os from "node:os";

import streamDeck from "@elgato/streamdeck";
import type { JsonObject, JsonValue } from "@elgato/utils";

import { GameLink, type LinkStatus } from "./game-link.js";
import { commandsByTab, labelOf, type Schema } from "./schema.js";

type GlobalSettings = { token?: string };

export const link = new GameLink({ name: `Stream Deck (${os.hostname()})` });

/** The Stream Deck's language ("fr", "en", "de"...). */
export function language(): string {
	return String(streamDeck.info.application.language ?? "en");
}

/** A plugin text (en.json / fr.json, "Localization"). */
export function t(key: string): string {
	return streamDeck.i18n.translate(key);
}

/** Starts the link with the token the settings kept; keeps the settings in step with it. */
export async function startLink(): Promise<void> {
	const saved = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	link.token = typeof saved.token === "string" ? saved.token : "";
	link.on("paired", (token: string) => {
		streamDeck.logger.info("paired with the game");
		void streamDeck.settings.setGlobalSettings<GlobalSettings>({ token });
	});
	link.on("unpaired", () => {
		streamDeck.logger.info("the game no longer knows this Stream Deck: pair it again");
		void streamDeck.settings.setGlobalSettings<GlobalSettings>({});
	});
	link.on("status", (status: LinkStatus) => {
		streamDeck.logger.info(`game link: ${status}`);
		void refreshInspector();
	});
	link.on("schema", () => void refreshInspector());
	link.start();
}

/** The status line of the Property Inspector, in the Stream Deck's language. */
export function statusText(status: LinkStatus): string {
	switch (status) {
		case "paired":
			return `${t("paired")} (Farline ${link.game})`;
		case "unpaired":
			return t("unpaired");
	}
	return t("game_off");
}

/** The choices of a Property Inspector's list: commands by tab, or fields. */
function choices(kind: "command" | "value", schema: Schema): JsonValue {
	const lang = language();
	if (kind === "value") {
		return [{ group: "", items: schema.fields.map((f) => ({ id: f.id, label: labelOf(f, lang) })) }];
	}
	const out: JsonObject[] = [];
	for (const [tab, commands] of commandsByTab(schema)) {
		const head = schema.tabs.find((x) => x.id === tab);
		out.push({ group: head ? labelOf(head, lang) : tab, items: commands.map((c) => ({ id: c.id, label: labelOf(c, lang) })) });
	}
	return out;
}

const COMMAND_UUID = "com.david-digitis.farline-companion.command";

/** The open Property Inspector again (the link changed while it was open: paired, game closed). */
async function refreshInspector(): Promise<void> {
	const open = streamDeck.ui.action;
	if (open === undefined) {
		return;
	}
	await sendInspector(open.manifestId === COMMAND_UUID ? "command" : "value", await open.getSettings());
}

/** Everything the Property Inspector draws, sent each time something changes. */
export async function sendInspector(kind: "command" | "value", settings: JsonObject): Promise<void> {
	await streamDeck.ui.sendToPropertyInspector({
		t: "link",
		status: link.status,
		statusText: statusText(link.status),
		language: language(),
		choices: link.schema ? choices(kind, link.schema) : [],
		settings,
	});
}

/** A message from a Property Inspector that is about the pairing, not the key. True if handled. */
export function pairingMessage(payload: JsonObject): boolean {
	if (payload.t === "pair" && typeof payload.code === "string") {
		link.pair(payload.code);
		return true;
	}
	if (payload.t === "forget") {
		link.forget();
		void streamDeck.settings.setGlobalSettings<GlobalSettings>({});
		return true;
	}
	return false;
}
