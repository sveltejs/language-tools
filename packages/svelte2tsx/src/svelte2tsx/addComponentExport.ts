import { pascalCase } from 'pascal-case';
import path from 'path';
import MagicString from 'magic-string';
import { ExportedNames } from './nodes/ExportedNames';
import { ComponentDocumentation } from './nodes/ComponentDocumentation';
import { Generics } from './nodes/Generics';

export interface AddComponentExportPara {
    str: MagicString;
    uses$$propsOr$$restProps: boolean;
    /**
     * If true, not fallback to `any`
     * -> all unknown events will throw a type error
     * */
    strictEvents: boolean;
    isTsFile: boolean;
    usesAccessors: boolean;
    exportedNames: ExportedNames;
    fileName?: string;
    componentDocumentation: ComponentDocumentation;
    mode: 'dts' | 'tsx';
    generics: Generics;
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
    strictEvents,
    uses$$propsOr$$restProps,
    exportedNames,
    componentDocumentation,
    fileName,
    mode,
    usesAccessors,
    str,
    generics
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
        return ${props(
            true,
            uses$$propsOr$$restProps,
            exportedNames,
            `render${genericsRef}()`
        )}.props;
    }
    events() {
        return ${events(strictEvents, `render${genericsRef}()`)}.events;
    }
    slots() {
        return render${genericsRef}().slots;
    }
}
`;

    if (mode === 'dts') {
        statement +=
            `export type ${className}Props${genericsDef} = ${returnType('props')};\n` +
            `export type ${className}Events${genericsDef} = ${returnType('events')};\n` +
            `export type ${className}Slots${genericsDef} = ${returnType('slots')};\n` +
            `\n${doc}export default class${
                className ? ` ${className}` : ''
            }${genericsDef} extends SvelteComponentTyped<${className}Props${genericsRef}, ${className}Events${genericsRef}, ${className}Slots${genericsRef}> {` + // eslint-disable-line max-len
            exportedNames.createClassGetters() +
            (usesAccessors ? exportedNames.createClassAccessors() : '') +
            '\n}';
    } else {
        statement +=
            `\n\n${doc}export default class${
                className ? ` ${className}` : ''
            }${genericsDef} extends Svelte2TsxComponent<${returnType('props')}, ${returnType(
                'events'
            )}, ${returnType('slots')}> {` +
            exportedNames.createClassGetters() +
            (usesAccessors ? exportedNames.createClassAccessors() : '') +
            '\n}';
    }

    str.append(statement);
}

function addSimpleComponentExport({
    strictEvents,
    isTsFile,
    uses$$propsOr$$restProps,
    exportedNames,
    componentDocumentation,
    fileName,
    mode,
    usesAccessors,
    str
}: AddComponentExportPara) {
    const propDef = props(
        isTsFile,
        uses$$propsOr$$restProps,
        exportedNames,
        events(strictEvents, 'render()')
    );

    const doc = componentDocumentation.getFormatted();
    const className = fileName && classNameFromFilename(fileName, mode !== 'dts');

    let statement: string;
    if (mode === 'dts' && isTsFile) {
        statement =
            `\nconst __propDef = ${propDef};\n` +
            `export type ${className}Props = typeof __propDef.props;\n` +
            `export type ${className}Events = typeof __propDef.events;\n` +
            `export type ${className}Slots = typeof __propDef.slots;\n` +
            `\n${doc}export default class${
                className ? ` ${className}` : ''
            } extends SvelteComponentTyped<${className}Props, ${className}Events, ${className}Slots> {` + // eslint-disable-line max-len
            exportedNames.createClassGetters() +
            (usesAccessors ? exportedNames.createClassAccessors() : '') +
            '\n}';
    } else if (mode === 'dts' && !isTsFile) {
        statement =
            `\nconst __propDef = ${propDef};\n` +
            `/** @typedef {typeof __propDef.props}  ${className}Props */\n` +
            `/** @typedef {typeof __propDef.events}  ${className}Events */\n` +
            `/** @typedef {typeof __propDef.slots}  ${className}Slots */\n` +
            `\n${doc}export default class${
                className ? ` ${className}` : ''
            } extends __sveltets_1_createSvelteComponentTyped(${propDef}) {` +
            exportedNames.createClassGetters() +
            (usesAccessors ? exportedNames.createClassAccessors() : '') +
            '\n}';
    } else {
        statement =
            `\n\n${doc}export default class${
                className ? ` ${className}` : ''
            } extends __sveltets_1_createSvelte2TsxComponent(${propDef}) {` +
            exportedNames.createClassGetters() +
            (usesAccessors ? exportedNames.createClassAccessors() : '') +
            '\n}';
    }

    str.append(statement);
}

function events(strictEvents: boolean, renderStr: string) {
    return strictEvents ? renderStr : `__sveltets_1_with_any_event(${renderStr})`;
}

function props(
    isTsFile: boolean,
    uses$$propsOr$$restProps: boolean,
    exportedNames: ExportedNames,
    renderStr: string
) {
    if (isTsFile) {
        return uses$$propsOr$$restProps ? `__sveltets_1_with_any(${renderStr})` : renderStr;
    } else {
        const optionalProps = exportedNames.createOptionalPropsArray();
        const partial = `__sveltets_1_partial${uses$$propsOr$$restProps ? '_with_any' : ''}`;
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
