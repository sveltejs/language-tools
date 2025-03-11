<script lang="ts">
    let { 
        foo = $bindable(),
        foo2
    } = $props();

    function onClick() {
        foo = 42;
    }
</script>

<button onclick={onClick}>Click me</button>
