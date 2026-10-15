// Combined keys: a command key shows the state it changes, so one key presses and tells. The field
// each command shows by default, keyed by the schema's identifiers (never renamed); the player can
// pick another field or none in the Property Inspector (settings.show: "" = this table, "none").

export const STATE_OF: Record<string, string> = {
	view_toggle: "view_cockpit", head_toggle: "head_tracking", boost: "boost",
	tri_weapons: "energy_weapons", tri_engine: "energy_engine", tri_shield: "energy_shield",
	capacitor_mode: "capacitor_full",
	conv_far: "convergence", conv_near: "convergence", convergence_up: "convergence",
	convergence_down: "convergence", convergence: "convergence",
	engine_toggle: "engines", headlights: "headlights", cabin_light: "cabin_light", landing_gear: "gear",
	photo_mode: "photo", photo_horizon: "photo_horizon", photo_time: "photo_frozen",
	photo_smooth_more: "photo_smoothing", photo_smooth_less: "photo_smoothing",
	photo_speed_down: "photo_speed", photo_speed_up: "photo_speed",
	photo_blur_less: "photo_blur", photo_blur_more: "photo_blur",
	photo_depth_less: "photo_depth", photo_depth_more: "photo_depth",
};

/** The field a command key shows: the player's choice, else the table's; "" for none. */
export function shownField(command: string, show: string | undefined): string {
	if (show === "none") {
		return "";
	}
	return show !== undefined && show !== "" ? show : (STATE_OF[command] ?? "");
}
