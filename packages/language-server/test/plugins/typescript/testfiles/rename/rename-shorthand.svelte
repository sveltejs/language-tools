<script>
    import Child from './rename3.svelte';

    let props2;
</script>

<Child bind:props2 />
<Child {props2} />
<Child props2={props2} />
<Child props2={props2?.toString()} />
