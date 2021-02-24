import svelte2tsx, { SvelteCompiledToTsx } from "svelte2tsx";
import { createLanguagePlugin } from "./ts-language-plugin";
module.exports = createLanguagePlugin({
	extension: "svelte",
	transform(fileName, text) {
		const tsx: SvelteCompiledToTsx = svelte2tsx(text, { filename: fileName, emitOnTemplateError: true });
		return {
			content: tsx.code,
			mappings: tsx.map.mappings,
		};
	},
});
