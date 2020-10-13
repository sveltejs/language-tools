import MagicString from 'magic-string';
import { Node } from 'estree-walker';

/**
 * Special treatment for self-closing / void tags to make them conform to JSX.
 */
export function handleElement(htmlx: string, str: MagicString, node: Node): void {
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
