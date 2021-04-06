import MagicString from 'magic-string';
import { getSlotName } from '../../utils/svelteAst';
import { handleSlot } from './slot';
import { IfScope } from './if-scope';
import { TemplateScope } from '../nodes/template-scope';
import { BaseNode } from '../../interfaces';

/**
 * Special treatment for self-closing / void tags to make them conform to JSX.
 */
export function handleElement(
    htmlx: string,
    str: MagicString,
    node: BaseNode,
    parent: BaseNode,
    ifScope: IfScope,
    templateScope: TemplateScope
): void {
    const slotName = getSlotName(node);
    if (slotName) {
        handleSlot(htmlx, str, node, parent, slotName, ifScope, templateScope);
    }

    //we just have to self close void tags since jsx always wants the />
    const voidTags = 'area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr'.split(
        ','
    );
    if (voidTags.find((x) => x == node.name)) {
        if (htmlx[node.end - 2] != '/') {
            str.appendRight(node.end - 1, '/');
        }
    }

    //some tags auto close when they encounter certain elements, jsx doesn't support this
    if (htmlx[node.end - 1] != '>') {
        str.appendRight(node.end, `</${node.name}>`);
    }
}
