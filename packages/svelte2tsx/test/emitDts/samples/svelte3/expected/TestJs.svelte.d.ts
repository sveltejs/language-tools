/** @typedef {typeof __propDef.props}  TestJsProps */
/** @typedef {typeof __propDef.events}  TestJsEvents */
/** @typedef {typeof __propDef.slots}  TestJsSlots */
export default class TestJs extends SvelteComponentTyped<{
    astring: string;
}, {
    event: CustomEvent<any>;
} & {
    [evt: string]: CustomEvent<any>;
}, {
    default: {
        astring: string;
    };
}> {
    get astring(): string;
}
export type TestJsProps = typeof __propDef.props;
export type TestJsEvents = typeof __propDef.events;
export type TestJsSlots = typeof __propDef.slots;
import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: {
        astring: string;
    };
    events: {
        event: CustomEvent<any>;
    } & {
        [evt: string]: CustomEvent<any>;
    };
    slots: {
        default: {
            astring: string;
        };
    };
};
export {};
