# schema.json

Copied byte for byte from the game's repository (`companion/schema.json`, written by the game's
`companion_schema` tool) at each version of the game that changes it. Never edited here: the game
is its source, and the plugin also receives it live from the game at every connection.

What it holds: `commands` (every command a key may send, by tab of the game's Controls page, with
its kind, its labels in English and French, its default key), `fields` (every value the game may
push, with its type and unit), `tabs`, `contexts` and `cv`. The master profiles are generated from
it (`npm run profiles`).
