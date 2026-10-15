// "Value": a key that shows one value the game pushes (speed, convergence, gear...), large, with
// its unit and its label. Its setting is the field's id, chosen in the Property Inspector from the
// schema. Pressing it does nothing in the game.

import {
	action, type KeyAction, type SendToPluginEvent, SingletonAction, type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { language, link, pairingMessage, sendInspector, t } from "../hub.js";
import { idleKey, valueKey } from "../render.js";
import { findField, labelOf, type Value } from "../schema.js";
import { Painter } from "./painter.js";

type ValueSettings = { field?: string };

@action({ UUID: "com.david-digitis.farline-companion.value" })
export class ValueAction extends SingletonAction<ValueSettings> {
	private readonly painter = new Painter();
	/** key id -> the field it shows, so a state message redraws only the keys it touches. */
	private readonly fields = new Map<string, string>();

	constructor() {
		super();
		link.on("status", () => this.redrawAll());
		link.on("schema", () => this.redrawAll());
		link.on("state", (changes: Record<string, Value>) => this.changed(changes));
	}

	override onWillAppear(ev: WillAppearEvent<ValueSettings>): void {
		this.fields.set(ev.action.id, ev.payload.settings.field ?? "");
		if (ev.action.isKey()) {
			this.redraw(ev.action);
		}
	}

	override onWillDisappear(ev: WillDisappearEvent<ValueSettings>): void {
		this.fields.delete(ev.action.id);
		this.painter.forget(ev.action.id);
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonObject, ValueSettings>): Promise<void> {
		const payload = ev.payload;
		const settings = await ev.action.getSettings();
		if (payload.t === "choose") {
			settings.field = String(payload.id ?? "");
			this.fields.set(ev.action.id, settings.field);
			await ev.action.setSettings(settings);
			if (ev.action.isKey()) {
				this.redraw(ev.action);
			}
		} else {
			pairingMessage(payload);
		}
		await sendInspector("value", settings);
	}

	private changed(changes: Record<string, Value>): void {
		for (const key of this.actions) {
			if (key.isKey() && (this.fields.get(key.id) ?? "") in changes) {
				this.redraw(key);
			}
		}
	}

	private redrawAll(): void {
		for (const key of this.actions) {
			if (key.isKey()) {
				this.redraw(key);
			}
		}
	}

	private redraw(key: KeyAction<ValueSettings>): void {
		const id = this.fields.get(key.id) ?? "";
		if (link.status !== "paired") {
			this.painter.paint(key, idleKey(link.status === "unpaired" ? t("pair_short") : link.status === "outdated" ? t("outdated_short") : t("game_off")));
			return;
		}
		const field = findField(link.schema, id);
		this.painter.paint(key, valueKey(field, link.state.get(id), field ? labelOf(field, language()) : id));
	}
}
