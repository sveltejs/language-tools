import { GenerateConfig, ProjectType, Resource } from '../types';

const defaultScriptTemplate = `
<script>
    /** @type {import('./$types').LayoutData} */
    export let data;
</script>
`;

const tsSv5ScriptTemplate = `
<script lang="ts">
    import type { LayoutData } from './$types';
    
    let data: LayoutData = $props();
</script>
`;

const tsScriptTemplate = `
<script lang="ts">
    import type { LayoutData } from './$types';
    
    export let data: LayoutData;
</script>
`;

const jsSv5ScriptTemplate = `
<script>
    /** @type {import('./$types').LayoutData} */
    let data = $props();
</script>
`;

const scriptTemplate: ReadonlyMap<ProjectType, string> = new Map([
    [ProjectType.TS_SV5, tsSv5ScriptTemplate],
    [ProjectType.TS_SATISFIES_SV5, tsSv5ScriptTemplate],
    [ProjectType.JS_SV5, jsSv5ScriptTemplate],
    [ProjectType.TS, tsScriptTemplate],
    [ProjectType.TS_SATISFIES, tsScriptTemplate],
    [ProjectType.JS, defaultScriptTemplate]
])

export default async function (config: GenerateConfig): ReturnType<Resource['generate']> {
    return (scriptTemplate.get(config.type) ?? defaultScriptTemplate).trim();
}
