// "Command": a key that presses one of the game's commands (an action of its Controls page, or
// the convergence). Its setting is the command's id, chosen in the Property Inspector from the
// schema the game sent; for the convergence distance, a value in metres too.
// A refused press turns the key coral for REFUSED_MS with the game's reason.

import streamDeck, {
	action, type KeyAction, type KeyDownEvent, type SendToPluginEvent, SingletonAction,
	type WillAppearEvent, type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { language, link, pairingMessage, sendInspector, t } from "../hub.js";
import { commandIcon, NAV_ICONS } from "../icons.js";
import { commandKey, idleKey, refusedKey } from "../render.js";
import { findCommand, labelOf } from "../schema.js";
import { Painter } from "./painter.js";

const REFUSED_MS = 600;

type CommandSettings = { id?: string; value?: number };

@action({ UUID: "com.david-digitis.farline-companion.command" })
export class CommandAction extends SingletonAction<CommandSettings> {
	private readonly painter = new Painter();
	private readonly flashing = new Set<string>();

	constructor() {
		super();
		link.on("status", () => this.redrawAll());
		link.on("schema", () => this.redrawAll());
		link.on("refused", (refusal: { id: string; why: string }) => this.refused(refusal));
	}

	override onWillAppear(ev: WillAppearEvent<CommandSettings>): void {
		if (ev.action.isKey()) {
			this.redraw(ev.action, ev.payload.settings);
		}
	}

	override onWillDisappear(ev: WillDisappearEvent<CommandSettings>): void {
		this.painter.forget(ev.action.id);
	}

	override async onKeyDown(ev: KeyDownEvent<CommandSettings>): Promise<void> {
		const id = ev.payload.settings.id ?? "";
		const command = findCommand(link.schema, id);
		let sent = false;
		if (command?.kind === "set") {
			sent = link.set(id, Number(ev.payload.settings.value ?? command.min_m ?? 0));
		} else if (id !== "") {
			sent = link.command(id);
		}
		if (!sent) {
			await ev.action.showAlert();   // game off, not paired, no command chosen, or too fast
		}
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonObject, CommandSettings>): Promise<void> {
		const payload = ev.payload;
		const settings = await ev.action.getSettings();
		if (payload.t === "choose") {
			settings.id = String(payload.id ?? "");
			if (typeof payload.value === "number") {
				settings.value = payload.value;
			}
			await ev.action.setSettings(settings);
			if (ev.action.isKey()) {
				this.redraw(ev.action, settings);
			}
		} else {
			pairingMessage(payload);
		}
		await sendInspector("command", settings);
	}

	private redrawAll(): void {
		for (const key of this.actions) {
			if (key.isKey()) {
				void key.getSettings().then((settings) => this.redraw(key, settings));
			}
		}
	}

	private redraw(key: KeyAction<CommandSettings>, settings: CommandSettings): void {
		if (this.flashing.has(key.id)) {
			return;
		}
		if (link.status !== "paired") {
			this.painter.paint(key, idleKey(link.status === "unpaired" ? t("pair_short") : link.status === "outdated" ? t("outdated_short") : t("game_off"), NAV_ICONS.idle));
			return;
		}
		const command = findCommand(link.schema, settings.id ?? "");
		const label = command ? labelOf(command, language()) : (settings.id ?? "?");
		this.painter.paint(key, commandKey(command?.kind === "set" ? `${label} ${settings.value ?? ""} m` : label, commandIcon(settings.id ?? "")));
	}

	private refused(refusal: { id: string; why: string }): void {
		for (const key of this.actions) {
			if (!key.isKey()) {
				continue;
			}
			void key.getSettings().then((settings) => {
				if (settings.id !== refusal.id || this.flashing.has(key.id)) {
					return;
				}
				const command = findCommand(link.schema, refusal.id);
				this.painter.paint(key, refusedKey(command ? labelOf(command, language()) : refusal.id, refusal.why, commandIcon(refusal.id)));
				this.flashing.add(key.id);
				setTimeout(() => {
					this.flashing.delete(key.id);
					const still = [...this.actions].find((a) => a.id === key.id);
					if (still?.isKey()) {
						void still.getSettings().then((now) => this.redraw(still, now));   // rebound meanwhile: its new face
					}
				}, REFUSED_MS);
			});
		}
		streamDeck.logger.info(`refused ${refusal.id}: ${refusal.why}`);
	}
}
