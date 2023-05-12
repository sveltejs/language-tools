declare namespace svelte.JSX {
    interface HTMLAttributes {
        owntypefromold?: string;
        onownclickfromold?: (event: CustomEvent<{ foo: string }>) => void;
    }
    interface IntrinsicElements {
        'own-element-from-old': {
            attribute?: string;
        };
    }
}

declare namespace svelteHTML {
    interface HTMLAttributes {
        owntype?: string;
        'on:ownclick'?: (event: CustomEvent<{ foo: string }>) => void;
    }
    interface IntrinsicElements {
        'own-element': {
            attribute?: string;
        };
    }
}
