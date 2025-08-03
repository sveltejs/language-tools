import { GenerateConfig, Resource } from '../types';

const defaultScriptTemplate = `
<script>
    import { page } from '$app/state';
</script>

<h1>{page.status}: {page.error.message}</h1>
`;

const tsScriptTemplate = `
<script lang="ts">
    import { page } from '$app/state';
</script>

<h1>{page.status}: {page.error?.message}</h1>
`;

export default async function (config: GenerateConfig): ReturnType<Resource['generate']> {
    const { withTs } = config.kind;
    let template = defaultScriptTemplate;

    if (withTs) {
        template = tsScriptTemplate;
    }

    return template.trim();
}
