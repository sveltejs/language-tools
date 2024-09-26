import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';
import { surroundWithIgnoreComments } from '../../utils/ignore';
import {
    sanitizePropName,
    surroundWith,
    transform,
    TransformationArray
} from '../utils/node-utils';

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
    private snippetPropsTransformation: TransformationArray = [];
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

    constructor(
        private str: MagicString,
        private node: BaseNode,
        public parent?: any
    ) {
        if (parent) {
            parent.child = this;
        }
        this.isSelfclosing = this.computeIsSelfclosing();
        this.startTagStart = this.node.start;
        this.startTagEnd = this.computeStartTagEnd();

        const tagEnd = this.startTagStart + this.node.name.length + 1;
        // Ensure deleted characters are mapped to the attributes object so we
        // get autocompletion when triggering it on a whitespace.
        if (/\s/.test(str.original.charAt(tagEnd))) {
            this.propsTransformation.push(tagEnd);
            this.propsTransformation.push([tagEnd, tagEnd + 1]);
            // Overwrite necessary or else we get really weird mappings
            this.str.overwrite(tagEnd, tagEnd + 1, '', { contentOnly: true });
        }

        if (this.node.name === 'svelte:self') {
            // TODO try to get better typing here, maybe TS allows us to use the created class
            // even if it's used in the function that is used to create it
            this._name = '$$_svelteself' + this.computeDepth();
            this.startTransformation.push('{ __sveltets_2_createComponentAny({');
            this.addNameConstDeclaration = () =>
                (this.startTransformation[0] = `{ const ${this._name} = __sveltets_2_createComponentAny({`);
            this.startEndTransformation.push('});');
        } else {
            const isSvelteComponentTag = this.node.name === 'svelte:component';
            // We don't know if the thing we use to create the Svelte component with
            // is actually a proper Svelte component, which would lead to errors
            // when accessing things like $$prop_def. Therefore widen the type
            // here, falling back to a any-typed component to ensure the user doesn't
            // get weird followup-errors all over the place. The diagnostic error
            // will be on the __sveltets_2_ensureComponent part, giving a more helpful message
            // The name is reversed here so that when the component is undeclared,
            // TypeScript won't suggest the undeclared variable to be a misspelling of the generated variable
            this._name =
                '$$_' +
                Array.from(sanitizePropName(this.node.name)).reverse().join('') +
                this.computeDepth();
            const constructorName = this._name + 'C';
            const nodeNameStart = isSvelteComponentTag
                ? this.node.expression.start
                : this.str.original.indexOf(this.node.name, this.node.start);
            const nodeNameEnd = isSvelteComponentTag
                ? this.node.expression.end
                : nodeNameStart + this.node.name.length;
            this.startTransformation.push(
                `{ const ${constructorName} = __sveltets_2_ensureComponent(`,
                [nodeNameStart, nodeNameEnd],
                `); new ${constructorName}({ target: __sveltets_2_any(), props: {`
            );
            this.addNameConstDeclaration = () =>
                (this.startTransformation[2] = `); const ${this._name} = new ${constructorName}({ target: __sveltets_2_any(), props: {`);
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
        this.eventsTransformation.push(
            `${this.name}.$on(`,
            surroundWith(this.str, [nameStart, nameEnd], '"', '"'),
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

    addImplicitSnippetProp(name: [number, number], transforms: TransformationArray): void {
        this.addProp([name], transforms);

        this.snippetPropsTransformation.push(this.str.original.slice(name[0], name[1]));
    }

    /**
     * Add something right after the start tag end.
     */
    appendToStartEnd(value: TransformationArray): void {
        this.startEndTransformation.push(...value);
    }

    performTransformation(): void {
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

        const snippetPropVariables = this.snippetPropsTransformation?.join(', ');
        const snippetPropVariablesDeclaration = snippetPropVariables
            ? surroundWithIgnoreComments(
                  `const {${snippetPropVariables}} = ${this.name}.$$prop_def;`
              )
            : '';

        if (this.isSelfclosing) {
            this.endTransformation.push('}');
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
                snippetPropVariablesDeclaration,
                ...this.endTransformation
            ]);
        } else {
            const endStart =
                this.str.original
                    .substring(this.node.start, this.node.end)
                    .lastIndexOf(`</${this.node.name}`) + this.node.start;
            if (!this.node.name.startsWith('svelte:')) {
                // Ensure the end tag is mapped, too. </Component> -> Component}
                this.endTransformation.push([endStart + 2, endStart + this.node.name.length + 2]);
            }
            this.endTransformation.push('}');

            transform(this.str, this.startTagStart, this.startTagEnd, this.startTagEnd, [
                // See comment above why this goes first
                ...namedSlotLetTransformation,
                ...this.startTransformation,
                ...this.propsTransformation,
                ...this.startEndTransformation,
                ...this.eventsTransformation,
                snippetPropVariablesDeclaration,
                ...defaultSlotLetTransformation
            ]);
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
        return this.str.original[this.node.end - 2] === '/';
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
