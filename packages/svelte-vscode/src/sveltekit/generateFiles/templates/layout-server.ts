import { GenerateConfig } from '../types';

export default async function (config: GenerateConfig) {
    const ts = `
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
    return {};
};
    `.trim();

    const tsSatisfies = `
import type { LayoutServerLoad } from './$types';

export const load = (async () => {
    return {};
}) satisfies LayoutServerLoad;
    `.trim();

    const js = `
/** @type {import('./$types').LayoutServerLoad} */
export async function load() {
    return {};
}
    `.trim();

    return config.type === 'js' ? js : config.type === 'ts' ? ts : tsSatisfies;
}
