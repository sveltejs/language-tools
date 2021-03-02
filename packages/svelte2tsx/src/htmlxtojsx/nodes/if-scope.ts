import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { getIdentifiersInIfExpression } from '../utils/node-utils';
import TemplateScope from '../../svelte2tsx/nodes/TemplateScope';

enum IfType {
    If,
    ElseIf,
    Else
}

interface ConditionInfo {
    identifiers: Map<string, { start: number; end: number }[]>;
    condition: string;
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

function getConditionString(
    condition: ConditionInfo,
    replacedNames: string[],
    replacementPrefix: string
): string {
    const replacements: { name: string; start: number; end: number }[] = [];
    for (const name of replacedNames) {
        const occurences = condition.identifiers.get(name);
        if (occurences) {
            for (const occurence of occurences) {
                replacements.push({ ...occurence, name });
            }
        }
    }

    if (!replacements.length) {
        return condition.condition;
    }

    replacements.sort((r1, r2) => r1.start - r2.start);
    return (
        condition.condition.substring(0, replacements[0].start) +
        replacements
            .map(
                (replacement, idx) =>
                    replacementPrefix +
                    replacement.name +
                    condition.condition.substring(replacement.end, replacements[idx + 1]?.start)
            )
            .join('')
    );
}

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

// TODO:
// - Use TemplateScope in IfScope to detect shadowed variables
// - In case of Shadowed variables, do a walk on the expression. Search for "Identifier" | "MemberExpression"[.object]
// - prepend some unichar to all found identifiers and add const x = y; before it

export class IfScope {
    private child?: IfScope;
    private ownScope = this.scope.value;
    private replacementPrefix = REPLACEMENT_PREFIX.repeat(this.computeDepth());

    constructor(
        private scope: { value: TemplateScope },
        private current?: Condition,
        private parent?: IfScope
    ) {}

    getFullCondition(): string {
        if (!this.current) {
            return '';
        }

        const parentCondition = this.parent?.getFullCondition();
        const condition = `(${getFullCondition(
            this.current,
            this.getReplacedNames(),
            this.replacementPrefix
        )})`;
        return parentCondition ? `(${parentCondition}) && ${condition}` : condition;
    }

    addPossibleIfCondition(): string {
        const condition = this.getFullCondition();
        return condition ? `${condition} && ` : '';
    }

    addNestedIf(expression: Node, str: MagicString): void {
        const condition = this.getConditionString(str, expression);
        const ifScope = new IfScope(this.scope, { condition, type: IfType.If }, this);
        this.child = ifScope;
    }

    addElseIf(expression: Node, str: MagicString): void {
        const condition = this.getConditionString(str, expression);
        this.current = {
            condition,
            parent: this.current as IfCondition | ElseIfCondition,
            type: IfType.ElseIf
        };
    }

    addElse(): void {
        this.current = { parent: this.current as IfCondition | ElseIfCondition, type: IfType.Else };
    }

    getChild(): IfScope {
        return this.child || this;
    }

    getParent(): IfScope {
        return this.parent || this;
    }

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

    getConstsToRedeclare(): string {
        const replacements = this.getNamesToRedeclare()
            .map((identifier) => `${this.replacementPrefix + identifier}=${identifier}`)
            .join(',');
        return replacements ? `const ${replacements};` : '';
    }

    addConstsSuffixIfNecessary(): string {
        return this.getNamesToRedeclare().length ? '}' : '';
    }

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

    private getConditionString(str: MagicString, expression: Node) {
        const identifiers = getIdentifiersInIfExpression(expression);
        const condition = str.original.substring(expression.start, expression.end);
        return { identifiers, condition };
    }

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

    private getReplacedNames() {
        const referencedIdentifiers = this.collectReferencedIdentifiers();
        return [...referencedIdentifiers].filter((identifier) =>
            this.someChildScopeHasRedeclaredVariable(identifier)
        );
    }

    private someChildScopeHasRedeclaredVariable(name: string) {
        let scope = this.scope.value;
        while (scope && scope !== this.ownScope) {
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

// TODO: wenn ein neuer Scope aufgeht, muss der IfScope das bei der Analyse und dem Replacement berücksichtigen und das sozusagen "resetten"
// Scope, der info enthält, was gerade zu überschreiben ist. scope wird bei jedem if und elseif und await und each und let neu gemacht
// SCope enthält die aktuell geshadowed-en Variablen.
// depth für ifScope damit er weiß wie viele Ω vorne dran
// templatescope hat eine depth
// ifscope kriegt die depth gesagt
// wenn nach re-if gefragt wird, guckt ifscope den templatescope von current(=max) bis sichselbst+1. wenn da redeclare von variable wird die ersetzt
// wenn neues await/each/slot, guckt der ifscope "darüber", ob bei sich selbst oder vater-ifs (bis zu templatescope wo redeclare) schon eine solche variable in der ifcondition war und wenn ja const x=y prepend.
// jeder if-scope braucht seinen direkten templatescope-vater
