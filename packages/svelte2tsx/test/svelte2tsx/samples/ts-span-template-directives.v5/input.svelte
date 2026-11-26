<script lang="ts">
    let n: number = 1;
</script>

<!-- @ts-expect-error -->
<input value={n.notThere} />
<!-- @ts-expect-error -->
<input value={n} />
<!-- @ts-ignore -->
<input value={n.alsoNotThere} />
<!-- a normal comment -->
<input value={n.reported} />
