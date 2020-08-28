# Using other CSS-languages than CSS/Less/SCSS

The svelte-language-server and therefore the VSCode extension can only handle CSS/Less/SCSS syntax. To get other syntaxes working, read on.

## TailwindCSS

We assume you already have setup TailwindCSS within your Svelte project. If not, [this article](https://dev.to/inalbant/a-simpler-way-to-add-tailwindcss-to-your-svelte-project-11ja) and [this article](https://dev.to/sarioglu/using-svelte-with-tailwindcss-a-better-approach-47ph) explain two approaches on how to do it.

To use TailwindCSS with the VSCode extension:

1. Install the [Tailwind CSS VSCode extension](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)
2. Either add `lang="postcss"` to each of your `<style>` tags where you plan on using the Tailwind CSS directives such as `@apply`, or disable CSS diagnostics completely by adding `"svelte.plugin.css.diagnostics.enable": false` within your settings. If you still want diagnostics, install the [Stylelint VSCode extension](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint) and [configure it accordingly](https://andrich.me/vscode-stylelint-tailwind-css-are-love). Note that within your config files you can only use node-syntax, things like `import ...` or `export const ...` are not allowed.

## SASS

1. Install the [SASS VSCode extension](https://marketplace.visualstudio.com/items?itemName=Syler.sass-indented)
2. Add `lang="sass"` to your `<style>` tags
3. You now get proper syntax highlighting. If you have problems with formatting, [turn it off](https://github.com/sveltejs/language-tools/tree/master/packages/svelte-vscode#sveltepluginsvelteformatenable). If you experience wrong css diagnostic errors, [turn it off](https://github.com/sveltejs/language-tools/tree/master/packages/svelte-vscode#svelteplugincssdiagnostics)
