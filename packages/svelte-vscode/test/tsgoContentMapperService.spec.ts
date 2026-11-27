import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal `vscode` for TsContentMapperService: settings, events, the TS7 extension
const state = vi.hoisted(() => ({
    useTsgo: true as boolean | undefined,
    configListeners: [] as Array<(e: any) => void>,
    warnings: [] as string[],
    tsExtension: undefined as any
}));

vi.mock('vscode', () => {
    class EventEmitter<T> {
        private listeners: Array<(e: T) => void> = [];
        event = (listener: (e: T) => void) => {
            this.listeners.push(listener);
            return {
                dispose: () => (this.listeners = this.listeners.filter((l) => l !== listener))
            };
        };
        fire(e: T) {
            this.listeners.forEach((l) => l(e));
        }
        dispose() {}
    }
    return {
        EventEmitter,
        ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
        Disposable: class {
            static from(...d: any[]) {
                return { dispose: () => d.forEach((x) => x.dispose()) };
            }
        },
        workspace: {
            onDidChangeConfiguration(listener: (e: any) => void) {
                state.configListeners.push(listener);
                return { dispose() {} };
            },
            getConfiguration(section: string) {
                return {
                    inspect: (key: string) =>
                        key === 'experimental.useTsgo' && section === 'js/ts'
                            ? { globalValue: state.useTsgo }
                            : {},
                    get: (_key: string, fallback: unknown) => fallback
                };
            }
        },
        extensions: { getExtension: () => state.tsExtension },
        window: {
            showWarningMessage: (message: string) => {
                state.warnings.push(message);
                return Promise.resolve(undefined);
            },
            showInformationMessage: () => Promise.resolve(undefined)
        },
        env: { clipboard: { writeText: async () => {} } },
        Uri: { file: (f: string) => ({ fsPath: f }) }
    };
});

import { TsContentMapperService } from '../src/typescript-go/contentMapper';

/** A fake TS7 extension API; `initialize()` simulates a (late) server initialization */
function createTsApi() {
    const listeners: Array<(sdk: any) => void> = [];
    let sdk: any;
    const api = {
        registerContentMappers: () => ({ dispose() {} }),
        onLanguageServerInitialized(listener: (sdk: any) => void) {
            listeners.push(listener);
            if (sdk) listener(sdk);
            return { dispose() {} };
        },
        initialize(newSdk: any) {
            sdk = newSdk;
            listeners.forEach((l) => l(newSdk));
        }
    };
    state.tsExtension = { activate: async () => api, packageJSON: { version: '1.0.2' } };
    return api;
}

const sdk = (version: string, init: () => Promise<string>) => ({
    version,
    packageJsonPath: '/ts/package.json',
    isCurrent: () => true,
    initializeAPIConnection: init
});

function setUseTsgo(value: boolean) {
    state.useTsgo = value;
    state.configListeners.forEach((l) =>
        l({ affectsConfiguration: (key: string) => key === 'js/ts.experimental.useTsgo' })
    );
}

describe('tsgo: TsContentMapperService', () => {
    beforeEach(() => {
        state.useTsgo = true;
        state.configListeners = [];
        state.warnings = [];
    });

    it('server already initialized: enables with the API pipe, no restart event', async () => {
        const api = createTsApi();
        api.initialize(sdk('7.1.0-dev.20261125.1', async () => 'pipe-1'));
        const service = new TsContentMapperService({ id: 'svelte.svelte-vscode' } as any);
        const restarts = vi.fn();
        service.onTsServerRestart(restarts);
        expect(await service.tryStart()).toMatchObject({ enable: true, apiPipe: 'pipe-1' });
        expect(restarts).not.toHaveBeenCalled();
    });

    it('server initialized after registration: fires one restart event (startup race)', async () => {
        const api = createTsApi();
        const service = new TsContentMapperService({ id: 'svelte.svelte-vscode' } as any);
        const restarts = vi.fn();
        service.onTsServerRestart(restarts);
        expect(await service.tryStart()).toEqual({ enable: false });
        api.initialize(sdk('7.1.0-dev.20261125.1', async () => 'pipe-1'));
        expect(restarts).toHaveBeenCalledTimes(1);
        expect(await service.tryStart()).toMatchObject({ enable: true, apiPipe: 'pipe-1' });
    });

    it('a restart of the Svelte LS gets a new API pipe', async () => {
        const api = createTsApi();
        let n = 0;
        api.initialize(sdk('7.1.0-dev.20261125.1', async () => `pipe-${++n}`));
        const service = new TsContentMapperService({ id: 'svelte.svelte-vscode' } as any);
        expect(await service.tryStart()).toMatchObject({ enable: true, apiPipe: 'pipe-1' });
        expect(await service.renewApiConnection()).toMatchObject({
            enable: true,
            apiPipe: 'pipe-2'
        });
        // and tryStart answers with the current one
        expect(await service.tryStart()).toMatchObject({ apiPipe: 'pipe-2' });
    });

    it('renewing after useTsgo was turned off gives the off option', async () => {
        const api = createTsApi();
        api.initialize(sdk('7.1.0-dev.20261125.1', async () => 'pipe'));
        const service = new TsContentMapperService({ id: 'svelte.svelte-vscode' } as any);
        await service.tryStart();
        setUseTsgo(false);
        expect(await service.renewApiConnection()).toEqual({ enable: false });
    });

    it('a transient renewal failure is not remembered (review R5)', async () => {
        const api = createTsApi();
        let calls = 0;
        api.initialize(
            sdk('7.1.0-dev.20261125.1', async () => {
                calls++;
                if (calls === 2) throw new Error('transient');
                return `pipe-${calls}`;
            })
        );
        const service = new TsContentMapperService({ id: 'svelte.svelte-vscode' } as any);
        expect(await service.tryStart()).toMatchObject({ enable: true, apiPipe: 'pipe-1' });
        expect(await service.renewApiConnection()).toMatchObject({
            enable: false,
            retryable: true
        });
        expect(await service.renewApiConnection()).toMatchObject({
            enable: true,
            apiPipe: 'pipe-3'
        });
        expect(calls).toBe(3);
    });

    it('a failed first API connection is tried again on the next start', async () => {
        const api = createTsApi();
        let failing = true;
        api.initialize(
            sdk('7.1.0-dev.20261125.1', async () => {
                if (failing) throw new Error('not yet');
                return 'pipe';
            })
        );
        const service = new TsContentMapperService({ id: 'svelte.svelte-vscode' } as any);
        expect(await service.tryStart()).toMatchObject({ enable: false, retryable: true });
        failing = false;
        expect(await service.tryStart()).toMatchObject({ enable: true, apiPipe: 'pipe' });
    });

    it('warns and stays off for a TS7 server older than 7.1', async () => {
        const api = createTsApi();
        api.initialize(sdk('7.0.2', async () => 'pipe'));
        const service = new TsContentMapperService({ id: 'svelte.svelte-vscode' } as any);
        expect(await service.tryStart()).toEqual({ enable: false });
        expect(state.warnings.join('\n')).toContain('7.0.2');
    });

    it('warns and stays off for a TS7 extension without the needed API', async () => {
        state.tsExtension = {
            activate: async () => ({ registerContentMappers: () => ({ dispose() {} }) }),
            packageJSON: { version: '1.0.1' }
        };
        const service = new TsContentMapperService({ id: 'svelte.svelte-vscode' } as any);
        expect(await service.tryStart()).toEqual({ enable: false });
        expect(state.warnings.join('\n')).toContain('1.0.1');
    });
});
