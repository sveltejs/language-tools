import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { Hover } from 'vscode-languageserver-protocol';
export class HoverVerbosityProvider implements vscode.HoverProvider {
    private lastHoverAndLevel: [vscode.Hover, number] | undefined;
    private readonly getClient: () => LanguageClient;
    constructor(getClient: () => LanguageClient) {
        this.getClient = getClient;
    }

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context?: vscode.HoverContext
    ) {
        const verbosityLevel = Math.max(
            0,
            (this.getPreviousLevel(context?.previousHover) ?? 0) + (context?.verbosityDelta ?? 0)
        );
        const client = this.getClient();
        const response = (await client.sendRequest(
            '$/hoverVerbosity',
            {
                textDocument: { uri: document.uri.toString() },
                position: this.toProtocolPosition(position),
                context: { verbosityLevel }
            },
            token
        )) as Hover & { canIncreaseVerbosityLevel?: boolean };

        const hover = client.protocol2CodeConverter.asHover(response);


        const verboseHover = new vscode.VerboseHover(
            hover.contents,
            hover.range,
            response.canIncreaseVerbosityLevel,
            verbosityLevel !== 0
        );
        this.lastHoverAndLevel = [verboseHover, verbosityLevel];

        return verboseHover
    }

    private toProtocolPosition(position: vscode.Position) {
        return { line: position.line, character: position.character };
    }

    private getPreviousLevel(previousHover?: vscode.Hover | undefined): number | undefined {
        if (
            previousHover &&
            this.lastHoverAndLevel &&
            this.lastHoverAndLevel[0] === previousHover
        ) {
            return this.lastHoverAndLevel[1];
        }
        return 0;
    }
}
