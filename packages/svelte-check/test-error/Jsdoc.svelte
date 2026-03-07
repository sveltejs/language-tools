<script>
    // Various patterns to ensure they don't accidentally cause TS syntax errors TS syntax sneaks in

    /** @type {boolean}*/
    export let b;
    b;
    let rect = '';
</script>

<div bind:contentRect={rect}></div>
