import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { ComponentEvents } from './nodes/ComponentEvents';
import { InstanceScriptProcessResult } from './processInstanceScriptContent';
import { surroundWithIgnoreComments } from '../utils/ignore';

export interface CreateRenderFunctionPara extends InstanceScriptProcessResult {
    str: MagicString;
    scriptTag: Node;
    scriptDestination: number;
    slots: Map<string, Map<string, string>>;
    events: ComponentEvents;
    isTsFile: boolean;
    uses$$SlotsInterface: boolean;
    mode?: 'ts' | 'tsx' | 'dts';
}

export function createRenderFunction({
    str,
    scriptTag,
    scriptDestination,
    slots,
    events,
    exportedNames,
    isTsFile,
    uses$$props,
    uses$$restProps,
    uses$$slots,
    uses$$SlotsInterface,
    generics,
    mode
}: CreateRenderFunctionPara) {
    const useNewTransformation = mode === 'ts';
    const htmlx = str.original;
    let propsDecl = '';

    if (uses$$props) {
        propsDecl += ' let $$props = __sveltets_1_allPropsType();';
    }
    if (uses$$restProps) {
        propsDecl += ' let $$restProps = __sveltets_1_restPropsType();';
    }

    if (uses$$slots) {
        propsDecl +=
            ' let $$slots = __sveltets_1_slotsType({' +
            Array.from(slots.keys())
                .map((name) => `'${name}': ''`)
                .join(', ') +
            '});';
    }

    const slotsDeclaration =
        slots.size > 0 && mode !== 'dts'
            ? '\n' +
              surroundWithIgnoreComments(
                  useNewTransformation
                      ? ';const __sveltets_createSlot = __sveltets_2_createCreateSlot' +
                            (uses$$SlotsInterface ? '<$$Slots>' : '') +
                            '();'
                      : ';const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot' +
                            (uses$$SlotsInterface ? '<$$Slots>' : '') +
                            '();'
              )
            : '';

    if (scriptTag) {
        //I couldn't get magicstring to let me put the script before the <> we prepend during conversion of the template to jsx, so we just close it instead
        const scriptTagEnd = htmlx.lastIndexOf('>', scriptTag.content.start) + 1;
        str.overwrite(scriptTag.start, scriptTag.start + 1, useNewTransformation ? ';' : '</>;');
        str.overwrite(
            scriptTag.start + 1,
            scriptTagEnd,
            `function render${generics.toDefinitionString(true)}() {${propsDecl}\n`
        );

        const scriptEndTagStart = htmlx.lastIndexOf('<', scriptTag.end - 1);
        // wrap template with callback
        str.overwrite(
            scriptEndTagStart,
            scriptTag.end,
            useNewTransformation
                ? `${slotsDeclaration};\n() => {`
                : `${slotsDeclaration};\n() => (<>`,
            {
                contentOnly: true
            }
        );
    } else {
        str.prependRight(
            scriptDestination,
            `${useNewTransformation ? '' : '</>'};function render${generics.toDefinitionString(
                true
            )}() {` + `${propsDecl}${slotsDeclaration}\n${useNewTransformation ? '' : '<>'}`
        );
    }

    const slotsAsDef = uses$$SlotsInterface
        ? '{} as unknown as $$Slots'
        : '{' +
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
        `\nreturn { props: ${exportedNames.createPropsStr(isTsFile)}` +
        `, slots: ${slotsAsDef}` +
        `, getters: ${exportedNames.createRenderFunctionGetterStr()}` +
        `, events: ${events.toDefString()} }}`;

    // wrap template with callback
    if (scriptTag) {
        str.append(useNewTransformation ? '};' : ');');
    }

    str.append(returnString);
}
