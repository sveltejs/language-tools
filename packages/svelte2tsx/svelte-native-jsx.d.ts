declare namespace svelteNative.JSX {

    /* svelte specific */
    interface ElementClass {
        $$prop_def: any;
    }

    interface ElementAttributesProperty {
        $$prop_def: any; // specify the property name to use
    }

    interface IntrinsicAttributes {
    }

    interface IntrinsicElements {
        [name: string]: { [name: string]: any };
    }
}