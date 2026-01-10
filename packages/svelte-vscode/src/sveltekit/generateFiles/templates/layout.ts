import { GenerateConfig, Resource } from '../types';

const defaultScriptTemplate = `
<script>
    /** @type {import('./$types').LayoutData} */
    export let data;
</script>

<slot />
`;

const tsSv5ScriptTemplate = `
<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { LayoutData } from './$types';

    let { data, children }: { data: LayoutData, children: Snippet } = $props();
</script>

{@render children()}
`;

const tsSv5ScriptTemplateProps = `
<script lang="ts">
    import type { LayoutProps } from './$types';

    let { data, children }: LayoutProps = $props();
</script>

{@render children()}
`;

const tsScriptTemplate = `
<script lang="ts">
    import type { LayoutData } from './$types';

    export let data: LayoutData;
</script>

<slot />
`;

const jsSv5ScriptTemplate = `
<script>
    /** @type {{ data: import('./$types').LayoutData, children: import('svelte').Snippet }} */
    let { data, children } = $props();
</script>

{@render children()}
`;

const jsSv5ScriptTemplateProps = `
<script>
    /** @type {import('./$types').LayoutProps} */
    let { data, children } = $props();
</script>

{@render children()}
`;

export default async function (config: GenerateConfig): ReturnType<Resource['generate']> {
    const { withRunes, withTs, withProps } = config.kind;
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
