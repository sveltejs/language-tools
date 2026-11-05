import type {
    CompletionItem,
    TextEdit
} from '@typescript/native/vscode' with { 'resolution-mode': 'import' };
import { Block, findBlocks, isModuleScript } from './componentTagText';

interface TextView {
    getText(): string;
    offsetAt(position: { line: number; character: number }): number;
    positionAt(offset: number): { line: number; character: number };
}

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
    document: TextView,
    options: ImportEditOptions
): CompletionItem {
    const edits = item.additionalTextEdits;
    if (!edits?.length) {
        return item;
    }
    const text = document.getText();
    const scripts = findBlocks(text).filter((block) => block.tag === 'script');
    const isInScript = (edit: TextEdit) => {
        const start = document.offsetAt(edit.range.start);
        const end = document.offsetAt(edit.range.end);
        return scripts.some((s) => s.contentStart <= start && end <= s.contentEnd);
    };
    const misplaced = edits.filter((edit) => isImportEdit(edit) && !isInScript(edit));
    if (misplaced.length === 0) {
        return item;
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
    return {
        ...item,
        additionalTextEdits: [...edits.filter((edit) => !misplaced.includes(edit)), relocated]
    };
}

function isImportEdit(edit: TextEdit) {
    return /^\s*import\s/.test(edit.newText);
}

function insertIntoScript(
    script: Block,
    text: string,
    statements: string[],
    document: TextView
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
    document: TextView,
    options: ImportEditOptions
): TextEdit {
    const position = document.positionAt(0);
    const lines = statements.map((statement) => '\t' + statement).join('\n');
    return {
        range: { start: position, end: position },
        newText: `${options.newScriptTag}\n${lines}\n</script>\n\n`
    };
}
