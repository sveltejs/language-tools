import { GenerateConfig } from '../types';

export default async function generate(config: GenerateConfig) {
    return `
export async function GET() {
    return new Response();
};
    `.trim();

    return config.type === 'js' ? js : ts;
}
