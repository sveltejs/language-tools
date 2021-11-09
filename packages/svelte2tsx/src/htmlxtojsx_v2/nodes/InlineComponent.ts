import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';
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
    private startEndTransformation: TransformationArray = [];
    private propsTransformation: TransformationArray = [];
    private eventsTransformation: TransformationArray = [];
    private letBindingsTransformation: TransformationArray = [];
    private endTransformation: TransformationArray = [];
    private startTagStart: number;
    private startTagEnd: number;
    private name: string;
    private isSelfclosing: boolean;
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
            this.name = '$$_' + this.node.name;
            this.startTransformation.push(
                `{ const ${this.name} = new ${this.node.name}({ target: __sveltets_2_any(), props: {`
            );
        }
    }

    /**
     * prop={foo}  -->  "prop": foo,
     * @param name Property name
     * @param value Property value, if present. Falls back to undefined if not given.
     */
    addProp(name: TransformationArray, value: TransformationArray = ['undefined']): void {
        this.propsTransformation.push(...name, ':', ...value, ',');
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

    performTransformation(): void {
        this.startEndTransformation.push('}});');
        this.endTransformation.push('}');

        if (this.isSelfclosing) {
            transform(this.str, this.startTagStart, this.startTagEnd, this.startTagEnd, [
                ...this.startTransformation,
                ...this.propsTransformation,
                ...this.startEndTransformation,
                ...this.eventsTransformation,
                ...this.letBindingsTransformation,
                ...this.endTransformation
            ]);
        } else {
            transform(this.str, this.startTagStart, this.startTagEnd, this.startTagEnd, [
                ...this.startTransformation,
                ...this.propsTransformation,
                ...this.startEndTransformation,
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
}
