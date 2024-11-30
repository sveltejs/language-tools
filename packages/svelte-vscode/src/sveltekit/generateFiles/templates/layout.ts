import { GenerateConfig, ProjectType, Resource } from '../types';

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

const scriptTemplate: ReadonlyMap<ProjectType, string> = new Map([
    [ProjectType.TS_SV5, tsSv5ScriptTemplate],
    [ProjectType.TS_SATISFIES_SV5, tsSv5ScriptTemplate],
    [ProjectType.JS_SV5, jsSv5ScriptTemplate],
    [ProjectType.TS, tsScriptTemplate],
    [ProjectType.TS_SATISFIES, tsScriptTemplate],
    [ProjectType.JS, defaultScriptTemplate]
]);

export default async function (config: GenerateConfig): ReturnType<Resource['generate']> {
    return (scriptTemplate.get(config.type) ?? defaultScriptTemplate).trim();
}
