<script lang="ts">
    import Legacy from './Legacy.svelte';
    import Runes from './Runes.svelte';

    let bind_and_prop: () => boolean;
    let value = '';

    let only_bind: () => boolean;
    let can_bind = '';
    let readonly = ''

    let instance: Runes;
    instance!.only_bind() === true;
</script>

<!-- ok -->
<Legacy bind:bind_and_prop />
<Legacy bind:value />
<Legacy {value} />
<Legacy {bind_and_prop} />
<Runes bind:can_bind />
<Runes {can_bind} />
<Runes {readonly} />

<!-- error in Svelte 5 -->
<Runes bind:readonly />
<Runes bind:only_bind />
<Runes {only_bind} />
