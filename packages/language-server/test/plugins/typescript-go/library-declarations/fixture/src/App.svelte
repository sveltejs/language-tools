<script lang="ts">
    import type { ComponentProps } from 'svelte';
    import { Bar, Foo, NoTypes } from 'my-lib';

    // Foo.svelte.d.ts types `name` as a string, Foo.svelte as a number
    export const foo: ComponentProps<Foo> = { name: 'foo' };
    // @ts-expect-error
    export const fooWrong: ComponentProps<Foo> = { name: 1 };

    // Bar.d.svelte.ts types `name` as a string, Bar.svelte as a number
    export const bar: ComponentProps<Bar> = { name: 'bar' };
    // @ts-expect-error
    export const barWrong: ComponentProps<Bar> = { name: 1 };

    // NoTypes.svelte has no declarations, so its source is used
    export const noTypes: ComponentProps<NoTypes> = { count: 1 };
    // @ts-expect-error
    export const noTypesWrong: ComponentProps<NoTypes> = { count: 'one' };
</script>

<Foo name="foo" />
<Bar name="bar" />
<NoTypes count={1} />
