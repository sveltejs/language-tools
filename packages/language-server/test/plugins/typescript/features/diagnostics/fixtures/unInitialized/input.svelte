<script lang="ts">
    let hi: string
    export let hi2: string;
    let hi3: string;

    hi.toString();
    hi2.toString();
    hi3.toString();

    $: hi3.toString();

    function setHi3() {
        hi3 = 'hi3';
    }
    setHi3();
</script>
{hi}
{hi2}
{hi3}
