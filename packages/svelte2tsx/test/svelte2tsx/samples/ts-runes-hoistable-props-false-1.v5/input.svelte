<script lang="ts">
    interface Props {
        foo: C;
    }
 
    const a = 1;
    type C = typeof a | '2' | '3';

    let { foo }: Props = $props();
</script>
