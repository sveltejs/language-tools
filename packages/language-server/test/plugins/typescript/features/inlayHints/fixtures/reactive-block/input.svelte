<script>
    let test = 1;
    $: log(test);
    $: if (test) {
        log(test)
    }

    /**
     * @returns {void}
     */
    function log(message) {}
</script>