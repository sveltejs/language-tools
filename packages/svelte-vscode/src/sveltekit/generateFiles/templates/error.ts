import { GenerateConfig, Resource } from '../types';

const defaultScriptTemplate = `
<script>
    import { page } from '$app/stores';
</script>

<h1>{$page.status}: {$page.error.message}</h1>
`;

const jsSv5ScriptTemplateAppState = `
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

const tsSv5ScriptTemplateAppState = `
<script lang="ts">
    import { page } from '$app/state';
</script>

<h1>{page.status}: {page.error?.message}</h1>
`;

export default async function (config: GenerateConfig): ReturnType<Resource['generate']> {
    const { withTs, withAppState } = config.kind;
    let template = defaultScriptTemplate;

    if (withAppState && withTs) {
        template = tsSv5ScriptTemplateAppState;
    } else if (withAppState && !withTs) {
        template = jsSv5ScriptTemplateAppState;
    } else if (!withAppState && withTs) {
        template = tsScriptTemplate;
    } else if (!withAppState && !withTs) {
        template = defaultScriptTemplate;
    }

    return template.trim();
}
