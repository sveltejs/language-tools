import type ts from 'typescript/lib/tsserverlibrary';
import { SvelteSnapshot, SvelteSnapshotManager } from '../svelte-snapshots';
import {
    findNodeAtSpan,
    gatherDescendants,
    isGeneratedSvelteComponentName,
    isNotNullOrUndefined,
    isSvelteFilePath,
    offsetOfGeneratedComponentExport
} from '../utils';

const ENSURE_COMPONENT_HELPER = '__sveltets_2_ensureComponent';

export function decorateCallHierarchy(
    ls: ts.LanguageService,
    snapshotManager: SvelteSnapshotManager,
    typescript: typeof ts
): void {
    // don't need to patch prepare. It's always a ts/js file
    // const prepareCallHierarchy = ls.prepareCallHierarchy;
    const provideCallHierarchyIncomingCalls = ls.provideCallHierarchyIncomingCalls;
    const provideCallHierarchyOutgoingCalls = ls.provideCallHierarchyOutgoingCalls;

    ls.provideCallHierarchyIncomingCalls = (fileName: string, position: number) => {
        const program = ls.getProgram();
        // probably won't happen
        if (!program) {
            return provideCallHierarchyIncomingCalls(fileName, position);
        }

        const snapshot = snapshotManager.get(fileName);
        const componentExportOffset =
            isComponentModulePosition(fileName, position) && snapshot
                ? offsetOfGeneratedComponentExport(snapshot)
                : -1;
        const redirectedPosition = componentExportOffset >= 0 ? componentExportOffset : position;
        const tsResult = provideCallHierarchyIncomingCalls(fileName, redirectedPosition);

        return tsResult
            .map((item): ts.CallHierarchyIncomingCall | null => {
                if (!isSvelteFilePath(item.from.file)) {
                    return item;
                }

                const snapshot = snapshotManager.get(item.from.file);
                const from = convertSvelteCallHierarchyItem(item.from, program);

                if (!from || !snapshot) {
                    return null;
                }

                const fromSpans = item.fromSpans
                    .map((span) => snapshot.getOriginalTextSpan(span))
                    .filter(isNotNullOrUndefined);

                return {
                    from,
                    fromSpans: fromSpans
                };
            })
            .concat(getInComingCallsForComponent(ls, program, fileName, redirectedPosition) ?? [])
            .filter(isNotNullOrUndefined);
    };

    ls.provideCallHierarchyOutgoingCalls = (fileName: string, position: number) => {
        const program = ls.getProgram();
        // probably won't happen
        if (!program) {
            return provideCallHierarchyOutgoingCalls(fileName, position);
        }

        const sourceFile = program?.getSourceFile(fileName);
        const renderFunctionOffset =
            isComponentModulePosition(fileName, position) && sourceFile
                ? sourceFile.statements
                      .find(
                          (statement): statement is ts.FunctionDeclaration =>
                              typescript.isFunctionDeclaration(statement) &&
                              statement.name?.getText() === 'render'
                      )
                      ?.name?.getStart()
                : -1;
        const offset =
            renderFunctionOffset != null && renderFunctionOffset >= 0
                ? renderFunctionOffset
                : position;
        const snapshot = snapshotManager.get(fileName);

        return provideCallHierarchyOutgoingCalls(fileName, offset)
            .concat(
                program && sourceFile && isComponentModulePosition(fileName, position)
                    ? (getOutgoingCallsForComponent(program, sourceFile) ?? [])
                    : []
            )
            .map((item): ts.CallHierarchyOutgoingCall | null => {
                const to = convertSvelteCallHierarchyItem(item.to, program);

                if (
                    !to ||
                    item.to.name.startsWith('__sveltets') ||
                    item.to.containerName === 'svelteHTML'
                ) {
                    return null;
                }

                const fromSpans = snapshot
                    ? item.fromSpans
                          .map((span) => snapshot.getOriginalTextSpan(span))
                          .filter(isNotNullOrUndefined)
                    : item.fromSpans;

                if (!fromSpans.length) {
                    return null;
                }

                return {
                    to,
                    fromSpans
                };
            })
            .filter(isNotNullOrUndefined);
    };

    function isComponentModulePosition(fileName: string, position: number) {
        return isSvelteFilePath(fileName) && position === 0;
    }

    function convertSvelteCallHierarchyItem(
        item: ts.CallHierarchyItem,
        program: ts.Program
    ): ts.CallHierarchyItem | null {
        if (!isSvelteFilePath(item.file)) {
            return item;
        }

        const snapshot = snapshotManager.get(item.file);
        if (!snapshot) {
            return null;
        }

        const redirectedCallHierarchyItem = redirectSvelteCallHierarchyItem(
            snapshot,
            program,
            item
        );

        if (redirectedCallHierarchyItem) {
            return redirectedCallHierarchyItem;
        }

        const selectionSpan = snapshot.getOriginalTextSpan(item.selectionSpan);

        if (!selectionSpan) {
            return null;
        }

        const span = snapshot.getOriginalTextSpan(item.span);
        if (!span) {
            return null;
        }

        return {
            ...item,
            span,
            selectionSpan
        };
    }

    function redirectSvelteCallHierarchyItem(
        snapshot: SvelteSnapshot,
        program: ts.Program,
        item: ts.CallHierarchyItem
    ): ts.CallHierarchyItem | null {
        const sourceFile = program.getSourceFile(item.file);

        if (!sourceFile) {
            return null;
        }

        if (isGeneratedSvelteComponentName(item.name)) {
            return toComponentCallHierarchyItem(snapshot, item.file);
        }

        if (item.name === 'render') {
            const end = item.selectionSpan.start + item.selectionSpan.length;
            const renderFunction = sourceFile.statements.find(
                (statement) =>
                    statement.getStart() <= item.selectionSpan.start && statement.getEnd() >= end
            );
            if (!renderFunction || !sourceFile.statements.includes(renderFunction)) {
                return null;
            }
            return toComponentCallHierarchyItem(snapshot, item.file);
        }

        return null;
    }

    function toComponentCallHierarchyItem(
        snapshot: SvelteSnapshot,
        file: string
    ): ts.CallHierarchyItem {
        const fileSpan = { start: 0, length: snapshot.getOriginalText().length };

        return {
            kind: typescript.ScriptElementKind.moduleElement,
            file: file,
            name: '',
            selectionSpan: { start: 0, length: 0 },
            span: fileSpan
        };
    }

    function getInComingCallsForComponent(
        ls: ts.LanguageService,
        program: ts.Program,
        fileName: string,
        position: number
    ): ts.CallHierarchyIncomingCall[] | null {
        if (!isSvelteFilePath(fileName)) {
            return null;
        }

        return (
            ls
                .findReferences(fileName, position)
                ?.map((ref) => componentRefToIncomingCall(ref, program))
                .filter(isNotNullOrUndefined) ?? null
        );
    }

    function componentRefToIncomingCall(
        ref: ts.ReferencedSymbol,
        program: ts.Program
    ): ts.CallHierarchyIncomingCall | null {
        const snapshot =
            isSvelteFilePath(ref.definition.fileName) &&
            snapshotManager.get(ref.definition.fileName);
        const sourceFile = program.getSourceFile(ref.definition.fileName);

        if (!snapshot || !sourceFile) {
            return null;
        }

        const startTags = ref.references
            .map((ref) => {
                const generatedTextSpan = snapshot.getGeneratedTextSpan(ref.textSpan);
                const node =
                    generatedTextSpan &&
                    findNodeAtSpan(sourceFile, generatedTextSpan, isComponentStartTag);

                if (node) {
                    return ref;
                }

                return null;
            })
            .filter(isNotNullOrUndefined);

        if (!startTags.length) {
            return null;
        }

        return {
            from: toComponentCallHierarchyItem(snapshot, ref.definition.fileName),
            fromSpans: startTags.map((tag) => tag.textSpan)
        };
    }

    function isComponentStartTag(node: ts.Node | undefined): node is ts.Identifier {
        return (
            !!node &&
            node.parent &&
            typescript.isCallExpression(node.parent) &&
            typescript.isIdentifier(node.parent.expression) &&
            node.parent.expression.text === ENSURE_COMPONENT_HELPER &&
            typescript.isIdentifier(node) &&
            node === node.parent.arguments[0]
        );
    }

    function getOutgoingCallsForComponent(
        program: ts.Program,
        sourceFile: ts.SourceFile
    ): ts.CallHierarchyOutgoingCall[] | null {
        const groups = new Map<ts.ClassDeclaration, ts.TextSpan[]>();

        const startTags = gatherDescendants(sourceFile, isComponentStartTag);
        const typeChecker = program.getTypeChecker();

        for (const startTag of startTags) {
            const type = typeChecker.getTypeAtLocation(startTag);
            const symbol = type.aliasSymbol ?? type.symbol;
            const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];

            if (!declaration || !typescript.isClassDeclaration(declaration)) {
                continue;
            }

            let group = groups.get(declaration);

            if (!group) {
                group = [];
                groups.set(declaration, group);
            }

            group.push({ start: startTag.getStart(), length: startTag.getWidth() });
        }

        return (
            Array.from(groups).map(([declaration, group]) => {
                const file = declaration.getSourceFile().fileName;
                const name = declaration.name?.getText() ?? file.slice(file.lastIndexOf('.'));
                const span = { start: declaration.getStart(), length: declaration.getWidth() };
                const selectionSpan = declaration.name
                    ? { start: declaration.name.getStart(), length: declaration.name.getWidth() }
                    : span;

                return {
                    to: {
                        file,
                        kind: typescript.ScriptElementKind.classElement,
                        name,
                        selectionSpan,
                        span
                    },
                    fromSpans: group
                };
            }) ?? null
        );
    }
}
