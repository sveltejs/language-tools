import { GenerateConfig, Resource } from '../types';

const defaultScriptTemplate = `
/** @type {import('./$types').RequestHandler} */
export async function GET() {
    return new Response();
};
`;

const tsScriptTemplate = `
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    return new Response();
};
`;

export default async function (config: GenerateConfig): ReturnType<Resource['generate']> {
    const { withTs } = config.kind;
    let template = defaultScriptTemplate;

    if (withTs) {
        template = tsScriptTemplate;
    }

    return template.trim();
}
