import {
    Definition,
    DefinitionLink,
    Hover,
    InlayHint,
    Location,
    MarkedString,
    MarkupContent,
    SignatureHelp
} from 'vscode-languageserver';
import {
    isGeneratedIdentifier,
    isSvelte2tsxShimUri,
    replaceGeneratedNames
} from './generatedNames';

/**
 * Transformations of TS7 language feature responses for Svelte files that don't need the document.
 * (TS7 already hides most generated code via the span feature masks of the content mapper,
 * these handle what's left.)
 */

/**
 * Typing inside `{#each [1, 2] ...}` or inside a component prop shows the signature of the
 * generated wrapper (`__sveltets_2_ensureArray(array: ...)`, `$$_xyz(options: ComponentConstructorOptions<...>)`).
 */
export function transformSignatureHelp(result: SignatureHelp | null): SignatureHelp | null {
    if (!result?.signatures.length) {
        return result;
    }

    const activeSignature = result.signatures[result.activeSignature ?? 0];
    const signatures = result.signatures.filter(
        (signature) => !isGeneratedIdentifier(getSignatureName(signature.label))
    );
    if (signatures.length === result.signatures.length) {
        return result;
    }
    if (!signatures.length) {
        return null;
    }

    const activeIndex = signatures.indexOf(activeSignature);
    return {
        ...result,
        signatures,
        activeSignature: activeIndex === -1 ? 0 : activeIndex
    };
}

function getSignatureName(label: string) {
    return label.slice(0, label.search(/[(<]|$/)).trim();
}

const generatedDeclarationRegex =
    /^(?:\([\w\s]+\)\s+)*(?:function|const|let|var|class|type|interface|namespace)?\s*([\w$]+)/;

/**
 * - `Child__SvelteComponent_` -> `Child` (hover on a component tag)
 * - hovers for generated declarations are dropped
 */
export function transformHover(result: Hover | null): Hover | null {
    if (!result) {
        return result;
    }

    const contents = result.contents;
    if (isGeneratedDeclarationHover(contents)) {
        return null;
    }

    return { ...result, contents: mapHoverContents(contents, replaceGeneratedNames) };
}

function isGeneratedDeclarationHover(contents: Hover['contents']): boolean {
    const text = getFirstCodeLine(contents);
    const name = text && generatedDeclarationRegex.exec(text)?.[1];
    return !!name && isGeneratedIdentifier(name) && !name.endsWith('__SvelteComponent_');
}

function getFirstCodeLine(contents: Hover['contents']): string | undefined {
    const first = Array.isArray(contents) ? contents[0] : contents;
    if (!first) {
        return;
    }
    if (typeof first === 'string') {
        return first.match(/```\w*\n(.*)/)?.[1] ?? first.split('\n')[0];
    }
    if (MarkupContent.is(first)) {
        return first.value.match(/```\w*\n(.*)/)?.[1] ?? first.value.split('\n')[0];
    }
    return first.value.split('\n')[0];
}

function mapHoverContents(
    contents: Hover['contents'],
    map: (text: string) => string
): Hover['contents'] {
    const mapMarked = (value: MarkedString): MarkedString =>
        typeof value === 'string' ? map(value) : { ...value, value: map(value.value) };

    if (Array.isArray(contents)) {
        return contents.map(mapMarked);
    }
    if (MarkupContent.is(contents)) {
        return { ...contents, value: map(contents.value) };
    }
    return mapMarked(contents);
}

/**
 * A node that's split into several spans by the content mapper gets one hint per span
 * (e.g. `{add(item, index)}` inside `{#each}` gets the parameter name hints three times).
 */
export function transformInlayHints(result: InlayHint[] | null): InlayHint[] | null {
    if (!result?.length) {
        return result;
    }
    const seen = new Set<string>();
    return result.filter((hint) => {
        const label =
            typeof hint.label === 'string' ? hint.label : hint.label.map((p) => p.value).join('');
        const key = JSON.stringify([
            hint.position.line,
            hint.position.character,
            hint.kind,
            label,
            hint.paddingLeft,
            hint.paddingRight
        ]);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

type LocationsResult = Definition | DefinitionLink[] | Location[] | null;

/**
 * Drops locations inside svelte2tsx's shim files (users can't do anything with them) and
 * dedupes identical locations.
 */
export function transformLocations<T extends LocationsResult>(result: T): T {
    if (!result) {
        return result;
    }
    if (!Array.isArray(result)) {
        return (isSvelte2tsxShimUri(result.uri) ? null : result) as T;
    }

    const seen = new Set<string>();
    return (result as Array<Location | DefinitionLink>).filter((location) => {
        const uri = 'targetUri' in location ? location.targetUri : location.uri;
        if (isSvelte2tsxShimUri(uri)) {
            return false;
        }
        const range = 'targetUri' in location ? location.targetSelectionRange : location.range;
        const key = JSON.stringify([uri, range]);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    }) as T;
}
