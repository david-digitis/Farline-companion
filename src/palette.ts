// The game's colours, copied from its interface tokens (game/scripts/ui/ui_tokens.gd in the
// game's repository). Three accents, one meaning each, everywhere: MINT = me, an ally, positive,
// the engine and the speed; CORAL = hostile, danger, weapons, g-force, alerts; BLUE = the shield.
// The rest in ink. No glow, no gradient, no rounded corner: corners are cut.

/** BG_SCREEN: the background of every screen. */
export const BG = "#0f1419";
/** INK: text and neutral strokes. */
export const INK = "#ece8e1";
/** INK_SECONDARY: INK at 60 %, for small labels. */
export const INK_DIM = "#ece8e199";
/** INK_DISABLED: INK at 38 %, for a key that does nothing here. */
export const INK_OFF = "#ece8e161";
/** TRACK: INK at 12 %, the empty part of a bar. */
export const INK_TRACK = "#ece8e11f";
/** MINT: me, positive, the engine, the speed. */
export const MINT = "#3ee6b4";
/** CORAL: danger, weapons, g, alerts. */
export const CORAL = "#ff5e5b";
/** CORAL at 10 %: the tint of a coral block (a refused key). */
export const CORAL_TINT = "#ff5e5b1a";
/** BLUE: the shield. */
export const BLUE = "#8fb8ff";

const CORAL_FIELDS = new Set(["energy_weapons", "g", "charge", "beam", "target", "target_distance", "hull"]);
const MINT_FIELDS = new Set(["speed", "throttle", "boost", "energy_engine", "station", "convergence"]);
const BLUE_FIELDS = new Set(["energy_shield"]);

/** The accent of a field's value (a number or a string), by the game's rule. */
export function accentOf(field: string): string {
	if (CORAL_FIELDS.has(field)) {
		return CORAL;
	}
	if (BLUE_FIELDS.has(field)) {
		return BLUE;
	}
	return MINT_FIELDS.has(field) ? MINT : INK;
}

/** A colour as an SVG attribute that every renderer reads alike: #rrggbb, and a see-through one
 *  (#rrggbbaa in this file) split into #rrggbb plus fill-opacity. The Stream Deck software is
 *  built on Qt, which reads eight digits as #aarrggbb. */
export function fill(colour: string): string {
	if (colour.length !== 9) {
		return `fill="${colour}"`;
	}
	const alpha = Math.round((parseInt(colour.slice(7), 16) / 255) * 100) / 100;
	return `fill="${colour.slice(0, 7)}" fill-opacity="${alpha}"`;
}
