import { GenerateConfig, Resource } from '../types';

const defaultScriptTemplate = `
<script>
    import { page } from '$app/stores';
</script>

<h1>{$page.status}: {$page.error.message}</h1>
`;

const jsSv5ScriptTemplateProps = `
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

const tsSv5ScriptTemplateProps = `
<script lang="ts">
    import { page } from '$app/state';
</script>

<h1>{page.status}: {page.error?.message}</h1>
`;

export default async function (config: GenerateConfig): ReturnType<Resource['generate']> {
    const { withTs, withProps } = config.kind;
    let template = defaultScriptTemplate;

    if (withProps && withTs) {
        template = tsSv5ScriptTemplateProps;
    } else if (withProps && !withTs) {
        template = jsSv5ScriptTemplateProps;
    } else if (!withProps && withTs) {
        template = tsScriptTemplate;
    } else if (!withProps && !withTs) {
        template = defaultScriptTemplate;
    }

    return template.trim();
}
