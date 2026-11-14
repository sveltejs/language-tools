import assert from 'assert';
import {
    mkdirSync,
    mkdtempSync,
    realpathSync,
    renameSync,
    rmSync,
    unlinkSync,
    writeFileSync
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DidChangeWatchedFilesParams, FileChangeType, FileEvent } from 'vscode-languageserver';
import { FallbackWatcher } from '../../src/lib/FallbackWatcher';
import { pathToUrl } from '../../src/utils';

const SETTLE_MS = 300;
const EVENT_TIMEOUT_MS = 5000;

describe('FallbackWatcher', function () {
    this.timeout(20_000);

    let root: string;
    let watcher: FallbackWatcher | undefined;
    let events: FileEvent[];

    function startWatcher(workspacePaths = [root]) {
        events = [];
        watcher = new FallbackWatcher(['.ts', '.svelte'], workspacePaths);
        watcher.onDidChangeWatchedFiles((params: DidChangeWatchedFilesParams) => {
            events.push(...params.changes);
        });
        return watcher;
    }

    function settle() {
        return new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    }

    async function waitForEvent(path: string, type: FileChangeType) {
        const uri = pathToUrl(path);
        const deadline = Date.now() + EVENT_TIMEOUT_MS;
        while (Date.now() < deadline) {
            if (events.some((event) => event.uri === uri && event.type === type)) {
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
        assert.fail(`no event of type ${type} for ${path}; got ${JSON.stringify(events)}`);
    }

    async function assertNoEventFor(path: string) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const uri = pathToUrl(path);
        assert.deepStrictEqual(
            events.filter((event) => event.uri === uri),
            []
        );
    }

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), 'fallback-watcher-')));
    });

    afterEach(() => {
        watcher?.dispose();
        watcher = undefined;
        rmSync(root, { recursive: true, force: true });
    });

    it('reports created, changed and deleted files', async () => {
        mkdirSync(join(root, 'src'));
        startWatcher();
        await settle();
        const file = join(root, 'src', 'a.ts');

        writeFileSync(file, 'export const a = 1;');
        await waitForEvent(file, FileChangeType.Created);

        events = [];
        writeFileSync(file, 'export const a = 2;');
        await waitForEvent(file, FileChangeType.Changed);

        unlinkSync(file);
        await waitForEvent(file, FileChangeType.Deleted);
    });

    it('reports changes to files that existed before watching started', async () => {
        mkdirSync(join(root, 'src'));
        const edited = join(root, 'src', 'edited.ts');
        const saved = join(root, 'src', 'saved.ts');
        writeFileSync(edited, 'export const a = 1;');
        writeFileSync(saved, 'export const b = 1;');
        startWatcher();
        await settle();

        writeFileSync(edited, 'export const a = 2;');
        await waitForEvent(edited, FileChangeType.Changed);

        writeFileSync(`${saved}.tmp`, 'export const b = 2;');
        renameSync(`${saved}.tmp`, saved);
        await waitForEvent(saved, FileChangeType.Changed);

        assert.deepStrictEqual(
            events.filter((event) => event.type === FileChangeType.Created),
            []
        );
    });

    it('ignores files with other extensions', async () => {
        startWatcher();
        await settle();
        const file = join(root, 'notes.md');

        writeFileSync(file, '# notes');
        await assertNoEventFor(file);
    });

    it('ignores node_modules and .git', async () => {
        mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true });
        mkdirSync(join(root, '.git'));
        startWatcher();
        await settle();
        const dependency = join(root, 'node_modules', 'pkg', 'index.ts');
        const gitFile = join(root, '.git', 'hook.ts');

        writeFileSync(dependency, 'export {};');
        writeFileSync(gitFile, 'export {};');
        await assertNoEventFor(dependency);
        await assertNoEventFor(gitFile);
    });

    it('reports files in directories added with watchDirectory', async () => {
        const workspace = join(root, 'workspace');
        const external = join(root, 'shared');
        mkdirSync(workspace);
        mkdirSync(join(external, 'nested'), { recursive: true });
        startWatcher([workspace]).watchDirectory([
            { baseUri: pathToUrl(external), pattern: '**/*.{ts,svelte}' }
        ]);
        await settle();
        const file = join(external, 'nested', 'b.ts');

        writeFileSync(file, 'export const b = 1;');
        await waitForEvent(file, FileChangeType.Created);
    });

    it('keeps reporting changes in a workspace with many directories', async () => {
        for (let i = 0; i < 6000; i++) {
            mkdirSync(join(root, 'build', `d${Math.floor(i / 100)}`, `e${i % 100}`), {
                recursive: true
            });
        }
        mkdirSync(join(root, 'src'));
        startWatcher();
        await settle();
        const file = join(root, 'src', 'App.svelte');

        writeFileSync(file, '<script></script>');
        await waitForEvent(file, FileChangeType.Created);
    });
});
