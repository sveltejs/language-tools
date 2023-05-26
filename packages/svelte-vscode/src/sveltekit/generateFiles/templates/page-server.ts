import { GenerateConfig } from '../types';

export default async function (config: GenerateConfig) {
    return `
export async function load() {
    return {};
};
    `.trim();

    return config.type === 'js' ? js : config.type === 'ts' ? ts : tsSatisfies;
}
