<script>
const obj = {
    a: 1,
    b: 2,
    nested: {
        c: 3,
        d: 4,
    },
};

export const {
    a, b, nested: { c, d: g }
} = obj;
</script>