# Using other CSS-languages than CSS/Less/SCSS

The svelte-language-server and therefore the VSCode extension can only handle CSS/Less/SCSS syntax. To get other syntaxes working, read on.

## PostCSS

1. Setup you build and `svelte.config.js` ([general info](./in-general.md)) correctly and add a `postcss.config.js`. We recommend using [svelte-preprocess](https://github.com/sveltejs/svelte-preprocess/blob/master/docs/preprocessing.md#postcss). For the `svelte.config.js`, this should be enough:

```js
const sveltePreprocess = require('svelte-preprocess');
module.exports = { preprocess: sveltePreprocess({ postcss: true }) };
```

Note that within your config files you can only use node-syntax, things like `import ...` or `export const ...` are not allowed.

2. Either add `lang="postcss"` to each of your `<style>` tags where you plan on using PostCSS, or disable CSS diagnostics completely by adding `"svelte.plugin.css.diagnostics.enable": false` within your settings. If you still want diagnostics, install the [Stylelint VSCode extension](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint). If you want better syntax highlighting, install the [PostCSS VSCode extension](https://marketplace.visualstudio.com/items?itemName=csstools.postcss).

## TailwindCSS

We assume you already have setup TailwindCSS within your Svelte project. If not, [this article](https://dev.to/inalbant/a-simpler-way-to-add-tailwindcss-to-your-svelte-project-11ja) and [this article](https://dev.to/sarioglu/using-svelte-with-tailwindcss-a-better-approach-47ph) explain two approaches on how to do it.

To use TailwindCSS with the VSCode extension:

1. Setup the `svelte.config.js` the same way you would for PostCSS - see the section above (first point) for more details
2. Install the [Tailwind CSS VSCode extension](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)
3. Either add `lang="postcss"` to each of your `<style>` tags where you plan on using the Tailwind CSS directives such as `@apply`, or disable CSS diagnostics completely by adding `"svelte.plugin.css.diagnostics.enable": false` within your settings. If you still want diagnostics, install the [Stylelint VSCode extension](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint) and [configure it accordingly](https://andrich.me/vscode-stylelint-tailwind-css-are-love). Note that within your config files you can only use node-syntax, things like `import ...` or `export const ...` are not allowed.

## SASS

1. Add `lang="sass"` to your `<style>` tags
2. If you want to have proper syntax highlighting for VS Code, install the [SASS VSCode extension](https://marketplace.visualstudio.com/items?itemName=Syler.sass-indented)
3. If you have problems with formatting, [turn it off](https://github.com/sveltejs/language-tools/tree/master/packages/svelte-vscode#sveltepluginsvelteformatenable). If you experience wrong css diagnostic errors, [turn it off](https://github.com/sveltejs/language-tools/tree/master/packages/svelte-vscode#svelteplugincssdiagnostics)

## Stylus

1. Add `lang="stylus"` to your `<style>` tags
2. If you want to have proper syntax highlighting for VS Code, install the [language-stylus](https://marketplace.visualstudio.com/items?itemName=sysoev.language-stylus) extension
