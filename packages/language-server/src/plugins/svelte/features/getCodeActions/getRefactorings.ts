import * as path from 'path';
import {
    CodeAction,
    CreateFile,
    Position,
    Range,
    TextDocumentEdit,
    TextEdit,
    VersionedTextDocumentIdentifier,
    WorkspaceEdit,
} from 'vscode-languageserver';
import { isRangeInTag, TagInformation } from '../../../../lib/documents';
import { pathToUrl } from '../../../../utils';
import { SvelteDocument } from '../../SvelteDocument';

export interface RefactorArgs {
    range: Range;
}

const extractComponentCommand = 'extract_to_svelte_component';

/**
 * Get applicable refactoring commands at given range.
 */
export async function getRefactorings(
    svelteDoc: SvelteDocument,
    range: Range,
): Promise<CodeAction[]> {
    return getExtractRefactoringCommand(svelteDoc, range);
}

async function getExtractRefactoringCommand(
    svelteDoc: SvelteDocument,
    range: Range,
): Promise<CodeAction[]> {
    const offsetStart = svelteDoc.offsetAt(range.start);
    const offsetEnd = svelteDoc.offsetAt(range.end);

    if (isSmallSelectionRange() || isInvalidSelectionRange()) {
        return [];
    }

    return [
        CodeAction.create('Extract into component', {
            title: 'Extract into component',
            command: extractComponentCommand,
            arguments: [
                svelteDoc.uri,
                <RefactorArgs>{
                    range,
                },
            ],
        }),
    ];

    function isSmallSelectionRange() {
        return offsetEnd - offsetStart < 10;
    }

    function isInvalidSelectionRange() {
        const text = svelteDoc.getText();
        const validStart = offsetStart === 0 || /[\s\W]/.test(text[offsetStart - 1]);
        const validEnd = offsetEnd === text.length - 1 || /[\s\W]/.test(text[offsetEnd]);
        return (
            !validStart ||
            !validEnd ||
            isRangeInTag(range, svelteDoc.style) ||
            isRangeInTag(range, svelteDoc.script) ||
            isRangeInTag(range, svelteDoc.moduleScript)
        );
    }
}

export async function executeRefactoringCommand(
    svelteDoc: SvelteDocument,
    command: string,
    args?: any[],
): Promise<WorkspaceEdit | null> {
    if (command === extractComponentCommand && args) {
        return executeExtractComponentCommand(svelteDoc, args[1]);
    }

    return null;
}

async function executeExtractComponentCommand(
    svelteDoc: SvelteDocument,
    refactorArgs: RefactorArgs,
): Promise<WorkspaceEdit | null> {
    const { range } = refactorArgs;

    const newFileUri = pathToUrl(
        path.join(path.dirname(svelteDoc.getFilePath()), 'NewComponent.svelte'),
    );
    return <WorkspaceEdit>{
        documentChanges: [
            TextDocumentEdit.create(VersionedTextDocumentIdentifier.create(svelteDoc.uri, null), [
                TextEdit.replace(range, '<NewComponent></NewComponent>'),
                createComponentImportTextEdit(),
            ]),
            CreateFile.create(newFileUri, { overwrite: true }),
            createNewFileEdit(),
        ],
    };

    function createNewFileEdit() {
        const text = svelteDoc.getText();
        const newText = [
            getTemplate(),
            getTag(svelteDoc.script),
            getTag(svelteDoc.moduleScript),
            getTag(svelteDoc.style),
        ]
            .filter((tag) => tag.start >= 0)
            .sort((a, b) => a.start - b.start)
            .map((tag) => tag.text)
            .join('');

        return TextDocumentEdit.create(VersionedTextDocumentIdentifier.create(newFileUri, null), [
            TextEdit.insert(Position.create(0, 0), newText),
        ]);

        function getTemplate() {
            const startOffset = svelteDoc.offsetAt(range.start);
            return {
                text: text.substring(startOffset, svelteDoc.offsetAt(range.end)),
                start: startOffset,
            };
        }

        function getTag(tag: TagInformation | null) {
            if (!tag) {
                return { text: '', start: -1 };
            }

            return {
                text: `${text.substring(tag.container.start, tag.container.end)}\n\n`,
                start: tag.container.start,
            };
        }
    }

    function createComponentImportTextEdit(): TextEdit {
        const startPos = (svelteDoc.script || svelteDoc.moduleScript)?.startPos;
        const importText = `\n  import NewComponent from './NewComponent.svelte';\n`;
        return TextEdit.insert(
            startPos || Position.create(0, 0),
            startPos ? importText : `<script>\n${importText}</script>`,
        );
    }
}
