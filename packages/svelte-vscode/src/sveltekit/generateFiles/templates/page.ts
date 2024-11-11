import { GenerateConfig, ProjectType, Resource } from '../types';

const defaultScriptTemplate = `
<script>
    /** @type {import('./$types').PageData} */
    export let data;
</script>
`;

const tsSv5ScriptTemplate = `
<script lang="ts">
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
</script>
`;

const tsScriptTemplate = `
<script lang="ts">
    import type { PageData } from './$types';

    export let data: PageData;
</script>
`;

const jsSv5ScriptTemplate = `
<script>
    /** @type {{ data: import('./$types').PageData }} */
    let { data } = $props();
</script>
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
