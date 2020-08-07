import { Node } from 'estree-walker';

export function createEventHandlerTransformer() {
    const events = new Map<string, string | string[]>();

    const handleEventHandler = (node: Node, parent: Node) => {
        const eventName = node.name;

        const handleEventHandlerBubble = () => {
            const componentEventDef = `__sveltets_instanceOf(${parent.name})`;
            // eslint-disable-next-line max-len
            const exp = `__sveltets_bubbleEventDef(${componentEventDef}.$$events_def, '${eventName}')`;

            const exist = events.get(eventName);
            events.set(eventName, exist ? [].concat(exist, exp) : exp);
        };

        // pass-through/ bubble
        if (!node.expression) {
            if (parent.type === 'InlineComponent') {
                handleEventHandlerBubble();
            } else {
                events.set(eventName, getEventDefExpressionForNonCompoent(eventName, parent));
            }
        }
    };

    return {
        handleEventHandler,
        getEvents: () => events,
    };
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

export function eventMapToString(events: Map<string, string | string[]>) {
    return '{' + Array.from(events.entries()).map(eventMapEntryToString).join(', ') + '}';
}

function eventMapEntryToString([eventName, expression]: [string, string | string[]]) {
    return `'${eventName}':${Array.isArray(expression) ? `[${expression}]` : expression}`;
}
