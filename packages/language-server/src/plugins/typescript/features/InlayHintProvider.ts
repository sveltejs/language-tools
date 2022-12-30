import ts, { DocumentSpan } from 'typescript';
import { Range, InlayHint, InlayHintKind } from 'vscode-languageserver-types';
import { Document } from '../../../lib/documents';
import { InlayHintProvider } from '../../interfaces';
import { DocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertToTextSpan } from '../utils';
import {
    findContainingNode,
    isInGeneratedCode,
    findChildOfKind,
    findRenderFunction
} from './utils';

export class InlayHintProviderImpl implements InlayHintProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async getInlayHints(document: Document, range: Range): Promise<InlayHint[] | null> {
        const { lang, tsDoc, userPreferences } = await this.lsAndTsDocResolver.getLSAndTSDoc(
            document
        );

        const inlayHints = lang.provideInlayHints(
            tsDoc.filePath,
            convertToTextSpan(range, fragment),
            userPreferences
        );

        const sourceFile = lang.getProgram()?.getSourceFile(tsDoc.filePath);

        if (!sourceFile) {
            return [];
        }

        const renderFunction = findRenderFunction(sourceFile);
        const renderFunctionReturnTypeLocation =
            renderFunction && this.getTypeAnnotationPosition(renderFunction);

        return inlayHints
            .filter(
                (inlayHint) =>
                    !isInGeneratedCode(tsDoc.getFullText(), inlayHint.position) &&
                    inlayHint.position !== renderFunctionReturnTypeLocation &&
                    !this.isSvelte2tsxFunctionHints(sourceFile, inlayHint) &&
                    !this.isGeneratedVariableTypeHint(sourceFile, inlayHint) &&
                    !this.isGeneratedFunctionReturnType(sourceFile, inlayHint)
            )
            .map((inlayHint) => ({
                label: inlayHint.text,
                position: tsDoc.getOriginalPosition(tsDoc.positionAt(inlayHint.position)),
                kind: this.convertInlayHintKind(inlayHint.kind),
                paddingLeft: inlayHint.whitespaceBefore,
                paddingRight: inlayHint.whitespaceAfter
            }))
            .filter(
                (inlayHint) => inlayHint.position.line >= 0 && inlayHint.position.character >= 0
            );
    }

    private convertInlayHintKind(kind: ts.InlayHintKind): InlayHintKind | undefined {
        switch (kind) {
            case 'Parameter':
                return InlayHintKind.Parameter;
            case 'Type':
                return InlayHintKind.Type;
            case 'Enum':
                return undefined;
            default:
                return undefined;
        }
    }

    private isSvelte2tsxFunctionHints(sourceFile: ts.SourceFile, inlayHint: ts.InlayHint): boolean {
        if (inlayHint.kind !== ts.InlayHintKind.Parameter) {
            return false;
        }

        const node = findContainingNode(
            sourceFile,
            { start: inlayHint.position, length: 0 },
            ts.isCallOrNewExpression
        );

        if (!node) {
            return false;
        }

        const expressionText = node.expression.getText();
        const isComponentEventHandler = expressionText.includes('.$on');

        return (
            isComponentEventHandler ||
            expressionText.includes('.createElement') ||
            expressionText.includes('__sveltets_') ||
            expressionText.startsWith('$$_')
        );
    }

    private isGeneratedVariableTypeHint(
        sourceFile: ts.SourceFile,
        inlayHint: ts.InlayHint
    ): boolean {
        if (inlayHint.kind !== ts.InlayHintKind.Type) {
            return false;
        }

        const declaration = findContainingNode(
            sourceFile,
            { start: inlayHint.position, length: 0 },
            ts.isVariableDeclaration
        );

        if (!declaration) {
            return false;
        }

        return (
            isInGeneratedCode(sourceFile.text, declaration.pos) ||
            declaration.name.getText().startsWith('$$_')
        );
    }

    private isGeneratedFunctionReturnType(sourceFile: ts.SourceFile, inlayHint: ts.InlayHint) {
        if (inlayHint.kind !== ts.InlayHintKind.Type) {
            return false;
        }

        const expression = findContainingNode(
            sourceFile,
            { start: inlayHint.position, length: 0 },
            ts.isFunctionDeclaration
        );

        if (!expression) {
            return false;
        }

        return isInGeneratedCode(sourceFile.text, expression.pos);
    }

    private getTypeAnnotationPosition(
        decl:
            | ts.FunctionDeclaration
            | ts.ArrowFunction
            | ts.FunctionExpression
            | ts.MethodDeclaration
            | ts.GetAccessorDeclaration
    ) {
        const closeParenToken = findChildOfKind(decl, ts.SyntaxKind.CloseParenToken);
        if (closeParenToken) {
            return closeParenToken.end;
        }
        return decl.parameters.end;
    }
}
