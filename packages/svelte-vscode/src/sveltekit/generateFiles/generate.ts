import { FileType, GenerateConfig } from './types';
import { join } from 'path';
import { Position, Uri, window, workspace, WorkspaceEdit } from 'vscode';

export async function generateResources(config: GenerateConfig) {
    workspace.fs.createDirectory(Uri.file(config.path));
    const edit = new WorkspaceEdit();

    for (const resource of config.resources) {
        const ext = resource.type === FileType.PAGE ? config.pageExtension : config.scriptExtension;
        const filepath = join(config.path, `${resource.filename}.${ext}`);

        const uri = Uri.file(filepath);
        edit.createFile(uri, {
            overwrite: false,
            ignoreIfExists: true
        });

        const data = await resource.generate(config);
        edit.insert(uri, new Position(0, 0), data);
    }

    await workspace.applyEdit(edit);

    // save documents and open the first
    await Promise.all(
        edit.entries().map(async ([uri], i) => {
            const doc = workspace.textDocuments.find((t) => t.uri.path === uri.path);
            if (doc) {
                await doc?.save();
                if (i === 0) {
                    await workspace.openTextDocument(uri);
                    await window.showTextDocument(doc);
                }
            }
        })
    );
}
