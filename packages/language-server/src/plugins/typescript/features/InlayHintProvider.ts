import ts from 'typescript';
import { Range, InlayHint, InlayHintKind } from 'vscode-languageserver-types';
import { Document, isInTag } from '../../../lib/documents';
import { getAttributeContextAtPosition } from '../../../lib/documents/parseHtml';
import { InlayHintProvider } from '../../interfaces';
import { DocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import {
    findContainingNode,
    isInGeneratedCode,
    findChildOfKind,
    findRenderFunction,
    findClosestContainingNode
} from './utils';

export class InlayHintProviderImpl implements InlayHintProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async getInlayHints(document: Document, range: Range): Promise<InlayHint[] | null> {
        const { lang, tsDoc, userPreferences } = await this.lsAndTsDocResolver.getLSAndTSDoc(
            document
        );

        const inlayHints = lang.provideInlayHints(
            tsDoc.filePath,
            this.convertToTargetTextSpan(range, tsDoc),
            userPreferences
        );

        const sourceFile = lang.getProgram()?.getSourceFile(tsDoc.filePath);

        if (!sourceFile) {
            return [];
        }

        const renderFunction = findRenderFunction(sourceFile);
        const renderFunctionReturnTypeLocation =
            renderFunction && this.getTypeAnnotationPosition(renderFunction);

        const result = inlayHints
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
                (inlayHint) =>
                    inlayHint.position.line >= 0 &&
                    inlayHint.position.character >= 0 &&
                    !this.checkGeneratedFunctionHintWithSource(inlayHint, document)
            );

        return result;
    }

    private convertToTargetTextSpan(range: Range, snapshot: DocumentSnapshot) {
        const generatedStartOffset = snapshot.getGeneratedPosition(range.start);
        const generatedEndOffset = snapshot.getGeneratedPosition(range.end);

        const start = generatedStartOffset.line < 0 ? 0 : snapshot.offsetAt(generatedStartOffset);
        const end =
            generatedEndOffset.line < 0
                ? snapshot.getLength()
                : snapshot.offsetAt(generatedEndOffset);

        return {
            start,
            length: end - start
        };
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

        const node = findClosestContainingNode(
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

        // $$_tnenopmoC, $$_value, $$props, $$slots, $$restProps...
        return (
            isInGeneratedCode(sourceFile.text, declaration.pos) ||
            declaration.name.getText().startsWith('$$')
        );
    }

    private isGeneratedFunctionReturnType(sourceFile: ts.SourceFile, inlayHint: ts.InlayHint) {
        if (inlayHint.kind !== ts.InlayHintKind.Type) {
            return false;
        }

        // $: a = something
        // it's always top level and shouldn't be under other function call
        // so we don't need to use findClosestContainingNode
        const expression = findContainingNode(
            sourceFile,
            { start: inlayHint.position, length: 0 },
            (node): node is IdentifierCallExpression =>
                ts.isCallExpression(node) && ts.isIdentifier(node.expression)
        );

        if (!expression) {
            return false;
        }

        return (
            expression.expression.text === '__sveltets_2_invalidate' &&
            ts.isArrowFunction(expression.arguments[0]) &&
            this.getTypeAnnotationPosition(expression.arguments[0]) === inlayHint.position
        );
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

    private checkGeneratedFunctionHintWithSource(inlayHint: InlayHint, document: Document) {
        if (isInTag(inlayHint.position, document.moduleScriptInfo)) {
            return false;
        }

        if (isInTag(inlayHint.position, document.scriptInfo)) {
            return document
                .getText()
                .slice(document.offsetAt(inlayHint.position))
                .trimStart()
                .startsWith('$:');
        }

        const attributeContext = getAttributeContextAtPosition(document, inlayHint.position);

        if (!attributeContext || attributeContext.inValue || !attributeContext.name.includes(':')) {
            return false;
        }

        const { name, elementTag } = attributeContext;

        // <div on:click>
        if (name.startsWith('on:') && !elementTag.attributes?.[attributeContext.name]) {
            return true;
        }

        const directives = ['in', 'out', 'animate', 'transition', 'use'];

        // hide
        // - transitionCall: for __sveltets_2_ensureTransition
        // - tag: for svelteHTML.mapElementTag inside transition call and action call
        // - animationCall: for __sveltets_2_ensureAnimation
        // - actionCall for __sveltets_2_ensureAction
        return directives.some((directive) => name.startsWith(directive + ':'));
    }
}

interface IdentifierCallExpression extends ts.CallExpression {
    expression: ts.Identifier;
}
