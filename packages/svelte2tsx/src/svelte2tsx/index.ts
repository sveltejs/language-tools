import { Node } from 'estree-walker';
import MagicString from 'magic-string';
import { pascalCase } from 'pascal-case';
import path from 'path';
import { convertHtmlxToJsx } from '../htmlxtojsx';
import { parseHtmlx } from '../utils/htmlxparser';
import { ComponentDocumentation } from './nodes/ComponentDocumentation';
import { ComponentEvents } from './nodes/ComponentEvents';
import { EventHandler } from './nodes/event-handler';
import { ExportedNames } from './nodes/ExportedNames';
import { createClassGetters, createRenderFunctionGetterStr } from './nodes/exportgetters';
import {
    handleScopeAndResolveForSlot,
    handleScopeAndResolveLetVarForSlot,
} from './nodes/handleScopeAndResolveForSlot';
import { Scripts } from './nodes/Scripts';
import { SlotHandler } from './nodes/slot';
import { Stores } from './nodes/Stores';
import TemplateScope from './nodes/TemplateScope';
import {
    InstanceScriptProcessResult,
    processInstanceScriptContent,
} from './processInstanceScriptContent';
import { processModuleScriptTag } from './processModuleScriptTag';
import { ScopeStack } from './utils/Scope';

interface CreateRenderFunctionPara extends InstanceScriptProcessResult {
    str: MagicString;
    scriptTag: Node;
    scriptDestination: number;
    slots: Map<string, Map<string, string>>;
    events: ComponentEvents;
    isTsFile: boolean;
}

interface AddComponentExportPara {
    str: MagicString;
    uses$$propsOr$$restProps: boolean;
    strictMode: boolean;
    /**
     * If true, not fallback to `CustomEvent<any>`
     * -> all unknown events will throw a type error
     * */
    strictEvents: boolean;
    isTsFile: boolean;
    getters: Set<string>;
    fileName?: string;
    componentDocumentation: ComponentDocumentation;
}

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
};

/**
 * A component class name suffix is necessary to prevent class name clashes
 * like reported in https://github.com/sveltejs/language-tools/issues/294
 */
const COMPONENT_SUFFIX = '__SvelteComponent_';

function processSvelteTemplate(str: MagicString): TemplateProcessResult {
    const htmlxAst = parseHtmlx(str.original);

    let uses$$props = false;
    let uses$$restProps = false;
    let uses$$slots = false;

    const componentDocumentation = new ComponentDocumentation();

    //track if we are in a declaration scope
    const isDeclaration = { value: false };

    //track $store variables since we are only supposed to give top level scopes special treatment, and users can declare $blah variables at higher scopes
    //which prevents us just changing all instances of Identity that start with $

    const scopeStack = new ScopeStack();
    const stores = new Stores(scopeStack, str, isDeclaration);
    const scripts = new Scripts(htmlxAst);

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
                component,
            });
        }
    };

    const handleScopeAndResolveForSlotInner = (
        identifierDef: Node,
        initExpression: Node,
        owner: Node,
    ) => {
        handleScopeAndResolveForSlot({
            identifierDef,
            initExpression,
            slotHandler,
            templateScope,
            owner,
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
            case 'Identifier':
                handleIdentifier(node);
                stores.handleIdentifier(node, parent, prop);
                eventHandler.handleIdentifier(node, parent, prop);
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

    convertHtmlxToJsx(str, htmlxAst, onHtmlxWalk, onHtmlxLeave);

    // resolve scripts
    const { scriptTag, moduleScriptTag } = scripts.getTopLevelScriptTags();
    scripts.blankOtherScriptTags(str);

    //resolve stores
    stores.resolveStores();

    const events = new ComponentEvents();
    events.setEventHandler(eventHandler);

    return {
        moduleScriptTag,
        scriptTag,
        slots: slotHandler.getSlotDef(),
        events,
        uses$$props,
        uses$$restProps,
        uses$$slots,
        componentDocumentation,
    };
}

function addComponentExport({
    str,
    uses$$propsOr$$restProps,
    strictMode,
    strictEvents,
    isTsFile,
    getters,
    fileName,
    componentDocumentation,
}: AddComponentExportPara) {
    const eventsDef = strictEvents ? 'render' : '__sveltets_with_any_event(render)';
    const propDef =
        // Omit partial-wrapper only if both strict mode and ts file, because
        // in a js file the user has no way of telling the language that
        // the prop is optional
        strictMode && isTsFile
            ? uses$$propsOr$$restProps
                ? `__sveltets_with_any(${eventsDef})`
                : eventsDef
            : `__sveltets_partial${uses$$propsOr$$restProps ? '_with_any' : ''}(${eventsDef})`;

    const doc = componentDocumentation.getFormatted();
    const className = fileName && classNameFromFilename(fileName);

    const statement =
        `\n\n${doc}export default class${
            className ? ` ${className}` : ''
        } extends createSvelte2TsxComponent(${propDef}) {` +
        createClassGetters(getters) +
        '\n}';

    str.append(statement);
}

/**
 * Returns a Svelte-compatible component name from a filename. Svelte
 * components must use capitalized tags, so we try to transform the filename.
 *
 * https://svelte.dev/docs#Tags
 */
function classNameFromFilename(filename: string): string | undefined {
    try {
        const withoutExtensions = path.parse(filename).name?.split('.')[0];
        const inPascalCase = pascalCase(withoutExtensions);
        return `${inPascalCase}${COMPONENT_SUFFIX}`;
    } catch (error) {
        console.warn(`Failed to create a name for the component class from filename ${filename}`);
        return undefined;
    }
}

function createRenderFunction({
    str,
    scriptTag,
    scriptDestination,
    slots,
    getters,
    events,
    exportedNames,
    isTsFile,
    uses$$props,
    uses$$restProps,
    uses$$slots,
}: CreateRenderFunctionPara) {
    const htmlx = str.original;
    let propsDecl = '';

    if (uses$$props) {
        propsDecl += ' let $$props = __sveltets_allPropsType();';
    }
    if (uses$$restProps) {
        propsDecl += ' let $$restProps = __sveltets_restPropsType();';
    }

    if (uses$$slots) {
        propsDecl +=
            ' let $$slots = __sveltets_slotsType({' +
            Array.from(slots.keys())
                .map((name) => `${name}: ''`)
                .join(', ') +
            '});';
    }

    if (scriptTag) {
        //I couldn't get magicstring to let me put the script before the <> we prepend during conversion of the template to jsx, so we just close it instead
        const scriptTagEnd = htmlx.lastIndexOf('>', scriptTag.content.start) + 1;
        str.overwrite(scriptTag.start, scriptTag.start + 1, '</>;');
        str.overwrite(scriptTag.start + 1, scriptTagEnd, `function render() {${propsDecl}\n`);

        const scriptEndTagStart = htmlx.lastIndexOf('<', scriptTag.end - 1);
        // wrap template with callback
        str.overwrite(scriptEndTagStart, scriptTag.end, ';\n() => (<>', {
            contentOnly: true,
        });
    } else {
        str.prependRight(scriptDestination, `</>;function render() {${propsDecl}\n<>`);
    }

    const slotsAsDef =
        '{' +
        Array.from(slots.entries())
            .map(([name, attrs]) => {
                const attrsAsString = Array.from(attrs.entries())
                    .map(([exportName, expr]) => `${exportName}:${expr}`)
                    .join(', ');
                return `'${name}': {${attrsAsString}}`;
            })
            .join(', ') +
        '}';

    const returnString =
        `\nreturn { props: ${exportedNames.createPropsStr(
            isTsFile,
        )}, slots: ${slotsAsDef}, getters: ${createRenderFunctionGetterStr(getters)}` +
        `, events: ${events.toDefString()} }}`;

    // wrap template with callback
    if (scriptTag) {
        str.append(');');
    }

    str.append(returnString);
}

export function svelte2tsx(
    svelte: string,
    options?: { filename?: string; strictMode?: boolean; isTsFile?: boolean },
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
    } = processSvelteTemplate(str);

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

    //move the instance script and process the content
    let exportedNames = new ExportedNames();
    let getters = new Set<string>();
    if (scriptTag) {
        //ensure it is between the module script and the rest of the template (the variables need to be declared before the jsx template)
        if (scriptTag.start != instanceScriptTarget) {
            str.move(scriptTag.start, scriptTag.end, instanceScriptTarget);
        }
        const res = processInstanceScriptContent(str, scriptTag, events);
        uses$$props = uses$$props || res.uses$$props;
        uses$$restProps = uses$$restProps || res.uses$$restProps;
        uses$$slots = uses$$slots || res.uses$$slots;

        ({ exportedNames, events, getters } = res);
    }

    //wrap the script tag and template content in a function returning the slot and exports
    createRenderFunction({
        str,
        scriptTag,
        scriptDestination: instanceScriptTarget,
        slots,
        events,
        getters,
        exportedNames,
        isTsFile: options?.isTsFile,
        uses$$props,
        uses$$restProps,
        uses$$slots,
    });

    // we need to process the module script after the instance script has moved otherwise we get warnings about moving edited items
    if (moduleScriptTag) {
        processModuleScriptTag(str, moduleScriptTag);
    }

    addComponentExport({
        str,
        uses$$propsOr$$restProps: uses$$props || uses$$restProps,
        strictMode: !!options?.strictMode,
        strictEvents: events.hasInterface(),
        isTsFile: options?.isTsFile,
        getters,
        fileName: options?.filename,
        componentDocumentation,
    });

    str.prepend('///<reference types="svelte" />\n');

    return {
        code: str.toString(),
        map: str.generateMap({ hires: true, source: options?.filename }),
        exportedNames,
        events: events.createAPI(),
    };
}
