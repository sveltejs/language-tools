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
    private startEndTransformation: TransformationArray = [];
    private propsTransformation: TransformationArray = [];
    private eventsTransformation: TransformationArray = [];
    private slotLetsTransformation?: [TransformationArray, TransformationArray];
    private endTransformation: TransformationArray = [];
    private startTagStart: number;
    private startTagEnd: number;
    private isSelfclosing: boolean;
    public child?: any;

    // Add const $$xxx = ... only if the variable name is actually used
    // in order to prevent "$$xxx is defined but never used" TS hints
    private addNameConstDeclaration?: () => void;
    private _name: string;
    public get name(): string {
        if (this.addNameConstDeclaration) {
            this.addNameConstDeclaration();
            this.addNameConstDeclaration = undefined;
        }
        return this._name;
    }

    constructor(private str: MagicString, private node: BaseNode, public parent?: any) {
        if (parent) {
            parent.child = this;
        }
        this.isSelfclosing = this.computeIsSelfclosing();
        this.startTagStart = this.node.start;
        this.startTagEnd = this.computeStartTagEnd();

        if (this.node.name === 'svelte:self') {
            // TODO try to get better typing here, maybe TS allows us to use the created class
            // even if it's used in the function that is used to create it
            this._name = '$$_svelteself' + this.computeDepth();
            this.startTransformation.push('{ __sveltets_2_createComponentAny({');
            this.addNameConstDeclaration = () =>
                (this.startTransformation[0] = `{ const ${this._name} = __sveltets_2_createComponentAny({`);
            this.startEndTransformation.push('});');
        } else if (this.node.name === 'svelte:component') {
            this._name = '$$_sveltecomponent' + this.computeDepth();
            this.startTransformation.push(
                `{ const ${this._name}_ = new `,
                [this.node.expression.start, this.node.expression.end],
                '({ target: __sveltets_2_any(), props: {'
            );
            // We don't know if the thing we use to create the Svelte component with
            // is actually a proper Svelte component, which would lead to errors
            // when accessing things like $$prop_def. Therefore widen the type
            // here, falling back to a any-typed component to ensure the user doesn't
            // get weird follup-errors all over the place. The diagnostic error
            // should still error on the new X() part.
            this.startEndTransformation.push(`}});${this._name}_;`);
            this.addNameConstDeclaration = () =>
                (this.startEndTransformation[0] = `}});const ${this._name} = __sveltets_2_typeAsComponent(${this._name}_);`);
        } else {
            this._name = '$$_' + this.node.name + this.computeDepth();
            const nodeNameStart = this.str.original.indexOf(this.node.name, this.node.start);
            this.startTransformation.push(
                '{ new ',
                [nodeNameStart, nodeNameStart + this.node.name.length],
                '({ target: __sveltets_2_any(), props: {'
            );
            this.addNameConstDeclaration = () =>
                (this.startTransformation[0] = `{ const ${this._name} = new `);
            this.startEndTransformation.push('}});');
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
    addEvent([nameStart, nameEnd]: [number, number], expression?: [number, number]): void {
        // This ensures a better mapping as TS will also add the quotes
        // to the range if the event doesn't exist
        // Complicated mapping necessary to preserve better range mappings
        if (nameStart + 1 === nameEnd)
            this.str.overwrite(nameStart, nameEnd, `"${this.str.original.charAt(nameStart)}"`, {
                contentOnly: true
            });
        else {
            this.str.overwrite(
                nameStart,
                nameStart + 1,
                `"${this.str.original.charAt(nameStart)}`,
                {
                    contentOnly: true
                }
            );
            this.str.overwrite(nameEnd - 1, nameEnd, `${this.str.original.charAt(nameEnd - 1)}"`, {
                contentOnly: true
            });
        }

        this.eventsTransformation.push(
            `${this.name}.$on(`,
            [nameStart, nameEnd],
            ', ',
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
                    `{const {${surroundWithIgnoreComments('$$_$$')},`,
                    ...this.slotLetsTransformation[1],
                    `} = ${this.name}.$$slot_def.default;$$_$$;`
                );
            } else {
                namedSlotLetTransformation.push(
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

        if (this.isSelfclosing) {
            transform(this.str, this.startTagStart, this.startTagEnd, this.startTagEnd, [
                // Named slot transformations go first inside a outer block scope because
                // <Comp let:xx {x} /> means "use the x of let:x", and without a separate
                // block scope this would give a "used before defined" error
                ...namedSlotLetTransformation,
                ...this.startTransformation,
                ...this.propsTransformation,
                ...this.startEndTransformation,
                ...this.eventsTransformation,
                ...defaultSlotLetTransformation,
                ...this.endTransformation
            ]);
        } else {
            transform(this.str, this.startTagStart, this.startTagEnd, this.startTagEnd, [
                // See comment above why this goes first
                ...namedSlotLetTransformation,
                ...this.startTransformation,
                ...this.propsTransformation,
                ...this.startEndTransformation,
                ...this.eventsTransformation,
                ...defaultSlotLetTransformation
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
            .match(new RegExp(`</${this.node.name}\\s*>$`));
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
