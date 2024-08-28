<script lang="ts">
    import Legacy from './Legacy.svelte';
    import Runes from './Runes.svelte';
    import RunesGeneric from './RunesGeneric.svelte';

    let legacy = '';
    let runes = '';
    let foo: string | number;
</script>

<!-- ok -->
<Legacy bind:legacy1={legacy} />
<Runes bind:runes1={runes} bind:runes2={(runes as any)} />
<!-- bail on generics -->
<RunesGeneric {foo} bind:bar={runes} />

<!-- error in Svelte 5 -->
<Legacy bind:legacy2={legacy} />
<Runes bind:runes1={runes} bind:runes2={runes} />
