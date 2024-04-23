import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        foo: string;
        bar?: import("svelte").Bindable<number>;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type TestRunesProps = typeof __propDef.props;
export type TestRunesEvents = typeof __propDef.events;
export type TestRunesSlots = typeof __propDef.slots;
export default class TestRunes extends SvelteComponent<TestRunesProps, TestRunesEvents, TestRunesSlots> {
    constructor(options?: import("svelte").ComponentConstructorOptions<{
        foo: string;
        bar?: import("svelte").Bindable<number>;
    }>);
    get baz(): () => void;
}
export {};
