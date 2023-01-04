import { Node } from 'estree-walker';

export class EventHandler {
    private bubbledEvents = new Map<string, string | string[]>();
    private callees: Array<{ name: string; parent: Node }> = [];

    handleEventHandler(node: Node, parent: Node): void {
        const eventName = node.name;

        // pass-through/ bubble
        if (!node.expression) {
            if (parent.type === 'InlineComponent') {
                if (parent.name !== 'svelte:self') {
                    this.handleEventHandlerBubble(parent, eventName);
                }
                return;
            }
            this.bubbledEvents.set(
                eventName,
                getEventDefExpressionForNonComponent(eventName, parent)
            );
        }
    }

    handleIdentifier(node: Node, parent: Node, prop: string): void {
        if (prop === 'callee') {
            this.callees.push({ name: node.name, parent });
        }
    }

    getBubbledEvents() {
        return this.bubbledEvents;
    }

    getDispatchedEventsForIdentifier(name: string) {
        const eventNames = new Set<string>();

        this.callees.forEach((callee) => {
            if (callee.name === name) {
                const [name] = callee.parent.arguments;

                if (name.value !== undefined) {
                    eventNames.add(name.value);
                }
            }
        });

        return eventNames;
    }

    bubbledEventsAsStrings() {
        return Array.from(this.bubbledEvents.entries()).map(eventMapEntryToString);
    }

    private handleEventHandlerBubble(parent: Node, eventName: string): void {
        const componentEventDef = `__sveltets_2_instanceOf(${parent.name})`;
        const exp = `__sveltets_2_bubbleEventDef(${componentEventDef}.$$events_def, '${eventName}')`;
        const exist = this.bubbledEvents.get(eventName);
        this.bubbledEvents.set(eventName, exist ? [].concat(exist, exp) : exp);
    }
}

function getEventDefExpressionForNonComponent(eventName: string, ele: Node) {
    switch (ele.type) {
        case 'Element':
            return `__sveltets_2_mapElementEvent('${eventName}')`;
        case 'Body':
            return `__sveltets_2_mapBodyEvent('${eventName}')`;
        case 'Window':
            return `__sveltets_2_mapWindowEvent('${eventName}')`;
        default:
            break;
    }
}

function eventMapEntryToString([eventName, expression]: [string, string | string[]]) {
    return `'${eventName}':${
        Array.isArray(expression) ? `__sveltets_2_unionType(${expression.join(',')})` : expression
    }`;
}
