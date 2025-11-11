<p>
  <a href="https://svelte.dev">
	<img alt="Cybernetically enhanced web apps: Svelte" src="https://user-images.githubusercontent.com/49038/76711598-f0b39180-66e7-11ea-9501-37f6e1edf8a6.png">
  </a>

  <a href="https://www.npmjs.com/package/svelte">
    <img src="https://img.shields.io/npm/v/svelte.svg" alt="npm version">
  </a>

  <a href="https://github.com/sveltejs/svelte/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/svelte.svg" alt="license">
  </a>
</p>

[IDE docs and troubleshooting](docs)

## What is Svelte Language Tools?

Svelte Language Tools contains a library implementing the Language Server Protocol (LSP). LSP powers the [VSCode extension](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode), which is also hosted in this repository. Additionally, LSP is capable of powering plugins for [numerous other IDEs](https://microsoft.github.io/language-server-protocol/implementors/tools/).

A `.svelte` file would look something like this:

```html
<script>
    let count = $state(1);

    let doubled = $derived(count * 2);
    let quadrupled = $derived(doubled * 2);

    function handleClick() {
        count += 1;
    }
</script>

<button onclick="{handleClick}">Count: {count}</button>

<p>{count} * 2 = {doubled}</p>
<p>{doubled} * 2 = {quadrupled}</p>
```

Which is a mix of [HTMLx](https://github.com/htmlx-org/HTMLx) and vanilla JavaScript (but with additional runtime behavior coming from the svelte compiler).

This repo contains the tools which provide editor integrations for Svelte files like this.

## Contributing

Contributions are encouraged and always welcome. [Read the contribution guide for more info](CONTRIBUTING.md) and help us out!

## Supporting Svelte

Svelte is an MIT-licensed open source project with its ongoing development made possible entirely by the support of awesome volunteers. If you'd like to support their efforts, please consider:

-   [Becoming a backer on Open Collective](https://opencollective.com/svelte).

Funds donated via Open Collective will be used for compensating expenses related to Svelte's development such as hosting costs. If sufficient donations are received, funds may also be used to support Svelte's development more directly.

## License

[MIT](LICENSE)

## Credits

-   [James Birtles](https://github.com/jamesbirtles) for creating the foundation which this language server, and the extensions are built on
-   Vue's [Vetur](https://github.com/vuejs/vetur) language server which heavily inspires this project
-   [halfnelson](https://github.com/halfnelson) for creating `svelte2tsx`
-   [jasonlyu123](https://github.com/jasonlyu123) for his ongoing work in all areas of the language-tools
