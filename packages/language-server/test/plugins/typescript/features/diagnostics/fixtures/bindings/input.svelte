<script lang="ts">
    import Legacy from './Legacy.svelte';
    import Runes from './Runes.svelte';
    import RunesGeneric from './RunesGeneric.svelte';

    let bind_and_prop: () => boolean;
    let value = '';

    let only_bind: () => boolean;
    let can_bind = '';
    let readonly = ''

    let instance: ReturnType<typeof Runes>;
    instance!.only_bind() === true;
</script>

<!-- ok -->
<Legacy bind:bind_and_prop />
<Legacy bind:value />
<Legacy {value} />
<Legacy {bind_and_prop} />
<Runes bind:can_bind /> <!-- these error in Svelte 4 because props are not a thing there -->
<Runes {can_bind} />
<Runes {readonly} />

<!-- error in Svelte 5 -->
<Runes bind:readonly />
<Runes bind:only_bind />
<Runes {only_bind} />

<RunesGeneric bind:readonly />
<RunesGeneric bind:only_bind />
<RunesGeneric {only_bind} />
