import path from 'path';
import { TextDocumentEdit, TextEdit, WorkspaceEdit } from 'vscode-languageserver';
import { FileRename } from '../../interfaces';
import { pathToUrl, urlToPath } from '../../../utils';
import { TsApiLocationMapper } from '../TsApiLocationMapper';
import { TsApiService } from '../TsApiService';
import type { tsApiAsync, tsAst } from '../types';

/**
 * Import updates for renamed/moved files in content mapper mode, for the import specifiers in
 * `.svelte` files.
 *
 * TS7 answers `workspace/willRenameFiles` itself (measured with 7.1.0-dev.20261125.1): it updates
 * `.ts`/`.js` importers, also of a renamed `.svelte` file, but edits nothing in `.svelte` files:
 * neither their imports of the renamed file nor the relative imports of a moved `.svelte` file.
 * So this only produces edits in `.svelte` files and leaves the rest to TS7.
 *
 * Must run before the rename (the client calls it from `onWillRenameFiles`): the old paths still
 * resolve then. The edits are for the old uris, as LSP `willRenameFiles` edits are. Only relative
 * specifiers are updated, keeping how they were written (with or without extension, `.js` for a
 * `.ts` file, a directory for its `index` as long as it stays one). Aliases (`$lib/...`, `paths`)
 * and query suffixes (`?raw`) stay as they are. All projects loaded in TS7 are searched, not the
 * workspace. Upstream ask: TS7 handling the importers in content-mapped files itself.
 */
export class TsGoUpdateImportsProvider {
    constructor(private readonly tsApiService: TsApiService) {}

    async updateImports(renames: FileRename | FileRename[]): Promise<WorkspaceEdit | null> {
        const moves: { from: string; to: string }[] = [];
        for (const rename of Array.isArray(renames) ? renames : [renames]) {
            const from = urlToPath(rename.oldUri);
            const to = urlToPath(rename.newUri);
            if (from && to) {
                moves.push({ from: path.resolve(from), to: path.resolve(to) });
            }
        }
        if (!moves.length) {
            return null;
        }
        // file or folder: the new path of `fileName`
        const moved = (fileName: string) => {
            const file = path.resolve(fileName);
            for (const { from, to } of moves) {
                if (file === from) {
                    return to;
                }
                if (file.startsWith(from + path.sep)) {
                    return to + file.slice(from.length);
                }
            }
            return file;
        };

        const ast = this.tsApiService.astModule;
        // The Svelte files of all loaded projects (an importer can be in another project than the
        // renamed file, e.g. a shared component); each with the first project that has it
        const edits = await this.tsApiService.withLoadedProjects(async (projects) => {
            const mapper = new TsApiLocationMapper(ast);
            const changes: TextDocumentEdit[] = [];
            const seen = new Set<string>();
            for (const project of projects) {
                const program = project.program;
                const svelteFiles: string[] = [];
                for (const fileName of await program.getSourceFileNames()) {
                    if (
                        fileName.endsWith('.svelte') &&
                        !fileName.includes('/node_modules/') &&
                        !seen.has(fileName)
                    ) {
                        seen.add(fileName);
                        svelteFiles.push(fileName);
                    }
                }
                await this.updateProject(program, svelteFiles, moved, mapper, changes);
            }
            return changes;
        });
        return edits.length ? { documentChanges: edits } : null;
    }

    private async updateProject(
        program: tsApiAsync.Program,
        svelteFiles: readonly string[],
        moved: (fileName: string) => string,
        mapper: TsApiLocationMapper,
        changes: TextDocumentEdit[]
    ): Promise<void> {
        const ast = this.tsApiService.astModule;
        await Promise.all(
            svelteFiles.map(async (fileName) => {
                const sourceFile = await program.getSourceFile(fileName);
                if (!sourceFile) {
                    return;
                }
                const importerFrom = path.dirname(path.resolve(fileName));
                const importerTo = path.dirname(moved(fileName));
                const specifiers = sourceFile.imports.filter(
                    (node): node is tsAst.StringLiteral | tsAst.NoSubstitutionTemplateLiteral =>
                        (ast.isStringLiteral(node) || ast.isNoSubstitutionTemplateLiteral(node)) &&
                        /^\.\.?(\/|$)/.test(node.text)
                );
                const resolved = await Promise.all(
                    specifiers.map((specifier) =>
                        program
                            .getResolvedModuleFromModuleSpecifier(specifier, fileName)
                            .catch(() => undefined)
                    )
                );
                const fileEdits: TextEdit[] = [];
                specifiers.forEach((specifier, i) => {
                    const target = resolved[i]?.resolvedFileName;
                    if (!target) {
                        return;
                    }
                    const targetTo = moved(target);
                    if (importerFrom === importerTo && path.resolve(target) === targetTo) {
                        return;
                    }
                    const newSpecifier = updateSpecifier(
                        specifier.text,
                        path.resolve(target),
                        importerTo,
                        targetTo
                    );
                    if (!newSpecifier || newSpecifier === specifier.text) {
                        return;
                    }
                    // the text between the quotes; only what the user wrote (not svelte2tsx's)
                    const span = mapper.toOriginalSpan(
                        sourceFile,
                        specifier.getStart(sourceFile) + 1,
                        specifier.end - 1,
                        ast.SpanMapFeature.References
                    );
                    if (
                        span &&
                        sourceFile.originalText.slice(span.start, span.end) === specifier.text
                    ) {
                        fileEdits.push(
                            TextEdit.replace(
                                mapper.toRange(sourceFile, span.start, span.end),
                                newSpecifier
                            )
                        );
                    }
                });
                if (fileEdits.length) {
                    changes.push(
                        TextDocumentEdit.create(
                            { uri: pathToUrl(sourceFile.fileName), version: null },
                            fileEdits
                        )
                    );
                }
            })
        );
    }
}

const scriptExtensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.d.ts'];

/**
 * The specifier for `targetTo` from `importerDir`, written in the style of `specifier` (which
 * resolved to `target`). Undefined if the style isn't recognized.
 */
export function updateSpecifier(
    specifier: string,
    target: string,
    importerDir: string,
    targetTo: string
): string | undefined {
    const written = specifier.split('/').pop()!;
    const base = path.basename(target);
    const extension = path.extname(target);
    const withoutExtension = base.slice(0, base.length - extension.length);

    let newPath: string;
    if (written === base) {
        newPath = targetTo;
    } else if (written === withoutExtension || written === withoutExtension.replace(/\.d$/, '')) {
        newPath = targetTo.slice(0, targetTo.length - extension.length).replace(/\.d$/, '');
    } else if (
        path.extname(written) &&
        written.slice(0, -path.extname(written).length) === withoutExtension &&
        scriptExtensions.includes(path.extname(written))
    ) {
        // `./foo.js` for `foo.ts`: keep the written extension
        newPath = targetTo.slice(0, targetTo.length - extension.length) + path.extname(written);
    } else if (
        withoutExtension === 'index' &&
        (written === '' || written === '.' || written === '..' || !written.includes('.'))
    ) {
        // `./lib` for `lib/index.ts`: stays a directory only if the target is still its index
        const newExtension = path.extname(targetTo);
        const newBase = path.basename(targetTo).slice(0, -newExtension.length || undefined);
        newPath =
            newBase.replace(/\.d$/, '') === 'index'
                ? path.dirname(targetTo)
                : targetTo.slice(0, targetTo.length - newExtension.length).replace(/\.d$/, '');
    } else {
        return undefined;
    }

    const relative = path.relative(importerDir, newPath).split(path.sep).join('/');
    if (relative === '') {
        return '.';
    }
    return relative.startsWith('../') || relative === '..' ? relative : './' + relative;
}
