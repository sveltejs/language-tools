import path, { dirname, isAbsolute, join } from 'path';
import { existsSync, readdirSync, statSync, writeFileSync } from 'fs';
import ts from 'typescript';
import { resolveConfig, format } from 'prettier';
import { DocumentManager, Document } from '../../../src/lib/documents';
import { FileMap } from '../../../src/lib/documents/fileCollection';
import { LSConfigManager } from '../../../src/ls-config';
import { LSAndTSDocResolver } from '../../../src/plugins';
import {
    createGetCanonicalFileName,
    normalizePath,
    pathToUrl,
    urlToPath
} from '../../../src/utils';
import { VERSION } from 'svelte/compiler';
import { findTsConfigPath } from '../../../src/plugins/typescript/utils';

const isSvelte5Plus = Number(VERSION.split('.')[0]) >= 5;

export function createVirtualTsSystem(currentDirectory: string): ts.System {
    const virtualFs = new FileMap<string>();
    // array behave more similar to the actual fs event than Set
    const watchers = new FileMap<ts.FileWatcherCallback[]>();
    const watchTimeout = new FileMap<Array<ReturnType<typeof setTimeout>>>();
    const getCanonicalFileName = createGetCanonicalFileName(ts.sys.useCaseSensitiveFileNames);
    const modifiedTime = new FileMap<Date>();

    function toAbsolute(path: string) {
        return isAbsolute(path) ? path : join(currentDirectory, path);
    }

    const virtualSystem: ts.System = {
        ...ts.sys,
        getCurrentDirectory() {
            return currentDirectory;
        },
        writeFile(path, data) {
            const normalizedPath = normalizePath(toAbsolute(path));
            const existsBefore = virtualFs.has(normalizedPath);
            virtualFs.set(normalizedPath, data);
            modifiedTime.set(normalizedPath, new Date());
            triggerWatch(
                normalizedPath,
                existsBefore ? ts.FileWatcherEventKind.Changed : ts.FileWatcherEventKind.Created
            );
        },
        readFile(path) {
            return virtualFs.get(normalizePath(toAbsolute(path)));
        },
        fileExists(path) {
            return virtualFs.has(normalizePath(toAbsolute(path)));
        },
        directoryExists(path) {
            const normalizedPath = getCanonicalFileName(normalizePath(toAbsolute(path)));
            return Array.from(virtualFs.keys()).some((fileName) =>
                fileName.startsWith(normalizedPath)
            );
        },
        deleteFile(path) {
            const normalizedPath = normalizePath(toAbsolute(path));
            const existsBefore = virtualFs.has(normalizedPath);
            virtualFs.delete(normalizedPath);

            if (existsBefore) {
                triggerWatch(normalizedPath, ts.FileWatcherEventKind.Deleted);
            }
        },
        watchFile(path, callback) {
            const normalizedPath = normalizePath(toAbsolute(path));
            let watchersOfPath = watchers.get(normalizedPath);

            if (!watchersOfPath) {
                watchersOfPath = [];
                watchers.set(normalizedPath, watchersOfPath);
            }

            watchersOfPath.push(callback);

            return {
                close() {
                    const watchersOfPath = watchers.get(normalizedPath);

                    if (watchersOfPath) {
                        watchers.set(
                            normalizedPath,
                            watchersOfPath.filter((watcher) => watcher === callback)
                        );
                    }

                    const timeouts = watchTimeout.get(normalizedPath);

                    if (timeouts != null) {
                        timeouts.forEach((timeout) => clearTimeout(timeout));
                    }
                }
            };
        },
        getModifiedTime(path) {
            return modifiedTime.get(normalizePath(toAbsolute(path)));
        },
        readDirectory(path, _extensions, _exclude, include, _depth) {
            if (include && (include.length != 1 || include[0] !== '**/*')) {
                throw new Error(
                    'include pattern matching not implemented. Mock it if the test needs it. Pattern: ' +
                        include
                );
            }

            const normalizedPath = getCanonicalFileName(normalizePath(toAbsolute(path)));
            return Array.from(virtualFs.keys()).filter((fileName) =>
                fileName.startsWith(normalizedPath)
            );
        }
    };

    return virtualSystem;

    function triggerWatch(normalizedPath: string, kind: ts.FileWatcherEventKind) {
        // if watcher is not set yet. don't trigger it
        if (!watchers.has(normalizedPath)) {
            return;
        }

        let timeoutsOfPath = watchTimeout.get(normalizedPath);

        if (!timeoutsOfPath) {
            timeoutsOfPath = [];
            watchTimeout.set(normalizedPath, timeoutsOfPath);
        }

        timeoutsOfPath.push(
            setTimeout(
                () =>
                    watchers
                        .get(normalizedPath)
                        ?.forEach((callback) => callback(normalizedPath, kind)),
                0
            )
        );
    }
}

export function getRandomVirtualDirPath(testDir: string) {
    return path.join(testDir, `virtual-path-${Math.floor(Math.random() * 100_000)}`);
}

interface VirtualEnvironmentOptions {
    testDir: string;
    filename: string;
    fileContent: string;
}

export function setupVirtualEnvironment({
    testDir,
    fileContent,
    filename
}: VirtualEnvironmentOptions) {
    const docManager = new DocumentManager(
        (textDocument) => new Document(textDocument.uri, textDocument.text)
    );

    const lsConfigManager = new LSConfigManager();

    const virtualSystem = createVirtualTsSystem(testDir);
    const lsAndTsDocResolver = new LSAndTSDocResolver(
        docManager,
        [pathToUrl(testDir)],
        lsConfigManager,
        {
            tsSystem: virtualSystem
        }
    );

    const filePath = join(testDir, filename);
    virtualSystem.writeFile(filePath, fileContent);
    const document = docManager.openClientDocument(<any>{
        uri: pathToUrl(filePath),
        text: virtualSystem.readFile(filePath) || ''
    });

    return {
        lsAndTsDocResolver,
        document,
        docManager,
        virtualSystem,
        lsConfigManager
    };
}

export function createSnapshotTester<
    TestOptions extends {
        dir: string;
        workspaceDir: string;
        context: Mocha.Suite;
    }
>(executeTest: (inputFile: string, testOptions: TestOptions) => Promise<void>) {
    return (testOptions: TestOptions) => {
        serviceWarmup(testOptions.context, testOptions.dir, pathToUrl(testOptions.workspaceDir));
        executeTests(testOptions);
    };

    function executeTests(testOptions: TestOptions) {
        const { dir } = testOptions;
        const workspaceUri = pathToUrl(testOptions.workspaceDir);

        const inputFile = join(dir, 'input.svelte');
        const tsconfig = join(dir, 'tsconfig.json');
        const jsconfig = join(dir, 'jsconfig.json');

        if (existsSync(tsconfig) || existsSync(jsconfig)) {
            serviceWarmup(testOptions.context, dir, workspaceUri);
        }

        if (existsSync(inputFile)) {
            const _it =
                dir.endsWith('.v5') && !isSvelte5Plus
                    ? it.skip
                    : dir.endsWith('.only')
                      ? it.only
                      : it;
            _it(dir.substring(__dirname.length), () => executeTest(inputFile, testOptions));
        } else {
            const _describe = dir.endsWith('.only') ? describe.only : describe;
            _describe(dir.substring(__dirname.length), function () {
                const subDirs = readdirSync(dir);

                for (const subDir of subDirs) {
                    const stat = statSync(join(dir, subDir));
                    if (stat.isDirectory()) {
                        executeTests({
                            ...testOptions,
                            context: this,
                            dir: join(dir, subDir)
                        });
                    }
                }
            });
        }
    }
}

export async function updateSnapshotIfFailedOrEmpty({
    assertion,
    expectedFile,
    rootDir,
    getFileContent
}: {
    assertion: () => void;
    expectedFile: string;
    rootDir: string;
    getFileContent: () => string | Promise<string>;
}) {
    if (existsSync(expectedFile)) {
        try {
            assertion();
        } catch (e) {
            if (process.argv.includes('--auto')) {
                await writeFile(`Updated ${expectedFile} for`);
            } else {
                throw e;
            }
        }
    } else {
        await writeFile(`Created ${expectedFile} for`);
    }

    async function writeFile(msg: string) {
        console.info(msg, dirname(expectedFile).substring(rootDir.length));
        writeFileSync(expectedFile, await getFileContent(), 'utf-8');
    }
}

export async function createJsonSnapshotFormatter(dir: string) {
    if (!process.argv.includes('--auto')) {
        return (_obj: any) => '';
    }

    const prettierOptions = await resolveConfig(dir);

    return (obj: any) =>
        format(JSON.stringify(obj), {
            ...prettierOptions,
            parser: 'json'
        });
}

export function serviceWarmup(
    suite: Mocha.Suite,
    testDir: string,
    rootUri = pathToUrl(testDir),
    tsconfigPath: string | undefined = undefined
) {
    const defaultTimeout = suite.timeout();

    // allow to set a higher timeout for slow machines from cli flag
    const warmupTimeout = Math.max(defaultTimeout, 5_000);
    suite.timeout(warmupTimeout);
    before(() => warmup(tsconfigPath));

    suite.timeout(defaultTimeout);

    async function warmup(configFilePath: string | undefined = undefined) {
        const start = Date.now();
        console.log('Warming up language service...');

        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );

        const lsAndTsDocResolver = new LSAndTSDocResolver(
            docManager,
            [rootUri],
            new LSConfigManager()
        );

        configFilePath ??= findTsConfigPath(
            join(testDir, 'DoesNotMater.svelte'),
            [rootUri],
            ts.sys.fileExists,
            createGetCanonicalFileName(ts.sys.useCaseSensitiveFileNames)
        );

        const ls = await lsAndTsDocResolver.getTSServiceByConfigPath(
            configFilePath,
            configFilePath ? dirname(configFilePath) : urlToPath(rootUri)!
        );
        ls.getService();

        const projectReferences = ls.getResolvedProjectReferences();

        if (projectReferences.length) {
            await Promise.all(projectReferences.map((ref) => warmup(ref.configFilePath)));
        }

        console.log(`Service warming up done in ${Date.now() - start}ms`);
    }
}

export function recursiveServiceWarmup(
    suite: Mocha.Suite,
    testDir: string,
    rootUri = pathToUrl(testDir)
) {
    serviceWarmup(suite, testDir, rootUri);
    recursiveServiceWarmupNonRoot(suite, testDir, rootUri);
}

function recursiveServiceWarmupNonRoot(
    suite: Mocha.Suite,
    testDir: string,
    rootUri = pathToUrl(testDir)
) {
    const subDirs = readdirSync(testDir);

    for (const subDirOrFile of subDirs) {
        const stat = statSync(join(testDir, subDirOrFile));

        if (
            stat.isFile() &&
            (subDirOrFile === 'tsconfig.json' || subDirOrFile === 'jsconfig.json')
        ) {
            serviceWarmup(suite, testDir, rootUri);
        }

        if (stat.isDirectory()) {
            recursiveServiceWarmupNonRoot(suite, join(testDir, subDirOrFile), rootUri);
        }
    }
}
