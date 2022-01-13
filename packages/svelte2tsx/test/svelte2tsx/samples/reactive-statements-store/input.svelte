<script lang="ts">
    const uid = readable('')
    $: foo1 = getFoo1($uid);
    $: console.log({ foo1: $foo1 });
    
    $: foo2 = getFoo2($uid)
    $: console.log({ foo2: $foo2 })

    $: ({foo3} = getFoo3($uid));
    $: console.log({ foo3: $foo3 });
    
    $: ({foo4} = getFoo4($uid))
    $: console.log({ foo4: $foo4 })
</script>