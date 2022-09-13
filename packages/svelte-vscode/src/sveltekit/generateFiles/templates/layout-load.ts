import { GenerateConfig } from '../types';

export default async function (config: GenerateConfig) {
    const ts = `
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async () => {
    return {};
};
    `.trim();

    const js = `
/** @type {import('./$types').LayoutLoad} */
export async function load() {
    return {};
}
    `.trim();

    return config.typescript ? ts : js;
}
