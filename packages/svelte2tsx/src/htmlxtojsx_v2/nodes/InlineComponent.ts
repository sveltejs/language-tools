import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';
import { surroundWithIgnoreComments } from '../../utils/ignore';
import { transform, TransformationArray } from '../utils/node-utils';

/**
 * Handles Svelte components as well as svelte:self and svelte:component
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
 * <Comp prop={foo} />
 * // after
 * { const $$_Comp = new Comp({ target: __sveltets_2_any(), props: {"prop": foo,}}); }
 * ```
 */
export class InlineComponent {
    private startTransformation: TransformationArray = [];
    private startEndTransformation: TransformationArray = ['}});'];
    private propsTransformation: TransformationArray = [];
    private eventsTransformation: TransformationArray = [];
    private slotLetsTransformation?: [TransformationArray, TransformationArray];
    private letBindingsTransformation: TransformationArray = [];
    private endTransformation: TransformationArray = [];
    private startTagStart: number;
    private startTagEnd: number;
    private isSelfclosing: boolean;
    public name: string;
    public child?: any;

    constructor(private str: MagicString, private node: BaseNode, public parent?: any) {
        if (parent) {
            parent.child = this;
        }
        this.isSelfclosing = this.computeIsSelfclosing();
        this.startTagStart = this.node.start;
        this.startTagEnd = this.computeStartTagEnd();

        if (this.node.name === 'svelte:self') {
            // TODO
        } else if (this.node.name === 'svelte:component') {
            // TODO
        } else {
            this.name = '$$_' + this.node.name + this.computeDepth();
            const nodeNameStart = this.str.original.indexOf(this.node.name, this.node.start);
            this.startTransformation.push(
                `const ${this.name} = new `,
                [nodeNameStart, nodeNameStart + this.node.name.length],
                '({ target: __sveltets_2_any(), props: {'
            );
        }
    }

    /**
     * prop={foo}  -->  "prop": foo,
     * @param name Property name
     * @param value Attribute value, if present. If not present, this is treated as a shorthand attribute
     */
    addProp(name: TransformationArray, value?: TransformationArray): void {
        if (value) {
            this.propsTransformation.push(...name, ':', ...value, ',');
        } else {
            this.propsTransformation.push(...name, ',');
        }
    }

    /**
     * on:click={xxx}  -->  $$_Component.$on("click", xxx)
     * @param name Event name
     * @param expression Event handler, if present
     */
    addEvent(name: [number, number], expression?: [number, number]): void {
        this.eventsTransformation.push(
            `${this.name}.$on("`,
            name,
            '", ',
            expression ? expression : '() => {}',
            ');'
        );
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

    /**
     * Add something right after the start tag end.
     */
    appendToStartEnd(value: TransformationArray): void {
        this.startEndTransformation.push(...value);
    }

    performTransformation(): void {
        this.endTransformation.push('}');

        const namedSlotLetTransformation: TransformationArray = [];
        const defaultSlotLetTransformation: TransformationArray = [];
        if (this.slotLetsTransformation) {
            if (this.slotLetsTransformation[0][0] === 'default') {
                defaultSlotLetTransformation.push(
                    // add dummy destructuring parameter because if all parameters are unused,
                    // the mapping will be confusing, because TS will highlight the whole destructuring
                    `const {${surroundWithIgnoreComments('$$_$$')},`,
                    ...this.slotLetsTransformation[1],
                    `} = ${this.name}.$$slot_def.default;$$_$$;`
                );
            } else {
                namedSlotLetTransformation.push(
                    // See comment above
                    `const {${surroundWithIgnoreComments('$$_$$')},`,
                    ...this.slotLetsTransformation[1],
                    `} = ${this.parent.name}.$$slot_def["`,
                    ...this.slotLetsTransformation[0],
                    '"];$$_$$;'
                );
            }
        }

        if (this.isSelfclosing) {
            transform(this.str, this.startTagStart, this.startTagEnd, this.startTagEnd, [
                '{ ',
                ...namedSlotLetTransformation,
                ...this.startTransformation,
                ...this.propsTransformation,
                ...this.startEndTransformation,
                ...defaultSlotLetTransformation,
                ...this.eventsTransformation,
                ...this.letBindingsTransformation,
                ...this.endTransformation
            ]);
        } else {
            transform(this.str, this.startTagStart, this.startTagEnd, this.startTagEnd, [
                '{ ',
                ...namedSlotLetTransformation,
                ...this.startTransformation,
                ...this.propsTransformation,
                ...this.startEndTransformation,
                ...defaultSlotLetTransformation,
                ...this.eventsTransformation,
                ...this.letBindingsTransformation
            ]);

            const endStart =
                this.str.original
                    .substring(this.node.start, this.node.end)
                    .lastIndexOf(`</${this.node.name}`) + this.node.start;
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
        if (this.str.original[this.node.end - 2] === '/') {
            return true;
        }
        return !!this.str.original
            .substring(this.node.start, this.node.end)
            .match(new RegExp(`</${this.node.name}\s>$`));
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
