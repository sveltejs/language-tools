import ts, { ArrowFunction } from 'typescript';
import { CancellationToken } from 'vscode-languageserver';
import {
    Position,
    Range,
    InlayHint,
    InlayHintKind,
    InlayHintLabelPart
} from 'vscode-languageserver-types';
import { Document, isInTag, mapLocationToOriginal } from '../../../lib/documents';
import { getAttributeContextAtPosition } from '../../../lib/documents/parseHtml';
import { InlayHintProvider } from '../../interfaces';
import { DocumentSnapshot, SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import {
    findContainingNode,
    isInGeneratedCode,
    findChildOfKind,
    findRenderFunction,
    SnapshotMap,
    startsWithIgnoredPosition
} from './utils';
import { convertRange, isSvelte2tsxShimFile } from '../utils';

export class InlayHintProviderImpl implements InlayHintProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async getInlayHints(
        document: Document,
        range: Range,
        cancellationToken?: CancellationToken
    ): Promise<InlayHint[] | null> {
        // Don't sync yet so we can skip TypeScript's synchronizeHostData if inlay hints are disabled
        const { userPreferences } =
            await this.lsAndTsDocResolver.getLsForSyntheticOperations(document);

        if (
            cancellationToken?.isCancellationRequested ||
            !this.areInlayHintsEnabled(userPreferences)
        ) {
            return null;
        }

        const { tsDoc, lang, lsContainer } = await this.lsAndTsDocResolver.getLSAndTSDoc(document);

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

        const snapshotMap = new SnapshotMap(this.lsAndTsDocResolver, lsContainer);
        snapshotMap.set(tsDoc.filePath, tsDoc);

        const convertPromises = inlayHints
            .filter(
                (inlayHint) =>
                    !isInGeneratedCode(tsDoc.getFullText(), inlayHint.position) &&
                    inlayHint.position !== renderFunctionReturnTypeLocation &&
                    !this.isSvelte2tsxFunctionHints(sourceFile, inlayHint) &&
                    !this.isGeneratedVariableTypeHint(sourceFile, inlayHint) &&
                    !this.isGeneratedAsyncFunctionReturnType(sourceFile, inlayHint) &&
                    !this.isGeneratedFunctionReturnType(sourceFile, inlayHint)
            )
            .map(async (inlayHint) => ({
                label: await this.convertInlayHintLabelParts(inlayHint, snapshotMap),
                position: this.getOriginalPosition(document, tsDoc, inlayHint),
                kind: this.convertInlayHintKind(inlayHint.kind),
                paddingLeft: inlayHint.whitespaceBefore,
                paddingRight: inlayHint.whitespaceAfter
            }));

        return (await Promise.all(convertPromises)).filter(
            (inlayHint) =>
                inlayHint.position.line >= 0 &&
                inlayHint.position.character >= 0 &&
                !this.checkGeneratedFunctionHintWithSource(inlayHint, document)
        );
    }

    private areInlayHintsEnabled(preferences: ts.UserPreferences) {
        return (
            preferences.includeInlayParameterNameHints === 'literals' ||
            preferences.includeInlayParameterNameHints === 'all' ||
            preferences.includeInlayEnumMemberValueHints ||
            preferences.includeInlayFunctionLikeReturnTypeHints ||
            preferences.includeInlayFunctionParameterTypeHints ||
            preferences.includeInlayPropertyDeclarationTypeHints ||
            preferences.includeInlayVariableTypeHints
        );
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

    private async convertInlayHintLabelParts(inlayHint: ts.InlayHint, snapshotMap: SnapshotMap) {
        if (!inlayHint.displayParts) {
            return inlayHint.text;
        }

        const convertPromises = inlayHint.displayParts.map(
            async (part): Promise<InlayHintLabelPart> => {
                if (!part.file || !part.span) {
                    return {
                        value: part.text
                    };
                }

                const snapshot = await snapshotMap.retrieve(part.file);
                if (!snapshot) {
                    return {
                        value: part.text
                    };
                }

                const originalLocation = mapLocationToOriginal(
                    snapshot,
                    convertRange(snapshot, part.span)
                );

                return {
                    value: part.text,
                    location: originalLocation.range.start.line < 0 ? undefined : originalLocation
                };
            }
        );

        const parts = await Promise.all(convertPromises);

        return parts;
    }

    private getOriginalPosition(
        document: Document,
        tsDoc: SvelteDocumentSnapshot,
        inlayHint: ts.InlayHint
    ): Position {
        let originalPosition = tsDoc.getOriginalPosition(tsDoc.positionAt(inlayHint.position));
        if (inlayHint.kind === ts.InlayHintKind.Type) {
            const originalOffset = document.offsetAt(originalPosition);
            const source = document.getText();
            // detect if inlay hint position is off by one
            // by checking if source[offset] is part of an identifier
            // https://github.com/sveltejs/language-tools/pull/2070
            if (
                originalOffset < source.length &&
                !/[\x00-\x23\x25-\x2F\x3A-\x40\x5B\x5D-\x5E\x60\x7B-\x7F]/.test(
                    source[originalOffset]
                )
            ) {
                originalPosition.character += 1;
            }
        }

        return originalPosition;
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

        if (inlayHint.displayParts?.some((v) => isSvelte2tsxShimFile(v.file))) {
            return true;
        }

        const hasParameterWithSamePosition = (node: ts.CallExpression | ts.NewExpression) =>
            node.arguments !== undefined &&
            node.arguments.some((arg) => arg.getStart() === inlayHint.position);

        const node = findContainingNode(
            sourceFile,
            { start: inlayHint.position, length: 0 },
            (node): node is ts.CallExpression | ts.NewExpression =>
                ts.isCallOrNewExpression(node) && hasParameterWithSamePosition(node)
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

        if (startsWithIgnoredPosition(sourceFile.text, inlayHint.position)) {
            return true;
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

    /** `true` if is one of the `async () => {...}` functions svelte2tsx generates */
    private isGeneratedAsyncFunctionReturnType(sourceFile: ts.SourceFile, inlayHint: ts.InlayHint) {
        if (inlayHint.kind !== ts.InlayHintKind.Type) {
            return false;
        }

        const expression = findContainingNode(
            sourceFile,
            { start: inlayHint.position, length: 0 },
            (node): node is ArrowFunction => ts.isArrowFunction(node)
        );

        if (
            !expression?.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ||
            !expression.parent?.parent ||
            !ts.isBlock(expression.parent.parent)
        ) {
            return false;
        }

        return this.getTypeAnnotationPosition(expression) === inlayHint.position;
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
