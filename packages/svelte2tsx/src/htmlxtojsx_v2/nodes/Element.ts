import MagicString from 'magic-string';
import { BaseDirective, BaseNode } from '../../interfaces';
import { surroundWithIgnoreComments } from '../../utils/ignore';
import {
    transform,
    TransformationArray,
    sanitizePropName,
    surroundWith,
    getDirectiveNameStartEndIdx,
    rangeWithTrailingPropertyAccess
} from '../utils/node-utils';

const voidTags = 'area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr'.split(',');

/**
 * Handles HTML elements as well as svelte:options, svelte:head, svelte:window, svelte:body, svelte:element
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
    private startEndTransformation: TransformationArray = ['});'];
    private attrsTransformation: TransformationArray = [];
    private slotLetsTransformation?: [TransformationArray, TransformationArray];
    private actionsTransformation: TransformationArray = [];
    private actionIdentifiers: string[] = [];
    private endTransformation: TransformationArray = [];
    private startTagStart: number;
    private startTagEnd: number;
    private isSelfclosing: boolean;
    public tagName: string;
    public child?: any;
    private tagNameEnd: number;

    // Add const $$xxx = ... only if the variable name is actually used
    // in order to prevent "$$xxx is defined but never used" TS hints
    private referencedName = false;
    private _name: string;
    public get name(): string {
        this.referencedName = true;
        return this._name;
    }

    /**
     * @param str The MagicString instance used to manipulate the text
     * @param node The Svelte AST node that represents this element
     * @param typingsNamespace Determines which namespace to use for the createElement function
     * @param parent The Svelte AST parent node
     */
    constructor(
        private str: MagicString,
        private node: BaseNode,
        public typingsNamespace: string,
        public parent?: any
    ) {
        if (parent) {
            parent.child = this;
        }

        this.tagName = this.node.name === 'svelte:body' ? 'body' : this.node.name;
        this.isSelfclosing = this.computeIsSelfclosing();
        this.startTagStart = this.node.start;
        this.startTagEnd = this.computeStartTagEnd();

        const tagEnd = (this.tagNameEnd = this.startTagStart + this.node.name.length + 1);
        // Ensure deleted characters are mapped to the attributes object so we
        // get autocompletion when triggering it on a whitespace.
        if (/\s/.test(str.original.charAt(tagEnd))) {
            this.attrsTransformation.push(tagEnd);
            this.attrsTransformation.push([tagEnd, tagEnd + 1]);
            // Overwrite necessary or else we get really weird mappings
            this.str.overwrite(tagEnd, tagEnd + 1, '', { contentOnly: true });
        }

        switch (this.node.name) {
            // Although not everything that is possible to add to Element
            // is valid on the special svelte elements,
            // we still also handle them here and let the Svelte parser handle invalid
            // cases. For us it doesn't make a difference to a normal HTML element.
            case 'svelte:options':
            case 'svelte:head':
            case 'svelte:window':
            case 'svelte:body':
            case 'svelte:fragment': {
                // remove the colon: svelte:xxx -> sveltexxx
                const nodeName = `svelte${this.node.name.substring(7)}`;
                this._name = '$$_' + nodeName + this.computeDepth();
                break;
            }
            case 'svelte:element': {
                this._name = '$$_svelteelement' + this.computeDepth();
                break;
            }
            case 'slot': {
                this._name = '$$_slot' + this.computeDepth();
                break;
            }
            default: {
                this._name = '$$_' + sanitizePropName(this.node.name) + this.computeDepth();
                break;
            }
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
        this.slotLetsTransformation = this.slotLetsTransformation || [['default'], []];
        this.slotLetsTransformation[1].push(...transformation, ',');
    }

    addAction(attr: BaseDirective) {
        const id = `$$action_${this.actionIdentifiers.length}`;
        this.actionIdentifiers.push(id);
        if (!this.actionsTransformation.length) {
            this.actionsTransformation.push('{');
        }

        this.actionsTransformation.push(
            `const ${id} = __sveltets_2_ensureAction(`,
            getDirectiveNameStartEndIdx(this.str, attr),
            `(${this.typingsNamespace}.mapElementTag('${this.tagName}')`
        );
        if (attr.expression) {
            this.actionsTransformation.push(
                ',(',
                rangeWithTrailingPropertyAccess(this.str.original, attr.expression),
                ')'
            );
        }
        this.actionsTransformation.push('));');
    }

    /**
     * Add something right after the start tag end.
     */
    appendToStartEnd(value: TransformationArray): void {
        this.startEndTransformation.push(...value);
    }

    performTransformation(): void {
        this.endTransformation.push('}');

        const slotLetTransformation: TransformationArray = [];
        if (this.slotLetsTransformation) {
            if (this.slotLetsTransformation[0][0] === 'default') {
                slotLetTransformation.push(
                    // add dummy destructuring parameter because if all parameters are unused,
                    // the mapping will be confusing, because TS will highlight the whole destructuring
                    `{const {${surroundWithIgnoreComments('$$_$$')},`,
                    ...this.slotLetsTransformation[1],
                    `} = ${this.parent.name}.$$slot_def.default;$$_$$;`
                );
            } else {
                slotLetTransformation.push(
                    // See comment above
                    `{const {${surroundWithIgnoreComments('$$_$$')},`,
                    ...this.slotLetsTransformation[1],
                    `} = ${this.parent.name}.$$slot_def["`,
                    ...this.slotLetsTransformation[0],
                    '"];$$_$$;'
                );
            }
            this.endTransformation.push('}');
        }

        if (this.actionIdentifiers.length) {
            this.endTransformation.push('}');
        }

        if (this.isSelfclosing) {
            // The transformation is the whole start tag + <, ex: <span
            // To avoid the end tag transform being moved to before the tag name,
            // manually remove the first character and let the `transform` function skip removing unused
            let transformEnd = this.startTagEnd;
            if (
                this.str.original[transformEnd - 1] !== '>' &&
                (transformEnd === this.tagNameEnd || transformEnd === this.tagNameEnd + 1)
            ) {
                transformEnd = this.startTagStart;
                this.str.remove(this.startTagStart, this.startTagStart + 1);
            }

            transform(this.str, this.startTagStart, transformEnd, [
                // Named slot transformations go first inside a outer block scope because
                // <div let:xx {x} /> means "use the x of let:x", and without a separate
                // block scope this would give a "used before defined" error
                ...slotLetTransformation,
                ...this.actionsTransformation,
                ...this.getStartTransformation(),
                ...this.attrsTransformation,
                ...this.startEndTransformation,
                ...this.endTransformation
            ]);
        } else {
            transform(this.str, this.startTagStart, this.startTagEnd, [
                ...slotLetTransformation,
                ...this.actionsTransformation,
                ...this.getStartTransformation(),
                ...this.attrsTransformation,
                ...this.startEndTransformation
            ]);

            const closingTag = this.str.original.substring(
                this.str.original.lastIndexOf('</', this.node.end - 1) + 2,
                this.node.end - 1
            );

            const tagEndIdx = this.str.original
                .substring(this.node.start, this.node.end)
                .lastIndexOf(`</${this.node.name}`);
            // tagEndIdx === -1 happens in situations of unclosed tags like `<p>fooo <p>anothertag</p>`
            const endStart =
                tagEndIdx === -1 || closingTag.trim() !== this.node.name
                    ? this.node.end
                    : tagEndIdx + this.node.start;
            transform(this.str, endStart, this.node.end, this.endTransformation);
        }
    }

    private getStartTransformation(): TransformationArray {
        const createElement = `${this.typingsNamespace}.createElement`;
        const addActions = () => {
            if (this.actionIdentifiers.length) {
                return `, __sveltets_2_union(${this.actionIdentifiers.join(',')})`;
            } else {
                return '';
            }
        };

        let createElementStatement: TransformationArray;
        switch (this.node.name) {
            // Although not everything that is possible to add to Element
            // is valid on the special svelte elements,
            // we still also handle them here and let the Svelte parser handle invalid
            // cases. For us it doesn't make a difference to a normal HTML element.
            case 'svelte:options':
            case 'svelte:head':
            case 'svelte:window':
            case 'svelte:body':
            case 'svelte:fragment': {
                createElementStatement = [`${createElement}("${this.node.name}"${addActions()}, {`];
                break;
            }
            case 'svelte:element': {
                const nodeName = this.node.tag
                    ? typeof this.node.tag !== 'string'
                        ? ([this.node.tag.start, this.node.tag.end] as [number, number])
                        : `"${this.node.tag}"`
                    : '""';
                createElementStatement = [`${createElement}(`, nodeName, `${addActions()}, {`];
                break;
            }
            case 'slot': {
                // If the element is a <slot> tag, create the element with the createSlot-function
                // which is created inside createRenderFunction.ts to check that the name and attributes
                // of the slot tag are correct. The check will error if the user defined $$Slots
                // and the slot definition or its attributes contradict that type definition.
                const slotName =
                    this.node.attributes?.find((a: BaseNode) => a.name === 'name')?.value[0] ||
                    'default';
                createElementStatement = [
                    '__sveltets_createSlot(',
                    typeof slotName === 'string'
                        ? `"${slotName}"`
                        : surroundWith(this.str, [slotName.start, slotName.end], '"', '"'),
                    ', {'
                ];
                break;
            }
            default: {
                createElementStatement = [
                    `${createElement}("`,
                    [this.node.start + 1, this.tagNameEnd],
                    `"${addActions()}, {`
                ];
                break;
            }
        }

        if (this.referencedName) {
            createElementStatement[0] = `const ${this._name} = ` + createElementStatement[0];
        }
        createElementStatement[0] = `{ ${createElementStatement[0]}`;
        return createElementStatement;
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
            // Paranoid check because theoretically there could be other void
            // tags in different namespaces other than HTML
            !this.str.original
                .substring(this.node.start, this.node.end)
                .match(new RegExp(`</${this.node.name}\\s*>$`))
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
