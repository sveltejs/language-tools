import { Location } from 'vscode-languageserver-types';
import { FileReferencesProvider } from '../../interfaces';
import { pathToUrl, urlToPath } from '../../../utils';
import { TsApiLocationMapper } from '../TsApiLocationMapper';
import { TsApiService } from '../TsApiService';
import type { tsApiAsync, tsAst } from '../types';

/**
 * "Find File References" in content mapper mode: the import specifiers that resolve to the file,
 * like TS's `getFileReferences` (which the TS7 API doesn't offer). Goes through the source files of
 * the file's default project (without libraries; local declaration files count), resolves their imports
 * with TS7 and maps the specifiers back (`References` feature, so svelte2tsx's own imports, e.g. of
 * the shims, are not reported).
 */
export class TsGoFileReferencesProvider implements FileReferencesProvider {
    constructor(private readonly tsApiService: TsApiService) {}

    async fileReferences(uri: string): Promise<Location[] | null> {
        const targetPath = urlToPath(uri);
        if (!targetPath) {
            return null;
        }
        const ast = this.tsApiService.astModule;
        const result = await this.tsApiService.withProject(uri, async (project) => {
            const program = project.program;
            const target = normalize(targetPath);
            const mapper = new TsApiLocationMapper(ast);
            const locations: Location[] = [];

            const fileNames = await getWorkspaceSourceFileNames(program);
            await Promise.all(
                fileNames.map(async (fileName) => {
                    if (normalize(fileName) === target) {
                        return;
                    }
                    const sourceFile = await program.getSourceFile(fileName);
                    const specifiers = (sourceFile?.imports ?? []).filter(
                        (node): node is tsAst.StringLiteral | tsAst.NoSubstitutionTemplateLiteral =>
                            ast.isStringLiteral(node) || ast.isNoSubstitutionTemplateLiteral(node)
                    );
                    const resolved = await Promise.all(
                        specifiers.map((specifier) =>
                            program
                                .getResolvedModuleFromModuleSpecifier(specifier, fileName)
                                .catch(() => undefined)
                        )
                    );
                    specifiers.forEach((specifier, i) => {
                        const resolvedFileName = resolved[i]?.resolvedFileName;
                        if (!resolvedFileName || normalize(resolvedFileName) !== target) {
                            return;
                        }
                        // the specifier's text without the quotes, like TS
                        const span = mapper.toOriginalSpan(
                            sourceFile!,
                            specifier.getStart(sourceFile) + 1,
                            specifier.end - 1,
                            ast.SpanMapFeature.References
                        );
                        if (span) {
                            locations.push({
                                uri: pathToUrl(sourceFile!.fileName),
                                range: mapper.toRange(sourceFile!, span.start, span.end)
                            });
                        }
                    });
                })
            );
            return locations.sort(
                (a, b) =>
                    a.uri.localeCompare(b.uri) ||
                    a.range.start.line - b.range.start.line ||
                    a.range.start.character - b.range.start.character
            );
        });
        return result ?? null;
    }
}

/**
 * The program's files without dependencies and default libraries: what is in `node_modules`, and
 * declaration files TS7 marks as library (only those are asked, one request each)
 */
async function getWorkspaceSourceFileNames(
    program: tsApiAsync.Program
): Promise<readonly string[]> {
    const fileNames = (await program.getSourceFileNames()).filter(
        (fileName) => !fileName.includes('/node_modules/')
    );
    const keep = await Promise.all(
        fileNames.map(async (fileName) => {
            if (!isDeclarationFile(fileName)) {
                return true;
            }
            const metadata = await program.getSourceFileMetadata(fileName).catch(() => undefined);
            return !!metadata && !metadata.isDefaultLibrary && !metadata.isFromExternalLibrary;
        })
    );
    return fileNames.filter((_, i) => keep[i]);
}

function isDeclarationFile(fileName: string) {
    return /\.d\.[cm]?ts$/.test(fileName) || /\.d\.[^/]+\.ts$/.test(fileName);
}

function normalize(fileName: string) {
    const forward = fileName.replace(/\\/g, '/');
    return process.platform === 'win32' ? forward.toLowerCase() : forward;
}
