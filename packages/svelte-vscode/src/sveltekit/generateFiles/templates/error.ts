import { GenerateConfig, Resource } from '../types';

const defaultScriptTemplate = `
<script>
    import { page } from '$app/stores';
</script>

<h1>{$page.status}: {$page.error.message}</h1>
`;

const jsSv5ScriptTemplate = `
<script>
    import { page } from '$app/state';
</script>

<h1>{page.status}: {page.error.message}</h1>
`;

const tsScriptTemplate = `
<script lang="ts">
    import { page } from '$app/stores';
</script>

<h1>{$page.status}: {$page.error?.message}</h1>
`;

const tsSv5ScriptTemplate = `
<script lang="ts">
    import { page } from '$app/state';
</script>

<h1>{page.status}: {page.error?.message}</h1>
`;

export default async function (config: GenerateConfig): ReturnType<Resource['generate']> {
    const { withRunes, withTs } = config.kind;
    let template = defaultScriptTemplate;

    if (withRunes && withTs) {
        template = tsSv5ScriptTemplate;
    } else if (withRunes && !withTs) {
        template = jsSv5ScriptTemplate;
    } else if (!withRunes && withTs) {
        template = tsScriptTemplate;
    } else if (!withRunes && !withTs) {
        template = defaultScriptTemplate;
    }

    return template.trim();
}
