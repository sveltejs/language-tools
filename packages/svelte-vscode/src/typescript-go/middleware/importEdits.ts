import type {
    CompletionItem,
    TextEdit
} from '@typescript/native/vscode' with { 'resolution-mode': 'import' };
import { Block, findBlocks, isModuleScript } from './componentTagText';
import type { TextDocumentView } from './utils';

export interface ImportEditOptions {
    /** Start tag for a new script, e.g. `<script lang="ts">` */
    newScriptTag: string;
}

/**
 * TS7 computes auto-import edits in the virtual code and maps them back. In files without a usable
 * script that goes wrong (measured with the content mapper):
 * - no script at all: the import is inserted at the start of the file, e.g. after the `<` of the
 *   first tag (`<\nimport X from "./X.svelte";\n\nChild`)
 * - empty `<script></script>`: the import lands after `</script>`
 * Like the TS6 `CompletionProvider` (`codeActionChangeToTextEdit`), import edits outside of a script
 * are moved to the start of the instance (else module) script, and a script tag is created if there
 * is none.
 */
export function fixImportEdits(
    item: CompletionItem,
    document: TextDocumentView,
    options: ImportEditOptions
): CompletionItem {
    const edits = item.additionalTextEdits;
    if (!edits?.length) {
        return item;
    }
    const fixed = fixImportTextEdits(edits, document, options);
    return fixed === edits ? item : { ...item, additionalTextEdits: fixed };
}

/**
 * The edits of a completion item or code action (quick fix "Add import") in a Svelte file:
 * - import edits outside of a script are moved into it (see `fixImportEdits`)
 * - import edits in a script are indented like the script. TS7 indents them with its own format
 *   options (4 spaces), which knows nothing about the indentation of the script tag's content.
 * Returns `edits` itself if nothing changed.
 */
export function fixImportTextEdits(
    edits: readonly TextEdit[],
    document: TextDocumentView,
    options: ImportEditOptions
): TextEdit[] {
    const text = document.getText();
    const scripts = findBlocks(text).filter((block) => block.tag === 'script');
    const scriptOf = (edit: TextEdit) => {
        const start = document.offsetAt(edit.range.start);
        const end = document.offsetAt(edit.range.end);
        return scripts.find((s) => s.contentStart <= start && end <= s.contentEnd);
    };
    let changed = false;
    const misplaced: TextEdit[] = [];
    const kept: TextEdit[] = [];
    for (const edit of edits) {
        if (!isImportEdit(edit)) {
            kept.push(edit);
            continue;
        }
        const script = scriptOf(edit);
        if (!script) {
            misplaced.push(edit);
            changed = true;
            continue;
        }
        const reindented = reindentImports(
            edit.newText,
            getScriptIndent(text.slice(script.contentStart, script.contentEnd))
        );
        if (reindented !== edit.newText) {
            changed = true;
            kept.push({ ...edit, newText: reindented });
        } else {
            kept.push(edit);
        }
    }
    if (!changed) {
        return edits as TextEdit[];
    }
    if (misplaced.length === 0) {
        return kept;
    }

    const statements = misplaced.flatMap((edit) =>
        edit.newText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
    );
    const script = scripts.find((s) => !isModuleScript(s)) ?? scripts[0];
    const relocated = script
        ? insertIntoScript(script, text, statements, document)
        : insertNewScript(statements, document, options);
    return [...kept, relocated];
}

function isImportEdit(edit: TextEdit) {
    return /^\s*import\s/.test(edit.newText);
}

/** Indentation of the first non-empty line of the script content, `\t` if it's empty */
function getScriptIndent(content: string): string {
    const firstLine = /^([ \t]*)\S/m.exec(content);
    return firstLine ? firstLine[1] : '\t';
}

/** Gives every line of `newText` that starts an import statement the script's indentation */
function reindentImports(newText: string, indent: string): string {
    return newText.replace(/^[ \t]*(?=import\s)/gm, indent);
}

function insertIntoScript(
    script: Block,
    text: string,
    statements: string[],
    document: TextDocumentView
): TextEdit {
    const content = text.slice(script.contentStart, script.contentEnd);
    const indent = /^\n?([ \t]+)\S/m.exec(content)?.[1] ?? '\t';
    const lines = statements.map((statement) => indent + statement).join('\n');
    if (content.trim() === '') {
        // `<script></script>` or only whitespace: replace it, so the tags end up on their own lines
        return {
            range: {
                start: document.positionAt(script.contentStart),
                end: document.positionAt(script.contentEnd)
            },
            newText: `\n${lines}\n`
        };
    }
    const position = document.positionAt(script.contentStart);
    return {
        range: { start: position, end: position },
        newText:
            content.startsWith('\n') || content.startsWith('\r\n') ? `\n${lines}` : `\n${lines}\n`
    };
}

function insertNewScript(
    statements: string[],
    document: TextDocumentView,
    options: ImportEditOptions
): TextEdit {
    const position = document.positionAt(0);
    const lines = statements.map((statement) => '\t' + statement).join('\n');
    return {
        range: { start: position, end: position },
        newText: `${options.newScriptTag}\n${lines}\n</script>\n\n`
    };
}
