<script>
    const o = { a: 1, b: { c: 2, d: [3, 4, 5] }, e: [6] };

    export let { a, b: { c, d: [d_one, , d_three] }, e: [e_one] } = o;
    export const { a: A, b: { c: C } } = o;
</script>
