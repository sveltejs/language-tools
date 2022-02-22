import MagicString from 'magic-string';
import { StyleDirective } from '../../interfaces';
import { buildTemplateString } from '../utils/node-utils';

/**
 * style:xx         --->  __sveltets_1_ensureType(String, Number, xx);
 * style:xx={yy}    --->  __sveltets_1_ensureType(String, Number, yy);
 * style:xx="yy"    --->  __sveltets_1_ensureType(String, Number, "yy");
 * style:xx="a{b}"  --->  __sveltets_1_ensureType(String, Number, `a${b}`);
 */
export function handleStyleDirective(str: MagicString, style: StyleDirective): void {
    const htmlx = str.original;
    if (style.value === true || style.value.length === 0) {
        str.overwrite(
            style.start,
            htmlx.indexOf(':', style.start) + 1,
            '{...__sveltets_1_ensureType(String, Number, '
        );
        str.appendLeft(style.end, ')}');
        return;
    }

    if (style.value.length > 1) {
        buildTemplateString(
            style,
            str,
            htmlx,
            '{...__sveltets_1_ensureType(String, Number, `',
            '`)}',
            style.start
        );
        return;
    }

    const styleVal = style.value[0];
    if (styleVal.type === 'Text') {
        str.overwrite(style.start, styleVal.start, '{...__sveltets_1_ensureType(String, Number, "');
        if (styleVal.end === style.end) {
            str.appendLeft(style.end, '")}');
        } else {
            str.overwrite(styleVal.end, style.end, '")}');
        }
    } else {
        // MustacheTag
        str.overwrite(
            style.start,
            styleVal.start + 1,
            '{...__sveltets_1_ensureType(String, Number, '
        );
        str.overwrite(styleVal.end - 1, style.end, ')}');
    }
}
