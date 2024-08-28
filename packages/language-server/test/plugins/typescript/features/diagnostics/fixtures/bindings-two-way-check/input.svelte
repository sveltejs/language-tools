<script lang="ts">
    import Legacy from './Legacy.svelte';
    import Runes from './Runes.svelte';

    let legacy = '';
    let runes = '';
</script>

<!-- ok -->
<Legacy bind:legacy1={legacy} />
<Runes bind:runes1={runes} bind:runes2={(runes as any)} />

<!-- error in Svelte 5 -->
<Legacy bind:legacy2={legacy} />
<Runes bind:runes1={runes} bind:runes2={runes} />
