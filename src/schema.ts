// The schema the game sends (and schema.json in this repository): what can be pressed, what can
// be shown, their labels in English and French. Identifiers never change name (they are only
// marked "deprecated"): a key copied into a player's own profile stays valid for ever.

export type CommandKind = "press" | "hold" | "delta" | "set";

export type Command = {
	id: string;
	tab: string;
	kind: CommandKind;
	label_en: string;
	label_fr: string;
	default_key: string;
	deprecated?: boolean;
	min_m?: number;
	max_m?: number;
	step_m?: number;
};

export type Field = {
	id: string;
	type: "number" | "bool" | "string";
	unit: string;
	label_en: string;
	label_fr: string;
	deprecated?: boolean;
};

export type Tab = { id: string; label_en: string; label_fr: string };

export type Schema = {
	cv: number;
	contexts: string[];
	tabs: Tab[];
	commands: Command[];
	fields: Field[];
};

/** A value the game pushes: a number, a flag, a word, or null once gone. */
export type Value = number | boolean | string | null;

/** The label in the Stream Deck's language: French for "fr", English otherwise. */
export function labelOf(item: { label_en: string; label_fr: string }, language: string): string {
	return language.startsWith("fr") ? item.label_fr : item.label_en;
}

/** The commands a key may send (held ones are refused by the game), grouped by tab, in order. */
export function commandsByTab(schema: Schema): Map<string, Command[]> {
	const out = new Map<string, Command[]>();
	for (const tab of schema.tabs) {
		out.set(tab.id, []);
	}
	for (const command of schema.commands) {
		if (command.kind === "hold") {
			continue;
		}
		const list = out.get(command.tab) ?? [];
		list.push(command);
		out.set(command.tab, list);
	}
	return out;
}

export function findCommand(schema: Schema | null, id: string): Command | undefined {
	return schema?.commands.find((command) => command.id === id);
}

export function findField(schema: Schema | null, id: string): Field | undefined {
	return schema?.fields.find((field) => field.id === id);
}

/** A light shape check of a message that claims to be the schema. */
export function isSchema(value: unknown): value is Schema {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const s = value as Record<string, unknown>;
	return Array.isArray(s.commands) && Array.isArray(s.fields) && Array.isArray(s.tabs);
}
