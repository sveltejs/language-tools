import { GenerateConfig } from '../types';

export default async function (config: GenerateConfig) {
    const ts = `
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async () => {
    return {};
};
    `.trim();

    const tsSatisfies = `
import type { LayoutLoad } from './$types';

export const load = (async () => {
    return {};
}) satisfies LayoutLoad;
    `.trim();

    const js = `
/** @type {import('./$types').LayoutLoad} */
export async function load() {
    return {};
}
    `.trim();

    return config.type === 'js' ? js : config.type === 'ts' ? ts : tsSatisfies;
}
