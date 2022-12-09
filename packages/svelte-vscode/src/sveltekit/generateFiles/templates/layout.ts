import { GenerateConfig } from '../types';

export default async function (config: GenerateConfig) {
    const ts = `
<script lang="ts">
    import type { LayoutData } from './$types';
    
    export let data: LayoutData;
</script>
    `.trim();

    const js = `
<script>
    /** @type {import('./$types').LayoutData} */
    export let data;
</script>
    `.trim();

    return config.type === 'js' ? js : ts;
}
