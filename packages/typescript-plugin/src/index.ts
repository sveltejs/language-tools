import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin';
import { svelteLanguagePlugin } from 'svelte-language-server/out/languagePlugin';

export = createLanguageServicePlugin(
  () => ({ languagePlugins: [svelteLanguagePlugin] })
);
