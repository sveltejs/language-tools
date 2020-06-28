import { Warning } from 'svelte/types/compiler/interfaces';
import { Diagnostic, DiagnosticSeverity, Position, Range } from 'vscode-languageserver';
import { Document, isInTag, mapDiagnosticToOriginal } from '../../../lib/documents';
import { Logger } from '../../../logger';
import { SvelteDocument, TranspileErrorSource } from '../SvelteDocument';

/**
 * Returns diagnostics from the svelte compiler.
 * Also tries to return errors at correct position if transpilation/preprocessing fails.
 */
export async function getDiagnostics(
    document: Document,
    svelteDoc: SvelteDocument,
): Promise<Diagnostic[]> {
    try {
        return await tryGetDiagnostics(document, svelteDoc);
    } catch (error) {
        return getPreprocessErrorDiagnostics(document, svelteDoc, error);
    }
}

/**
 * Try to transpile and compile the svelte file and return diagnostics.
 */
async function tryGetDiagnostics(
    document: Document,
    svelteDoc: SvelteDocument,
): Promise<Diagnostic[]> {
    const transpiled = await svelteDoc.getTranspiled();

    try {
        const res = await svelteDoc.getCompiled();
        return (((res.stats as any).warnings || res.warnings || []) as Warning[])
            .map((warning) => {
                const start = warning.start || { line: 1, column: 0 };
                const end = warning.end || start;
                return {
                    range: Range.create(start.line - 1, start.column, end.line - 1, end.column),
                    message: warning.message,
                    severity: DiagnosticSeverity.Warning,
                    source: 'svelte',
                    code: warning.code,
                };
            })
            .map((diag) => mapDiagnosticToOriginal(transpiled, diag));
    } catch (err) {
        return (await createParserErrorDiagnostic(err, document)).map((diag) =>
            mapDiagnosticToOriginal(transpiled, diag),
        );
    }
}

/**
 * Try to infer a nice diagnostic error message from the compilation error.
 */
async function createParserErrorDiagnostic(error: any, document: Document) {
    const start = error.start || { line: 1, column: 0 };
    const end = error.end || start;
    const diagnostic: Diagnostic = {
        range: Range.create(start.line - 1, start.column, end.line - 1, end.column),
        message: error.message,
        severity: DiagnosticSeverity.Error,
        source: 'svelte',
        code: error.code,
    };

    if (diagnostic.message.includes('expected')) {
        const isInStyle = isInTag(diagnostic.range.start, document.styleInfo);
        const isInScript = isInTag(diagnostic.range.start, document.scriptInfo);

        if (isInStyle || isInScript) {
            diagnostic.message +=
                '. If you expect this syntax to work, here are some suggestions: ';
            if (isInScript) {
                diagnostic.message +=
                    'If you use typescript with `svelte-preprocessor`, did you add `lang="typescript"` to your `script` tag? ';
            } else {
                diagnostic.message +=
                    'If you use less/SCSS with `svelte-preprocessor`, did you add `lang="scss"`/`lang="less"` to you `style` tag? ' +
                    scssNodeRuntimeHint;
            }
            diagnostic.message +=
                'Did you setup a `svelte.config.js`? ' +
                'See https://github.com/sveltejs/language-tools/tree/master/packages/svelte-vscode#using-with-preprocessors for more info.';
        }
    }

    return [diagnostic];
}

/**
 * Try to infer a nice diagnostic error message from the transpilation error.
 */
function getPreprocessErrorDiagnostics(
    document: Document,
    svelteDoc: SvelteDocument,
    error: any,
): Diagnostic[] {
    Logger.error('Preprocessing failed');
    Logger.error(error);

    if (svelteDoc.config.loadConfigError) {
        return getConfigLoadErrorDiagnostics(svelteDoc.config.loadConfigError);
    }

    if (document.styleInfo && error.__source === TranspileErrorSource.Style) {
        return getStyleErrorDiagnostics(error, document);
    }

    if (
        (document.scriptInfo || document.moduleScriptInfo) &&
        error.__source === TranspileErrorSource.Script
    ) {
        return getScriptErrorDiagnostics(error, document);
    }

    return getOtherErrorDiagnostics(error);
}

function getConfigLoadErrorDiagnostics(error: any): Diagnostic[] {
    return [
        {
            message: 'Error in svelte.config.js\n\n' + error,
            range: Range.create(Position.create(0, 0), Position.create(0, 5)),
            severity: DiagnosticSeverity.Error,
            source: 'svelte',
        },
    ];
}

/**
 * Try to infer a nice diagnostic error message from the transpilation error.
 */
function getStyleErrorDiagnostics(error: any, document: Document): Diagnostic[] {
    return [
        {
            message: getStyleErrorMessage(),
            range: getStyleErrorRange(),
            severity: DiagnosticSeverity.Error,
            source: 'svelte(style)',
        },
    ];

    function getStyleErrorMessage() {
        if (isSveltePreprocessCannotFindModulesError(error)) {
            const hint =
                error instanceof Error && error.message.includes('node-sass')
                    ? scssNodeRuntimeHint
                    : '';
            return error.message + preprocessSetupErrorMsg + hint + preprocessorsLinkMsg;
        }

        return (
            error.formatted /* sass error messages have this */ ||
            error.message ||
            'Style error. Transpilation failed.'
        );
    }

    function getStyleErrorRange() {
        const lineOffset = document.styleInfo?.startPos.line || 0;
        const position =
            typeof error?.column === 'number' && typeof error?.line === 'number'
                ? // Some preprocessors like sass or less return error objects with these attributes.
                  // Use it to display a nice error message.
                  Position.create(lineOffset + error.line - 1, error.column)
                : document.styleInfo?.startPos || Position.create(0, 0);
        return Range.create(position, position);
    }
}

/**
 * Try to infer a nice diagnostic error message from the transpilation error.
 */
function getScriptErrorDiagnostics(error: any, document: Document): Diagnostic[] {
    return [
        {
            message: getScriptErrorMessage(),
            range: getScriptErrorRange(),
            severity: DiagnosticSeverity.Error,
            source: 'svelte(script)',
        },
    ];

    function getScriptErrorMessage() {
        if (isSveltePreprocessCannotFindModulesError(error)) {
            return error.message + preprocessSetupErrorMsg + preprocessorsLinkMsg;
        }

        return error.message || 'Script error. Transpilation failed.';
    }

    function getScriptErrorRange() {
        const position =
            document.scriptInfo?.startPos ||
            document.moduleScriptInfo?.startPos ||
            Position.create(0, 0);
        return Range.create(position, position);
    }
}

/**
 * Try to infer a nice diagnostic error message from the transpilation error.
 */
function getOtherErrorDiagnostics(error: any): Diagnostic[] {
    return [
        {
            message: getOtherErrorMessage(),
            range: Range.create(Position.create(0, 0), Position.create(0, 5)),
            severity: DiagnosticSeverity.Warning,
            source: 'svelte',
        },
    ];

    function getOtherErrorMessage() {
        if (isSveltePreprocessCannotFindModulesError(error)) {
            return error.message + preprocessSetupErrorMsg + preprocessorsLinkMsg;
        }

        return error.message || 'Error. Transpilation failed.';
    }
}

/**
 * Preprocessing could fail if packages cannot be resolved.
 * A warning about a broken svelte.configs.js/preprocessor setup should be added then.
 */
function isSveltePreprocessCannotFindModulesError(error: any) {
    return error instanceof Error && error.message.startsWith('Cannot find any of modules');
}

const preprocessSetupErrorMsg =
    "\n\nThe file cannot be parsed because style requires a preprocessor that doesn't seem to be setup or failed during setup. " +
    'Did you setup a `svelte.config.js`? ';
const preprocessorsLinkMsg =
    '\n\nSee https://github.com/sveltejs/language-tools/tree/master/packages/svelte-vscode#using-with-preprocessors for more info.';
const scssNodeRuntimeHint =
    'If you use SCSS, it may be necessary to add the path to your NODE runtime to the setting `svelte.language-server.runtime`, or use `sass` instead of `node-sass`. ';
