<script lang="ts">
    const a: string = '';

    interface Props {
        [index: typeof a]: boolean;
    }

    let { foo }: Props = $props();
</script>
