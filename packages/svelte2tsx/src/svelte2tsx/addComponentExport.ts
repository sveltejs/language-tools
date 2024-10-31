import { pascalCase } from 'pascal-case';
import path from 'path';
import MagicString from 'magic-string';
import { ExportedNames } from './nodes/ExportedNames';
import { ComponentDocumentation } from './nodes/ComponentDocumentation';
import { Generics } from './nodes/Generics';
import { surroundWithIgnoreComments } from '../utils/ignore';
import { ComponentEvents } from './nodes/ComponentEvents';

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
    noSvelteComponentTyped?: boolean;
}

/**
 * A component class name suffix is necessary to prevent class name clashes
 * like reported in https://github.com/sveltejs/language-tools/issues/294
 */
export const COMPONENT_SUFFIX = '__SvelteComponent_';

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
    generics,
    usesSlots,
    isSvelte5,
    noSvelteComponentTyped
}: AddComponentExportPara) {
    const genericsDef = generics.toDefinitionString();
    const genericsRef = generics.toReferencesString();

    const doc = componentDocumentation.getFormatted();
    const className = fileName && classNameFromFilename(fileName, mode !== 'dts');

    function returnType(forPart: string) {
        return `ReturnType<__sveltets_Render${genericsRef}['${forPart}']>`;
    }

    let statement = `
class __sveltets_Render${genericsDef} {
    props() {
        return ${props(true, canHaveAnyProp, exportedNames, `render${genericsRef}()`)}.props;
    }
    events() {
        return ${_events(events.hasStrictEvents() || exportedNames.usesRunes(), `render${genericsRef}()`)}.events;
    }
    slots() {
        return render${genericsRef}().slots;
    }
${
    isSvelte5
        ? `    bindings() { return ${exportedNames.createBindingsStr()}; }
    exports() { return ${exportedNames.hasExports() ? `render${genericsRef}().exports` : '{}'}; }
}`
        : '}'
}
`;

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
        if (events.hasEvents() || !exportedNames.usesRunes()) {
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
        statement +=
            `\ninterface $$IsomorphicComponent {\n` +
            `    new ${genericsDef}(options: import('svelte').ComponentConstructorOptions<${returnType('props') + (usesSlots ? '& {children?: any}' : '')}>): import('svelte').SvelteComponent<${returnType('props')}, ${returnType('events')}, ${returnType('slots')}> & { $$bindings?: ${returnType('bindings')} } & ${returnType('exports')};\n` +
            `    ${genericsDef}(internal: unknown, props: ${propsType}): ${returnType('exports')};\n` +
            `    z_$$bindings?: ${bindingsType};\n` +
            `}\n` +
            `${doc}const ${className || '$$Component'}: $$IsomorphicComponent = null as any;\n` +
            surroundWithIgnoreComments(
                `type ${className || '$$Component'}${genericsDef} = InstanceType<typeof ${className || '$$Component'}${genericsRef}>;\n`
            ) +
            `export default ${className || '$$Component'};`;
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
        statement +=
            `\n\nimport { ${svelteComponentClass} as __SvelteComponentTyped__ } from "svelte" \n` +
            `${doc}export default class${
                className ? ` ${className}` : ''
            }${genericsDef} extends __SvelteComponentTyped__<${returnType('props')}, ${returnType(
                'events'
            )}, ${returnType('slots')}> {` +
            exportedNames.createClassGetters(genericsRef) +
            (usesAccessors ? exportedNames.createClassAccessors() : '') +
            '\n}';
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
    isSvelte5
}: AddComponentExportPara) {
    const propDef = props(
        isTsFile,
        canHaveAnyProp,
        exportedNames,
        _events(events.hasStrictEvents(), 'render()')
    );

    const doc = componentDocumentation.getFormatted();
    const className = fileName && classNameFromFilename(fileName, mode !== 'dts');
    const componentName = className || '$$Component';

    let statement: string;
    if (mode === 'dts') {
        if (isSvelte5 && exportedNames.usesRunes() && !usesSlots && !events.hasEvents()) {
            statement =
                `\n${doc}const ${componentName} = __sveltets_2_fn_component(render());\n` +
                `type ${componentName} = ReturnType<typeof ${componentName}>;\n` +
                `export default ${componentName};`;
        } else if (isSvelte5) {
            // Inline definitions from Svelte shims; else dts files will reference the globals which will be unresolved
            statement =
                `\ninterface $$__sveltets_2_IsomorphicComponent<Props extends Record<string, any> = any, Events extends Record<string, any> = any, Slots extends Record<string, any> = any, Exports = {}, Bindings = string> {
    new (options: import('svelte').ComponentConstructorOptions<Props>): import('svelte').SvelteComponent<Props, Events, Slots> & { $$bindings?: Bindings } & Exports;
    (internal: unknown, props: ${!canHaveAnyProp && exportedNames.hasNoProps() ? '{$$events?: Events, $$slots?: Slots}' : 'Props & {$$events?: Events, $$slots?: Slots}'}): Exports & { $set?: any, $on?: any };
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
>(klass: {props: Props, events: Events, slots: Slots, exports?: Exports, bindings?: Bindings }): $$__sveltets_2_IsomorphicComponent<Props, Events, Slots, Exports, Bindings>;\n`) +
                `${doc}const ${componentName} = $$__sveltets_2_isomorphic_component${usesSlots ? '_slots' : ''}(${propDef});\n` +
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
            if (exportedNames.usesRunes() && !usesSlots && !events.hasEvents()) {
                statement =
                    `\n${doc}const ${componentName} = __sveltets_2_fn_component(render());\n` +
                    `type ${componentName} = ReturnType<typeof ${componentName}>;\n` +
                    `export default ${componentName};`;
            } else {
                statement =
                    `\n${doc}const ${componentName} = __sveltets_2_isomorphic_component${usesSlots ? '_slots' : ''}(${propDef});\n` +
                    surroundWithIgnoreComments(
                        `type ${componentName} = InstanceType<typeof ${componentName}>;\n`
                    ) +
                    `export default ${componentName};`;
            }
        } else {
            statement =
                `\n\n${doc}export default class${
                    className ? ` ${className}` : ''
                } extends __sveltets_2_createSvelte2TsxComponent(${propDef}) {` +
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
    if (exportedNames.usesRunes()) {
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
function classNameFromFilename(filename: string, appendSuffix: boolean): string | undefined {
    try {
        const withoutExtensions = path.parse(filename).name?.split('.')[0];
        const withoutInvalidCharacters = withoutExtensions
            .split('')
            // Although "-" is invalid, we leave it in, pascal-case-handling will throw it out later
            .filter((char) => /[A-Za-z$_\d-]/.test(char))
            .join('');
        const firstValidCharIdx = withoutInvalidCharacters
            .split('')
            // Although _ and $ are valid first characters for classes, they are invalid first characters
            // for tag names. For a better import autocompletion experience, we therefore throw them out.
            .findIndex((char) => /[A-Za-z]/.test(char));
        const withoutLeadingInvalidCharacters = withoutInvalidCharacters.substr(firstValidCharIdx);
        const inPascalCase = pascalCase(withoutLeadingInvalidCharacters);
        const finalName = firstValidCharIdx === -1 ? `A${inPascalCase}` : inPascalCase;
        return `${finalName}${appendSuffix ? COMPONENT_SUFFIX : ''}`;
    } catch (error) {
        console.warn(`Failed to create a name for the component class from filename ${filename}`);
        return undefined;
    }
}
