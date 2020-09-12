import { Node } from 'estree-walker';

export class EventHandler {
    events = new Map<string, string | string[]>();

    handleEventHandler = (node: Node, parent: Node) => {
        const eventName = node.name;

        const handleEventHandlerBubble = () => {
            const componentEventDef = `__sveltets_instanceOf(${parent.name})`;
            // eslint-disable-next-line max-len
            const exp = `__sveltets_bubbleEventDef(${componentEventDef}.$$events_def, '${eventName}')`;

            const exist = this.events.get(eventName);
            this.events.set(eventName, exist ? [].concat(exist, exp) : exp);
        };

        // pass-through/ bubble
        if (!node.expression) {
            if (parent.type === 'InlineComponent') {
                handleEventHandlerBubble();
            } else {
                this.events.set(eventName, getEventDefExpressionForNonCompoent(eventName, parent));
            }
        }
    };

    getEvents() {
        return this.events;
    }

    eventMapToString() {
        return Array.from(this.events.entries()).map(eventMapEntryToString).join(', ');
    }
}

function getEventDefExpressionForNonCompoent(eventName: string, ele: Node) {
    switch (ele.type) {
        case 'Element':
            return `__sveltets_mapElementEvent('${eventName}')`;
        case 'Body':
            return `__sveltets_mapBodyEvent('${eventName}')`;
        case 'Window':
            return `__sveltets_mapWindowEvent('${eventName}')`;
        default:
            break;
    }
}

function eventMapEntryToString([eventName, expression]: [string, string | string[]]) {
    return `'${eventName}':${
        Array.isArray(expression) ? `__sveltets_unionType(${expression.join(',')})` : expression
    }`;
}
