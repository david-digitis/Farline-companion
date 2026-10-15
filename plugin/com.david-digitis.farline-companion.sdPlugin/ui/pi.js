// The Property Inspector of both actions: the link to the game, the pairing, and the key's choice.
// Plain JavaScript, nothing loaded from the network. It talks to the plugin only (sendToPlugin);
// the plugin talks to the game. Which action this is: <body data-kind="command|value">.

const TEXT = {
	en: {
		link: "Game", code: "Code shown in the game", pair: "Pair", forget: "Forget this Stream Deck",
		command: "Command", value: "Value", distance: "Distance (m)", show: "Show",
		auto: "Automatic", autoOf: "Automatic: ", nothing: "Nothing (the command only)",
		waiting: "Start the game, open Controls > Companion and tick Enable the companion.",
		pick: "Pair first: the list comes from the game.",
		hint: "In the game: Controls > Companion > Pair a device. The code is good for two minutes.",
		none: "- choose -", wrong: "Wrong code: check the one the game shows.",
		expired: "The code expired: click Pair a device again in the game.",
		locked: "Too many wrong codes: wait a minute, then pair again.", off: "The game is not reachable.",
	},
	fr: {
		link: "Jeu", code: "Code affiché dans le jeu", pair: "Appairer", forget: "Oublier ce Stream Deck",
		command: "Commande", value: "Valeur", distance: "Distance (m)", show: "Afficher",
		auto: "Automatique", autoOf: "Automatique : ", nothing: "Rien (la commande seule)",
		waiting: "Lancez le jeu, ouvrez Commandes > Companion et cochez Activer le companion.",
		pick: "Appairez d'abord : la liste vient du jeu.",
		hint: "Dans le jeu : Commandes > Companion > Appairer un appareil. Le code vaut deux minutes.",
		none: "- choisir -", wrong: "Code faux : vérifiez celui qu'affiche le jeu.",
		expired: "Le code a expiré : cliquez de nouveau sur Appairer un appareil dans le jeu.",
		locked: "Trop de codes faux : attendez une minute, puis appairez de nouveau.", off: "Le jeu n'est pas joignable.",
	},
};

let socket = null;
let context = "";
let actionUuid = "";
let lang = "en";
let kind = "command";
let last = null;

function words() {
	return TEXT[lang] ?? TEXT.en;
}

function toPlugin(payload) {
	if (socket && socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ event: "sendToPlugin", action: actionUuid, context, payload }));
	}
}

function el(id) {
	return document.getElementById(id);
}

function fillChoices(message) {
	const list = el("choice");
	const chosen = kind === "command" ? message.settings.id : message.settings.field;
	list.replaceChildren();
	const none = document.createElement("option");
	none.value = "";
	none.textContent = words().none;
	none.selected = !chosen;
	list.appendChild(none);
	for (const group of message.choices) {
		const parent = group.group ? document.createElement("optgroup") : list;
		if (group.group) {
			parent.label = group.group;
			list.appendChild(parent);
		}
		for (const item of group.items) {
			const option = document.createElement("option");
			option.value = item.id;
			option.textContent = item.label;
			option.selected = item.id === chosen;
			parent.appendChild(option);
		}
	}
	list.disabled = message.choices.length === 0;
	el("choice-empty").hidden = message.choices.length > 0;
	el("distance-row").hidden = !(kind === "command" && (chosen === "convergence" || list.value === "convergence"));
	if (typeof message.settings.value === "number") {
		el("distance").value = message.settings.value;
	}
}

/** The state a command key shows: automatic (the plugin's table), nothing, or one field. */
function fillShow(message) {
	const list = el("show");
	if (!list) {
		return;
	}
	const chosen = message.settings.show ?? "";
	const command = message.settings.id ?? "";
	const labels = new Map(message.fields.flatMap((g) => g.items.map((i) => [i.id, i.label])));
	const auto = message.states[command];
	const options = [["", auto ? words().autoOf + (labels.get(auto) ?? auto) : words().auto], ["none", words().nothing]];
	list.replaceChildren(...options.map(([id, label]) => {
		const option = document.createElement("option");
		option.value = id;
		option.textContent = label;
		option.selected = id === chosen;
		return option;
	}));
	for (const group of message.fields) {
		const parent = document.createElement("optgroup");
		parent.label = group.group || words().value;
		for (const item of group.items) {
			const option = document.createElement("option");
			option.value = item.id;
			option.textContent = item.label;
			option.selected = item.id === chosen;
			parent.appendChild(option);
		}
		list.appendChild(parent);
	}
	if (chosen !== "" && chosen !== "none" && !labels.has(chosen)) {
		const kept = document.createElement("option");   // a field this game does not send: kept, not lost
		kept.value = chosen;
		kept.textContent = chosen;
		kept.selected = true;
		list.appendChild(kept);
	}
	list.disabled = message.fields.length === 0;
}

function draw(message) {
	last = message;
	lang = String(message.language || "en").startsWith("fr") ? "fr" : "en";
	const w = words();
	for (const node of document.querySelectorAll("[data-text]")) {
		node.textContent = w[node.dataset.text];
	}
	el("choice-label").textContent = kind === "command" ? w.command : w.value;
	el("status").textContent = message.statusText;
	el("status").className = "status " + message.status;
	el("waiting").hidden = message.status !== "off" && message.status !== "connecting";
	el("pairing").hidden = message.status !== "unpaired";
	if (message.status === "paired") {
		el("pair-result").textContent = "";
	}
	el("forget").hidden = message.status !== "paired";
	el("choice-empty").textContent = w.pick;
	fillChoices(message);
	fillShow(message);
}

function choose() {
	const id = el("choice").value;
	const payload = { t: "choose", id };
	if (el("show")) {
		// Another command: back to its automatic state, not the field chosen for the previous one.
		payload.show = last && id !== (last.settings.id ?? "") ? "" : el("show").value;
	}
	if (id === "convergence") {
		payload.value = Number(el("distance").value) || 500;
	}
	toPlugin(payload);
}

function wire() {
	el("pair").addEventListener("click", () => {
		const code = el("code").value.replace(/\D/g, "");
		if (code.length === 6) {
			el("pair-result").textContent = "";
			toPlugin({ t: "pair", code });
		}
	});
	el("forget").addEventListener("click", () => toPlugin({ t: "forget" }));
	el("choice").addEventListener("change", choose);
	el("distance").addEventListener("change", choose);
	el("show")?.addEventListener("change", choose);
}

// Called by the Stream Deck software when it opens the inspector.
window.connectElgatoStreamDeckSocket = (port, uuid, registerEvent, info, actionInfo) => {
	context = uuid;
	kind = document.body.dataset.kind;
	actionUuid = JSON.parse(actionInfo).action;
	lang = String(JSON.parse(info).application?.language || "en").startsWith("fr") ? "fr" : "en";
	wire();
	socket = new WebSocket(`ws://127.0.0.1:${port}`);
	socket.onopen = () => {
		socket.send(JSON.stringify({ event: registerEvent, uuid }));
		toPlugin({ t: "hello" });
	};
	socket.onmessage = (event) => {
		const message = JSON.parse(event.data);
		if (message.event === "sendToPropertyInspector" && message.payload?.t === "link") {
			draw(message.payload);
		} else if (message.event === "sendToPropertyInspector" && message.payload?.t === "pair") {
			el("pair-result").textContent = words()[message.payload.why] ?? message.payload.why;
		}
	};
	if (last) {
		draw(last);
	}
};
