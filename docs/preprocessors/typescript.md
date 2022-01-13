# TypeScript Support

[Official blog post](https://svelte.dev/blog/svelte-and-typescript)

## Setup

#### 1. Install the required packages and setting up your build

Starting fresh? Use the [starter template](https://github.com/sveltejs/template) which has a node script which sets it all up for you.

Adding it to an existing project? [The official blog post explains how to do it](https://svelte.dev/blog/svelte-and-typescript#Adding_TypeScript_to_an_existing_project).

#### 2. Getting it to work in the editor

To tell us to treat your script tags as typescript, add a `lang` attribute to your script tags like so:

```html
<script lang="ts">
    export let name: string;
</script>
```

You may optionally want to add a `svelte.config.js` file - but it is not required as long as you only use TypeScript. Depending on your setup, this config file needs to be written either in ESM-style or CJS-Style.

ESM-style (for everything with `"type": "module"` in its `package.json`, like SvelteKit):

```js
import sveltePreprocess from 'svelte-preprocess';

export default {
    preprocess: sveltePreprocess()
};
```

CJS-style:

```js
const sveltePreprocess = require('svelte-preprocess');

module.exports = {
    preprocess: sveltePreprocess()
};
```

#### 3. Restart the svelte language server

You will need to tell svelte-vscode to restart the svelte language server in order to pick up the new configuration.

Hit `ctrl-shift-p` or `cmd-shift-p` on mac, type `svelte restart`, and select `Svelte: Restart Language Server`. Any errors you were seeing should now go away and you're now all set up!

## Typing components, authoring packages

When you provide a library, you also should provide type definitions alongside your code. You should not provide Svelte files that need preprocessors. So when you author a Svelte component library and write it in TypeScript, you should transpile the Svelte TS Code to JavaScript to provide JS/HTML/CSS-Svelte files. To type these components, place `d.ts` files next to their implementation. So for example when you have `Foo.svelte`, place `Foo.svelte.d.ts` next to it and tooling will aquire the types from the `d.ts` file. This is in line with how it works for regular TypeScript/JavaScript. Your `Foo.svelte.d.ts` should look something like this:

```typescript
import { SvelteComponentTyped } from 'svelte';

export interface FooProps {
    propA: string;
    // ...
}

export interface FooEvents {
    click: MouseEvent;
    customEvent: CustomEvent<boolean>;
}

export interface FooSlots {
    default: { slotValue: string };
    named: { slotValue: string };
}

export default class Foo extends SvelteComponentTyped<FooProps, FooEvents, FooSlots> {}
```

SvelteKit's `package` command will give you these capabilities - transpiling and creating type definitions - out of the box: https://kit.svelte.dev/docs#packaging

## Typing component events

When you are using TypeScript, you can type which events your component has in two ways:

The first and possibly most often used way is to type the `createEventDispatcher` invocation like this:

```html
<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher<{
        /**
         * you can also add docs
         */
        checked: boolean; // Will translate to `CustomEvent<boolean>`
        hello: string;
    }>();

    // ...
</script>
```

This will make sure that if you use `dispatch` that you can only invoke it with the specified names and its types.

Note though that this will _NOT_ make the events strict so that you get type errors when trying to listen to other events when using the component. Due to Svelte's dynamic events creation, component events could be fired not only from a dispatcher created directly in the component, but from a dispatcher which is created as part of another import. This is almost impossible to infer.

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

### I'm unable to use installed types (for example through `@types/..`)

You are most likely extending from Svelte's `@tsconfig/svelte` base config in your `tsconfig.json`, or you did set `"types": [..]` in your `tsconfig`. In both cases, a `"types": [..]` property is present. This makes TypeScript prevent all ambient types which are not listed in that `types`-array from getting picked up. The solution is to enhance/add a `types` section to your `tsconfig.json`:

```
{
    "compilerOptions": {
        // ..
        "types": ["svelte", "..<your installed type>.."]
    }
}
```

We are looking for ways to make the `types` definition in `@tsconfig/svelte` unnecessary, so you don't have those issues in the future.

### I'm getting weird behavior when using `"module": "CommonJS"`

Don't set the module to `CommonJS`, it will result in wrong transpilation of TypeScript to JavaScript. Moreover, you shouldn't set this anyway as `CommonJS` is a module format for NodeJS which is not understood by the Browser. For more technical details, see [this issue comment](https://github.com/sveltejs/language-tools/issues/826#issuecomment-782858437).
