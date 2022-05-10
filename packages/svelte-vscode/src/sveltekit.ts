// SvelteKit related features go here

import { Position, Uri, window, workspace, WorkspaceEdit } from 'vscode';

enum Option {
    Yes = 'Yes',
    No = 'No',
    Always = 'Always',
    Never = 'Never'
}

const routesPath = '/src/routes'; // TODO can be configured, read svelte.config.js https://kit.svelte.dev/docs/configuration

export function addPageEndpointsPrompt() {
    workspace.onDidCreateFiles(async (e) => {
        const option = workspace.getConfiguration('svelte.kit').get<string>('createEndpoints');
        if (option === Option.Never) {
            return;
        }

        const files = e.files.filter(
            (file) => file.path.includes(routesPath) && file.path.endsWith('.svelte')
        );
        if (!files.length) {
            return;
        }

        if (option === Option.Always) {
            createPageEndpoint(files);
            return;
        }

        const item = await window.showQuickPick(
            [
                { label: Option.Yes, detail: 'Create an endpoint for the page you just created' },
                { label: Option.No, detail: 'Do nothing' },
                {
                    label: Option.Always,
                    detail: 'Always automatically create an endpoint for the page you just created'
                },
                { label: Option.Never, detail: 'Do not ask again' }
            ],
            {
                placeHolder: 'Create corresponding page endpoint?',
                canPickMany: false
            }
        );
        switch (item?.label) {
            case Option.Always:
                workspace.getConfiguration('svelte.kit').update('createEndpoints', Option.Always);
                createPageEndpoint(files);
                break;
            case Option.Never:
                workspace.getConfiguration('svelte.kit').update('createEndpoints', Option.Never);
                break;
            case Option.Yes:
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
