import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';
import { surroundWithIgnoreComments } from '../../utils/ignore';
import { transform, TransformationArray, sanitizePropName } from '../utils/node-utils';

const voidTags = 'area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr'.split(',');

/**
 * Handles HTML elements as well as svelte:options, svelte:head, svelte:window, svelte:body
 *
 * Children of this element should call the methods on this class to add themselves to the correct
 * position within the transformation.
 *
 * The transformation result does not have anything to do with HTMLx, it instead uses plan JS,
 * leveraging scoped blocks (`{ ... }`). Each element is transformed to something that is
 * contained in such a block. This ensures we can declare variables inside that do not leak
 * to the outside while preserving TypeScript's control flow.
 *
 * A transformation reads for example like this:
 * ```
 * // before
 * <div class={foo} />
 * // after
 * { const $$_div = __sveltets_2_createElement("div", {"class": foo,}); }
 * ```
 */
export class Element {
    private startTransformation: TransformationArray = [];
    private startEndTransformation: TransformationArray = ['});'];
    private attrsTransformation: TransformationArray = [];
    private slotLetsTransformation?: [TransformationArray, TransformationArray];
    private endTransformation: TransformationArray = [];
    private startTagStart: number;
    private startTagEnd: number;
    private isSelfclosing: boolean;
    public name: string;
    public tagName: string;
    public child?: any;

    /**
     * @param str The MagicString instance used to manipulate the text
     * @param node The Svelte AST node that represents this element
     * @param typingsNamespace Determines which createElement function to use. If 'html'/'native', it uses
     *                         a function which provides type-checks and errors on for example wrong
     *                         attributes. If 'any', it falls back to a "everything goes" function
     *                         which is needed for example for Svelte Native.
     * @param parent The Svelte AST parent node
     */
    constructor(
        private str: MagicString,
        private node: BaseNode,
        private typingsNamespace: 'html' | 'native' | 'any',
        public parent?: any
    ) {
        if (parent) {
            parent.child = this;
        }

        this.tagName = this.node.name === 'svelte:body' ? 'body' : this.node.name;
        this.isSelfclosing = this.computeIsSelfclosing();
        this.startTagStart = this.node.start;
        this.startTagEnd = this.computeStartTagEnd();
        const createElement =
            this.typingsNamespace === 'html'
                ? '__sveltets_2_createElement'
                : this.typingsNamespace === 'native'
                ? '__sveltets_2_createElementNative'
                : '__sveltets_2_createElementAny';

        switch (this.node.name) {
            // Although not everything that is possible to add to Element
            // is valid on the special svelte elements,
            // we still also handle them here and let the Svelte parser handle invalid
            // cases. For us it doesn't make a difference to a normal HTML element.
            case 'svelte:options':
            case 'svelte:head':
            case 'svelte:window':
            case 'svelte:body':
            case 'svelte:fragment':
                // remove the colon: svelte:xxx -> sveltexxx
                const nodeName = `svelte${this.node.name.substring(7)}`;
                this.name = '$$_' + nodeName + this.computeDepth();
                this.startTransformation.push(
                    `{ const ${this.name} = ${createElement}("${nodeName}", {`
                );
                break;
            case 'slot':
                // If the element is a <slot> tag, create the element with the createSlot-function
                // which is created inside createRenderFunction.ts to check that the name and attributes
                // of the slot tag are correct. The check will error if the user defined $$Slots
                // and the slot definition or its attributes contradict that type definition.
                this.name = '$$_slot' + this.computeDepth();
                const slotName =
                    this.node.attributes?.find((a: BaseNode) => a.name === 'name')?.value[0] ||
                    'default';
                this.startTransformation.push(
                    `{ const ${this.name} = __sveltets_createSlot("`,
                    typeof slotName === 'string' ? slotName : [slotName.start, slotName.end],
                    '", {'
                );
                break;
            default:
                this.name = '$$_' + sanitizePropName(this.node.name) + this.computeDepth();
                this.startTransformation.push(
                    `{ const ${this.name} = ${createElement}("`,
                    [this.node.start + 1, this.node.start + 1 + this.node.name.length],
                    '", {'
                );
                break;
        }
    }

    /**
     * attribute={foo}  -->  "attribute": foo,
     * @param name Attribute name
     * @param value Attribute value, if present. If not present, this is treated as a shorthand attribute
     */
    addAttribute(name: TransformationArray, value?: TransformationArray): void {
        if (value) {
            this.attrsTransformation.push(...name, ':', ...value, ',');
        } else {
            this.attrsTransformation.push(...name, ',');
        }
    }

    /**
     * Handle the slot of `<... slot=".." />`
     * @param transformation Slot name transformation
     */
    addSlotName(transformation: TransformationArray): void {
        this.slotLetsTransformation = this.slotLetsTransformation || [[], []];
        this.slotLetsTransformation[0] = transformation;
    }

    /**
     * Handle the let: of `<... let:xx={yy} />`
     * @param transformation Let transformation
     */
    addSlotLet(transformation: TransformationArray): void {
        this.slotLetsTransformation = this.slotLetsTransformation || [[], []];
        this.slotLetsTransformation[1].push(...transformation, ',');
    }

    /**
     * Add something right after the start tag end.
     */
    appendToStartEnd(value: TransformationArray): void {
        this.startEndTransformation.push(...value);
    }

    performTransformation(): void {
        this.endTransformation.push('}');

        const namedSlotLetTransformation: TransformationArray = [];
        if (this.slotLetsTransformation) {
            namedSlotLetTransformation.push(
                // add dummy destructuring parameter because if all parameters are unused,
                // the mapping will be confusing, because TS will highlight the whole destructuring
                `{ const {${surroundWithIgnoreComments('$$_$$')},`,
                ...this.slotLetsTransformation[1],
                `} = ${this.parent.name}.$$slot_def["`,
                ...this.slotLetsTransformation[0],
                '"];$$_$$;'
            );
            this.endTransformation.push('}');
        }

        if (this.isSelfclosing) {
            transform(this.str, this.startTagStart, this.startTagEnd, this.startTagEnd, [
                // Named slot transformations go first inside a outer block scope because
                // <div let:xx {x} /> means "use the x of let:x", and without a separate
                // block scope this would give a "used before defined" error
                ...namedSlotLetTransformation,
                ...this.startTransformation,
                ...this.attrsTransformation,
                ...this.startEndTransformation,
                ...this.endTransformation
            ]);
        } else {
            transform(this.str, this.startTagStart, this.startTagEnd, this.startTagEnd, [
                ...namedSlotLetTransformation,
                ...this.startTransformation,
                ...this.attrsTransformation,
                ...this.startEndTransformation
            ]);

            const tagEndIdx = this.str.original
                .substring(this.node.start, this.node.end)
                .lastIndexOf(`</${this.node.name}`);
            // tagEndIdx === -1 happens in situations of unclosed tags like `<p>fooo <p>anothertag</p>`
            const endStart = tagEndIdx === -1 ? this.node.end : tagEndIdx + this.node.start;
            transform(this.str, endStart, this.node.end, this.node.end, this.endTransformation);
        }
    }

    private computeStartTagEnd() {
        if (this.node.children?.length) {
            return this.node.children[0].start;
        }
        return this.isSelfclosing
            ? this.node.end
            : this.str.original.lastIndexOf('>', this.node.end - 2) + 1;
    }

    private computeIsSelfclosing() {
        if (this.str.original[this.node.end - 2] === '/' || voidTags.includes(this.node.name)) {
            return true;
        }
        return (
            !this.node.children?.length &&
            !this.str.original
                .substring(this.node.start, this.node.end)
                .match(new RegExp(`</${this.node.name}\s*>$`))
        );
    }

    private computeDepth() {
        let idx = 0;
        let parent = this.parent;
        while (parent) {
            parent = parent.parent;
            idx++;
        }
        return idx;
    }
}