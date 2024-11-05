<script context="module" lang="ts">
    export interface TestEvents {
        foo: 'bar';
    }
    interface TestSlots {
        foo: 'bar';
    }
</script>

<script lang="ts">
    import { eventProps, type TestProps } from './foo';

    export let p: TestProps;
    export let x = eventProps();
</script>

{p}
{x}
