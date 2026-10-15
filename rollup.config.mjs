// Bundles src/plugin.ts into the plugin's bin/plugin.js (the official template's setup, without terser:
// a readable bundle is easier to audit for a public plugin).
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

const sdPlugin = "plugin/com.david-digitis.farline-companion.sdPlugin";

export default {
	input: "src/plugin.ts",
	output: { file: `${sdPlugin}/bin/plugin.js`, format: "es" },
	plugins: [
		typescript({ outDir: undefined, rootDir: undefined }),
		nodeResolve({ browser: false, exportConditions: ["node"], preferBuiltins: true }),
		commonjs(),
		{
			name: "emit-module-package-file",
			generateBundle() {
				this.emitFile({ fileName: "package.json", source: `{ "type": "module" }`, type: "asset" });
			},
		},
	],
};
