import { pascalCase } from 'scule';
import path from 'path';
import MagicString from 'magic-string';
import { ExportedNames } from './nodes/ExportedNames';
import { ComponentDocumentation } from './nodes/ComponentDocumentation';
import { Generics } from './nodes/Generics';
import { surroundWithIgnoreComments } from '../utils/ignore';
import { ComponentEvents } from './nodes/ComponentEvents';
import { internalHelpers } from '../helpers';
import { mapGenerated, SpanMapFeature, SpanMapGenerator } from '../utils/spanMap';

export interface AddComponentExportPara {
    str: MagicString;
    canHaveAnyProp: boolean;
    /**
     * If strictEvents true, not fallback to `any`
     * -> all unknown events will throw a type error
     * */
    events: ComponentEvents;
    isTsFile: boolean;
    usesAccessors: boolean;
    exportedNames: ExportedNames;
    fileName?: string;
    componentDocumentation: ComponentDocumentation;
    mode: 'ts' | 'dts' | 'tsx';
    generics: Generics;
    usesSlots: boolean;
    isSvelte5: boolean;
    hasTopLevelAwait: boolean;
    noSvelteComponentTyped?: boolean;
    /**
     * If true, emits JSDoc annotations for types in JS files instead of TypeScript syntax.
     */
    emitJsDoc?: boolean;
    spanMapGenerator?: SpanMapGenerator;
    /** See `Svelte2TsxOptions.declarationEmit` */
    declarationEmit?: boolean;
}

/**
 * A component class name suffix is necessary to prevent class name clashes
 * like reported in https://github.com/sveltejs/language-tools/issues/294
 */
export const COMPONENT_SUFFIX = '__SvelteComponent_';

/**
 * Global names that svelte2tsx's output refers to in the file's own code (the shims are separate files).
 * The component's declaration would shadow them.
 */
const NAMES_USED_BY_GENERATED_CODE = new Set([
    'Array',
    'Awaited',
    'CustomEvent',
    'Element',
    'InstanceType',
    'Parameters',
    'Partial',
    'Pick',
    'Promise',
    'Record',
    'ReturnType'
]);

/**
 * The name of the component's default export. In declaration files (`dts` mode, `declarationEmit`)
 * that's what users see, e.g. in auto imports, so it's the plain name from the file name if possible.
 * Otherwise it has a suffix, so that it can't clash with the names of the component.
 * With `declarationEmit` the plain name is used if the component doesn't mention it anywhere:
 * then nothing in it can clash with the name or refer to it by accident (like a global `Image` in `Image.svelte`).
 */
function componentNameFromFilename(
    fileName: string | undefined,
    mode: AddComponentExportPara['mode'],
    declarationEmit: boolean | undefined,
    source: string
): string | undefined {
    const name = fileName && classNameFromFilename(fileName);
    if (!name || mode === 'dts') {
        return name;
    }
    const isUnused =
        !NAMES_USED_BY_GENERATED_CODE.has(name) &&
        !new RegExp(`(?<![\\w$])${name}(?![\\w$])`).test(source);
    return declarationEmit && isUnused ? name : name + COMPONENT_SUFFIX;
}

/**
 * The JSDoc of a type alias in a JS file. With `declarationEmit`, it belongs to an empty statement,
 * because TypeScript copies the JSDoc of the statement it belongs to into the declaration file.
 */
function jsDocTypedef(type: string, name: string, declarationEmit: boolean | undefined) {
    return `/** @typedef {${type}} ${name} */${declarationEmit ? ';' : ''}\n`;
}

/**
 * Definitions of `__sveltets_2_IsomorphicComponent` and its factory from the shims, for files
 * whose declarations are emitted: their consumers don't have the shims.
 * Returns the definitions and the name of the factory.
 */
function isomorphicComponentDefinitions(
    useTypeScriptSyntax: boolean,
    usesSlots: boolean,
    hasNoProps: boolean
): [definitions: string, factory: string] {
    if (useTypeScriptSyntax) {
        // Same as in dts mode
        return [
            `\ninterface $$__sveltets_2_IsomorphicComponent<Props extends Record<string, any> = any, Events extends Record<string, any> = any, Slots extends Record<string, any> = any, Exports = {}, Bindings = string> {
    new (options: import('svelte').ComponentConstructorOptions<Props>): import('svelte').SvelteComponent<Props, Events, Slots> & { $$bindings?: Bindings } & Exports;
    (internal: unknown, props: ${hasNoProps ? '{$$events?: Events, $$slots?: Slots}' : 'Props & {$$events?: Events, $$slots?: Slots}'}): Exports & { $set?: any, $on?: any };
    z_$$bindings?: Bindings;
}\n` +
                (usesSlots
                    ? `type $$__sveltets_2_PropsWithChildren<Props, Slots> = Props &
    (Slots extends { default: any }
        ? Props extends Record<string, never>
        ? any
        : { children?: any }
        : {});
        declare function $$__sveltets_2_isomorphic_component_slots<
            Props extends Record<string, any>, Events extends Record<string, any>, Slots extends Record<string, any>, Exports extends Record<string, any>, Bindings extends string
        >(klass: {props: Props, events: Events, slots: Slots, exports?: Exports, bindings?: Bindings }): $$__sveltets_2_IsomorphicComponent<$$__sveltets_2_PropsWithChildren<Props, Slots>, Events, Slots, Exports, Bindings>;\n`
                    : `
declare function $$__sveltets_2_isomorphic_component<
    Props extends Record<string, any>, Events extends Record<string, any>, Slots extends Record<string, any>, Exports extends Record<string, any>, Bindings extends string
>(klass: {props: Props, events: Events, slots: Slots, exports?: Exports, bindings?: Bindings }): $$__sveltets_2_IsomorphicComponent<Props, Events, Slots, Exports, Bindings>;\n`),
            `$$__sveltets_2_isomorphic_component${usesSlots ? '_slots' : ''}`
        ];
    }

    // A JS file can't declare a type alias without exporting it, so the factory returns an object type
    // literal. TypeScript writes its instantiation into the declaration file.
    const props = usesSlots
        ? '(Props & (Slots extends { default: any } ? Props extends Record<string, never> ? any : { children?: any } : {}))'
        : 'Props';
    const callProps = hasNoProps
        ? '{$$events?: Events, $$slots?: Slots}'
        : `${props} & {$$events?: Events, $$slots?: Slots}`;
    return [
        `
/**
 * @template {Record<string, any>} Props
 * @template {Record<string, any>} Events
 * @template {Record<string, any>} Slots
 * @template {Record<string, any>} Exports
 * @template {string} Bindings
 * @param {{props: Props, events: Events, slots: Slots, exports?: Exports, bindings?: Bindings }} klass
 * @returns {{ new (options: import('svelte').ComponentConstructorOptions<${props}>): import('svelte').SvelteComponent<${props}, Events, Slots> & { $$bindings?: Bindings } & Exports; (internal: unknown, props: ${callProps}): Exports & { $set?: any, $on?: any }; z_$$bindings?: Bindings }}
 */
function $$__sveltets_2_isomorphic_component(klass) { return /** @type {any} */ (klass); }\n`,
        '$$__sveltets_2_isomorphic_component'
    ];
}

/**
 * Marks the declaration of the default export, so that go to definition of a default import
 * lands at the start of the file
 */
function defaultExportAnchor(spanMapGenerator: SpanMapGenerator | undefined, text: string) {
    return mapGenerated(spanMapGenerator, text, [0, 0], SpanMapFeature.Definition);
}

/** ` ClassName`, if there is a class name */
function classNameOf(spanMapGenerator: SpanMapGenerator | undefined, name: string | undefined) {
    return name ? ` ${defaultExportAnchor(spanMapGenerator, name)}` : '';
}

export function addComponentExport(params: AddComponentExportPara) {
    if (params.generics.has()) {
        addGenericsComponentExport(params);
    } else {
        addSimpleComponentExport(params);
    }
}

function addGenericsComponentExport({
    events,
    canHaveAnyProp,
    exportedNames,
    componentDocumentation,
    fileName,
    mode,
    usesAccessors,
    str,
    isTsFile,
    generics,
    usesSlots,
    isSvelte5,
    noSvelteComponentTyped,
    hasTopLevelAwait,
    emitJsDoc,
    spanMapGenerator,
    declarationEmit
}: AddComponentExportPara) {
    const genericsDef = generics.toDefinitionString();
    const genericsRef = generics.toReferencesString();
    const useTSSyntax = isTsFile || !emitJsDoc;
    const templateNames =
        !useTSSyntax && genericsDef
            ? genericsDef
                  .slice(1, -1)
                  .split(',')
                  .map((part) => part.trim())
                  .map((part) => part.split(/\s|=/)[0])
                  .filter(Boolean)
            : [];
    const templateComment = templateNames.length
        ? `/** @template ${templateNames.join(', ')} */\n`
        : '';

    const doc = componentDocumentation.getFormatted();
    const className = componentNameFromFilename(fileName, mode, declarationEmit, str.original);

    function returnType(forPart: string) {
        return `ReturnType<__sveltets_Render${genericsRef}['${forPart}']>`;
    }

    const renderCall = hasTopLevelAwait
        ? `(await ${internalHelpers.renderName}${useTSSyntax ? genericsRef : ''}())`
        : `${internalHelpers.renderName}${useTSSyntax ? genericsRef : ''}()`;

    // TODO once Svelte 4 compatibility is dropped, we can simplify this, because since TS 4.7 it is possible to use generics
    // like this: `typeof render<T>` - which wasn't possibly before, hence the class + methods workaround.
    let statement = `
${templateComment}class __sveltets_Render${useTSSyntax ? genericsDef : ''} {
    props() {
        return ${props(true, canHaveAnyProp, exportedNames, renderCall)}.props;
    }
    events() {
        return ${_events(events.hasStrictEvents() || exportedNames.isRunesMode(), renderCall)}.events;
    }
    slots() {
        return ${renderCall}.slots;
    }
`;

    // For Svelte 5+ we assume TS > 4.7
    if (isSvelte5 && exportedNames.isRunesMode()) {
        const renderType = hasTopLevelAwait
            ? `Awaited<ReturnType<typeof ${internalHelpers.renderName}${genericsRef}>>`
            : `ReturnType<typeof ${internalHelpers.renderName}${genericsRef}>`;
        if (useTSSyntax) {
            statement = `
class __sveltets_Render${genericsDef} {
    props(): ${renderType}['props'] { return null as any; }
    events(): ${renderType}['events'] { return null as any; }
    slots(): ${renderType}['slots'] { return null as any; }
`;
        } else {
            statement = `
${templateComment}class __sveltets_Render {
    /** @returns {${renderType}['props']} */
    props() { return /** @type {any} */ (null); }
    /** @returns {${renderType}['events']} */
    events() { return /** @type {any} */ (null); }
    /** @returns {${renderType}['slots']} */
    slots() { return /** @type {any} */ (null); }
`;
        }
    }

    statement += isSvelte5
        ? `    bindings() { return ${exportedNames.createBindingsStr()}; }
    ${hasTopLevelAwait ? 'async ' : ''}exports() { return ${exportedNames.hasExports() ? `${renderCall}.exports` : '{}'}; }
}\n`
        : '}\n';

    const svelteComponentClass = noSvelteComponentTyped
        ? 'SvelteComponent'
        : 'SvelteComponentTyped';
    const [PropsName] = addTypeExport(str, className, 'Props');
    const [EventsName] = addTypeExport(str, className, 'Events');
    const [SlotsName] = addTypeExport(str, className, 'Slots');

    if (isSvelte5) {
        // Don't add props/events/slots type exports in dts mode for now, maybe someone asks for it to be back,
        // but it's safer to not do it for now to have more flexibility in the future.
        let eventsSlotsType = [];
        if (events.hasEvents() || !exportedNames.isRunesMode()) {
            eventsSlotsType.push(`$$events?: ${returnType('events')}`);
        }
        if (usesSlots) {
            eventsSlotsType.push(`$$slots?: ${returnType('slots')}`);
            eventsSlotsType.push(`children?: any`);
        }
        const propsType =
            !canHaveAnyProp && exportedNames.hasNoProps()
                ? `{${eventsSlotsType.join(', ')}}`
                : `${returnType('props')} & {${eventsSlotsType.join(', ')}}`;
        const bindingsType = `ReturnType<__sveltets_Render${generics.toReferencesAnyString()}['bindings']>`;

        // Sadly, due to a combination of requirements and TypeScript limitations, we need to always create both a legacy class component and function component type.
        // - Constraints: Need to support Svelte 4 class component types, therefore we need to use __sveltets_2_ensureComponent to transform function components to classes
        // - Limitations: TypeScript is not able to preserve generics during said transformation (i.e. there's no way to express keeping the generic etc)
        // TODO Svelte 6/7: Switch this around and not use new Component in svelte2tsx anymore, which means we can remove the legacy class component. We need something like _ensureFnComponent then.
        if (useTSSyntax) {
            statement +=
                `\ninterface $$IsomorphicComponent {\n` +
                `    new ${genericsDef}(options: import('svelte').ComponentConstructorOptions<${returnType('props') + (usesSlots ? '& {children?: any}' : '')}>): import('svelte').SvelteComponent<${returnType('props')}, ${returnType('events')}, ${returnType('slots')}> & { $$bindings?: ${returnType('bindings')} } & ${returnType('exports')};\n` +
                `    ${genericsDef}(internal: unknown, props: ${propsType}): ${returnType('exports')};\n` +
                `    z_$$bindings?: ${bindingsType};\n` +
                `}\n` +
                `${doc}${defaultExportAnchor(spanMapGenerator, `const ${className || '$$Component'}`)}: $$IsomorphicComponent = null as any;\n` +
                surroundWithIgnoreComments(
                    `type ${className || '$$Component'}${genericsDef} = InstanceType<typeof ${className || '$$Component'}${genericsRef}>;\n`
                ) +
                `export default ${className || '$$Component'};`;
        } else {
            const componentName = className || '$$Component';
            const componentType =
                `(new ${genericsDef}(options: import('svelte').ComponentConstructorOptions<${returnType('props') + (usesSlots ? '& {children?: any}' : '')}>) => import('svelte').SvelteComponent<${returnType('props')}, ${returnType('events')}, ${returnType('slots')}> & { $$bindings?: ${returnType('bindings')} } & ${returnType('exports')}) & ` +
                `(${genericsDef}(internal: unknown, props: ${propsType}) => ${returnType('exports')}) & ` +
                `{z_$$bindings?: ${bindingsType}}`;
            const declaration = `export ${defaultExportAnchor(spanMapGenerator, `const ${componentName}`)}`;
            statement +=
                '\n' +
                (declarationEmit
                    ? // Not a typedef, because that would be exported (the signatures declare the generics themselves),
                      // and a cast, because TypeScript copies the JSDoc of the statement into the declaration file
                      `${doc}${declaration} = /** @type {${componentType}} */(/** @type {any} */(null));\n`
                    : `${templateComment}/** @typedef {${componentType}} $$IsomorphicComponent */\n` +
                      `${doc}/** @type {$$IsomorphicComponent} */ ${declaration} = /** @type {any} */(null);\n`) +
                jsDocTypedef(
                    `InstanceType<typeof ${componentName}>`,
                    componentName,
                    declarationEmit
                ) +
                `export default ${componentName};`;
        }
    } else if (mode === 'dts') {
        statement +=
            `export type ${PropsName}${genericsDef} = ${returnType('props')};\n` +
            `export type ${EventsName}${genericsDef} = ${returnType('events')};\n` +
            `export type ${SlotsName}${genericsDef} = ${returnType('slots')};\n` +
            `\n${doc}export default class${
                className ? ` ${className}` : ''
            }${genericsDef} extends ${svelteComponentClass}<${PropsName}${genericsRef}, ${EventsName}${genericsRef}, ${SlotsName}${genericsRef}> {` +
            exportedNames.createClassGetters(genericsRef) +
            (usesAccessors ? exportedNames.createClassAccessors() : '') +
            '\n}';
    } else {
        if (useTSSyntax) {
            statement +=
                `\n\nimport { ${svelteComponentClass} as __SvelteComponentTyped__ } from "svelte" \n` +
                `${doc}export default class${classNameOf(spanMapGenerator, className)}${genericsDef} extends __SvelteComponentTyped__<${returnType('props')}, ${returnType(
                    'events'
                )}, ${returnType('slots')}> {` +
                exportedNames.createClassGetters(genericsRef) +
                (usesAccessors ? exportedNames.createClassAccessors() : '') +
                '\n}';
        } else {
            statement +=
                `\n\nimport { ${svelteComponentClass} as __SvelteComponentTyped__ } from "svelte" \n` +
                `/**` +
                templateNames.map((t) => ` * @template ${t}\n`).join('') +
                ` * @extends {__SvelteComponentTyped__<${returnType('props')}, ${returnType('events')}, ${returnType('slots')}>}\n` +
                ` */\n` +
                `export default class${classNameOf(spanMapGenerator, className)} extends __SvelteComponentTyped__ {` +
                exportedNames.createClassGetters(genericsRef) +
                (usesAccessors ? exportedNames.createClassAccessors() : '') +
                '\n}';
        }
    }

    str.append(statement);
}

function addSimpleComponentExport({
    events,
    isTsFile,
    canHaveAnyProp,
    exportedNames,
    componentDocumentation,
    fileName,
    mode,
    usesAccessors,
    str,
    usesSlots,
    noSvelteComponentTyped,
    isSvelte5,
    hasTopLevelAwait,
    emitJsDoc,
    spanMapGenerator,
    declarationEmit
}: AddComponentExportPara) {
    const renderCall = hasTopLevelAwait
        ? `$${internalHelpers.renderName}`
        : `${internalHelpers.renderName}()`;
    const awaitDeclaration = hasTopLevelAwait
        ? // tsconfig could disallow top-level await, so we need to wrap it in ignore
          surroundWithIgnoreComments(
              `const $${internalHelpers.renderName} = await ${internalHelpers.renderName}();`
          ) + '\n'
        : '';

    const propDef = props(
        isTsFile,
        canHaveAnyProp,
        exportedNames,
        _events(events.hasStrictEvents(), renderCall)
    );

    const doc = componentDocumentation.getFormatted();
    const className = componentNameFromFilename(fileName, mode, declarationEmit, str.original);
    const componentName = className || '$$Component';

    let statement: string;
    if (mode === 'dts') {
        if (isSvelte5 && exportedNames.isRunesMode() && !usesSlots && !events.hasEvents()) {
            statement =
                `\n${awaitDeclaration}${doc}const ${componentName} = __sveltets_2_fn_component(${renderCall});\n` +
                `type ${componentName} = ReturnType<typeof ${componentName}>;\n` +
                `export default ${componentName};`;
        } else if (isSvelte5) {
            // Inline definitions from Svelte shims; else dts files will reference the globals which will be unresolved
            const [definitions, factory] = isomorphicComponentDefinitions(
                true,
                usesSlots,
                !canHaveAnyProp && exportedNames.hasNoProps()
            );
            statement =
                definitions +
                `${awaitDeclaration}${doc}const ${componentName} = ${factory}(${propDef});\n` +
                // TODO for JS files the d.ts output of this type is broken: TypeScript's declaration emit for JS files
                // re-serializes TS-syntax type aliases and drops the module qualifier of `import('svelte').SvelteComponent`
                // in the process, so the d.ts references `SvelteComponent` without importing it. This happens even when
                // writing `import('svelte').SvelteComponent<..>` explicitly here, and adding an import (named or namespace)
                // doesn't help either because TypeScript removes it. A JSDoc `@typedef` would produce correct output, but
                // typedefs are always exported, so the const would need to be exported, too (else they don't merge) -
                // which means the d.ts would contain a named export that doesn't exist at runtime.
                surroundWithIgnoreComments(
                    `type ${componentName} = InstanceType<typeof ${componentName}>;\n`
                ) +
                `export default ${componentName};`;
        } else if (isTsFile) {
            const svelteComponentClass = noSvelteComponentTyped
                ? 'SvelteComponent'
                : 'SvelteComponentTyped';
            const [PropsName, PropsExport] = addTypeExport(str, className, 'Props');
            const [EventsName, EventsExport] = addTypeExport(str, className, 'Events');
            const [SlotsName, SlotsExport] = addTypeExport(str, className, 'Slots');

            statement =
                `\nconst __propDef = ${propDef};\n` +
                PropsExport +
                EventsExport +
                SlotsExport +
                `\n${doc}export default class${
                    className ? ` ${className}` : ''
                } extends ${svelteComponentClass}<${PropsName}, ${EventsName}, ${SlotsName}> {` +
                exportedNames.createClassGetters() +
                (usesAccessors ? exportedNames.createClassAccessors() : '') +
                '\n}';
        } else {
            statement =
                `\nconst __propDef = ${propDef};\n` +
                `/** @typedef {typeof __propDef.props}  ${className}Props */\n` +
                `/** @typedef {typeof __propDef.events}  ${className}Events */\n` +
                `/** @typedef {typeof __propDef.slots}  ${className}Slots */\n` +
                `\n${doc}export default class${
                    className ? ` ${className}` : ''
                } extends __sveltets_2_createSvelte2TsxComponent(${propDef}) {` +
                exportedNames.createClassGetters() +
                (usesAccessors ? exportedNames.createClassAccessors() : '') +
                '\n}';
        }
    } else {
        if (isSvelte5) {
            // When emitting JSDoc (JS files in incremental mode), we use @typedef instead of
            // TS type syntax, and must export the const so declaration-merging with @typedef works.
            const useTypeScriptSyntax = isTsFile || !emitJsDoc;
            if (exportedNames.isRunesMode() && !usesSlots && !events.hasEvents()) {
                statement =
                    `\n${awaitDeclaration}${doc}${useTypeScriptSyntax ? '' : 'export '}${defaultExportAnchor(spanMapGenerator, `const ${componentName}`)} = __sveltets_2_fn_component(${renderCall});\n` +
                    // Surround the type with ignore comments so it is filtered out from go-to-definition etc,
                    // which for some editors can cause duplicates
                    surroundWithIgnoreComments(
                        useTypeScriptSyntax
                            ? `type ${componentName} = ReturnType<typeof ${componentName}>;\n`
                            : jsDocTypedef(
                                  `ReturnType<typeof ${componentName}>`,
                                  componentName,
                                  declarationEmit
                              )
                    ) +
                    `export default ${componentName};`;
            } else {
                // The shims' types would end up in the declaration file, so declare them in the file
                const [definitions, factory] = declarationEmit
                    ? isomorphicComponentDefinitions(
                          useTypeScriptSyntax,
                          usesSlots,
                          !canHaveAnyProp && exportedNames.hasNoProps()
                      )
                    : ['', `__sveltets_2_isomorphic_component${usesSlots ? '_slots' : ''}`];
                statement =
                    (definitions ? '\n' + surroundWithIgnoreComments(definitions) : '') +
                    `\n${awaitDeclaration}${doc}${useTypeScriptSyntax ? '' : 'export '}${defaultExportAnchor(spanMapGenerator, `const ${componentName}`)} = ${factory}(${propDef});\n` +
                    surroundWithIgnoreComments(
                        useTypeScriptSyntax
                            ? `type ${componentName} = InstanceType<typeof ${componentName}>;\n`
                            : jsDocTypedef(
                                  `InstanceType<typeof ${componentName}>`,
                                  componentName,
                                  declarationEmit
                              )
                    ) +
                    `export default ${componentName};`;
            }
        } else {
            statement =
                `\n\n${doc}export default class${classNameOf(spanMapGenerator, className)} extends __sveltets_2_createSvelte2TsxComponent(${propDef}) {` +
                exportedNames.createClassGetters() +
                (usesAccessors ? exportedNames.createClassAccessors() : '') +
                '\n}';
        }
    }

    str.append(statement);
}

function addTypeExport(
    str: MagicString,
    className: string,
    type: string
): [name: string, exportstring: string] {
    const exportName = className + type;

    if (!new RegExp(`\\W${exportName}\\W`).test(str.original)) {
        return [
            exportName,
            `export type ${exportName} = typeof __propDef.${type.toLowerCase()};\n`
        ];
    }

    let replacement = exportName + '_';
    while (str.original.includes(replacement)) {
        replacement += '_';
    }

    if (
        // Check if there's already an export with the same name
        !new RegExp(
            `export ((const|let|var|class|interface|type) ${exportName}\\W|{[^}]*?${exportName}(}|\\W.*?}))`
        ).test(str.original)
    ) {
        return [
            replacement,
            `type ${replacement} = typeof __propDef.${type.toLowerCase()};\nexport { ${replacement} as ${exportName} };\n`
        ];
    } else {
        return [
            replacement,
            // we assume that the author explicitly named the type the same and don't export the generated type (which has an unstable name)
            `type ${replacement} = typeof __propDef.${type.toLowerCase()};\n`
        ];
    }
}

function _events(strictEvents: boolean, renderStr: string) {
    return strictEvents ? renderStr : `__sveltets_2_with_any_event(${renderStr})`;
}

function props(
    isTsFile: boolean,
    canHaveAnyProp: boolean,
    exportedNames: ExportedNames,
    renderStr: string
) {
    if (exportedNames.isRunesMode()) {
        return renderStr;
    } else if (isTsFile) {
        return canHaveAnyProp ? `__sveltets_2_with_any(${renderStr})` : renderStr;
    } else {
        const optionalProps = exportedNames.createOptionalPropsArray();
        const partial = `__sveltets_2_partial${canHaveAnyProp ? '_with_any' : ''}`;
        return optionalProps.length > 0
            ? `${partial}([${optionalProps.join(',')}], ${renderStr})`
            : `${partial}(${renderStr})`;
    }
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
        const withoutInvalidCharacters = withoutExtensions
            .split('')
            // Although "-" is invalid, we leave it in, pascal-case-handling will throw it out later
            .filter((char) => /[A-Za-z_\d-]/.test(char))
            .join('');
        const firstValidCharIdx = withoutInvalidCharacters
            .split('')
            // Although _ and $ are valid first characters for classes, they are invalid first characters
            // for tag names. For a better import autocompletion experience, we therefore throw them out.
            .findIndex((char) => /[A-Za-z]/.test(char));
        const withoutLeadingInvalidCharacters = withoutInvalidCharacters.substr(firstValidCharIdx);
        const inPascalCase = pascalCase(withoutLeadingInvalidCharacters);
        return firstValidCharIdx === -1 ? `A${inPascalCase}` : inPascalCase;
    } catch (error) {
        console.warn(`Failed to create a name for the component class from filename ${filename}`);
        return undefined;
    }
}
