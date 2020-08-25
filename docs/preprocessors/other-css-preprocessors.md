# Using other CSS-languages than CSS/Less/SCSS

The svelte-language-server and therefore the VSCode extension can only handle CSS/Less/SCSS syntax. To get other syntaxes working, read on.

## TailwindCSS

We assume you already have setup TailwindCSS within your Svelte project. If not, [this article](https://dev.to/inalbant/a-simpler-way-to-add-tailwindcss-to-your-svelte-project-11ja) and [this article](https://dev.to/sarioglu/using-svelte-with-tailwindcss-a-better-approach-47ph) explain two approaches on how to do it.

To use TailwindCSS with the VSCode extension:

1. Install the [Tailwind CSS VSCode extension](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)
2. Either add `lang="postcss"` to each of your `<style>` tags where you plan on using the Tailwind CSS directives such as `@apply`, or disable CSS diagnostics completely by adding `"svelte.plugin.css.diagnostics.enable": false` within your settings. If you still want diagnostics, install the [Stylelint VSCode extension](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint) and [configure it accordingly](https://andrich.me/vscode-stylelint-tailwind-css-are-love)
