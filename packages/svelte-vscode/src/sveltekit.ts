// SvelteKit related features go here

import { commands, ExtensionContext, Position, Uri, workspace, WorkspaceEdit } from 'vscode';

export function addPageEndpointsCommand(context: ExtensionContext) {
    context.subscriptions.push(
        commands.registerTextEditorCommand('svelte.kit.createPageEndpoint', async (editor) => {
            const file = editor.document.uri;
            // Traverse the file tree up until the workspace root to check if it's a TS project or not
            const workspaceFolder = workspace.workspaceFolders?.find((folder) =>
                file.path.startsWith(folder.uri.path)
            );
            let isTsProject = false;
            let path = file.path;
            while (!isTsProject && workspaceFolder && path.startsWith(workspaceFolder.uri.path)) {
                const parts = path.split('/');
                parts.pop();
                path = parts.join('/');
                try {
                    await workspace.fs.stat(Uri.file(path + '/tsconfig.json'));
                    isTsProject = true;
                } catch (e) {
                    // continue
                }
            }

            // Create page endpoint file
            const edit = new WorkspaceEdit();
            const uri = Uri.file(
                file.path.slice(0, -'.svelte'.length) + (isTsProject ? '.ts' : '.js')
            );
            edit.createFile(uri, {
                overwrite: false,
                ignoreIfExists: true
            });
            const fileName = file.path.split('/').pop()!.slice(0, -'.svelte'.length);
            edit.insert(
                uri,
                new Position(0, 0),
                isTsProject
                    ? `import type { RequestHandler } from './${fileName}.d';

export const get: RequestHandler = async () => {

}
`
                    : `/** @type {import('./${fileName}').RequestHandler} */
export async function get() {

}
`
            );
            workspace.applyEdit(edit);
        })
    );
}
