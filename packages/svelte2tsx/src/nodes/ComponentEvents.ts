import ts from 'typescript';
import { EventHandler } from './event-handler';

export abstract class ComponentEvents {
    protected events = new Map<string, { type: string; doc?: string }>();

    getAll(): { name: string; type?: string; doc?: string }[] {
        const entries: { name: string; type: string; doc?: string }[] = [];

        const iterableEntries = this.events.entries();
        for (const entry of iterableEntries) {
            entries.push({ name: entry[0], ...entry[1] });
        }

        return entries;
    }

    abstract toDefString(): string;
}

export class ComponentEventsFromInterface extends ComponentEvents {
    constructor(node: ts.InterfaceDeclaration) {
        super();
        this.events = this.extractEvents(node);
    }

    toDefString() {
        return '{} as unknown as ComponentEvents';
    }

    private extractEvents(node: ts.InterfaceDeclaration) {
        const map = new Map<string, { type: string; doc?: string }>();

        node.members.filter(ts.isPropertySignature).forEach((member) => {
            map.set(member.name.getText(), {
                type: member.type?.getText() || 'Event',
                doc: this.getDoc(node, member),
            });
        });

        return map;
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
                // Remove /** */
                .replace(/\s*\/\*\*/, '')
                .replace(/\s*\*\//, '')
                .replace(/\s*\*/g, '');
        }

        return doc;
    }
}

export class ComponentEventsFromEventsMap extends ComponentEvents {
    constructor(private eventHandler: EventHandler) {
        super();
        this.events = this.extractEvents(eventHandler);
    }

    toDefString() {
        return this.eventHandler.eventMapToString();
    }

    private extractEvents(eventHandler: EventHandler) {
        const map = new Map();
        for (const name of eventHandler.getEvents().keys()) {
            map.set(name, { type: 'Event' });
        }
        return map;
    }
}
