import { GenerateConfig, Resource } from '../types';

const defaultScriptTemplate = `
/** @type {import('./$types').PageLoad} */
export async function load() {
    return {};
};
`;

const tsScriptTemplate = `
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
    return {};
};
`;

const tsSatisfiesScriptTemplate = `
import type { PageLoad } from './$types';

export const load = (async () => {
    return {};
}) satisfies PageLoad;
`;

export default async function (config: GenerateConfig): ReturnType<Resource['generate']> {
    const { withTs, withSatisfies } = config.kind;
    let template = defaultScriptTemplate;

    if (withTs && withSatisfies) {
        template = tsSatisfiesScriptTemplate;
    } else if (withTs && !withSatisfies) {
        template = tsScriptTemplate;
    }

    return template.trim();
}
