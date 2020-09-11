# TypeScript Support

[Official blog post](https://svelte.dev/blog/svelte-and-typescript)

## Setup

#### 1. Install the required packages and setting up your build

Starting fresh? Use the [starter template](https://github.com/sveltejs/template) which has a node script which sets it all up for you.

Adding it to an existing project? [The official blog post explains how to do it](https://svelte.dev/blog/svelte-and-typescript#Adding_TypeScript_to_an_existing_project).

#### 2. Getting it to work in the editor

To tell us to treat your script tags as typescript, add a `type` or `lang` attribute to your script tags like so:

```html
<!-- Add type="text/typescript" -->
<script type="text/typescript">
    export let name: string;
</script>

<!-- Or add lang="typescript" or lang="ts" -->
<script lang="typescript">
    export let name: string;
</script>
```

You may optionally want to add a `svelte.config.js` file - but it is not required as long as you only use TypeScript.

```js
const sveltePreprocess = require('svelte-preprocess');

module.exports = {
    preprocess: sveltePreprocess(),
};
```

#### 3. Restart the svelte language server

You will need to tell svelte-vscode to restart the svelte language server in order to pick up the new configuration.

Hit `ctrl-shift-p` or `cmd-shift-p` on mac, type `svelte restart`, and select `Svelte: Restart Language Server`. Any errors you were seeing should now go away and you're now all set up!

## Typing component events

When you are using TypeScript, you can type which events your component has by defining a reserved `interface` (_NOT_ `type`) called `ComponentEvents`:

```html
<script lang="ts">
    interface ComponentEvents {
        click: MouseEvent;
        hello: CustomEvent<boolean>;
    }

    // ...
</script>
```

Doing this will give you autocompletion for these events as well as type safety when listening to the events in other components.

If you want to be sure that the interface definition names correspond to your dispatched events, you can use computed property names:

```html
<script lang="ts">
    const hello = 'hello';
    interface ComponentEvents {
        [hello]: CustomEvent<boolean>;
    }
    // ...
    dispatch(hello, true);
</script>
```

> In case you ask why the events cannot be infered: Due to Svelte's dynamic nature, component events could be fired not only from a dispatcher created directly in the component, but from a dispatcher which is created as part of a mixin. This is almost impossible to infer, so we need you to tell us which events are possible.

## Troubleshooting / FAQ

### I cannot use TS inside my script even when `lang="ts"` is present

Make sure to follow the [setup instructions](/packages/svelte-vscode#setup)

### How do I type reactive assignments? / I get an "implicitly has type 'any' error"

The following code may throw an error like `Variable 'show' implicitly has type 'any' in some locations where its type cannot be determined.`, if you have stricter type settings:

```html
<script lang="typescript">
    export let data: { someKey: string | null };

    $: show = !!data.someKey; // <-- `show` has type `any`
</script>

{#if show}hey{/if}
```

To type the variable, do this:

```ts
let show: boolean; // <--- added above the reactive assignment
$: show = !!data.someKey; // <-- `show` now has type `boolean`
```

### How do I import interfaces into my Svelte components? I get errors after transpilation!

-   If you use `svelte-preprocess` BELOW `v4.x` and did NOT set `transpileOnly: true`, then make sure to have at least `v3.9.3` installed, which fixes this.
-   If you don't use `svelte-preprocess` OR use `transpileOnly: true` (which makes transpilation faster) OR use `v4.x`, import interfaces like this: `import type { SomeInterface } from './MyModule.ts'`. You need a least TypeScript 3.8 for this.

### Can I use TypeScript syntax inside the template/mustache tags?

At the moment, you cannot. Only `script`/`style` tags are preprocessed/transpiled. See [this issue](https://github.com/sveltejs/svelte/issues/4701) for more info.

### Why is VSCode not finding absolute paths for type imports?

You may need to set `baseUrl` in `tsconfig.json` at the project root to include (restart the language server to see this take effect):

```
"compilerOptions": {
    "baseUrl": "."
  }
}
```

### I'm using an attribute/event on a DOM element and it throws a type error

If it's a non-experimental standard attribute/event, this may very well be a missing typing from our [JSX typings](https://github.com/sveltejs/language-tools/blob/master/packages/svelte2tsx/svelte-jsx.d.ts). In that case, you are welcome to open an issue and/or a PR fixing it.

In case this is a custom or experimental attribute/event, you can enhance the typings like this:
Create a `additional-svelte-jsx.d.ts` file:

```ts
declare namespace svelte.JSX {
  interface HTMLAttributes<T> {
    // If you want to use on:beforeinstallprompt
    onbeforeinstallprompt?: (event: any) => any;
    // If you want to use myCustomAttribute={..} (note: all lowercase)
    mycustomattribute?: any;
    // You can replace any with something more specific if you like
  }
}
```

Then make sure that `d.ts` file is referenced in your `tsconfig.json`. If it reads something like `"include": ["src/**/*"]` and your `d.ts` file is inside `src`, it should work. You may need to reload for the changes to take effect.
