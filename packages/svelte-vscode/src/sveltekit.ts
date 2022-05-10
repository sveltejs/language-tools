// SvelteKit related features go here

import { Position, Uri, window, workspace, WorkspaceEdit } from 'vscode';

const routesPath = '/src/routes'; // TODO can be configured, read svelte.config.js https://kit.svelte.dev/docs/configuration

export function addPageEndpointsPrompt() {
    workspace.onDidCreateFiles(async (e) => {
        const files = e.files.filter(
            (file) => file.path.includes(routesPath) && file.path.endsWith('.svelte')
        );
        if (!files.length) {
            return;
        }

        const item = await window.showQuickPick(['Yes', 'No', 'Always', 'Never'], {
            placeHolder: 'Create corresponding page endpoint?',
            canPickMany: false
        });
        switch (item) {
            case 'Always':
                workspace.getConfiguration('svelte.kit').update('createEndpoints', 'Always');
                createPageEndpoint(files);
                break;
            case 'Never':
                workspace.getConfiguration('svelte.kit').update('createEndpoints', 'Never');
                break;
            case 'Yes':
                createPageEndpoint(files);
                break;
        }
    });
}

async function createPageEndpoint(files: Uri[]) {
    const edit = new WorkspaceEdit();

    for (const file of files) {
        let isTsProject = true;
        try {
            await workspace.fs.stat(Uri.file(file.path.split(routesPath)[0] + '/tsconfig.json'));
        } catch (e) {
            isTsProject = false;
        }

        const uri = Uri.file(file.path.slice(0, -'.svelte'.length) + (isTsProject ? '.ts' : '.js'));
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

export async function get() {

}
`
                : `/** @type {import('./${fileName}').RequestHandler} */
export async function get() {

}
`
        );
    }

    workspace.applyEdit(edit);
}
