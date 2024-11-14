<script lang="ts">
    interface Dependency {
        a: number;
    }

    interface Props {
        [k: string]: Dependency;
    }

    let { foo }: Props = $props();
</script>
