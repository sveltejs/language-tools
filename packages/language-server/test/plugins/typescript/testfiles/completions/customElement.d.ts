declare global {
    namespace svelteHTML {
        interface IntrinsicElements {
            /** Custom doc for custom element */
            'custom-element': {
                /** bar */
                foo: string
            };
        }
    }
}

export {};