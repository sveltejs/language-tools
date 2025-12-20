import { GenerateConfig, Resource } from '../types';

const defaultScriptTemplate = `
/** @type {import('./$types').LayoutLoad} */
export async function load() {
    return {};
}
`;

const tsScriptTemplate = `
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async () => {
    return {};
};
`;

const tsSatisfiesScriptTemplate = `
import type { LayoutLoad } from './$types';

export const load = (async () => {
    return {};
}) satisfies LayoutLoad;
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
