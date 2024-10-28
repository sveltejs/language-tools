import { GenerateConfig, ProjectType, Resource } from '../types';

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

const scriptTemplate: ReadonlyMap<ProjectType, string> = new Map([
    [ProjectType.TS_SV5, tsScriptTemplate],
    [ProjectType.TS_SATISFIES_SV5, tsScriptTemplate],
    [ProjectType.JS_SV5, defaultScriptTemplate],
    [ProjectType.TS, tsScriptTemplate],
    [ProjectType.TS_SATISFIES, tsScriptTemplate],
    [ProjectType.JS, defaultScriptTemplate]
]);

export default async function (config: GenerateConfig): ReturnType<Resource['generate']> {
    return (scriptTemplate.get(config.type) ?? defaultScriptTemplate).trim();
}
