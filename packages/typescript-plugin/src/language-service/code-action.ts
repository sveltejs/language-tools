import type ts from 'typescript';
import { SvelteSnapshot, SvelteSnapshotManager } from '../svelte-snapshots';
import { isNotNullOrUndefined, isSvelteFilePath } from '../utils';

type _ts = typeof ts;

export function decorateQuickFixAndRefactor(
    ls: ts.LanguageService,
    ts: _ts,
    snapshotManager: SvelteSnapshotManager
) {
    const getEditsForRefactor = ls.getEditsForRefactor;
    const getCodeFixesAtPosition = ls.getCodeFixesAtPosition;

    ls.getEditsForRefactor = (...args) => {
        const result = getEditsForRefactor(...args);

        if (!result) {
            return;
        }

        const edits = result.edits.map(mapFileTextChanges).filter(isNotNullOrUndefined);
        if (edits.length === 0) {
            return;
        }

        return {
            ...result,
            edits
        };
    };

    ls.getCodeFixesAtPosition = (...args) => {
        const result = getCodeFixesAtPosition(...args);

        return result
            .map((fix) => {
                return {
                    ...fix,
                    changes: fix.changes.map(mapFileTextChanges).filter(isNotNullOrUndefined)
                };
            })
            .filter((fix) => fix.changes.length > 0);
    };

    function mapFileTextChanges(change: ts.FileTextChanges) {
        const snapshot = snapshotManager.get(change.fileName);
        if (!isSvelteFilePath(change.fileName) || !snapshot) {
            return change;
        }

        let baseIndent: string | undefined;
        const getBaseIndent = () => {
            if (baseIndent !== undefined) {
                return baseIndent;
            }

            baseIndent = getIndentOfFirstStatement(ts, ls, change.fileName, snapshot);

            return baseIndent;
        };

        const textChanges = change.textChanges
            .map((textChange) => mapEdit(textChange, snapshot, getBaseIndent))
            .filter(isNotNullOrUndefined);

        // If part of the text changes are invalid, filter out the whole change
        if (textChanges.length === 0 || textChanges.length !== change.textChanges.length) {
            return null;
        }

        return {
            ...change,
            textChanges
        };
    }
}

function mapEdit(change: ts.TextChange, snapshot: SvelteSnapshot, getBaseIndent: () => string) {
    const isNewImportStatement = change.newText.trimStart().startsWith('import');
    if (isNewImportStatement) {
        return mapNewImport(change, snapshot, getBaseIndent);
    }

    const span = snapshot.getOriginalTextSpan(change.span);

    if (!span) {
        return null;
    }

    return {
        span,
        newText: change.newText
    };
}

function mapNewImport(
    change: ts.TextChange,
    snapshot: SvelteSnapshot,
    getBaseIndent: () => string
): ts.TextChange | null {
    const previousLineEnds = getPreviousLineEnds(snapshot.getText(), change.span.start);

    if (previousLineEnds === -1) {
        return null;
    }
    const mappable = snapshot.getOriginalTextSpan({
        start: previousLineEnds,
        length: 0
    });

    if (!mappable) {
        // There might not be any import at all but this is rare enough so ignore for now
        return null;
    }

    const originalText = snapshot.getOriginalText();
    const span = {
        start: originalText.indexOf('\n', mappable.start) + 1,
        length: change.span.length
    };

    const baseIndent = getBaseIndent();
    let newText = baseIndent
        ? change.newText
              .split('\n')
              .map((line) => (line ? baseIndent + line : line))
              .join('\n')
        : change.newText;

    return { span, newText };
}

function getPreviousLineEnds(text: string, start: number) {
    const index = text.lastIndexOf('\n', start);
    if (index === -1) {
        return index;
    }

    if (text[index - 1] === '\r') {
        return index - 1;
    }

    return index;
}

function getIndentOfFirstStatement(
    ts: _ts,
    ls: ts.LanguageService,
    fileName: string,
    snapshot: SvelteSnapshot
) {
    const firstExportOrImport = ls
        .getProgram()
        ?.getSourceFile(fileName)
        ?.statements.find((node) => ts.isExportDeclaration(node) || ts.isImportDeclaration(node));

    const originalPosition = firstExportOrImport
        ? snapshot.getOriginalOffset(firstExportOrImport.getStart())
        : -1;
    if (originalPosition === -1) {
        return '';
    }

    const source = snapshot.getOriginalText();
    const start = source.lastIndexOf('\n', originalPosition) + 1;
    let index = start;
    while (index < originalPosition) {
        const char = source[index];
        if (char.trim()) {
            break;
        }

        index++;
    }

    return source.substring(start, index);
}
