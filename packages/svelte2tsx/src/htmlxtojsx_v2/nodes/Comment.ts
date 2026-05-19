import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';
import { TransformationArray } from '../utils/node-utils';

/**
 * Removes comment altogether as it's unimportant for the output
 */
export function handleComment(str: MagicString, node: BaseNode): void {
    str.overwrite(node.start, node.end, '', { contentOnly: true });
}

/**
 * Handles comments that are directly before an element start tag and output them into the generated code as leading comments for the given node.
 * @param str The MagicString instance to operate on
 * @param node The node above which should be searched for a comment
 * @param ast The full Svelte AST
 */
export function handleLeadingStartComment(
    str: MagicString,
    node: BaseNode & { leadingComments?: BaseNode[] },
    ast: BaseNode
): void {
    const comments = ast._comments ?? [];
    if (!comments.length || node.leadingComments?.length) {
        return;
    }

    const leadingComments: BaseNode[] = [];
    let searchEnd = node.start;

    for (let i = comments.length - 1; i >= 0; i--) {
        const comment = comments[i];

        if (comment.end > searchEnd) {
            continue;
        }

        if (!/^\s*$/.test(str.original.slice(comment.end, searchEnd))) {
            break;
        }

        leadingComments.unshift(comment);
        searchEnd = comment.start;
    }

    if (leadingComments.length) {
        for (const leading of leadingComments) {
            if (
                /\n[ \t]*$/.test(
                    str.original.slice(Math.max(leading.start - 100, 0), leading.start)
                )
            ) {
                leading.newline = true;
            }
        }

        node.leadingComments = leadingComments;
    }
}

/**
 * Handles comments that are directly after the last node inside an element/component start tag
 * and output them into the generated code as trailing comments for the given node.
 */
export function handleTrailingEndComment(
    str: MagicString,
    node: BaseNode & { trailingComments?: BaseNode[] },
    parent: BaseNode,
    ast: BaseNode
): void {
    const comments = ast._comments ?? [];
    const attributes = parent.attributes as BaseNode[] | undefined;

    if (!comments.length || node.trailingComments?.length || !attributes?.length) {
        return;
    }

    if (attributes[attributes.length - 1] !== node) {
        return;
    }

    const tag_end = str.original.indexOf('>', node.end);
    if (tag_end < 0) {
        return;
    }

    const trailingComments: BaseNode[] = [];
    let searchStart = node.end;

    for (const comment of comments) {
        if (comment.start < searchStart) {
            continue;
        }

        if (comment.end > tag_end) {
            break;
        }

        if (!/^\s*$/.test(str.original.slice(searchStart, comment.start))) {
            break;
        }

        trailingComments.push(comment);
        searchStart = comment.end;
    }

    if (!trailingComments.length) {
        return;
    }

    if (!/^\s*\/?\s*$/.test(str.original.slice(searchStart, tag_end))) {
        return;
    }

    for (const trailing of trailingComments) {
        if (
            /\n[ \t]*$/.test(str.original.slice(Math.max(trailing.start - 100, 0), trailing.start))
        ) {
            trailing.newline = true;
        }
    }

    node.trailingComments = trailingComments;
}

export function getLeadingCommentTransformation(
    node: BaseNode & { leadingComments?: BaseNode[] }
): TransformationArray {
    if (!node.leadingComments?.length) {
        return [];
    }

    const transformations: TransformationArray = [];
    for (const comment of node.leadingComments) {
        if (comment.newline) transformations.push('\n');
        transformations.push([comment.start, comment.end]);
    }
    transformations.push('\n');
    return transformations;
}

export function getTrailingCommentTransformation(
    node: BaseNode & { trailingComments?: BaseNode[] }
): TransformationArray {
    if (!node.trailingComments?.length) {
        return [];
    }

    const transformations: TransformationArray = [];
    for (const comment of node.trailingComments) {
        transformations.push(comment.newline ? '\n' : ' ');
        transformations.push([comment.start, comment.end]);
    }
    transformations.push('\n');
    return transformations;
}
