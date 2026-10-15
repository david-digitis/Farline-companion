# The companion protocol (cv 1)

The game's own documentation is the source of this file; this copy is for whoever writes a
companion (this plugin, a tablet later). When they differ, the game is right and this file is fixed.

## The connection

- A WebSocket on **`ws://127.0.0.1:7790`**, opened by the game only when the player ticks
  **Enable the companion** (Controls > Companion). Off by default. The game listens on the loopback
  address only: nothing on the network can reach it.
- **A connection that carries an `Origin` header is refused** before any answer (HTTP 403). A web
  browser always sends one, a program never does: a web page cannot drive the game.
- At most 4 connections. Text frames only, one JSON object each, 4 KB at most.
- A connection that has not finished its handshake within 5 s is dropped.

## Pairing

1. The player clicks **Pair a device** in the game: a 6-digit code, good for 120 s.
2. The companion sends `pair` with that code. Five wrong codes close the pairing for 60 s.
3. The game answers `paired` with a token of 32 bytes (64 hex characters), given once.
4. At every later connection the companion sends `auth` with its token. The game keeps only a
   SHA-256 of the token; the player can revoke a device from the same page, which closes its
   connection and kills its token.

This plugin keeps its token in the Stream Deck software's global settings for the plugin, a local
file of the player's. It is not encrypted there: the token only lets a program press the game's
keys on that PC, which any local program could do anyway.

Without a valid token, the game answers `hello` and nothing else (commands are refused `unpaired`).

## Messages

From the companion:

```json
{"t":"hello","cv":1,"name":"Stream Deck (PC)"}
{"t":"pair","code":"482913","name":"Stream Deck (PC)"}
{"t":"auth","token":"<64 hex>"}
{"t":"schema"}
{"t":"cmd","id":"landing_gear"}
{"t":"set","id":"convergence","value":800}
```

From the game:

```json
{"t":"welcome","cv":1,"paired":false,"game":"0.67.0"}
{"t":"paired","token":"<64 hex>"}
{"t":"schema","cv":1,"game":"0.67.0","contexts":[],"tabs":[],"commands":[],"fields":[]}
{"t":"state","v":{"context":"flight","speed":142,"gear":true}}
{"t":"refused","id":"landing_gear","why":"context"}
{"t":"error","why":"too many commands"}
```

- `state` is **pushed** ten times a second, with **only what changed** since the last one sent to
  that companion. A value that is gone (back at the menu) arrives as `null`.
- `refused` says why a command did nothing:

| `why` | Meaning |
|---|---|
| `unpaired` | no valid token |
| `unknown` | not a command the game knows, or `set` on a key |
| `hold` | an action held while it lasts (the axes, boost, fire): not a command in cv 1 |
| `rate` | more than 20 commands in a second |
| `context` | nothing to act on here (the menu, on foot, a menu open, the photo mode) |
| `auto` | the convergence follows the target by itself |
| `off` | the ship's electronics are off |
| `unbound` | the player gave that action no key |

- `error` is followed by the end of the connection: not a JSON object, over 4 KB, or 40 commands
  in a second.

## Commands and fields

The schema (`schema.json` here, and the live `schema` message) lists them, with English and French
labels. A command is an action of the game's Controls page (pressed as its key would be, under the
same rules), or one of the two convergence commands: `convergence_up` / `convergence_down` move it
one wheel notch, `set convergence <metres>` puts it at a distance, inside the ship's own bounds.

**An identifier never changes name.** A command or a field that goes away stays in the schema
marked `"deprecated": true`: a key copied into a player's own profile stays valid for ever.

## Versions (cv)

`cv` is the companion protocol's version, apart from the game's. Both sides ignore a command, a
field or a message key they do not know, so a newer game and an older plugin (or the reverse) still
work. A breaking change raises `cv`, and a companion that sees a `cv` it does not speak tells the
player to update it.
