interface $$__sveltets_2_IsomorphicComponent<Props extends Record<string, any> = any, Events extends Record<string, any> = any, Slots extends Record<string, any> = any, Exports = {}, Bindings = string> {
    new (options: import('svelte').ComponentConstructorOptions<Props>): import('svelte').SvelteComponent<Props, Events, Slots> & {
        $$bindings?: Bindings;
    } & Exports;
    (internal: unknown, props: Props & {
        $$events?: Events;
        $$slots?: Slots;
    }): Exports & {
        $set?: any;
        $on?: any;
    };
    z_$$bindings?: Bindings;
}
declare const LegacyTs: $$__sveltets_2_IsomorphicComponent<{
    item: {
        name: string;
    };
    optional?: number;
    constant?: "c";
}, {
    select: CustomEvent<{
        name: string;
    }>;
} & {
    [evt: string]: CustomEvent<any>;
}, {
    footer: {
        item: {
            name: string;
        };
    };
}, {
    constant: "c";
}, string>;
type LegacyTs = InstanceType<typeof LegacyTs>;
export default LegacyTs;
//# sourceMappingURL=LegacyTs.d.svelte.ts.map