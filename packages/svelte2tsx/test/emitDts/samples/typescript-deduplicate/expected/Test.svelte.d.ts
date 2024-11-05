import { SvelteComponentTyped } from "svelte";
export interface TestEvents {
    foo: 'bar';
}
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
type TestEvents_ = typeof __propDef.events;
type TestSlots_ = typeof __propDef.slots;
export { TestSlots_ as TestSlots };
export default class Test extends SvelteComponentTyped<TestProps_, TestEvents_, TestSlots_> {
}
