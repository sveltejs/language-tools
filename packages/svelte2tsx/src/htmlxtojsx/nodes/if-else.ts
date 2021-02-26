import MagicString from 'magic-string';
import { Node } from 'estree-walker';

enum IfType {
    If,
    ElseIf,
    Else
}

interface IfCondition {
    type: IfType.If;
    condition: string;
}

interface ElseIfCondition {
    type: IfType.ElseIf;
    condition: string;
    parent: IfCondition | ElseIfCondition;
}

interface ElseCondition {
    type: IfType.Else;
    parent: IfCondition | ElseIfCondition;
}

type Condition = IfCondition | ElseIfCondition | ElseCondition;

function getFullCondition(condition: Condition): string {
    switch (condition.type) {
        case IfType.If:
            return _getFullCondition(condition, false);
        case IfType.ElseIf:
            return _getFullCondition(condition, false);
        case IfType.Else:
            return _getFullCondition(condition, false);
    }
}

function _getFullCondition(condition: Condition, negate: boolean): string {
    switch (condition.type) {
        case IfType.If:
            return negate ? `!(${condition.condition})` : `(${condition.condition})`;
        case IfType.ElseIf:
            return `${_getFullCondition(condition.parent, true)} && ${negate ? '!' : ''}(${
                condition.condition
            })`;
        case IfType.Else:
            return `${_getFullCondition(condition.parent, true)}`;
    }
}

export class IfScope {
    private child?: IfScope;

    constructor(private current?: Condition, private parent?: IfScope) {}

    getFullCondition(): string {
        if (!this.current) {
            return '';
        }

        const parentCondition = this.parent?.getFullCondition();
        const condition = `(${getFullCondition(this.current)})`;
        return parentCondition ? `(${parentCondition}) && ${condition}` : condition;
    }

    addPossibleIfCondition(): string {
        const condition = this.getFullCondition();
        return condition ? `${condition} && ` : '';
    }

    addNestedIf(condition: string): void {
        const ifScope = new IfScope({ condition, type: IfType.If }, this);
        this.child = ifScope;
    }

    addElseIf(condition: string): void {
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
}

/**
 * {# if ...}...{/if}   --->   {() => {if(...){<>...</>}}}
 */
export function handleIf(htmlx: string, str: MagicString, ifBlock: Node, ifScope: IfScope): void {
    const endIf = htmlx.lastIndexOf('{', ifBlock.end - 1);

    if (ifBlock.elseif) {
        // {:else if expr}  ->  : (expr) ? <>
        const elseIfStart = htmlx.lastIndexOf('{', ifBlock.expression.start);
        const elseIfConditionEnd = htmlx.indexOf('}', ifBlock.expression.end) + 1;
        str.overwrite(elseIfStart, ifBlock.expression.start, '</> : (', { contentOnly: true });
        str.overwrite(ifBlock.expression.end, elseIfConditionEnd, ') ? <>');

        ifScope.addElseIf(str.original.substring(ifBlock.expression.start, ifBlock.expression.end));

        if (!ifBlock.else) {
            str.appendLeft(endIf, '</> : <>');
        }
        return;
    }

    // {#if expr}  ->  {(expr) ? <>
    str.overwrite(ifBlock.start, ifBlock.expression.start, '{(', { contentOnly: true });
    const end = htmlx.indexOf('}', ifBlock.expression.end);
    str.overwrite(ifBlock.expression.end, end + 1, ') ? <>', { contentOnly: true });

    ifScope.addNestedIf(str.original.substring(ifBlock.expression.start, ifBlock.expression.end));

    if (ifBlock.else) {
        // {/if}  ->  </> }
        str.overwrite(endIf, ifBlock.end, '</> }', { contentOnly: true });
    } else {
        // {/if}  ->  </> : <></>}
        str.overwrite(endIf, ifBlock.end, '</> : <></>}', { contentOnly: true });
    }
}

/**
 * {:else}   --->   </> : <>
 */
export function handleElse(
    htmlx: string,
    str: MagicString,
    elseBlock: Node,
    parent: Node,
    ifScope: IfScope
): void {
    if (
        parent.type !== 'IfBlock' ||
        (elseBlock.children[0]?.type === 'IfBlock' && elseBlock.children[0]?.elseif)
    ) {
        return;
    }
    const elseEnd = htmlx.lastIndexOf('}', elseBlock.start);
    const elseword = htmlx.lastIndexOf(':else', elseEnd);
    const elseStart = htmlx.lastIndexOf('{', elseword);
    str.overwrite(elseStart, elseEnd + 1, '</> : <>');

    ifScope.addElse();
}
