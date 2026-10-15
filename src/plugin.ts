// The Farline companion: two generic actions, one link to the game on the local machine.
// The token never reaches the log (info level, and no line carries it).

import path from "node:path";
import { fileURLToPath } from "node:url";

import streamDeck from "@elgato/streamdeck";

import { CommandAction } from "./actions/command.js";
import { ValueAction } from "./actions/value.js";
import { startLink } from "./hub.js";
import { useSymbols } from "./symbols.js";

// The bundle is bin/plugin.js: the glyphs are in ../imgs/symbols.
useSymbols(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "imgs", "symbols"));
streamDeck.logger.setLevel("info");
streamDeck.actions.registerAction(new CommandAction());
streamDeck.actions.registerAction(new ValueAction());
await streamDeck.connect();
await startLink();
