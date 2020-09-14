<script>
    function bla() {
        return true;
    }
    bla();
    $: hello = 1;
    $: if (hello) {
        console.log('hi');
    }
</script>
