// A fake game for the tests: the companion protocol (PROTOCOL.md) on 127.0.0.1, enough of it to
// drive the plugin's GameLink. It replays schema.json, wants hello then pair or auth, pushes state
// deltas when told, refuses one given command, and closes a connection at 41 commands a second.

import fs from "node:fs";
import { WebSocketServer } from "ws";

export const CODE = "482913";
export const REFUSED_ID = "landing_gear";

export class FakeGame {
	constructor(port) {
		this.port = port;
		this.schema = JSON.parse(fs.readFileSync(new URL("../schema.json", import.meta.url), "utf8"));
		this.tokens = new Set();
		this.headers = [];   // the request headers of every connection
		this.received = [];   // every message, parsed
		this.clients = new Set();
		this.cv = 1;   // a test sets 2: a game that speaks a newer protocol
	}

	start() {
		this.server = new WebSocketServer({ host: "127.0.0.1", port: this.port });
		this.server.on("connection", (socket, request) => this.connected(socket, request));
		return new Promise((resolve) => this.server.on("listening", resolve));
	}

	stop() {
		for (const client of this.clients) {
			client.socket.terminate();
		}
		return new Promise((resolve) => this.server.close(() => resolve()));
	}

	/** Closes every connection (the game quit, or restarted). */
	dropAll() {
		for (const client of this.clients) {
			client.socket.close();
		}
	}

	/** Pushes a state delta to every paired client. */
	push(values) {
		for (const client of this.clients) {
			if (client.paired) {
				client.socket.send(JSON.stringify({ t: "state", v: values }));
			}
		}
	}

	connected(socket, request) {
		this.headers.push(request.headers);
		const client = { socket, paired: false, window: Date.now(), count: 0 };
		this.clients.add(client);
		socket.on("close", () => this.clients.delete(client));
		socket.on("message", (data) => this.message(client, JSON.parse(data.toString())));
	}

	send(client, message) {
		client.socket.send(JSON.stringify(message));
	}

	message(client, message) {
		this.received.push(message);
		switch (message.t) {
			case "hello":
				return this.send(client, { t: "welcome", cv: this.cv, paired: client.paired, game: "0.67.0" });
			case "pair":
				return this.pair(client, message);
			case "auth":
				if (!this.tokens.has(message.token)) {
					return this.send(client, { t: "refused", id: "auth", why: "unpaired" });
				}
				client.paired = true;
				return this.send(client, { t: "welcome", cv: this.cv, paired: true, game: "0.67.0" });
			case "schema":
				return this.send(client, client.paired ? { t: "schema", ...this.schema, game: "0.67.0" }
					: { t: "refused", id: "schema", why: "unpaired" });
			case "cmd":
			case "set":
				return this.command(client, message);
		}
	}

	pair(client, message) {
		if (message.code !== CODE) {
			return this.send(client, { t: "refused", id: "pair", why: "wrong" });
		}
		const token = `token-${this.tokens.size + 1}`.padEnd(64, "0");
		this.tokens.add(token);
		client.paired = true;
		this.send(client, { t: "paired", token });
	}

	command(client, message) {
		const now = Date.now();
		if (now - client.window >= 1000) {
			client.window = now;
			client.count = 0;
		}
		client.count += 1;
		if (client.count >= 41) {
			this.send(client, { t: "error", why: "too many commands" });
			return client.socket.close();
		}
		if (!client.paired) {
			return this.send(client, { t: "refused", id: message.id, why: "unpaired" });
		}
		if (message.id === REFUSED_ID) {
			this.send(client, { t: "refused", id: message.id, why: "context" });
		}
	}
}
