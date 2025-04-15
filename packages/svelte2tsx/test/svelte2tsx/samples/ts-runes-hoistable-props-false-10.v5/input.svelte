<script lang="ts">
type Props = {
    data: {cfg: string};
};
let { data }: Props = $props();

type A = typeof data.cfg;
type B = (typeof data)['cfg'];
</script>