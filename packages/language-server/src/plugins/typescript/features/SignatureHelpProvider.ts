import ts from 'typescript';
import {
    Position,
    SignatureHelpContext,
    SignatureHelp,
    SignatureHelpTriggerKind,
    SignatureInformation,
    ParameterInformation
} from 'vscode-languageserver';
import { SignatureHelpProvider } from '../..';
import { Document } from '../../../lib/documents';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { getMarkdownDocumentation, plain } from '../previewer';

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

        const signatures = info.items
            .map(this.toSignatureHelpInfomation);

        return {
            signatures,
            activeSignature: info.selectedItemIndex,
            activeParameter: info.argumentIndex
        };
    }

    isReTrigger(
        isRetrigger: boolean,
        triggerCharacter: string
    ): triggerCharacter is ts.SignatureHelpRetriggerCharacter {
        return (
            isRetrigger &&
            (this.isTriggerCharacter(triggerCharacter) ||
                SignatureHelpProviderImpl.retriggerCharacters.includes(triggerCharacter))
        );
    }

    isTriggerCharacter(
        triggerCharacter: string
    ): triggerCharacter is ts.SignatureHelpTriggerCharacter {
        return SignatureHelpProviderImpl.triggerCharacters.includes(triggerCharacter);
    }

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

    private toSignatureHelpInfomation(item: ts.SignatureHelpItem): SignatureInformation {
        const [prefixLabel, seperatorLabel, suffixLabel] = [
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
            const doc = plain(parameter.documentation);

            signatureLabel += label;
            parameters.push(ParameterInformation.create([startIndex, endIndex], doc));

            if (index < lastIndex) {
                textIndex = endIndex + seperatorLabel.length;
                signatureLabel += signatureLabel;
            }
        });
        const signatureDocumentation = getMarkdownDocumentation(
            item.documentation,
            item.tags.filter((tag) => tag.name !== 'param')
        );

        return SignatureInformation.create(
            prefixLabel + signatureLabel + suffixLabel,
            signatureDocumentation,
            ...parameters
        );
    }

    private isInSvelte2tsxGeneratedFunction(
        signatureHelpItem: ts.SignatureHelpItem
    ) {
        return ts.displayPartsToString(signatureHelpItem.prefixDisplayParts)
            .includes('__sveltets');
    }
}
