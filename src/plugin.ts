// The Farline companion: two generic actions, one link to the game on the local machine.
// The token never reaches the log (info level, and no line carries it).

import streamDeck from "@elgato/streamdeck";

import { CommandAction } from "./actions/command.js";
import { ValueAction } from "./actions/value.js";
import { startLink } from "./hub.js";

streamDeck.logger.setLevel("info");
streamDeck.actions.registerAction(new CommandAction());
streamDeck.actions.registerAction(new ValueAction());
await streamDeck.connect();
await startLink();
