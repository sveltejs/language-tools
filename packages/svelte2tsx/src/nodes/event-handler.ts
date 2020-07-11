import { Node } from 'estree-walker';

export function createEventHandlerTransformer() {
    const events = new Map<string, string>();

    const handleEventHandler = (node: Node, parent: Node) => {
        const eventName = node.name;

        // pass-through
        if (!node.expression) {
            if (parent.type === "Element") {
                events.set(eventName, `__sveltets_mapElementEvent('${eventName}')`);
            }
        }
    };

    return {
        handleEventHandler,
        getEvents: () => events
    };
}
