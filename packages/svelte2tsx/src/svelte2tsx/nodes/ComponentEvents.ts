import ts from 'typescript';
import { EventHandler } from './event-handler';
import { getVariableAtTopLevel, getLeadingDoc } from '../utils/tsAst';

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
 * - If it exists, try to find the variable where `createEventDispatcher()` is assigned to
 * - If that variable is found, try to find out if it's typed.
 *   - If yes, extract the event names and the event types from it
 *   - If no, track all invocations of it to get the event names
 */
export class ComponentEvents {
    private componentEventsInterface?: ComponentEventsFromInterface;
    private componentEventsFromEventsMap?: ComponentEventsFromEventsMap;

    private get eventsClass() {
        return this.componentEventsInterface || this.componentEventsFromEventsMap;
    }

    getAll(): { name: string; type?: string; doc?: string }[] {
        const entries: { name: string; type: string; doc?: string }[] = [];

        const iterableEntries = this.eventsClass.events.entries();
        for (const entry of iterableEntries) {
            entries.push({ name: entry[0], ...entry[1] });
        }

        return entries;
    }

    setEventHandler(eventHandler: EventHandler): void {
        this.componentEventsFromEventsMap = new ComponentEventsFromEventsMap(eventHandler);
    }

    setComponentEventsInterface(node: ts.InterfaceDeclaration): void {
        this.componentEventsInterface = new ComponentEventsFromInterface(node);
    }

    hasInterface(): boolean {
        return !!this.componentEventsInterface;
    }

    checkIfImportIsEventDispatcher(node: ts.ImportDeclaration): void {
        this.componentEventsFromEventsMap.checkIfImportIsEventDispatcher(node);
    }

    checkIfDeclarationInstantiatedEventDispatcher(node: ts.VariableDeclaration): void {
        this.componentEventsFromEventsMap.checkIfDeclarationInstantiatedEventDispatcher(node);
    }

    checkIfCallExpressionIsDispatch(node: ts.CallExpression): void {
        this.componentEventsFromEventsMap.checkIfCallExpressionIsDispatch(node);
    }

    toDefString(): string {
        return this.eventsClass.toDefString();
    }
}

class ComponentEventsFromInterface {
    events = new Map<string, { type: string; doc?: string }>();

    constructor(node: ts.InterfaceDeclaration) {
        this.events = this.extractEvents(node);
    }

    toDefString() {
        return '{} as unknown as ComponentEvents';
    }

    private extractEvents(node: ts.InterfaceDeclaration) {
        const map = new Map<string, { type: string; doc?: string }>();

        node.members.filter(ts.isPropertySignature).forEach((member) => {
            map.set(getName(member.name), {
                type: member.type?.getText() || 'Event',
                doc: getDoc(member),
            });
        });

        return map;
    }
}

class ComponentEventsFromEventsMap {
    events = new Map<string, { type: string; doc?: string }>();
    private dispatchedEvents = new Set();
    private stringVars = new Map<string, string>();
    private hasEventDispatcherImport = false;
    private eventDispatcherTyping?: string;
    private dispatcherName = '';

    constructor(private eventHandler: EventHandler) {
        this.events = this.extractEvents(eventHandler);
    }

    checkIfImportIsEventDispatcher(node: ts.ImportDeclaration) {
        if (this.hasEventDispatcherImport) {
            return;
        }
        if (ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text !== 'svelte') {
            return;
        }

        const namedImports = node.importClause?.namedBindings;
        if (ts.isNamedImports(namedImports)) {
            this.hasEventDispatcherImport = namedImports.elements.some(
                (el) => el.name.text === 'createEventDispatcher',
            );
        }
    }

    checkIfDeclarationInstantiatedEventDispatcher(node: ts.VariableDeclaration) {
        if (!ts.isIdentifier(node.name) || !node.initializer) {
            return;
        }

        if (ts.isStringLiteral(node.initializer)) {
            this.stringVars.set(node.name.text, node.initializer.text);
        }

        if (
            this.hasEventDispatcherImport &&
            ts.isCallExpression(node.initializer) &&
            ts.isIdentifier(node.initializer.expression) &&
            node.initializer.expression.text === 'createEventDispatcher'
        ) {
            this.dispatcherName = node.name.text;
            const dispatcherTyping = node.initializer.typeArguments?.[0];

            if (dispatcherTyping && ts.isTypeLiteralNode(dispatcherTyping)) {
                this.eventDispatcherTyping = dispatcherTyping.getText();
                dispatcherTyping.members.filter(ts.isPropertySignature).forEach((member) => {
                    this.addToEvents(getName(member.name), {
                        type: `CustomEvent<${member.type?.getText() || 'any'}>`,
                        doc: getDoc(member),
                    });
                });
            } else {
                this.eventHandler
                    .getDispatchedEventsForIdentifier(this.dispatcherName)
                    .forEach((evtName) => this.addToEvents(evtName));
            }
        }
    }

    checkIfCallExpressionIsDispatch(node: ts.CallExpression) {
        if (
            !this.eventDispatcherTyping &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === this.dispatcherName
        ) {
            const firstArg = node.arguments[0];
            if (ts.isStringLiteral(firstArg)) {
                this.addToEvents(firstArg.text);
            } else if (ts.isIdentifier(firstArg)) {
                const str = this.stringVars.get(firstArg.text);
                if (str) {
                    this.addToEvents(str);
                }
            }
        }
    }

    private addToEvents(
        eventName: string,
        info: { type: string; doc?: string } = { type: 'CustomEvent<any>' },
    ) {
        this.events.set(eventName, info);
        this.dispatchedEvents.add(eventName);
    }

    toDefString() {
        if (this.eventDispatcherTyping) {
            return `__sveltets_toEventTypings<${this.eventDispatcherTyping}>()`;
        }
        return (
            '{' +
            this.eventHandler.bubbledEventsMapToString() +
            [...this.dispatchedEvents.keys()]
                .map((e) => `'${e}': __sveltets_customEvent`)
                .join(', ') +
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
            'it must be a const declared within the component and initialized with a string.',
    );
    error.start = toLineColumn(prop.getStart());
    error.end = toLineColumn(prop.getEnd());
    throw error;

    function toLineColumn(pos: number) {
        const lineChar = prop.getSourceFile().getLineAndCharacterOfPosition(pos);
        return {
            line: lineChar.line + 1,
            column: lineChar.character,
        };
    }
}

function getDoc(member: ts.PropertySignature) {
    let doc = undefined;
    const comment = getLeadingDoc(member);

    if (comment) {
        doc = comment
            .split('\n')
            .map((line) =>
                // Remove /** */
                line
                    .replace(/\s*\/\*\*/, '')
                    .replace(/\s*\*\//, '')
                    .replace(/\s*\*/, '')
                    .trim(),
            )
            .join('\n');
    }

    return doc;
}
