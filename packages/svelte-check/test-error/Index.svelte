<script lang="ts">
    import Jsdoc from './Jsdoc.svelte';
    import { foo } from './relative';
    import nope from '../../outside';

    let count: number = 'oops';
    let x = 0;
    // prettier-ignore
    x ===
        '2';

    foo === '';
</script>

<p>{count}</p>
<Jsdoc />
