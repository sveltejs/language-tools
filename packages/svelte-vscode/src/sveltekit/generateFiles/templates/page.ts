import { GenerateConfig } from '../types';

export default async function (config: GenerateConfig) {
    const ts = `
<script lang="ts">
    import type { PageData } from './$types';
    
    export let data: PageData;
</script>
    `.trim();

    const js = `
<script>
    /** @type {import('./$types').PageData} */
    export let data;
</script>
    `.trim();

    return config.type === 'js' ? js : ts;
}
