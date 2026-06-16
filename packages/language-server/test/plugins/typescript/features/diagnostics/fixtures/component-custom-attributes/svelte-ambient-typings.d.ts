declare namespace svelteHTML {
    interface ComponentAttributes {
        'mochi:defer'?: boolean;
        'mochi:hydrate:visible'?: { rootMargin?: string };
    }
}
