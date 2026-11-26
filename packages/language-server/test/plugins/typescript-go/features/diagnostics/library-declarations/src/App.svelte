<script lang="ts">
    import type { ComponentProps } from 'svelte';
    import { Bar, Foo, NoTypes } from 'my-lib';

    // Foo.svelte.d.ts types `name` as a string, Foo.svelte as a number
    export const foo: ComponentProps<typeof Foo> = { name: 'foo' };
    // @ts-expect-error
    export const fooWrong: ComponentProps<typeof Foo> = { name: 1 };

    // Bar.d.svelte.ts types `name` as a string, Bar.svelte as a number
    export const bar: ComponentProps<typeof Bar> = { name: 'bar' };
    // @ts-expect-error
    export const barWrong: ComponentProps<typeof Bar> = { name: 1 };

    // NoTypes.svelte has no declarations, so its source types it
    export const noTypes: ComponentProps<typeof NoTypes> = { count: 1 };
    // @ts-expect-error
    export const noTypesWrong: ComponentProps<typeof NoTypes> = { count: 'one' };
</script>

<Foo name="foo" />
<Bar name="bar" />
<NoTypes count={1} />
