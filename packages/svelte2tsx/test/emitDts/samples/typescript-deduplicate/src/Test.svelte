<script lang="ts">
    import { eventProps, type TestProps } from './foo';

    export let p: TestProps;
    export let x = eventProps();
</script>

{p}
{x}
