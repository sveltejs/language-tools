import { GenerateConfig, Resource } from '../types';

const defaultScriptTemplate = `
/** @type {import('./$types').LayoutServerLoad} */
export async function load() {
    return {};
}
`;

const tsScriptTemplate = `
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
    return {};
};
`;

const tsSatisfiesScriptTemplate = `
import type { LayoutServerLoad } from './$types';

export const load = (async () => {
    return {};
}) satisfies LayoutServerLoad;
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
