import { Node } from 'estree-walker';
import MagicString from 'magic-string';
import { convertHtmlxToJsx } from '../htmlxtojsx';
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

type TemplateProcessResult = {
    uses$$props: boolean;
    uses$$restProps: boolean;
    uses$$slots: boolean;
    slots: Map<string, Map<string, string>>;
    scriptTag: Node;
    moduleScriptTag: Node;
    /** To be added later as a comment on the default class export */
    componentDocumentation: ComponentDocumentation;
    events: ComponentEvents;
    resolvedStores: string[];
    usesAccessors: boolean;
};

function processSvelteTemplate(
    str: MagicString,
    options?: { emitOnTemplateError?: boolean; namespace?: string; accessors?: boolean }
): TemplateProcessResult {
    const { htmlxAst, tags } = parseHtmlx(str.original, options);

    let uses$$props = false;
    let uses$$restProps = false;
    let uses$$slots = false;
    let usesAccessors = !!options.accessors;

    const componentDocumentation = new ComponentDocumentation();

    //track if we are in a declaration scope
    const isDeclaration = { value: false };

    //track $store variables since we are only supposed to give top level scopes special treatment, and users can declare $blah variables at higher scopes
    //which prevents us just changing all instances of Identity that start with $

    const scopeStack = new ScopeStack();
    const stores = new Stores(scopeStack, str, isDeclaration);
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
                scripts.handleScriptTag(node, parent);
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

    convertHtmlxToJsx(str, htmlxAst, onHtmlxWalk, onHtmlxLeave, {
        preserveAttributeCase: options?.namespace == 'foreign'
    });

    // resolve scripts
    const { scriptTag, moduleScriptTag } = scripts.getTopLevelScriptTags();
    scripts.blankOtherScriptTags(str);

    //resolve stores
    const resolvedStores = stores.resolveStores();

    return {
        moduleScriptTag,
        scriptTag,
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
        usesAccessors
    };
}

export function svelte2tsx(
    svelte: string,
    options: {
        filename?: string;
        isTsFile?: boolean;
        emitOnTemplateError?: boolean;
        namespace?: string;
        mode?: 'tsx' | 'dts';
        accessors?: boolean;
    } = {}
) {
    const str = new MagicString(svelte);
    // process the htmlx as a svelte template
    let {
        moduleScriptTag,
        scriptTag,
        slots,
        uses$$props,
        uses$$slots,
        uses$$restProps,
        events,
        componentDocumentation,
        resolvedStores,
        usesAccessors
    } = processSvelteTemplate(str, options);

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
    let exportedNames = new ExportedNames(str, 0);
    let generics = new Generics(str, 0);
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
            options.mode
        );
        uses$$props = uses$$props || res.uses$$props;
        uses$$restProps = uses$$restProps || res.uses$$restProps;
        uses$$slots = uses$$slots || res.uses$$slots;

        ({ exportedNames, events, generics, uses$$SlotsInterface } = res);
    }

    //wrap the script tag and template content in a function returning the slot and exports
    createRenderFunction({
        str,
        scriptTag,
        scriptDestination: instanceScriptTarget,
        slots,
        events,
        exportedNames,
        isTsFile: options?.isTsFile,
        uses$$props,
        uses$$restProps,
        uses$$slots,
        uses$$SlotsInterface,
        generics,
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
                scriptTag ? undefined : (input) => `</>;${input}<>`
            )
        );
    }

    addComponentExport({
        str,
        uses$$propsOr$$restProps: uses$$props || uses$$restProps,
        strictEvents: events.hasStrictEvents(),
        isTsFile: options?.isTsFile,
        exportedNames,
        usesAccessors,
        fileName: options?.filename,
        componentDocumentation,
        mode: options.mode,
        generics
    });

    if (options.mode === 'dts') {
        // Prepend the import and for JS files a single definition.
        // The other shims need to be provided by the user ambient-style,
        // for example through filenames.push(require.resolve('svelte2tsx/svelte-shims.d.ts'))
        str.prepend(
            'import { SvelteComponentTyped } from "svelte"\n' +
                (options?.isTsFile
                    ? ''
                    : // Not part of svelte-shims.d.ts because it would throw type errors as this function assumes
                      // the presence of a SvelteComponentTyped import
                      `
declare function __sveltets_1_createSvelteComponentTyped<Props, Events, Slots>(
    render: {props: Props, events: Events, slots: Slots }
): SvelteComponentConstructor<SvelteComponentTyped<Props, Events, Slots>,Svelte2TsxComponentConstructorParameters<Props>>;
`) +
                '\n'
        );
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
            events: events.createAPI()
        };
    }
}
