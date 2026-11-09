import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        /**
         * comment is preserved
         */
        label: string;
        disabled?: boolean;
    };
    slots: {
        default: {
            active: boolean;
        };
    };
    events: {
        toggle: CustomEvent<boolean>;
    };
};
export type TestInterfacesProps = typeof __propDef.props;
export type TestInterfacesEvents = typeof __propDef.events;
export type TestInterfacesSlots = typeof __propDef.slots;
export default class TestInterfaces extends SvelteComponent<TestInterfacesProps, TestInterfacesEvents, TestInterfacesSlots> {
}
export {};
