import ts from 'typescript';
import {
    Position,
    SignatureHelpContext,
    SignatureHelp,
    SignatureHelpTriggerKind,
    SignatureInformation,
    ParameterInformation,
    MarkupKind
} from 'vscode-languageserver';
import { SignatureHelpProvider } from '../..';
import { Document } from '../../../lib/documents';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { getMarkdownDocumentation } from '../previewer';

export class SignatureHelpProviderImpl implements SignatureHelpProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    private static readonly triggerCharacters = ['(', ',', '<'];
    private static readonly retriggerCharacters = [')'];

    async getSignatureHelp(
        document: Document,
        position: Position,
        context: SignatureHelpContext | undefined
    ): Promise<SignatureHelp | null> {
        const { lang, tsDoc } = this.lsAndTsDocResolver.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();

        const offset = fragment.offsetAt(fragment.getGeneratedPosition(position));
        const triggerReason = this.toTsTriggerReason(context);
        const info = lang.getSignatureHelpItems(
            tsDoc.filePath,
            offset,
            triggerReason ? { triggerReason } : undefined
        );
        if (
            !info ||
            info.items.some((signature) => this.isInSvelte2tsxGeneratedFunction(signature))
        ) {
            return null;
        }

        const signatures = info.items.map(this.toSignatureHelpInformation);

        return {
            signatures,
            activeSignature: info.selectedItemIndex,
            activeParameter: info.argumentIndex
        };
    }

    private isReTrigger(
        isRetrigger: boolean,
        triggerCharacter: string
    ): triggerCharacter is ts.SignatureHelpRetriggerCharacter {
        return (
            isRetrigger &&
            (this.isTriggerCharacter(triggerCharacter) ||
                SignatureHelpProviderImpl.retriggerCharacters.includes(triggerCharacter))
        );
    }

    private isTriggerCharacter(
        triggerCharacter: string
    ): triggerCharacter is ts.SignatureHelpTriggerCharacter {
        return SignatureHelpProviderImpl.triggerCharacters.includes(triggerCharacter);
    }

    /**
     * adopted from https://github.com/microsoft/vscode/blob/265a2f6424dfbd3a9788652c7d376a7991d049a3/extensions/typescript-language-features/src/languageFeatures/signatureHelp.ts#L103
     */
    private toTsTriggerReason(
        context: SignatureHelpContext | undefined
    ): ts.SignatureHelpTriggerReason {
        switch (context?.triggerKind) {
            case SignatureHelpTriggerKind.TriggerCharacter:
                if (context.triggerCharacter) {
                    if (this.isReTrigger(context.isRetrigger, context.triggerCharacter)) {
                        return { kind: 'retrigger', triggerCharacter: context.triggerCharacter };
                    }
                    if (this.isTriggerCharacter(context.triggerCharacter)) {
                        return {
                            kind: 'characterTyped',
                            triggerCharacter: context.triggerCharacter
                        };
                    }
                }
                return { kind: 'invoked' };
            case SignatureHelpTriggerKind.ContentChange:
                return context.isRetrigger ? { kind: 'retrigger' } : { kind: 'invoked' };

            case SignatureHelpTriggerKind.Invoked:
            default:
                return { kind: 'invoked' };
        }
    }

    /**
     * adopted from https://github.com/microsoft/vscode/blob/265a2f6424dfbd3a9788652c7d376a7991d049a3/extensions/typescript-language-features/src/languageFeatures/signatureHelp.ts#L73
     */
    private toSignatureHelpInformation(item: ts.SignatureHelpItem): SignatureInformation {
        const [prefixLabel, separatorLabel, suffixLabel] = [
            item.prefixDisplayParts,
            item.separatorDisplayParts,
            item.suffixDisplayParts
        ].map(ts.displayPartsToString);

        let textIndex = prefixLabel.length;
        let signatureLabel = '';
        const parameters: ParameterInformation[] = [];
        const lastIndex = item.parameters.length - 1;

        item.parameters.forEach((parameter, index) => {
            const label = ts.displayPartsToString(parameter.displayParts);

            const startIndex = textIndex;
            const endIndex = textIndex + label.length;
            const doc = ts.displayPartsToString(parameter.documentation);

            signatureLabel += label;
            parameters.push(ParameterInformation.create([startIndex, endIndex], doc));

            if (index < lastIndex) {
                textIndex = endIndex + separatorLabel.length;
                signatureLabel += separatorLabel;
            }
        });
        const signatureDocumentation = getMarkdownDocumentation(
            item.documentation,
            item.tags.filter((tag) => tag.name !== 'param')
        );

        return {
            label: prefixLabel + signatureLabel + suffixLabel,
            documentation: signatureDocumentation
                ? {
                      value: signatureDocumentation,
                      kind: MarkupKind.Markdown
                  }
                : undefined,
            parameters
        };
    }

    private isInSvelte2tsxGeneratedFunction(signatureHelpItem: ts.SignatureHelpItem) {
        return signatureHelpItem.prefixDisplayParts.some((part) =>
            part.text.includes('__sveltets')
        );
    }
}
