// The Property Inspector of both actions: the link to the game, the pairing, and the key's choice.
// Plain JavaScript, nothing loaded from the network. It talks to the plugin only (sendToPlugin);
// the plugin talks to the game. Which action this is: <body data-kind="command|value">.

const TEXT = {
	en: {
		link: "Game", code: "Code shown in the game", pair: "Pair", forget: "Forget this Stream Deck",
		command: "Command", value: "Value", distance: "Distance (m)",
		waiting: "Start the game, open Controls > Companion and tick Enable the companion.",
		pick: "Pair first: the list comes from the game.",
		hint: "In the game: Controls > Companion > Pair a device. The code is good for two minutes.",
	},
	fr: {
		link: "Jeu", code: "Code affiché dans le jeu", pair: "Appairer", forget: "Oublier ce Stream Deck",
		command: "Commande", value: "Valeur", distance: "Distance (m)",
		waiting: "Lancez le jeu, ouvrez Commandes > Companion et cochez Activer le companion.",
		pick: "Appairez d'abord : la liste vient du jeu.",
		hint: "Dans le jeu : Commandes > Companion > Appairer un appareil. Le code vaut deux minutes.",
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
	el("forget").hidden = message.status !== "paired";
	el("choice-empty").textContent = w.pick;
	fillChoices(message);
}

function choose() {
	const id = el("choice").value;
	const payload = { t: "choose", id };
	if (id === "convergence") {
		payload.value = Number(el("distance").value) || 500;
	}
	toPlugin(payload);
}

function wire() {
	el("pair").addEventListener("click", () => {
		const code = el("code").value.replace(/\D/g, "");
		if (code.length === 6) {
			toPlugin({ t: "pair", code });
			el("code").value = "";
		}
	});
	el("forget").addEventListener("click", () => toPlugin({ t: "forget" }));
	el("choice").addEventListener("change", choose);
	el("distance").addEventListener("change", choose);
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
		}
	};
	if (last) {
		draw(last);
	}
};
