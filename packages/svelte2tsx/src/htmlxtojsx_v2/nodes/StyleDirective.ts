import MagicString from 'magic-string';
import { StyleDirective } from '../../interfaces';
import { Element } from './Element';

/**
 * style:xx         --->  __sveltets_2_ensureType(String, Number, xx);
 * style:xx={yy}    --->  __sveltets_2_ensureType(String, Number, yy);
 * style:xx="yy"    --->  __sveltets_2_ensureType(String, Number, "yy");
 * style:xx="a{b}"  --->  __sveltets_2_ensureType(String, Number, `a${b}`);
 */
export function handleStyleDirective(
    str: MagicString,
    style: StyleDirective,
    element: Element
): void {
    const htmlx = str.original;
    const ensureType = '__sveltets_2_ensureType(String, Number, ';
    if (style.value === true || style.value.length === 0) {
        element.appendToStartEnd([
            ensureType,
            [htmlx.indexOf(':', style.start) + 1, style.end],
            ');'
        ]);
        return;
    }

    if (style.value.length > 1) {
        // We have multiple attribute values, so we build a template string out of them.
        for (const n of style.value) {
            if (n.type === 'MustacheTag') {
                str.appendRight(n.start, '$');
            }
        }
        element.appendToStartEnd([
            ensureType + '`',
            [style.value[0].start, style.value[style.value.length - 1].end],
            '`);'
        ]);
        return;
    }

    const styleVal = style.value[0];
    if (styleVal.type === 'Text') {
        const quote = ['"', "'"].includes(str.original[styleVal.start - 1])
            ? str.original[styleVal.start - 1]
            : '"';
        element.appendToStartEnd([
            `${ensureType}${quote}`,
            [styleVal.start, styleVal.end],
            `${quote});`
        ]);
    } else {
        // MustacheTag
        element.appendToStartEnd([ensureType, [styleVal.start + 1, styleVal.end - 1], ');']);
    }
}
