import { TemplateConfig } from '../types';

export default async function generate(config: TemplateConfig) {
    const ts = `
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    return new Response();
};
    `.trim();

    const js = `
/** @type {import('./$types').RequestHandler} */
export async function GET() {
    return new Response();
};
    `.trim();

    return config.typescript ? ts : js;
}
