/** @typedef {typeof __propDef.props}  TestNoTypesProps */
/** @typedef {typeof __propDef.events}  TestNoTypesEvents */
/** @typedef {typeof __propDef.slots}  TestNoTypesSlots */
export default class TestNoTypes extends SvelteComponentTyped<{
    noType: any;
    initializer?: string;
}, {
    event: CustomEvent<any>;
} & {
    [evt: string]: CustomEvent<any>;
}, {
    default: {
        noType: any;
    };
}> {
}
export type TestNoTypesProps = typeof __propDef.props;
export type TestNoTypesEvents = typeof __propDef.events;
export type TestNoTypesSlots = typeof __propDef.slots;
import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: {
        noType: any;
        initializer?: string;
    };
    events: {
        event: CustomEvent<any>;
    } & {
        [evt: string]: CustomEvent<any>;
    };
    slots: {
        default: {
            noType: any;
        };
    };
};
export {};
