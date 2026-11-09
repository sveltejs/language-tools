<script lang="ts">
    import type { X } from './x';
    /** asd */
    interface Props {
        foo: string;
        bar?: X;
    }
    let { foo, bar }: Props = $props();
</script>
