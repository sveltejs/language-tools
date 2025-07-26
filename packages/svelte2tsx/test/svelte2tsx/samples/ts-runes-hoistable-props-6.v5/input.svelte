<script lang="ts">
    interface A {
        type: string;
    }

    interface Props extends A {
        a: string;
    }
    const { }: Props = $props();
</script>
