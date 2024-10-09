import { Node } from 'estree-walker';
import MagicString from 'magic-string';
import { convertHtmlxToJsx } from '../htmlxtojsx_v2';
import { parseHtmlx } from '../utils/htmlxparser';
import { ComponentDocumentation } from './nodes/ComponentDocumentation';
import { ComponentEvents } from './nodes/ComponentEvents';
import { EventHandler } from './nodes/event-handler';
import { ExportedNames } from './nodes/ExportedNames';
import {
    handleScopeAndResolveForSlot,
    handleScopeAndResolveLetVarForSlot
} from './nodes/handleScopeAndResolveForSlot';
import { ImplicitStoreValues } from './nodes/ImplicitStoreValues';
import { Scripts } from './nodes/Scripts';
import { SlotHandler } from './nodes/slot';
import { Stores } from './nodes/Stores';
import TemplateScope from './nodes/TemplateScope';
import { processInstanceScriptContent } from './processInstanceScriptContent';
import { processModuleScriptTag } from './processModuleScriptTag';
import { ScopeStack } from './utils/Scope';
import { Generics } from './nodes/Generics';
import { addComponentExport } from './addComponentExport';
import { createRenderFunction } from './createRenderFunction';
// @ts-ignore
import { TemplateNode } from 'svelte/types/compiler/interfaces';
import path from 'path';
import { VERSION, parse } from 'svelte/compiler';

type TemplateProcessResult = {
    /**
     * The HTML part of the Svelte AST.
     */
    htmlAst: TemplateNode;
    uses$$props: boolean;
    uses$$restProps: boolean;
    uses$$slots: boolean;
    slots: Map<string, Map<string, string>>;
    scriptTag: Node;
    moduleScriptTag: Node;
    /** Start/end positions of snippets that should be moved to the instance script */
    rootSnippets: Array<[number, number]>;
    /** To be added later as a comment on the default class export */
    componentDocumentation: ComponentDocumentation;
    events: ComponentEvents;
    resolvedStores: string[];
    usesAccessors: boolean;
    isRunes: boolean;
};

function processSvelteTemplate(
    str: MagicString,
    parse: typeof import('svelte/compiler').parse,
    options: {
        emitOnTemplateError?: boolean;
        namespace?: string;
        accessors?: boolean;
        mode?: 'ts' | 'dts';
        typingsNamespace?: string;
        svelte5Plus: boolean;
    }
): TemplateProcessResult {
    const { htmlxAst, tags } = parseHtmlx(str.original, parse, options);

    let uses$$props = false;
    let uses$$restProps = false;
    let uses$$slots = false;
    let usesAccessors = !!options.accessors;
    let isRunes = false;

    const componentDocumentation = new ComponentDocumentation();

    //track if we are in a declaration scope
    const isDeclaration = { value: false };

    //track $store variables since we are only supposed to give top level scopes special treatment, and users can declare $blah variables at higher scopes
    //which prevents us just changing all instances of Identity that start with $

    const scopeStack = new ScopeStack();
    const stores = new Stores(scopeStack, isDeclaration);
    const scripts = new Scripts(htmlxAst);

    const handleSvelteOptions = (node: Node) => {
        for (let i = 0; i < node.attributes.length; i++) {
            const optionName = node.attributes[i].name;
            const optionValue = node.attributes[i].value;

            switch (optionName) {
                case 'accessors':
                    if (Array.isArray(optionValue)) {
                        if (optionValue[0].type === 'MustacheTag') {
                            usesAccessors = optionValue[0].expression.value;
                        }
                    } else {
                        usesAccessors = true;
                    }
                    break;
                case 'runes':
                    isRunes = true;
                    break;
            }
        }
    };

    const handleIdentifier = (node: Node) => {
        if (node.name === '$$props') {
            uses$$props = true;
            return;
        }
        if (node.name === '$$restProps') {
            uses$$restProps = true;
            return;
        }

        if (node.name === '$$slots') {
            uses$$slots = true;
            return;
        }
    };

    const handleStyleTag = (node: Node) => {
        str.remove(node.start, node.end);
    };

    const slotHandler = new SlotHandler(str.original);
    let templateScope = new TemplateScope();

    const handleEach = (node: Node) => {
        templateScope = templateScope.child();

        if (node.context) {
            handleScopeAndResolveForSlotInner(node.context, node.expression, node);
        }
    };

    const handleAwait = (node: Node) => {
        templateScope = templateScope.child();
        if (node.value) {
            handleScopeAndResolveForSlotInner(node.value, node.expression, node.then);
        }
        if (node.error) {
            handleScopeAndResolveForSlotInner(node.error, node.expression, node.catch);
        }
    };

    const handleComponentLet = (component: Node) => {
        templateScope = templateScope.child();
        const lets = slotHandler.getSlotConsumerOfComponent(component);

        for (const { letNode, slotName } of lets) {
            handleScopeAndResolveLetVarForSlot({
                letNode,
                slotName,
                slotHandler,
                templateScope,
                component
            });
        }
    };

    const handleScopeAndResolveForSlotInner = (
        identifierDef: Node,
        initExpression: Node,
        owner: Node
    ) => {
        handleScopeAndResolveForSlot({
            identifierDef,
            initExpression,
            slotHandler,
            templateScope,
            owner
        });
    };

    const eventHandler = new EventHandler();

    const onHtmlxWalk = (node: Node, parent: Node, prop: string) => {
        if (
            prop == 'params' &&
            (parent.type == 'FunctionDeclaration' || parent.type == 'ArrowFunctionExpression')
        ) {
            isDeclaration.value = true;
        }
        if (prop == 'id' && parent.type == 'VariableDeclarator') {
            isDeclaration.value = true;
        }

        switch (node.type) {
            case 'Comment':
                componentDocumentation.handleComment(node);
                break;
            case 'Options':
                handleSvelteOptions(node);
                break;
            case 'Identifier':
                handleIdentifier(node);
                stores.handleIdentifier(node, parent, prop);
                eventHandler.handleIdentifier(node, parent, prop);
                break;
            case 'Transition':
            case 'Action':
            case 'Animation':
                stores.handleDirective(node, str);
                break;
            case 'Slot':
                slotHandler.handleSlot(node, templateScope);
                break;
            case 'Style':
                handleStyleTag(node);
                break;
            case 'Element':
                scripts.checkIfElementIsScriptTag(node, parent);
                break;
            case 'RawMustacheTag':
                scripts.checkIfContainsScriptTag(node);
                break;
            case 'BlockStatement':
                scopeStack.push();
                break;
            case 'FunctionDeclaration':
                scopeStack.push();
                break;
            case 'ArrowFunctionExpression':
                scopeStack.push();
                break;
            case 'EventHandler':
                eventHandler.handleEventHandler(node, parent);
                break;
            case 'VariableDeclarator':
                isDeclaration.value = true;
                break;
            case 'EachBlock':
                handleEach(node);
                break;
            case 'AwaitBlock':
                handleAwait(node);
                break;
            case 'InlineComponent':
                handleComponentLet(node);
                break;
        }
    };

    const onHtmlxLeave = (node: Node, parent: Node, prop: string, _index: number) => {
        if (
            prop == 'params' &&
            (parent.type == 'FunctionDeclaration' || parent.type == 'ArrowFunctionExpression')
        ) {
            isDeclaration.value = false;
        }

        if (prop == 'id' && parent.type == 'VariableDeclarator') {
            isDeclaration.value = false;
        }
        const onTemplateScopeLeave = () => {
            templateScope = templateScope.parent;
        };

        switch (node.type) {
            case 'BlockStatement':
                scopeStack.pop();
                break;
            case 'FunctionDeclaration':
                scopeStack.pop();
                break;
            case 'ArrowFunctionExpression':
                scopeStack.pop();
                break;
            case 'EachBlock':
                onTemplateScopeLeave();
                break;
            case 'AwaitBlock':
                onTemplateScopeLeave();
                break;
            case 'InlineComponent':
                onTemplateScopeLeave();
                break;
        }
    };

    const rootSnippets = convertHtmlxToJsx(str, htmlxAst, onHtmlxWalk, onHtmlxLeave, {
        preserveAttributeCase: options?.namespace == 'foreign',
        typingsNamespace: options.typingsNamespace,
        svelte5Plus: options.svelte5Plus
    });

    // resolve scripts
    const { scriptTag, moduleScriptTag } = scripts.getTopLevelScriptTags();
    if (options.mode !== 'ts') {
        scripts.blankOtherScriptTags(str);
    }

    //resolve stores
    const resolvedStores = stores.getStoreNames();

    return {
        htmlAst: htmlxAst,
        moduleScriptTag,
        scriptTag,
        rootSnippets,
        slots: slotHandler.getSlotDef(),
        events: new ComponentEvents(
            eventHandler,
            tags.some((tag) => tag.attributes?.some((a) => a.name === 'strictEvents')),
            str
        ),
        uses$$props,
        uses$$restProps,
        uses$$slots,
        componentDocumentation,
        resolvedStores,
        usesAccessors,
        isRunes
    };
}

export function svelte2tsx(
    svelte: string,
    options: {
        parse?: typeof import('svelte/compiler').parse;
        version?: string;
        filename?: string;
        isTsFile?: boolean;
        emitOnTemplateError?: boolean;
        namespace?: string;
        mode?: 'ts' | 'dts';
        accessors?: boolean;
        typingsNamespace?: string;
        noSvelteComponentTyped?: boolean;
    } = { parse }
) {
    options.mode = options.mode || 'ts';
    options.version = options.version || VERSION;

    const str = new MagicString(svelte);
    const basename = path.basename(options.filename || '');
    const svelte5Plus = Number(options.version![0]) > 4;

    // process the htmlx as a svelte template
    let {
        htmlAst,
        moduleScriptTag,
        scriptTag,
        rootSnippets,
        slots,
        uses$$props,
        uses$$slots,
        uses$$restProps,
        events,
        componentDocumentation,
        resolvedStores,
        usesAccessors,
        isRunes
    } = processSvelteTemplate(str, options.parse || parse, {
        ...options,
        svelte5Plus
    });

    /* Rearrange the script tags so that module is first, and instance second followed finally by the template
     * This is a bit convoluted due to some trouble I had with magic string. A simple str.move(start,end,0) for each script wasn't enough
     * since if the module script was already at 0, it wouldn't move (which is fine) but would mean the order would be swapped when the script tag tried to move to 0
     * In this case we instead have to move it to moduleScriptTag.end. We track the location for the script move in the MoveInstanceScriptTarget var
     */
    let instanceScriptTarget = 0;

    if (moduleScriptTag) {
        if (moduleScriptTag.start != 0) {
            //move our module tag to the top
            str.move(moduleScriptTag.start, moduleScriptTag.end, 0);
        } else {
            //since our module script was already at position 0, we need to move our instance script tag to the end of it.
            instanceScriptTarget = moduleScriptTag.end;
        }
    }

    const renderFunctionStart = scriptTag
        ? str.original.lastIndexOf('>', scriptTag.content.start) + 1
        : instanceScriptTarget;
    const implicitStoreValues = new ImplicitStoreValues(resolvedStores, renderFunctionStart);
    //move the instance script and process the content
    let exportedNames = new ExportedNames(
        str,
        0,
        basename,
        options?.isTsFile,
        svelte5Plus,
        isRunes
    );
    let generics = new Generics(str, 0, { attributes: [] } as any);
    let uses$$SlotsInterface = false;
    if (scriptTag) {
        //ensure it is between the module script and the rest of the template (the variables need to be declared before the jsx template)
        if (scriptTag.start != instanceScriptTarget) {
            str.move(scriptTag.start, scriptTag.end, instanceScriptTarget);
        }
        const res = processInstanceScriptContent(
            str,
            scriptTag,
            events,
            implicitStoreValues,
            options.mode,
            /**hasModuleScripts */ !!moduleScriptTag,
            options?.isTsFile,
            basename,
            svelte5Plus,
            isRunes
        );
        uses$$props = uses$$props || res.uses$$props;
        uses$$restProps = uses$$restProps || res.uses$$restProps;
        uses$$slots = uses$$slots || res.uses$$slots;

        ({ exportedNames, events, generics, uses$$SlotsInterface } = res);
    }

    exportedNames.usesAccessors = usesAccessors;
    if (svelte5Plus) {
        exportedNames.checkGlobalsForRunes(implicitStoreValues.getGlobals());
    }

    //wrap the script tag and template content in a function returning the slot and exports
    createRenderFunction({
        str,
        scriptTag,
        scriptDestination: instanceScriptTarget,
        rootSnippets,
        slots,
        events,
        exportedNames,
        uses$$props,
        uses$$restProps,
        uses$$slots,
        uses$$SlotsInterface,
        generics,
        svelte5Plus,
        mode: options.mode
    });

    // we need to process the module script after the instance script has moved otherwise we get warnings about moving edited items
    if (moduleScriptTag) {
        processModuleScriptTag(
            str,
            moduleScriptTag,
            new ImplicitStoreValues(
                implicitStoreValues.getAccessedStores(),
                renderFunctionStart,
                scriptTag || options.mode === 'ts' ? undefined : (input) => `</>;${input}<>`
            )
        );
    }

    addComponentExport({
        str,
        canHaveAnyProp: !exportedNames.uses$$Props && (uses$$props || uses$$restProps),
        events,
        isTsFile: options?.isTsFile,
        exportedNames,
        usesAccessors,
        usesSlots: slots.size > 0,
        fileName: options?.filename,
        componentDocumentation,
        mode: options.mode,
        generics,
        isSvelte5: svelte5Plus,
        noSvelteComponentTyped: options.noSvelteComponentTyped
    });

    if (options.mode === 'dts') {
        // Prepend the import which is used for TS files
        // The other shims need to be provided by the user ambient-style,
        // for example through filenames.push(require.resolve('svelte2tsx/svelte-shims.d.ts'))
        // TODO replace with SvelteComponent for Svelte 5, keep old for backwards compatibility with Svelte 3
        if (options.noSvelteComponentTyped) {
            str.prepend('import { SvelteComponent } from "svelte"\n' + '\n');
        } else {
            str.prepend('import { SvelteComponentTyped } from "svelte"\n' + '\n');
        }
        let code = str.toString();
        // Remove all tsx occurences and the template part from the output
        code = code
            // prepended before each script block
            .replace('<></>;', '')
            .replace('<></>;', '')
            // tsx in render function
            .replace(/<>.*<\/>/s, '')
            .replace('\n() => ();', '');

        return {
            code
        };
    } else {
        str.prepend('///<reference types="svelte" />\n');
        return {
            code: str.toString(),
            map: str.generateMap({ hires: true, source: options?.filename }),
            exportedNames: exportedNames.getExportsMap(),
            events: events.createAPI(),
            // not part of the public API so people don't start using it
            htmlAst
        };
    }
}
