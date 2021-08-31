import { SvelteComponentTyped } from "svelte";
import type { Foo } from './foo';
interface Bar {
    a: true;
}
declare const __propDef: {
    props: {
        foo: Foo;
        bar: Bar;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export declare type Test2Props = typeof __propDef.props;
export declare type Test2Events = typeof __propDef.events;
export declare type Test2Slots = typeof __propDef.slots;
export default class Test2 extends SvelteComponentTyped<Test2Props, Test2Events, Test2Slots> {
}
export {};
