import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { getIdentifiersInIfExpression } from '../utils/node-utils';
import { TemplateScope } from '../nodes/template-scope';
import { surroundWithIgnoreComments } from '../../utils/ignore';

enum IfType {
    If,
    ElseIf,
    Else
}

interface ConditionInfo {
    identifiers: Map<string, Array<{ start: number; end: number }>>;
    text: string;
}

interface IfCondition {
    type: IfType.If;
    condition: ConditionInfo;
}

interface ElseIfCondition {
    type: IfType.ElseIf;
    condition: ConditionInfo;
    parent: IfCondition | ElseIfCondition;
}

interface ElseCondition {
    type: IfType.Else;
    parent: IfCondition | ElseIfCondition;
}
type Condition = IfCondition | ElseIfCondition | ElseCondition;

const REPLACEMENT_PREFIX = '\u03A9';

/**
 * Returns the full currently known condition. Identifiers in the condition
 * get replaced if they were redeclared.
 */
function getFullCondition(
    condition: Condition,
    replacedNames: string[],
    replacementPrefix: string
): string {
    switch (condition.type) {
        case IfType.If:
            return _getFullCondition(condition, false, replacedNames, replacementPrefix);
        case IfType.ElseIf:
            return _getFullCondition(condition, false, replacedNames, replacementPrefix);
        case IfType.Else:
            return _getFullCondition(condition, false, replacedNames, replacementPrefix);
    }
}

function _getFullCondition(
    condition: Condition,
    negate: boolean,
    replacedNames: string[],
    replacementPrefix: string
): string {
    switch (condition.type) {
        case IfType.If:
            return negate
                ? `!(${getConditionString(condition.condition, replacedNames, replacementPrefix)})`
                : `(${getConditionString(condition.condition, replacedNames, replacementPrefix)})`;
        case IfType.ElseIf:
            return `${_getFullCondition(
                condition.parent,
                true,
                replacedNames,
                replacementPrefix
            )} && ${negate ? '!' : ''}(${getConditionString(
                condition.condition,
                replacedNames,
                replacementPrefix
            )})`;
        case IfType.Else:
            return `${_getFullCondition(condition.parent, true, replacedNames, replacementPrefix)}`;
    }
}

/**
 * Alter a condition text such that identifiers which needs replacement
 * are replaced accordingly.
 */
function getConditionString(
    condition: ConditionInfo,
    replacedNames: string[],
    replacementPrefix: string
): string {
    const replacements: Array<{ name: string; start: number; end: number }> = [];
    for (const name of replacedNames) {
        const occurences = condition.identifiers.get(name);
        if (occurences) {
            for (const occurence of occurences) {
                replacements.push({ ...occurence, name });
            }
        }
    }

    if (!replacements.length) {
        return condition.text;
    }

    replacements.sort((r1, r2) => r1.start - r2.start);
    return (
        condition.text.substring(0, replacements[0].start) +
        replacements
            .map(
                (replacement, idx) =>
                    replacementPrefix +
                    replacement.name +
                    condition.text.substring(replacement.end, replacements[idx + 1]?.start)
            )
            .join('')
    );
}

/**
 * Returns a set of all identifiers that were used in this condition
 */
function collectReferencedIdentifiers(condition: Condition | undefined): Set<string> {
    const identifiers = new Set<string>();
    let current = condition;
    while (current) {
        if (current.type === IfType.ElseIf || current.type === IfType.If) {
            for (const identifier of current.condition.identifiers.keys()) {
                identifiers.add(identifier);
            }
        }
        current =
            current.type === IfType.ElseIf || current.type === IfType.Else
                ? current.parent
                : undefined;
    }
    return identifiers;
}

/**
 * A scope contains a if-condition including else(if) branches.
 * The branches are added over time and the whole known condition is updated accordingly.
 *
 * This class is then mainly used to reprint if-conditions. This is necessary when
 * a lambda-function is declared within the jsx-template because that function loses
 * the control flow information. The reprint should be prepended to the jsx-content
 * of the lambda function.
 *
 * Example:
 * `{check ? {() => {<p>hi</p>}} : ''}`
 * becomes
 * `{check ? {() => {check && <p>hi</p>}} : ''}`
 *
 * Most of the logic in here deals with the possibility of shadowed variables.
 * Example:
 * `{check ? {(check) => {<p>{check}</p>}} : ''}`
 * becomes
 * `{check ? {const Ωcheck = check;(check) => {Ωcheck && <p>{check}</p>}} : ''}`
 *
 */
export class IfScope {
    private child?: IfScope;
    private ownScope = this.scope.value;
    private replacementPrefix = REPLACEMENT_PREFIX.repeat(this.computeDepth());

    constructor(
        private scope: { value: TemplateScope },
        private current?: Condition,
        private parent?: IfScope
    ) {}

    /**
     * Returns the full currently known condition, prepended with the conditions
     * of its parents. Identifiers in the condition get replaced if they were redeclared.
     */
    getFullCondition(skipImmediateChildScope = false): string {
        if (!this.current) {
            return '';
        }

        const parentCondition = this.parent?.getFullCondition(false);
        const condition = `(${getFullCondition(
            this.current,
            this.getNamesThatNeedReplacement(skipImmediateChildScope),
            this.replacementPrefix
        )})`;
        return parentCondition ? `(${parentCondition}) && ${condition}` : condition;
    }

    /**
     * Convenience method which invokes `getFullCondition` and adds a `&&` at the end
     * for easy chaining.
     */
    addPossibleIfCondition(skipImmediateChildScope = false): string {
        const condition = this.getFullCondition(skipImmediateChildScope);
        return condition ? surroundWithIgnoreComments(`${condition} && `) : '';
    }

    /**
     * Adds a new child IfScope.
     */
    addNestedIf(expression: Node, str: MagicString): void {
        const condition = this.getConditionInfo(str, expression);
        const ifScope = new IfScope(this.scope, { condition, type: IfType.If }, this);
        this.child = ifScope;
    }

    /**
     * Adds a `else if` branch to the scope and enhances the condition accordingly.
     */
    addElseIf(expression: Node, str: MagicString): void {
        const condition = this.getConditionInfo(str, expression);
        this.current = {
            condition,
            parent: this.current as IfCondition | ElseIfCondition,
            type: IfType.ElseIf
        };
    }

    /**
     * Adds a `else` branch to the scope and enhances the condition accordingly.
     */
    addElse(): void {
        this.current = { parent: this.current as IfCondition | ElseIfCondition, type: IfType.Else };
    }

    getChild(): IfScope {
        return this.child || this;
    }

    getParent(): IfScope {
        return this.parent || this;
    }

    /**
     * Returns a set of all identifiers that were used in this IfScope and its parent scopes.
     */
    collectReferencedIdentifiers(): Set<string> {
        const current = collectReferencedIdentifiers(this.current);
        const parent = this.parent?.collectReferencedIdentifiers();
        if (parent) {
            for (const identifier of parent) {
                current.add(identifier);
            }
        }
        return current;
    }

    /**
     * Should be invoked when a new template scope which resets control flow (await, each, slot) is created.
     * The returned string contains a list of `const` declarations which redeclares the identifiers
     * in the conditions which would be overwritten by the scope
     * (because they declare a variable with the same name, therefore shadowing the outer variable).
     */
    getConstsToRedeclare(): string {
        const replacements = this.getNamesToRedeclare()
            .map((identifier) => `${this.replacementPrefix + identifier}=${identifier}`)
            .join(',');
        return replacements ? surroundWithIgnoreComments(`const ${replacements};`) : '';
    }

    /**
     * Returns true if given identifier is referenced in this IfScope or a parent scope.
     */
    referencesIdentifier(name: string): boolean {
        const current = collectReferencedIdentifiers(this.current);
        if (current.has(name)) {
            return true;
        }
        if (!this.parent || this.ownScope.inits.has(name)) {
            return false;
        }
        return this.parent.referencesIdentifier(name);
    }

    private getConditionInfo(str: MagicString, expression: Node) {
        const identifiers = getIdentifiersInIfExpression(expression);
        const text = str.original.substring(expression.start, expression.end);
        return { identifiers, text };
    }

    /**
     * Contains a list of identifiers which would be overwritten by the child template scope.
     */
    private getNamesToRedeclare() {
        return [...this.scope.value.inits.keys()].filter((init) => {
            let parent = this.scope.value.parent;
            while (parent && parent !== this.ownScope) {
                if (parent.inits.has(init)) {
                    return false;
                }
                parent = parent.parent;
            }
            return this.referencesIdentifier(init);
        });
    }

    /**
     * Return all identifiers that were redeclared and therefore need replacement.
     */
    private getNamesThatNeedReplacement(skipImmediateChildScope: boolean) {
        const referencedIdentifiers = this.collectReferencedIdentifiers();
        return [...referencedIdentifiers].filter((identifier) =>
            this.someChildScopeHasRedeclaredVariable(identifier, skipImmediateChildScope)
        );
    }

    /**
     * Returns true if given identifier name is redeclared in a child template scope
     * and is therefore shadowed within that scope.
     */
    private someChildScopeHasRedeclaredVariable(name: string, skipImmediateChildScope: boolean) {
        let scope = this.scope.value;
        while (
            scope &&
            (!skipImmediateChildScope || scope.parent !== this.ownScope) &&
            scope !== this.ownScope
        ) {
            if (scope.inits.has(name)) {
                return true;
            }
            scope = scope.parent;
        }
        return false;
    }

    private computeDepth() {
        let idx = 1;
        let parent = this.ownScope.parent;
        while (parent) {
            idx++;
            parent = parent.parent;
        }
        return idx;
    }
}
