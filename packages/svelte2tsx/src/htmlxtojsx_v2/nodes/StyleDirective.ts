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
    if (style.value === true || style.value.length === 0) {
        element.appendToStartEnd([
            '__sveltets_2_ensureType(String, Number, ',
            [htmlx.indexOf(':', style.start) + 1, style.end],
            ');'
        ]);
        return;
    }

    let start = style.value[0].start;
    if (style.value[0].type === 'MustacheTag') {
        start++;
    }
    const last = style.value[style.value.length - 1];
    let end = last.end;
    if (last.type === 'MustacheTag') {
        end--;
    }

    if (style.value.length > 1) {
        // We have multiple attribute values, so we build a template string out of them.
        for (const n of style.value) {
            if (n.type === 'MustacheTag') {
                str.appendRight(n.start, '$');
            }
        }
        element.appendToStartEnd([
            '__sveltets_2_ensureType(String, Number, `',
            [start, end],
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
            `__sveltets_2_ensureType(String, Number, ${quote}`,
            [start, end],
            `${quote});`
        ]);
    } else {
        // MustacheTag
        element.appendToStartEnd(['__sveltets_2_ensureType(String, Number, ', [start, end], ');']);
    }
}
