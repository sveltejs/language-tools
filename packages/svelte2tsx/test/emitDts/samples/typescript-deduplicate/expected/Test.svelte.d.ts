import { SvelteComponentTyped } from "svelte";
import { type TestProps } from './foo';
declare const __propDef: {
    props: {
        p: TestProps;
        x?: {
            x: {
                b: string;
            };
        };
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
type TestProps_ = typeof __propDef.props;
export { TestProps_ as TestProps };
export type TestEvents = typeof __propDef.events;
export type TestSlots = typeof __propDef.slots;
export default class Test extends SvelteComponentTyped<TestProps, TestEvents, TestSlots> {
}
