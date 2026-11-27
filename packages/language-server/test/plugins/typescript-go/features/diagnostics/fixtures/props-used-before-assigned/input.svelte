<script lang="ts">
    export let a: number;
    export let e: number, f: string;
    let b: number;
    let c: number;
    export { b, c as d };
    let notAProp: number;
    console.log(a, b, c, e, f, notAProp);
</script>

{a}{b}{c}{e}{f}{notAProp}
