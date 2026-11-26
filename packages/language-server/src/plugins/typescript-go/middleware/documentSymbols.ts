import { DocumentSymbol, Range, SymbolInformation, SymbolKind } from 'vscode-languageserver';
import { Document } from '../../../lib/documents';
import { TsApiAccess } from '../TsApiService';
import { TsApiLocationMapper } from '../TsApiLocationMapper';
import type { tsAst } from '../types';

/**
 * TS7 returns no document symbols for the instance script of a Svelte file. svelte2tsx puts its
 * code into `function $$render() { … }`; TS7 (`ProvideDocumentSymbols` in `tsc/internal/ls/symbols.go`)
 * drops a symbol whose name isn't mapped for `DocumentSymbols`, and with it all its children. So the
 * outline loses everything declared in `<script>` (the module script is top level and unaffected).
 *
 * This walks the virtual code like TS7 does, except that a container without a mapped name is
 * transparent: its mapped children take its place. Only symbols inside a script tag are kept (the
 * template's generated code has mapped names too, e.g. `{#each}` variables; TS6 mode filtered those
 * by a list of heuristics instead). Unnamed functions (callbacks) are skipped together with their
 * contents. Positions are mapped with the `DocumentSymbols` feature, like TS7 does.
 *
 * Upstream ask: hoist the mapped children of an unmapped container in TS7 itself. Then this is not
 * needed (`mergeDocumentSymbols` already drops what TS7 returns itself).
 */
export async function getLostDocumentSymbols(
    tsApi: TsApiAccess,
    document: Document
): Promise<DocumentSymbol[]> {
    const symbols = await tsApi.withSourceFile(document.uri, async (_project, sourceFile) => {
        if (!sourceFile.spanMap || sourceFile.originalText !== document.getText()) {
            return [];
        }
        return new SymbolCollector(tsApi.astModule, sourceFile, document).collect();
    });
    return symbols ?? [];
}

class SymbolCollector {
    private readonly mapper: TsApiLocationMapper;
    private readonly SyntaxKind: typeof tsAst.SyntaxKind;
    private readonly scriptRanges: Array<[number, number]>;

    constructor(
        private readonly ast: typeof tsAst,
        private readonly sourceFile: tsAst.SourceFile,
        document: Document
    ) {
        this.mapper = new TsApiLocationMapper(ast);
        this.SyntaxKind = ast.SyntaxKind;
        this.scriptRanges = [document.scriptInfo, document.moduleScriptInfo]
            .filter((info) => !!info)
            .map((info) => [info!.start, info!.end]);
    }

    collect(): DocumentSymbol[] {
        return this.childrenOf(this.sourceFile);
    }

    private childrenOf(node: tsAst.Node | undefined): DocumentSymbol[] {
        const symbols: DocumentSymbol[] = [];
        node?.forEachChild((child) => {
            symbols.push(...this.visit(child));
            return undefined;
        });
        return symbols;
    }

    /** Symbols for `node`: one, or (transparent node) those of its descendants */
    private visit(node: tsAst.Node): DocumentSymbol[] {
        const K = this.SyntaxKind;
        const n = node as any;
        switch (node.kind) {
            case K.ImportDeclaration:
            case K.ImportEqualsDeclaration:
                // like TS7 for top-level imports (svelte2tsx hoists them)
                return [];
            case K.ClassDeclaration:
            case K.ClassExpression:
            case K.InterfaceDeclaration:
            case K.EnumDeclaration:
                return this.symbol(node, n.name, this.childrenOf(node));
            case K.ModuleDeclaration:
                return this.symbol(node, n.name, this.childrenOf(n.body));
            case K.Constructor:
                return this.symbol(node, undefined, this.childrenOf(n.body), 'constructor');
            case K.FunctionDeclaration:
            case K.FunctionExpression:
            case K.ArrowFunction:
            case K.MethodDeclaration:
            case K.GetAccessor:
            case K.SetAccessor:
                if (!n.name) {
                    // callbacks etc.
                    return [];
                }
                return this.symbol(node, n.name, this.childrenOf(n.body));
            case K.VariableDeclaration:
            case K.BindingElement:
            case K.PropertyAssignment:
            case K.PropertyDeclaration:
                if (!n.name) {
                    return [];
                }
                if (
                    n.name.kind === K.ObjectBindingPattern ||
                    n.name.kind === K.ArrayBindingPattern
                ) {
                    return this.childrenOf(n.name);
                }
                return this.symbol(node, n.name, this.childrenOf(n.initializer));
            case K.MethodSignature:
            case K.PropertySignature:
            case K.CallSignature:
            case K.ConstructSignature:
            case K.IndexSignature:
            case K.EnumMember:
            case K.ShorthandPropertyAssignment:
            case K.TypeAliasDeclaration:
                return this.symbol(node, n.name, []);
            default:
                return this.childrenOf(node);
        }
    }

    private symbol(
        node: tsAst.Node,
        name: tsAst.Node | undefined,
        children: DocumentSymbol[],
        fallbackName?: string
    ): DocumentSymbol[] {
        const nameNode = name ?? node;
        const text =
            name && (name.kind === this.SyntaxKind.Identifier || 'text' in name)
                ? ((name as any).text ?? name.getText(this.sourceFile))
                : fallbackName;
        const nameStart = nameNode.getStart(this.sourceFile);
        const selection = this.map(nameStart, name ? nameNode.end : nameStart, true);
        if (!text || !selection || !this.isInScript(selection.start)) {
            // not shown by TS7 either: hand the children up
            return children;
        }
        const full = this.map(node.getStart(this.sourceFile), node.end, false) ?? selection;
        const toRange = (span: { start: number; end: number }) =>
            this.mapper.toRange(this.sourceFile, span.start, span.end);
        const selectionRange = toRange(selection);
        let range = toRange(full);
        if (!contains(range, selectionRange)) {
            range = selectionRange;
        }
        return [
            {
                name: text,
                kind: this.kindOf(node),
                range,
                selectionRange,
                children
            }
        ];
    }

    /** Original span; `single`: only if it maps to one segment (TS7's `IsSingleSegment`) */
    private map(start: number, end: number, single: boolean) {
        const spanMap = this.sourceFile.spanMap!;
        const mapped = spanMap.virtualToOriginalSpanForFeature(
            { pos: start, end },
            this.ast.SpanMapFeature.DocumentSymbols
        );
        const { Exact, Atom, None } = this.ast.SpanMapFidelity;
        if (
            mapped.fidelity === None ||
            (single && mapped.fidelity !== Exact && mapped.fidelity !== Atom)
        ) {
            return undefined;
        }
        return { start: mapped.range.pos, end: mapped.range.end };
    }

    private isInScript(offset: number) {
        return this.scriptRanges.some(([start, end]) => start <= offset && offset <= end);
    }

    private kindOf(node: tsAst.Node): SymbolKind {
        const K = this.SyntaxKind;
        switch (node.kind) {
            case K.ModuleDeclaration:
                return SymbolKind.Namespace;
            case K.ClassDeclaration:
            case K.ClassExpression:
            case K.TypeAliasDeclaration:
                return SymbolKind.Class;
            case K.InterfaceDeclaration:
                return SymbolKind.Interface;
            case K.EnumDeclaration:
                return SymbolKind.Enum;
            case K.ArrowFunction:
            case K.FunctionDeclaration:
            case K.FunctionExpression:
                return SymbolKind.Function;
            case K.MethodDeclaration:
            case K.MethodSignature:
            case K.CallSignature:
                return SymbolKind.Method;
            case K.GetAccessor:
            case K.SetAccessor:
            case K.PropertyDeclaration:
            case K.PropertySignature:
            case K.PropertyAssignment:
            case K.ShorthandPropertyAssignment:
            case K.IndexSignature:
                return SymbolKind.Property;
            case K.Constructor:
            case K.ConstructSignature:
                return SymbolKind.Constructor;
            case K.EnumMember:
                return SymbolKind.EnumMember;
            default:
                return SymbolKind.Variable;
        }
    }
}

function contains(outer: Range, inner: Range) {
    const before = (a: Range['start'], b: Range['start']) =>
        a.line < b.line || (a.line === b.line && a.character <= b.character);
    return before(outer.start, inner.start) && before(inner.end, outer.end);
}

function symbolKey(name: string, range: Range) {
    return `${name}|${range.start.line}:${range.start.character}`;
}

/**
 * Adds `extra` to TS7's result, skipping symbols TS7 already has (with their subtree), so this
 * keeps working once TS7 returns them itself. Flat `SymbolInformation[]` if TS7 answered flat.
 */
export function mergeDocumentSymbols(
    result: DocumentSymbol[] | SymbolInformation[] | null,
    extra: DocumentSymbol[],
    uri: string
): DocumentSymbol[] | SymbolInformation[] | null {
    if (extra.length === 0) {
        return result;
    }
    const isFlat = !!result?.length && 'location' in result[0];
    const known = new Set<string>();
    if (isFlat) {
        for (const s of result as SymbolInformation[]) {
            known.add(symbolKey(s.name, s.location.range));
        }
    } else {
        const visit = (s: DocumentSymbol) => {
            // TS7's selection range is the name, its range the declaration
            known.add(symbolKey(s.name, s.selectionRange));
            s.children?.forEach(visit);
        };
        (result as DocumentSymbol[] | null)?.forEach(visit);
    }

    const prune = (symbols: DocumentSymbol[]): DocumentSymbol[] =>
        symbols
            .filter((s) => !known.has(symbolKey(s.name, s.selectionRange)))
            .map((s) => ({ ...s, children: s.children && prune(s.children) }));
    const added = prune(extra);
    if (added.length === 0) {
        return result;
    }

    if (isFlat) {
        const flat: SymbolInformation[] = [];
        const flatten = (symbols: DocumentSymbol[], containerName?: string) => {
            for (const s of symbols) {
                flat.push({
                    name: s.name,
                    kind: s.kind,
                    location: { uri, range: s.selectionRange },
                    containerName
                });
                flatten(s.children ?? [], s.name);
            }
        };
        flatten(added);
        return [...(result as SymbolInformation[]), ...flat];
    }
    return [...((result as DocumentSymbol[] | null) ?? []), ...added];
}
