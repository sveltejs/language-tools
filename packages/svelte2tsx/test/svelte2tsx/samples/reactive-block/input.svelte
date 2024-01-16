<script lang="ts">
let a: 1 | 2 = 1;
$: {
    console.log(a + 1);
}
</script>
