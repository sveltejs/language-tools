import { SvelteComponentTyped } from "svelte";
declare const __propDef: {
    props: {
        b?: () => void;
        /**
         * comment is preserved
         */
        a: string;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export declare type Test3PropsProps = typeof __propDef.props;
export declare type Test3PropsEvents = typeof __propDef.events;
export declare type Test3PropsSlots = typeof __propDef.slots;
export default class Test3Props extends SvelteComponentTyped<Test3PropsProps, Test3PropsEvents, Test3PropsSlots> {
    get b(): () => void;
}
export {};
