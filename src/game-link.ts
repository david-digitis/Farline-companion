// The one link to the game: a WebSocket client on ws://127.0.0.1:7790, and nothing else.
// No dependency on the Stream Deck SDK, so the tests drive it against a fake game.
//
// It says hello, authenticates with its token when it has one (else waits for a pairing),
// asks for the schema once, then merges the game's state messages into a cache. The game
// pushes; nothing is ever polled. Commands are sent only while paired, at most RATE_MAX a
// second (the game refuses past 20 and closes at 40). It reconnects every 2 s, then every 5 s.
// It never sends an Origin header: the game refuses any connection that carries one.
//
// Protocol: PROTOCOL.md (the game's own documentation is the source).

import { EventEmitter } from "node:events";
import WebSocket from "ws";

import { isSchema, type Schema, type Value } from "./schema.js";

export const HOST = "127.0.0.1";
export const PORT = 7790;
export const CV = 1;
/** Commands a second we send at most; the game refuses past 20. */
export const RATE_MAX = 18;
const RETRY_FIRST_MS = 2000;
const RETRY_LATER_MS = 5000;
const RETRY_FIRST_TRIES = 3;

export type LinkStatus = "off" | "connecting" | "unpaired" | "paired";

export type LinkOptions = {
	name: string;
	token?: string;
	port?: number;
	/** Retry delays, shortened by the tests. */
	retryMs?: [number, number];
};

/**
 * Events: "status" (LinkStatus), "state" (changes: Record<string, Value>), "schema" (Schema),
 * "refused" ({id, why}), "paired" (token), "unpaired" (the token the game refused).
 */
export class GameLink extends EventEmitter {
	status: LinkStatus = "off";
	schema: Schema | null = null;
	readonly state = new Map<string, Value>();
	game = "";
	token: string;
	readonly name: string;
	private socket: WebSocket | null = null;
	private timer: NodeJS.Timeout | null = null;
	private tries = 0;
	private stopped = false;
	private sentAt: number[] = [];
	private readonly port: number;
	private readonly retry: [number, number];

	constructor(options: LinkOptions) {
		super();
		this.name = options.name;
		this.token = options.token ?? "";
		this.port = options.port ?? PORT;
		this.retry = options.retryMs ?? [RETRY_FIRST_MS, RETRY_LATER_MS];
	}

	start(): void {
		this.stopped = false;
		this.connect();
	}

	stop(): void {
		this.stopped = true;
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.socket?.terminate();
		this.socket = null;
		this.setStatus("off");
	}

	/** A key press. False when it could not be sent (game off, not paired, too fast). */
	command(id: string): boolean {
		return this.sendCommand({ t: "cmd", id });
	}

	/** A value set (the convergence distance, in metres). */
	set(id: string, value: number): boolean {
		return this.sendCommand({ t: "set", id, value });
	}

	/** Sends the code shown by the game; the answer comes as "paired" or "refused". */
	pair(code: string): boolean {
		return this.send({ t: "pair", code: code.trim(), name: this.name });
	}

	/** Forgets the token: the link goes back to "unpaired". */
	forget(): void {
		this.token = "";
		this.state.clear();
		if (this.status === "paired") {
			this.socket?.close();
		}
	}

	private connect(): void {
		if (this.stopped) {
			return;
		}
		this.setStatus("connecting");
		// No Origin, no other address: the game listens on the loopback only.
		const socket = new WebSocket(`ws://${HOST}:${this.port}`, { handshakeTimeout: 3000 });
		this.socket = socket;
		socket.on("open", () => {
			this.tries = 0;
			this.send({ t: "hello", cv: CV, name: this.name });
			if (this.token !== "") {
				this.send({ t: "auth", token: this.token });
			}
		});
		socket.on("message", (data) => this.receive(data.toString()));
		socket.on("error", () => undefined);   // "close" follows, which retries
		socket.on("close", () => this.closed(socket));
	}

	private closed(socket: WebSocket): void {
		if (socket !== this.socket) {
			return;
		}
		this.socket = null;
		this.state.clear();
		this.setStatus(this.stopped ? "off" : "connecting");
		if (this.stopped) {
			return;
		}
		this.tries += 1;
		const delay = this.tries <= RETRY_FIRST_TRIES ? this.retry[0] : this.retry[1];
		this.timer = setTimeout(() => this.connect(), delay);
	}

	private receive(text: string): void {
		let message: Record<string, unknown>;
		try {
			message = JSON.parse(text) as Record<string, unknown>;
		} catch {
			return;
		}
		switch (message.t) {
			case "welcome":
				this.game = String(message.game ?? "");
				this.welcome(message.paired === true);
				break;
			case "paired":
				this.token = String(message.token ?? "");
				this.emit("paired", this.token);
				this.welcome(true);
				break;
			case "schema":
				this.takeSchema(message);
				break;
			case "state":
				this.merge(message.v);
				break;
			case "refused":
				this.refused(String(message.id ?? ""), String(message.why ?? ""));
				break;
		}
	}

	private welcome(paired: boolean): void {
		if (!paired) {
			this.setStatus("unpaired");
			return;
		}
		const first = this.status !== "paired";
		this.setStatus("paired");
		if (first) {
			this.send({ t: "schema" });
		}
	}

	private takeSchema(message: Record<string, unknown>): void {
		if (isSchema(message)) {
			this.schema = message;
			this.emit("schema", message);
		}
	}

	private merge(values: unknown): void {
		if (typeof values !== "object" || values === null) {
			return;
		}
		const changes = values as Record<string, Value>;
		for (const [id, value] of Object.entries(changes)) {
			if (value === null) {
				this.state.delete(id);
			} else {
				this.state.set(id, value);
			}
		}
		this.emit("state", changes);
	}

	private refused(id: string, why: string): void {
		if (id === "auth" && why === "unpaired") {
			const dead = this.token;
			this.token = "";
			this.setStatus("unpaired");
			this.emit("unpaired", dead);
			return;
		}
		this.emit("refused", { id, why });
	}

	private sendCommand(message: Record<string, unknown>): boolean {
		if (this.status !== "paired") {
			return false;
		}
		const now = Date.now();
		this.sentAt = this.sentAt.filter((at) => now - at < 1000);
		if (this.sentAt.length >= RATE_MAX) {
			return false;
		}
		this.sentAt.push(now);
		return this.send(message);
	}

	private send(message: Record<string, unknown>): boolean {
		if (this.socket?.readyState !== WebSocket.OPEN) {
			return false;
		}
		this.socket.send(JSON.stringify(message));
		return true;
	}

	private setStatus(status: LinkStatus): void {
		if (status !== this.status) {
			this.status = status;
			this.emit("status", status);
		}
	}
}
