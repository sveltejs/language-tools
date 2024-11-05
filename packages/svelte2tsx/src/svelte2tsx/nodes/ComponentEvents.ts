import ts from 'typescript';
import { EventHandler } from './event-handler';
import {
    getVariableAtTopLevel,
    getLastLeadingDoc,
    isInterfaceOrTypeDeclaration
} from '../utils/tsAst';
import MagicString from 'magic-string';

export function is$$EventsDeclaration(
    node: ts.Node
): node is ts.TypeAliasDeclaration | ts.InterfaceDeclaration {
    return isInterfaceOrTypeDeclaration(node) && node.name.text === '$$Events';
}

/**
 * This class accumulates all events that are dispatched from the component.
 * It also tracks bubbled/forwarded events.
 *
 * It can not track events which are not fired through a variable
 * which was not instantiated within the component with `createEventDispatcher`.
 * This means that event dispatchers which are defined outside of the component and then imported do not get picked up.
 *
 * The logic is as follows:
 * - If there exists a ComponentEvents interface definition, use that and skip the rest
 * - Else first try to find the `createEventDispatcher` import
 * - If it exists, try to find the variables where `createEventDispatcher()` is assigned to
 * - For each variable found, try to find out if it's typed.
 *   - If yes, extract the event names and the event types from it
 *   - If no, track all invocations of it to get the event names
 */
export class ComponentEvents {
    private componentEventsInterface = new ComponentEventsFromInterface();
    private componentEventsFromEventsMap: ComponentEventsFromEventsMap;

    private get eventsClass() {
        return this.componentEventsInterface.isPresent()
            ? this.componentEventsInterface
            : this.componentEventsFromEventsMap;
    }

    constructor(
        eventHandler: EventHandler,
        private strictEvents: boolean,
        private str: MagicString
    ) {
        this.componentEventsFromEventsMap = new ComponentEventsFromEventsMap(eventHandler);
    }

    /**
     * Collect state and create the API which will be part
     * of the return object of the `svelte2tsx` function.
     */
    createAPI() {
        const entries: Array<{ name: string; type: string; doc?: string }> = [];

        const iterableEntries = this.eventsClass.events.entries();
        for (const entry of iterableEntries) {
            entries.push({ name: entry[0], ...entry[1] });
        }

        return {
            getAll(): Array<{ name: string; type?: string; doc?: string }> {
                return entries;
            }
        };
    }

    toDefString(): string {
        return this.eventsClass.toDefString();
    }

    setComponentEventsInterface(
        node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
        astOffset: number
    ): void {
        this.componentEventsInterface.setComponentEventsInterface(node, this.str, astOffset);
    }

    hasEvents(): boolean {
        return this.eventsClass.events.size > 0;
    }

    hasStrictEvents(): boolean {
        return this.componentEventsInterface.isPresent() || this.strictEvents;
    }

    checkIfImportIsEventDispatcher(node: ts.ImportDeclaration): void {
        this.componentEventsFromEventsMap.checkIfImportIsEventDispatcher(node);
        this.componentEventsInterface.checkIfImportIsEventDispatcher(node);
    }

    checkIfIsStringLiteralDeclaration(node: ts.VariableDeclaration): void {
        this.componentEventsFromEventsMap.checkIfIsStringLiteralDeclaration(node);
    }

    checkIfDeclarationInstantiatedEventDispatcher(node: ts.VariableDeclaration): void {
        this.componentEventsFromEventsMap.checkIfDeclarationInstantiatedEventDispatcher(node);
        this.componentEventsInterface.checkIfDeclarationInstantiatedEventDispatcher(node);
    }

    checkIfCallExpressionIsDispatch(node: ts.CallExpression): void {
        this.componentEventsFromEventsMap.checkIfCallExpressionIsDispatch(node);
    }
}

class ComponentEventsFromInterface {
    events = new Map<string, { type: string; doc?: string }>();
    private eventDispatcherImport = '';
    private str?: MagicString;
    private astOffset?: number;

    setComponentEventsInterface(
        node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
        str: MagicString,
        astOffset: number
    ) {
        this.str = str;
        this.astOffset = astOffset;
        this.events = this.extractEvents(node);
    }

    checkIfImportIsEventDispatcher(node: ts.ImportDeclaration) {
        if (this.eventDispatcherImport) {
            return;
        }
        this.eventDispatcherImport = checkIfImportIsEventDispatcher(node);
    }

    checkIfDeclarationInstantiatedEventDispatcher(node: ts.VariableDeclaration) {
        if (!this.isPresent()) {
            return;
        }
        const result = checkIfDeclarationInstantiatedEventDispatcher(
            node,
            this.eventDispatcherImport
        );
        if (!result) {
            return;
        }

        const { dispatcherTyping, dispatcherCreationExpr } = result;

        if (!dispatcherTyping) {
            this.str.prependLeft(
                dispatcherCreationExpr.expression.getEnd() + this.astOffset,
                '<__sveltets_2_CustomEvents<$$Events>>'
            );
        }
    }

    toDefString() {
        return this.isPresent() ? '{} as unknown as $$Events' : undefined;
    }

    isPresent() {
        return !!this.str;
    }

    private extractEvents(node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration) {
        const map = new Map<string, { type: string; doc?: string }>();

        if (ts.isInterfaceDeclaration(node)) {
            this.extractProperties(node.members, map);
        } else {
            if (ts.isTypeLiteralNode(node.type)) {
                this.extractProperties(node.type.members, map);
            } else if (ts.isIntersectionTypeNode(node.type)) {
                node.type.types.forEach((type) => {
                    if (ts.isTypeLiteralNode(type)) {
                        this.extractProperties(type.members, map);
                    }
                });
            }
        }
        return map;
    }

    private extractProperties(
        members: ts.NodeArray<ts.TypeElement>,
        map: Map<string, { type: string; doc?: string }>
    ) {
        members.filter(ts.isPropertySignature).forEach((member) => {
            map.set(getName(member.name), {
                type: member.type?.getText() || 'Event',
                doc: getDoc(member)
            });
        });
    }
}

class ComponentEventsFromEventsMap {
    events = new Map<string, { type: string; doc?: string }>();
    private dispatchedEvents = new Set();
    private stringVars = new Map<string, string>();
    private eventDispatcherImport = '';
    private eventDispatchers: Array<{ name: string; typing?: string }> = [];

    constructor(private eventHandler: EventHandler) {
        this.events = this.extractEvents(eventHandler);
    }

    checkIfImportIsEventDispatcher(node: ts.ImportDeclaration) {
        if (this.eventDispatcherImport) {
            return;
        }
        this.eventDispatcherImport = checkIfImportIsEventDispatcher(node);
    }

    checkIfIsStringLiteralDeclaration(node: ts.VariableDeclaration) {
        if (
            ts.isIdentifier(node.name) &&
            node.initializer &&
            ts.isStringLiteral(node.initializer)
        ) {
            this.stringVars.set(node.name.text, node.initializer.text);
        }
    }

    checkIfDeclarationInstantiatedEventDispatcher(node: ts.VariableDeclaration) {
        const result = checkIfDeclarationInstantiatedEventDispatcher(
            node,
            this.eventDispatcherImport
        );
        if (!result) {
            return;
        }

        const { dispatcherTyping, dispatcherName } = result;

        if (dispatcherTyping) {
            this.eventDispatchers.push({
                name: dispatcherName,
                typing: dispatcherTyping.getText()
            });

            if (ts.isTypeLiteralNode(dispatcherTyping)) {
                dispatcherTyping.members.filter(ts.isPropertySignature).forEach((member) => {
                    this.addToEvents(getName(member.name), {
                        type: `CustomEvent<${member.type?.getText() || 'any'}>`,
                        doc: getDoc(member)
                    });
                });
            }
        } else {
            this.eventDispatchers.push({ name: dispatcherName });
            this.eventHandler
                .getDispatchedEventsForIdentifier(dispatcherName)
                .forEach((evtName) => {
                    this.addToEvents(evtName);
                    this.dispatchedEvents.add(evtName);
                });
        }
    }

    checkIfCallExpressionIsDispatch(node: ts.CallExpression) {
        if (
            this.eventDispatchers.some(
                (dispatcher) =>
                    !dispatcher.typing &&
                    ts.isIdentifier(node.expression) &&
                    node.expression.text === dispatcher.name
            )
        ) {
            const firstArg = node.arguments[0];
            if (ts.isStringLiteral(firstArg)) {
                this.addToEvents(firstArg.text);
                this.dispatchedEvents.add(firstArg.text);
            } else if (ts.isIdentifier(firstArg)) {
                const str = this.stringVars.get(firstArg.text);
                if (str) {
                    this.addToEvents(str);
                    this.dispatchedEvents.add(str);
                }
            }
        }
    }

    private addToEvents(
        eventName: string,
        info: { type: string; doc?: string } = { type: 'CustomEvent<any>' }
    ) {
        if (this.events.has(eventName)) {
            // If there are multiple definitions, merge them by falling back to any-typing
            this.events.set(eventName, { type: 'CustomEvent<any>' });
            this.dispatchedEvents.add(eventName);
        } else {
            this.events.set(eventName, info);
        }
    }

    toDefString() {
        return (
            '{' +
            [
                ...this.eventDispatchers
                    .map(
                        (dispatcher) =>
                            dispatcher.typing &&
                            `...__sveltets_2_toEventTypings<${dispatcher.typing}>()`
                    )
                    .filter((str) => !!str),
                ...this.eventHandler.bubbledEventsAsStrings(),
                ...[...this.dispatchedEvents.keys()].map((e) => `'${e}': __sveltets_2_customEvent`)
            ].join(', ') +
            '}'
        );
    }

    private extractEvents(eventHandler: EventHandler) {
        const map = new Map();
        for (const name of eventHandler.getBubbledEvents().keys()) {
            map.set(name, { type: 'Event' });
        }
        return map;
    }
}

function getName(prop: ts.PropertyName) {
    if (ts.isIdentifier(prop) || ts.isStringLiteral(prop)) {
        return prop.text;
    }

    if (ts.isComputedPropertyName(prop)) {
        if (ts.isIdentifier(prop.expression)) {
            const identifierName = prop.expression.text;
            const identifierValue = getIdentifierValue(prop, identifierName);
            if (!identifierValue) {
                throwError(prop);
            }
            return identifierValue;
        }
    }

    throwError(prop);
}

function getIdentifierValue(prop: ts.ComputedPropertyName, identifierName: string) {
    const variable = getVariableAtTopLevel(prop.getSourceFile(), identifierName);
    if (variable && ts.isStringLiteral(variable.initializer)) {
        return variable.initializer.text;
    }
}

function throwError(prop: ts.PropertyName) {
    const error: any = new Error(
        'The ComponentEvents interface can only have properties of type ' +
            'Identifier, StringLiteral or ComputedPropertyName. ' +
            'In case of ComputedPropertyName, ' +
            'it must be a const declared within the component and initialized with a string.'
    );
    error.start = toLineColumn(prop.getStart());
    error.end = toLineColumn(prop.getEnd());
    throw error;

    function toLineColumn(pos: number) {
        const lineChar = prop.getSourceFile().getLineAndCharacterOfPosition(pos);
        return {
            line: lineChar.line + 1,
            column: lineChar.character
        };
    }
}

function getDoc(member: ts.PropertySignature) {
    let doc = undefined;
    const comment = getLastLeadingDoc(member);

    if (comment) {
        doc = comment
            .split('\n')
            .map((line) =>
                // Remove /** */
                line
                    .replace(/\s*\/\*\*/, '')
                    .replace(/\s*\*\//, '')
                    .replace(/\s*\*/, '')
                    .trim()
            )
            .join('\n');
    }

    return doc;
}

function checkIfImportIsEventDispatcher(node: ts.ImportDeclaration): string | undefined {
    if (ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text !== 'svelte') {
        return;
    }

    const namedImports = node.importClause?.namedBindings;
    if (namedImports && ts.isNamedImports(namedImports)) {
        const eventDispatcherImport = namedImports.elements.find(
            // If it's an aliased import, propertyName is set
            (el) => (el.propertyName || el.name).text === 'createEventDispatcher'
        );
        if (eventDispatcherImport) {
            return eventDispatcherImport.name.text;
        }
    }
}

function checkIfDeclarationInstantiatedEventDispatcher(
    node: ts.VariableDeclaration,
    eventDispatcherImport: string | undefined
):
    | {
          dispatcherName: string;
          dispatcherTyping: ts.TypeNode | undefined;
          dispatcherCreationExpr: ts.CallExpression;
      }
    | undefined {
    if (!ts.isIdentifier(node.name) || !node.initializer) {
        return;
    }

    if (
        ts.isCallExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        node.initializer.expression.text === eventDispatcherImport
    ) {
        const dispatcherName = node.name.text;
        const dispatcherTyping = node.initializer.typeArguments?.[0];

        return {
            dispatcherName,
            dispatcherTyping,
            dispatcherCreationExpr: node.initializer
        };
    }
}
