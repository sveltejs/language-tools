import { ChildProcess, spawn } from 'child_process';
import {
    CancellationToken,
    DidChangeConfigurationNotification,
    DidOpenTextDocumentNotification,
    InitializeParams,
    InitializeRequest,
    InitializeResult,
    InitializedNotification,
    LogMessageNotification,
    MessageType,
    ProtocolConnection,
    ProtocolNotificationType,
    ProtocolRequestType,
    RegistrationRequest,
    ServerCapabilities,
    WorkspaceFolder,
    createProtocolConnection
} from 'vscode-languageserver';
import { StreamMessageReader, StreamMessageWriter } from 'vscode-languageserver/node';
import { DocumentManager } from '../../../src/lib/documents';
import { Logger } from '../../../src/logger';
import { LSConfigManager } from '../../../src/ls-config';
import { Resolvable } from '../../../src/plugins/interfaces';

export interface TsLSPServiceOptions {
    tsserverPath: string;
    lsConfigManager: LSConfigManager;
    docManager: DocumentManager;
    serverInitializationOptions: Partial<InitializeParams> & {
        workspaceFolders: WorkspaceFolder[];
    };
}

/**
 * Currently only used in testing. But if we need to spawn a TypeScript LSP server for LSP clients other than VSCode. We can move this class to src.
 */
export class TsLSPService {
    private readonly options: TsLSPServiceOptions;
    private serverProcess: ChildProcess | null = null;
    private connection: ProtocolConnection | null = null;
    private initializePending: Promise<void> | null = null;
    private serverCapability: ServerCapabilities | null = null;

    constructor(options: TsLSPServiceOptions) {
        this.options = options;

        options.lsConfigManager.onChange(() => {
            this.syncConfiguration();
        });

        options.docManager.on('documentOpen', (document) => {
            this.sendNotification(DidOpenTextDocumentNotification.type, {
                textDocument: {
                    languageId: 'svelte',
                    text: document.getText(),
                    uri: document.getURL(),
                    version: document.version
                }
            });
        });
    }

    async sendRequest<P, R, PR, E, RO>(
        type: ProtocolRequestType<P, R, PR, E, RO>,
        params: P,
        token?: CancellationToken
    ): Promise<R> {
        const connection = await this.getConnection();
        return connection.sendRequest(type, params, token);
    }

    getServerCapability() {
        if (!this.serverCapability) {
            throw new Error(`Server have not been initialized yet.`);
        }
        return this.serverCapability;
    }

    private async sendNotification<P, RO>(
        type: ProtocolNotificationType<P, RO>,
        params?: P
    ): Promise<void> {
        const connection = await this.getConnection();
        return connection.sendNotification(type, params);
    }

    private async getConnection(): Promise<ProtocolConnection> {
        await this.initializePending;
        if (!this.connection) {
            throw new Error(
                `TypeScript Go server connection is not initialized. Please start the server first.`
            );
        }
        return this.connection;
    }

    start(): Resolvable<void> {
        if (this.connection || this.initializePending) {
            throw new Error(
                `TypeScript Go server is already running at ${this.options.tsserverPath}`
            );
        }
        this.initializePending = this.initializeServerProcess();
        return this.initializePending;
    }

    private async initializeServerProcess(): Promise<void> {
        const options = this.options;
        if (this.serverProcess) {
            throw new Error(
                `TypeScript Go server process is already running at ${options.tsserverPath}`
            );
        }
        this.serverProcess = spawn(options.tsserverPath, ['--lsp', '--stdio'], {});
        if (!this.serverProcess?.stdin || !this.serverProcess.stdout) {
            throw new Error(
                `Failed to spawn TypeScript Go server process at ${options.tsserverPath}`
            );
        }
        this.serverProcess.on('error', (err) => {
            Logger.error(
                err,
                `Failed to start TypeScript Go server process at ${options.tsserverPath}`
            );
        });
        this.serverProcess.on('exit', (code, signal) => {
            if (code !== 0) {
                Logger.error(
                    `TypeScript Go server process exited with code ${code} and signal ${signal}`
                );
                const stderr = this.serverProcess?.stderr?.read()?.toString();
                if (stderr) {
                    Logger.error(`TypeScript Go server process stderr: ${stderr}`);
                }
            }
        });
        const connection = createProtocolConnection(
            new StreamMessageReader(this.serverProcess.stdout),
            new StreamMessageWriter(this.serverProcess.stdin)
        );
        this.connection = connection;

        const clientCapabilities = options.lsConfigManager.getClientCapabilities();
        const initializeParams: InitializeParams = {
            processId: process.pid,
            rootUri: options.serverInitializationOptions.rootUri ?? null,
            workspaceFolders: options.serverInitializationOptions.workspaceFolders,
            locale: options.serverInitializationOptions.locale,
            capabilities: {
                textDocument: {
                    diagnostic: {
                        ...clientCapabilities?.textDocument?.publishDiagnostics,
                        ...clientCapabilities?.textDocument?.diagnostic
                    },
                    hover: clientCapabilities?.textDocument?.hover,
                    definition: clientCapabilities?.textDocument?.definition,
                    publishDiagnostics: clientCapabilities?.textDocument?.publishDiagnostics,
                    codeLens: clientCapabilities?.textDocument?.codeLens,
                    references: clientCapabilities?.textDocument?.references,
                    rename: clientCapabilities?.textDocument?.rename,
                    inlayHint: clientCapabilities?.textDocument?.inlayHint,
                    signatureHelp: clientCapabilities?.textDocument?.signatureHelp,
                    foldingRange: clientCapabilities?.textDocument?.foldingRange,
                    semanticTokens: clientCapabilities?.textDocument?.semanticTokens
                },
                workspace: {
                    workspaceFolders: clientCapabilities?.workspace?.workspaceFolders,
                    didChangeWatchedFiles: clientCapabilities?.workspace?.didChangeWatchedFiles
                }
            },
            initializationOptions: {
                codeLensShowLocationsCommandName: 'editor.action.showReferences',
                runExternalCode: true
            }
        };
        connection.onNotification(LogMessageNotification.type, (params) => {
            switch (params.type) {
                case MessageType.Error:
                    Logger.error(`[ts go] [error]: ${params.message}`);
                    break;
                case MessageType.Warning:
                    Logger.log(`[ts go] [warn]: ${params.message}`);
                    break;
                case MessageType.Info:
                    Logger.debug(`[ts go] [info]: ${params.message}`);
                    break;
                case MessageType.Log:
                    Logger.debug(`[ts go] [log]: ${params.message}`);
                    break;
                case MessageType.Debug:
                    Logger.debug(`[ts go] [debug]: ${params.message}`);
                    break;
            }
        });
        connection.onRequest(RegistrationRequest.type, () => {});
        connection.listen();
        return connection
            .sendRequest(InitializeRequest.type, initializeParams)
            .then(async (result: InitializeResult) => {
                Logger.debug('TypeScript Go server initialized successfully');
                Logger.debug('Server capabilities:', result.capabilities);
                this.serverCapability = result.capabilities;
                await connection.sendNotification(InitializedNotification.type, {});
            });
    }

    async syncConfiguration() {
        const lsConfigManager = this.options.lsConfigManager;
        await this.sendNotification(DidChangeConfigurationNotification.type, {
            settings: {
                typescript: lsConfigManager.getClientTsUserConfig('typescript'),
                javascript: lsConfigManager.getClientTsUserConfig('javascript')
            }
        });
    }

    dispose() {
        if (this.connection) {
            this.connection.dispose();
            this.connection = null;
        }
        if (this.serverProcess) {
            this.serverProcess.removeAllListeners();
            this.serverProcess.kill();
            this.serverProcess = null;
        }
    }
}
