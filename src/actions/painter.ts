// Draws keys without flooding the Stream Deck: one image at most every MIN_GAP_MS per key, and
// only when it differs from the last one sent. A late image waits for its turn, never lost.

import type { KeyAction } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { dataUri } from "../render.js";

const MIN_GAP_MS = 100;   // ten images a second per key at most

type Slot = { last: string; at: number; pending: string | null; timer: NodeJS.Timeout | null };

export class Painter {
	private readonly slots = new Map<string, Slot>();

	paint(action: KeyAction<JsonObject>, svg: string): void {
		const slot = this.slots.get(action.id) ?? { last: "", at: 0, pending: null, timer: null };
		this.slots.set(action.id, slot);
		if (svg === slot.last && slot.pending === null) {
			return;
		}
		const wait = slot.at + MIN_GAP_MS - Date.now();
		if (wait <= 0) {
			this.send(action, slot, svg);
			return;
		}
		slot.pending = svg;
		slot.timer ??= setTimeout(() => {
			slot.timer = null;
			if (slot.pending !== null) {
				this.send(action, slot, slot.pending);
			}
		}, wait);
	}

	/** The key is gone: its slot too. */
	forget(id: string): void {
		const slot = this.slots.get(id);
		if (slot?.timer) {
			clearTimeout(slot.timer);
		}
		this.slots.delete(id);
	}

	private send(action: KeyAction<JsonObject>, slot: Slot, svg: string): void {
		slot.pending = null;
		if (svg === slot.last) {
			return;
		}
		slot.last = svg;
		slot.at = Date.now();
		void action.setImage(dataUri(svg));
	}
}
