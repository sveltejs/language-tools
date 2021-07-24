/** @typedef {typeof __propDef.props}  TestNoScriptProps */
/** @typedef {typeof __propDef.events}  TestNoScriptEvents */
/** @typedef {typeof __propDef.slots}  TestNoScriptSlots */
export default class TestNoScript extends SvelteComponentTyped<{}, {
    click: MouseEvent;
} & {
    [evt: string]: CustomEvent<any>;
}, {
    default: {};
}> {
}
export type TestNoScriptProps = typeof __propDef.props;
export type TestNoScriptEvents = typeof __propDef.events;
export type TestNoScriptSlots = typeof __propDef.slots;
import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: {};
    events: {
        click: MouseEvent;
    } & {
        [evt: string]: CustomEvent<any>;
    };
    slots: {
        default: {};
    };
};
export {};
