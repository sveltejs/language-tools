import { GenerateConfig } from '../types';

export default async function (config: GenerateConfig) {
    const ts = `
<script lang="ts">
    import { page } from '$app/stores';
</script>

<h1>{$page.status}: {$page.error?.message}</h1>
    `.trim();

    const js = `
<script>
    import { page } from '$app/stores';
</script>

<h1>{$page.status}: {$page.error.message}</h1>
    `.trim();

    return config.type === 'js' ? js : ts;
}
