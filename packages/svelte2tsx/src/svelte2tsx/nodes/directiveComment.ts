import ts from 'typescript';

export function extractTsCheckComment(scriptTagContent: string): string[] {
    const topOfFileDirectives: string[] = [];
    ts.forEachLeadingCommentRange(scriptTagContent, 0, (pos, end, kind) => {
        if (kind !== ts.SyntaxKind.SingleLineCommentTrivia) {
            return;
        }

        let start = pos + 2;
        let charCode = scriptTagContent.charCodeAt(start);
        while (ts.isWhiteSpaceLike(charCode)) {
            start++;
            charCode = scriptTagContent.charCodeAt(start);
        }

        if (charCode !== 64 /* '@' */) {
            return;
        }

        const directiveName = extractDirectiveName(scriptTagContent, start + 1, end);
        if (directiveName === 'ts-check' || directiveName === 'ts-nocheck') {
            topOfFileDirectives.push('// @' + directiveName);
        }
    });

    return topOfFileDirectives;
}

function extractDirectiveName(scriptTagContent: string, start: number, end: number): string {
    let pos = start;
    while (pos < end) {
        const charCode = scriptTagContent.charCodeAt(pos);
        if ((charCode > 96 /* 'a' */ && charCode < 123) /* 'z' */ || charCode === 45 /* '-' */) {
            pos++;
            continue;
        }
        break;
    }
    return scriptTagContent.slice(start, pos);
}
