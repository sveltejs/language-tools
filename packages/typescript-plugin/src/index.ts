import { createTSServerPlugin } from '@volar/typescript/lib/quickstart/createTSServerPlugin';
import { svelteLanguagePlugin } from 'svelte-language-server/out/languagePlugin';

export = createTSServerPlugin(
  () => {
    return {
      languagePlugins: [svelteLanguagePlugin],
      extensions: ['.svelte'],
    }
  }
)
