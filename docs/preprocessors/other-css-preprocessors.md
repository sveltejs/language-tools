# Using other CSS-languages than CSS/Less/SCSS

The svelte-language-server and therefore the VSCode extension can only handle CSS/Less/SCSS syntax. To get other syntaxes working, read on.

## PostCSS

1. Setup your build and `svelte.config.js` ([general info](./in-general.md)) correctly and add a `postcss.config.js`. We recommend using [vitePreprocess](https://github.com/sveltejs/vite-plugin-svelte/blob/main/docs/preprocess.md) or [svelte-preprocess](https://github.com/sveltejs/svelte-preprocess/blob/master/docs/preprocessing.md#postcss). For the `svelte.config.js`, this should be enough:

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default { preprocess: [vitePreprocess()] };
```

Or:

```js
import sveltePreprocess from 'svelte-preprocess';
export default { preprocess: sveltePreprocess({ postcss: true }) };
```

Note that this assumes that you have a ESM-style project, which means there's `"type": "module"` in your project's `package.json`. If not, you need to use CommonJS in your `svelte.config.js` and `postcss.config.js` as things like `import ...` or `export const ...` are not allowed.

If your `svelte.config.js` is not in the workspace root (for example your `svelte.config.js` is within `/frontend`), you'll have to pass in the `configFilePath` config. This is because the relative path is resolved relative to the working directory of the node process.

```js
import sveltePreprocess from 'svelte-preprocess';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
    preprocess: sveltePreprocess({
        postcss: {
            configFilePath: join(__dirname, 'postcss.config.cjs')
        }
    })
};
```

2. Either add `lang="postcss"` to each of your `<style>` tags where you plan on using PostCSS, or disable CSS diagnostics completely by adding `"svelte.plugin.css.diagnostics.enable": false` within your settings. If you still want diagnostics, install the [Stylelint VSCode extension](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint). If you want better syntax highlighting, install the [PostCSS VSCode extension](https://marketplace.visualstudio.com/items?itemName=csstools.postcss).

## TailwindCSS

We assume you already have setup TailwindCSS within your Svelte project. If not, you can run `npx svelte-add tailwindcss` to set it up automatically or visit [the Tailwind docs](https://tailwindcss.com/docs/guides/sveltekit) which explain how to manually set it up.

To use TailwindCSS with the VSCode extension:

1. Setup the `svelte.config.js` the same way you would for PostCSS - see the section above (first point) for more details
2. Install the [Tailwind CSS VSCode extension](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)
3. Either add `lang="postcss"` to each of your `<style>` tags where you plan on using the Tailwind CSS directives such as `@apply`, or disable CSS diagnostics completely by adding `"svelte.plugin.css.diagnostics.enable": false` within your settings. If you still want diagnostics, install the [Stylelint VSCode extension](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint) and [configure it accordingly](https://scottspence.com/2021/03/15/stylelint-configuration-for-tailwindcss/). Note that within your config files you can only use node-syntax, things like `import ...` or `export const ...` are not allowed. To disable css checks for `svelte-check`, use the option `--diagnostic-sources "js,svelte"`.
4. If your `tailwind.config.js` is not in the workspace root. Or if your project is not in the workspace root. Make sure you pass in the path to your tailwind config file in your `postcss` [config file](https://github.com/postcss/postcss-load-config#postcssrcjs-or-postcssconfigjs).

```js
const path = require('path');
const tailwindcss = require('tailwindcss');

module.exports = {
    plugins: [tailwindcss(path.resolve(__dirname, './tailwind.config.cjs'))]
};
```

## SASS

1. Add `lang="sass"` to your `<style>` tags
2. If you want to have proper syntax highlighting for VS Code, install the [SASS VSCode extension](https://marketplace.visualstudio.com/items?itemName=Syler.sass-indented)
3. If you have problems with formatting, [turn it off](https://github.com/sveltejs/language-tools/tree/master/packages/svelte-vscode#sveltepluginsvelteformatenable). If you experience wrong css diagnostic errors, [turn it off](https://github.com/sveltejs/language-tools/tree/master/packages/svelte-vscode#svelteplugincssdiagnostics)

## Stylus

1. Add `lang="stylus"` to your `<style>` tags
2. If you want to have proper syntax highlighting for VS Code, install the [language-stylus](https://marketplace.visualstudio.com/items?itemName=sysoev.language-stylus) extension
