import {
    DocumentHighlight,
    DocumentHighlightKind,
    Position,
    Range
} from 'vscode-languageserver-types';
import { Document, TagInformation } from '../documents';

export function wordHighlightForTag(
    document: Document,
    position: Position,
    tag: TagInformation | null,
    wordPattern: RegExp
): DocumentHighlight[] | null {
    if (!tag || tag.start === tag.end) {
        return null;
    }

    const offset = document.offsetAt(position);

    const text = document.getText();
    if (
        offset < tag.start ||
        offset > tag.end ||
        // empty before and after the cursor
        !text.slice(offset - 1, offset + 1).trim()
    ) {
        return null;
    }

    const word = wordAt(document, position, wordPattern);
    if (!word) {
        return null;
    }

    const searching = document.getText().slice(tag.start, tag.end);

    const highlights: DocumentHighlight[] = [];

    let index = 0;
    while (index < searching.length) {
        index = searching.indexOf(word, index);
        if (index === -1) {
            break;
        }

        const start = tag.start + index;
        highlights.push({
            range: {
                start: document.positionAt(start),
                end: document.positionAt(start + word.length)
            },
            kind: DocumentHighlightKind.Text
        });

        index += word.length;
    }

    return highlights;
}

function wordAt(document: Document, position: Position, wordPattern: RegExp): string | null {
    const line = document
        .getText(
            Range.create(Position.create(position.line, 0), Position.create(position.line + 1, 0))
        )
        .trimEnd();

    wordPattern.lastIndex = 0;

    let start: number | undefined;
    let end: number | undefined;
    const matchEnd = Math.min(position.character, line.length);
    while (wordPattern.lastIndex < matchEnd) {
        const match = wordPattern.exec(line);
        if (!match) {
            break;
        }

        start = match.index;
        end = match.index + match[0].length;
    }

    if (start === undefined || end === undefined || end < position.character) {
        return null;
    }

    return line.slice(start, end);
}
