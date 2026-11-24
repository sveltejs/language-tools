/** @typedef {typeof __propDef.props}  TestJsProps */
/** @typedef {typeof __propDef.events}  TestJsEvents */
/** @typedef {typeof __propDef.slots}  TestJsSlots */
export default class TestJs extends SvelteComponent<{
    name: string;
    count?: number | undefined;
    version?: string | undefined;
}, {
    change: CustomEvent<any>;
} & {
    [evt: string]: CustomEvent<any>;
}, {
    default: {
        label: string;
        count: number;
    };
}> {
    get version(): string;
}
export type TestJsProps = typeof __propDef.props;
export type TestJsEvents = typeof __propDef.events;
export type TestJsSlots = typeof __propDef.slots;
import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        name: string;
        count?: number | undefined;
        version?: string | undefined;
    };
    events: {
        change: CustomEvent<any>;
    } & {
        [evt: string]: CustomEvent<any>;
    };
    slots: {
        default: {
            label: string;
            count: number;
        };
    };
    exports?: undefined;
    bindings?: undefined;
};
export {};
