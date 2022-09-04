import { FileType, TemplateConfig } from './types';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export async function generateResources(config: TemplateConfig) {
    mkdirSync(config.path, { recursive: true });

    const promises: Array<Promise<string>> = [];

    for (const resource of config.resources) {
        const ext = resource.type === FileType.PAGE ? config.pageExtension : config.scriptExtension;
        const filepath = join(config.path, `${resource.filename}.${ext}`);

        promises.push(
            resource
                .generate(config)
                .then((data) => writeFileSync(filepath, data, { encoding: 'utf-8' }))
                .then(() => filepath)
        );
    }

    const writtenFiles = await Promise.all(promises);
    return writtenFiles;
}
