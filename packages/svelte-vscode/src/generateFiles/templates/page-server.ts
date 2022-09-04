import { TemplateConfig } from '../types';

export default async function (config: TemplateConfig) {
    const ts = `
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    return {};
};
    `.trim();

    const js = `
/** @type {import('./$types').PageServerLoad} */
export async function load() {
    return {};
};
    `.trim();

    return config.typescript ? ts : js;
}
