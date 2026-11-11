<script lang="ts">
    interface $$Props {
        a: string;
        [key: string]: unknown;
    }
    interface $$Events {
        change: CustomEvent<string>;
    }
    interface $$Slots {
        default: { a: string };
    }
    export let a: string;
</script>

<div {...$$restProps}><slot {a} /></div>
