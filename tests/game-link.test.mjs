// GameLink against the fake game: pairing, the token, the schema, the state deltas, a refusal,
// the rate cap, the reconnection, and no Origin header ever sent.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { GameLink, RATE_MAX } from "../build/game-link.js";
import { CODE, FakeGame, REFUSED_ID } from "./fake-game.mjs";

const PORT = 17791;
const game = new FakeGame(PORT);

before(() => game.start());
after(() => game.stop());

/** Resolves with the event's first argument, or rejects after `ms`. */
function next(emitter, event, ms = 3000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`no ${event} in ${ms} ms`)), ms);
		emitter.once(event, (value) => {
			clearTimeout(timer);
			resolve(value);
		});
	});
}

async function until(check, ms = 3000) {
	const start = Date.now();
	while (!check()) {
		if (Date.now() - start > ms) {
			throw new Error("timed out");
		}
		await new Promise((r) => setTimeout(r, 20));
	}
}

function newLink(token) {
	return new GameLink({ name: "Test deck", token, port: PORT, retryMs: [100, 200] });
}

test("without a token: unpaired, a command is not sent", async () => {
	const link = newLink();
	link.start();
	await until(() => link.status === "unpaired");
	assert.equal(link.command("view_toggle"), false);
	link.stop();
});

test("pairing: a wrong code is refused, the right one gives a token, then the schema and the state", async () => {
	const link = newLink();
	link.start();
	await until(() => link.status === "unpaired");
	link.pair("000000");
	assert.deepEqual(await next(link, "refused"), { id: "pair", why: "wrong" });
	const schema = next(link, "schema");
	link.pair(` ${CODE} `);
	const token = await next(link, "paired");
	assert.equal(token.length, 64);
	assert.equal(link.status, "paired");
	assert.equal((await schema).commands.length, game.schema.commands.length);
	game.push({ speed: 142, gear: true });
	await next(link, "state");
	game.push({ speed: 150, target: null });
	await next(link, "state");
	assert.equal(link.state.get("speed"), 150);
	assert.equal(link.state.get("gear"), true);
	assert.equal(link.state.has("target"), false);
	link.stop();
});

test("a known token authenticates; a refused command says why; the rate stays under the game's cap", async () => {
	const token = [...game.tokens][0];
	const link = newLink(token);
	link.start();
	await until(() => link.status === "paired");
	assert.equal(link.command(REFUSED_ID), true);
	assert.deepEqual(await next(link, "refused"), { id: REFUSED_ID, why: "context" });
	await new Promise((r) => setTimeout(r, 1100));   // a fresh second
	let sent = 0;
	for (let i = 0; i < 50; i++) {
		sent += link.command("view_toggle") ? 1 : 0;
	}
	assert.equal(sent, RATE_MAX);
	await new Promise((r) => setTimeout(r, 200));
	assert.equal(link.status, "paired", "the game never closed the link");
	link.stop();
});

test("the game goes away and comes back: the link reconnects and authenticates again", async () => {
	const token = [...game.tokens][0];
	const link = newLink(token);
	link.start();
	await until(() => link.status === "paired");
	game.dropAll();
	await until(() => link.status !== "paired");
	await until(() => link.status === "paired", 4000);
	link.stop();
});

test("a token the game forgot (revoked): unpaired, and the token is dropped", async () => {
	const link = newLink("f".repeat(64));
	link.start();
	const dead = await next(link, "unpaired");
	assert.equal(dead, "f".repeat(64));
	assert.equal(link.token, "");
	assert.equal(link.status, "unpaired");
	link.stop();
});

test("no connection ever carried an Origin header, and all went to 127.0.0.1", () => {
	assert.ok(game.headers.length >= 5);
	for (const headers of game.headers) {
		assert.equal(headers.origin, undefined);
		assert.match(headers.host, /^127\.0\.0\.1:/);
	}
});
