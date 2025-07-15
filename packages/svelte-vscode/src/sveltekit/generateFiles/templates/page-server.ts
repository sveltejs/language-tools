import { GenerateConfig, Resource } from '../types';

const defaultScriptTemplate = `
/** @type {import('./$types').PageServerLoad} */
export async function load() {
    return {};
};
`;

const tsScriptTemplate = `
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    return {};
};
`;

const tsSatisfiesScriptTemplate = `
import type { PageServerLoad } from './$types';

export const load = (async () => {
    return {};
}) satisfies PageServerLoad;
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
