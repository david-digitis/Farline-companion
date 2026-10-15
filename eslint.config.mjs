// The house rules: 80 lines per function, 400 per file, no `any`.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{ ignores: ["node_modules/", "build/", "dist/", "plugin/**/bin/"] },
	js.configs.recommended,
	...tseslint.configs.strict,
	{
		files: ["**/*.ts", "**/*.mjs", "**/*.js"],
		rules: {
			"max-lines": ["error", { max: 400 }],
			"max-lines-per-function": ["error", { max: 80 }],
			"@typescript-eslint/no-explicit-any": "error",
		},
	},
	{
		files: ["plugin/**/ui/*.js"],
		languageOptions: { globals: { window: "readonly", document: "readonly", WebSocket: "readonly" } },
	},
	{
		files: ["tools/**/*.mjs", "tests/**/*.mjs"],
		languageOptions: { globals: { process: "readonly", console: "readonly", Buffer: "readonly", URL: "readonly",
			setTimeout: "readonly", clearTimeout: "readonly" } },
	},
);
