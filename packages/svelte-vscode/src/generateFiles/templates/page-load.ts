import { TemplateConfig } from '../types';

export default async function (config: TemplateConfig) {
    const ts = `
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
    return {};
};
    `.trim();

    const js = `
/** @type {import('./$types').PageLoad} */
export async function load() {
    return {};
};
    `.trim();

    return config.typescript ? ts : js;
}
