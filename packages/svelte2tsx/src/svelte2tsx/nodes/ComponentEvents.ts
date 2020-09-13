import ts from 'typescript';
import { EventHandler } from './event-handler';
import { getVariableAtTopLevel } from '../utils/tsAst';

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
            map.set(this.getName(member.name), {
                type: member.type?.getText() || 'Event',
                doc: this.getDoc(node, member),
            });
        });

        return map;
    }

    private getName(prop: ts.PropertyName) {
        if (ts.isIdentifier(prop) || ts.isStringLiteral(prop)) {
            return prop.text;
        }

        if (ts.isComputedPropertyName(prop)) {
            if (ts.isIdentifier(prop.expression)) {
                const identifierName = prop.expression.text;
                const identifierValue = this.getIdentifierValue(prop, identifierName);
                if (!identifierValue) {
                    this.throwError(prop);
                }
                return identifierValue;
            }
        }

        this.throwError(prop);
    }

    private getIdentifierValue(prop: ts.ComputedPropertyName, identifierName: string) {
        const variable = getVariableAtTopLevel(prop.getSourceFile(), identifierName);
        if (variable && ts.isStringLiteral(variable.initializer)) {
            return variable.initializer.text;
        }
    }

    private throwError(prop: ts.PropertyName) {
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

    private getDoc(node: ts.InterfaceDeclaration, member: ts.PropertySignature) {
        let doc = undefined;
        const comment = ts.getLeadingCommentRanges(
            node.getText(),
            member.getFullStart() - node.getStart(),
        );

        if (comment) {
            doc = node
                .getText()
                .substring(comment[0].pos, comment[0].end)
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
}

/**
Alles in einer Klasse tracken

Für Template:

case "Identifier":
          if (node.name === "createEventDispatcher") {
            hasDispatchedEvents = true;
          }

          if (prop === "callee") {
            callee.push({ name: node.name, parent });
          }
          break;


Für Script:

- alle const/let initialisierungen tracken (const a = ''; let a = '')
- alle callExpressions tracken und deren erstes argument
- createEventDispatcher tracken, zu welcher const/let es initialisiert wird


Am Ende:
1. name von createEventDispatcher rausfinden
2. alle calle aus Template iterieren, und die behalten, die dispatch sind.
3. alle callExpressions aus script iterieren, und die behalten, die dispatch sind
-- für 2 und 3 :  Für jede gucken, ob man Name bekommt. Entweder eine variable, dann aus const/let initialisierungen finden, oder ein StringLiteral.
 */
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
        if (!ts.isIdentifier(node.name)) {
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
                    this.addToEvents(this.getName(member.name), {
                        type: `CustomEvent<${member.type?.getText() || 'any'}>`,
                        doc: undefined, // TODO
                    });
                });
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
            this.eventHandler.eventMapToString() +
            [...this.dispatchedEvents.keys()]
                .map((e) => `'${e}': __sveltets_customEvent`)
                .join(', ') +
            '}'
        );
    }

    private extractEvents(eventHandler: EventHandler) {
        const map = new Map();
        for (const name of eventHandler.getEvents().keys()) {
            map.set(name, { type: 'Event' });
        }
        return map;
    }

    private getName(prop: ts.PropertyName) {
        if (ts.isIdentifier(prop) || ts.isStringLiteral(prop)) {
            return prop.text;
        }

        if (ts.isComputedPropertyName(prop)) {
            if (ts.isIdentifier(prop.expression)) {
                const identifierName = prop.expression.text;
                const identifierValue = this.getIdentifierValue(prop, identifierName);
                if (!identifierValue) {
                    this.throwError(prop);
                }
                return identifierValue;
            }
        }

        this.throwError(prop);
    }

    private getIdentifierValue(prop: ts.ComputedPropertyName, identifierName: string) {
        const variable = getVariableAtTopLevel(prop.getSourceFile(), identifierName);
        if (variable && ts.isStringLiteral(variable.initializer)) {
            return variable.initializer.text;
        }
    }

    private throwError(prop: ts.PropertyName) {
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
}
