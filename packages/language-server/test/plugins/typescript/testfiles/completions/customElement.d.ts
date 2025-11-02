declare global {
    namespace svelteHTML {
        interface IntrinsicElements {
            /** Custom doc for custom element */
            'custom-element': any;
        }
    }
}

export {};