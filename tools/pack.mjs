// Packs the plugin with a version that rises at each build, so that double-clicking the new
// .streamDeckPlugin replaces the installed one (the same version asked to uninstall first).
// The manifest keeps its committed version: it is stamped for the pack, then put back.
//
//   npm run pack           (-> dist/com.david-digitis.farline-companion.streamDeckPlugin)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = path.join(ROOT, "plugin", "com.david-digitis.farline-companion.sdPlugin");
const MANIFEST = path.join(PLUGIN, "manifest.json");

/** The build number: minutes since 2026-01-01 UTC, always rising, a plain number. */
export function buildNumber(now = Date.now()) {
	return Math.floor((now - Date.UTC(2026, 0, 1)) / 60000);
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const original = fs.readFileSync(MANIFEST);
const manifest = JSON.parse(original.toString("utf8"));
manifest.Version = `${pkg.version}.${buildNumber()}`;
try {
	fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, "\t")}\n`);
	const cli = path.join(ROOT, "node_modules", "@elgato", "cli", "bin", "streamdeck.mjs");
	execFileSync(process.execPath, [cli, "pack", PLUGIN, "--output", path.join(ROOT, "dist"), "--force"], { stdio: "inherit" });
	console.log(`version ${manifest.Version}`);
} finally {
	fs.writeFileSync(MANIFEST, original);
}
