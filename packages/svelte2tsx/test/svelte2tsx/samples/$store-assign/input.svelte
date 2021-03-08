<script lang="ts">
    const store = writable([]);

    $store[1] = true;
    $store.foo = true;

    $store[1] = true
    $store.foo = true

    $store = true
    $store = true;

    hello[$store] = true;

    $store = true,
    $store = false,
    $store,
    $store.a = true

    $store.a = true,
    $store.b = false;
</script>
