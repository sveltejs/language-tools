import { GenerateConfig, Resource } from '../types';

const defaultScriptTemplate = `
<script>
    /** @type {import('./$types').PageData} */
    export let data;
</script>
`;

const jsSv5ScriptTemplate = `
<script>
    /** @type {{ data: import('./$types').PageData }} */
    let { data } = $props();
</script>
`;

const jsSv5ScriptTemplateProps = `
<script>
    /** @type {import('./$types').PageProps} */
    let { data } = $props();
</script>
`;

const tsScriptTemplate = `
<script lang="ts">
    import type { PageData } from './$types';

    export let data: PageData;
</script>
`;

const tsSv5ScriptTemplate = `
<script lang="ts">
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
</script>
`;

const tsSv5ScriptTemplateProps = `
<script lang="ts">
    import type { PageProps } from './$types';

    let { data }: PageProps = $props();
</script>
`;

export default async function (config: GenerateConfig): ReturnType<Resource['generate']> {
    const { withProps, withRunes, withTs } = config.kind;
    let template = defaultScriptTemplate;

    if (withRunes && withTs && withProps) {
        template = tsSv5ScriptTemplateProps;
    } else if (withRunes && withTs && !withProps) {
        template = tsSv5ScriptTemplate;
    } else if (withRunes && !withTs && withProps) {
        template = jsSv5ScriptTemplateProps;
    } else if (withRunes && !withTs && !withProps) {
        template = jsSv5ScriptTemplate;
    } else if (!withRunes && withTs) {
        template = tsScriptTemplate;
    } else if (!withRunes && !withTs) {
        template = defaultScriptTemplate;
    }

    return template.trim();
}
