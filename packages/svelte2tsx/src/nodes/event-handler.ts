import { Node } from "estree-walker";

export function createEventHandlerTransformer() {
    const events = new Map<string, string>();

    const handleEventHandler = (node: Node, parent: Node) => {
        const eventName = node.name;

        // pass-through
        if (!node.expression) {
            if (parent.type === "InlineComponent") {
                // TODO: component
            } else {
                events.set(
                    eventName,
                    getEventDefExpressionForNonCompoent(eventName, parent)
                );
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
        case "Element":
            return `__sveltets_mapElementEvent('${eventName}')`;
        case "Body":
            return `__sveltets_mapBodyEvent('${eventName}')`;
        case "Window":
            return `__sveltets_mapWindowEvent('${eventName}')`;
        default:
            break;
    }
}
