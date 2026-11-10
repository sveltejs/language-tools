import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        name: string;
        count?: number;
        version?: "1.0.0";
        reset?: () => void;
    };
    events: {
        click: PointerEvent;
        change: CustomEvent<number>;
    } & {
        [evt: string]: CustomEvent<any>;
    };
    slots: {
        default: {
            count: number;
        };
        footer: {
            label: string;
        };
    };
    exports?: {} | undefined;
    bindings?: string | undefined;
};
export type TestProps = typeof __propDef.props;
export type TestEvents = typeof __propDef.events;
export type TestSlots = typeof __propDef.slots;
export default class Test extends SvelteComponent<TestProps, TestEvents, TestSlots> {
    get version(): "1.0.0";
    get reset(): () => void;
}
export {};
