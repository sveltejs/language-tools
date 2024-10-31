import { FSWatcher, watch } from 'chokidar';
import { readFile } from 'fs';
import globrex from 'globrex';
import { join } from 'path';
import { flatten, isNotNullOrUndefined, normalizePath } from '../../utils';

const varRegex = /^\s*(--\w+.*?):\s*?([^;]*)/;

export interface GlobalVar {
    name: string;
    filename: string;
    value: string;
}

export class GlobalVars {
    private fsWatcher?: FSWatcher;
    private watchedFiles: string | undefined;
    private globalVars = new Map<string, GlobalVar[]>();
    private readonly workspaceRoot: string[];

    constructor(workspaceRoot: string[]) {
        this.workspaceRoot = workspaceRoot;
    }

    watchFiles(filesToWatch: string): void {
        if (!filesToWatch || this.watchedFiles === filesToWatch) {
            return;
        }

        this.watchedFiles = filesToWatch;
        if (this.fsWatcher) {
            this.fsWatcher.close();
            this.globalVars.clear();
        }

        const paths = new Set<string>();
        const includePatterns = new Set<string>();

        for (const root of this.workspaceRoot) {
            for (const filePath of filesToWatch.split(',')) {
                if (!filePath.includes('*')) {
                    paths.add(filePath);
                    continue;
                }

                const normalizedPath = normalizePath(join(root, filePath));
                includePatterns.add(normalizedPath);
                const pathSegments = normalizedPath.split('**');
                let directory = pathSegments[0] || '.';
                paths.add(directory);
            }
        }

        this.fsWatcher = watch(Array.from(paths), {
            ignored: this.createIgnoreMatcher(includePatterns)
        })
            .addListener('add', (file) => this.updateForFile(file))
            .addListener('change', (file) => {
                this.updateForFile(file);
            })
            .addListener('unlink', (file) => this.globalVars.delete(file));
    }

    private createIgnoreMatcher(includePatterns: Set<string>) {
        if (includePatterns.size === 0) {
            return undefined;
        }

        const regexList = Array.from(includePatterns).map(
            (pattern) => globrex(pattern, { globstar: true }).regex
        );

        return (path: string) => {
            return !regexList.some((regex) => regex.test(path));
        };
    }

    private updateForFile(filename: string) {
        // Inside a small timeout because it seems chikidar is "too fast"
        // and reading the file will then return empty content
        setTimeout(() => {
            readFile(filename, 'utf-8', (error, contents) => {
                if (error) {
                    return;
                }

                const globalVarsForFile = contents
                    .split('\n')
                    .map((line) => line.match(varRegex))
                    .filter(isNotNullOrUndefined)
                    .map((line) => ({ filename, name: line[1], value: line[2] }));
                this.globalVars.set(filename, globalVarsForFile);
            });
        }, 1000);
    }

    getGlobalVars(): GlobalVar[] {
        return flatten([...this.globalVars.values()]);
    }
}
