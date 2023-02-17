<script>
    let test = 1;
    $: console.log(test);
    $: if (test) {
        console.log(test)
    }
</script>