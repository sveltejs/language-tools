export declare const LegacyJs: {
    (internal: unknown, props: {
        label: string;
        disabled?: boolean | undefined;
    } & {
        children?: any;
    } & {
        $$events?: ({
            press: CustomEvent<any>;
        } & {
            [evt: string]: CustomEvent<any>;
        }) | undefined;
        $$slots?: {
            default: {
                label: string;
            };
        } | undefined;
    }): {
        $set?: any;
        $on?: any;
    };
    new (options: import("svelte").ComponentConstructorOptions<{
        label: string;
        disabled?: boolean | undefined;
    } & {
        children?: any;
    }>): import("svelte").SvelteComponent<{
        label: string;
        disabled?: boolean | undefined;
    } & {
        children?: any;
    }, {
        press: CustomEvent<any>;
    } & {
        [evt: string]: CustomEvent<any>;
    }, {
        default: {
            label: string;
        };
    }> & {
        $$bindings?: string | undefined;
    };
    z_$$bindings?: string | undefined;
};
export type LegacyJs = InstanceType<typeof LegacyJs>;
export default LegacyJs;
//# sourceMappingURL=LegacyJs.d.svelte.ts.map