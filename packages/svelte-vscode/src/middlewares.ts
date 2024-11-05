import { Location, Range, Uri } from 'vscode';
import { Middleware, Location as LSLocation } from 'vscode-languageclient';

/**
 * Reference-like code lens require a client command to be executed.
 * There isn't a way to request client to show references from the server.
 * If other clients want to show references, they need to have a similar middleware to resolve the code lens.
 */
export const resolveCodeLensMiddleware: Middleware['resolveCodeLens'] = async function (
    resolving,
    token,
    next
) {
    const codeLen = await next(resolving, token);
    if (!codeLen) {
        return resolving;
    }

    if (codeLen.command?.arguments?.length !== 3) {
        return codeLen;
    }

    const locations = codeLen.command.arguments[2] as LSLocation[];
    codeLen.command.command = locations.length > 0 ? 'editor.action.showReferences' : '';
    codeLen.command.arguments = [
        Uri.parse(codeLen?.command?.arguments[0]),
        codeLen.range.start,
        locations.map(
            (l) =>
                new Location(
                    Uri.parse(l.uri),
                    new Range(
                        l.range.start.line,
                        l.range.start.character,
                        l.range.end.line,
                        l.range.end.character
                    )
                )
        )
    ];

    return codeLen;
};
