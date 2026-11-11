import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
interface Props extends HTMLButtonAttributes {
    /** The variant */
    variant?: 'primary' | 'secondary';
    count?: number;
    children?: Snippet;
}
/** A button */
declare const RunesTs: import("svelte").Component<Props, {
    reset: () => void;
}, "count">;
type RunesTs = ReturnType<typeof RunesTs>;
export default RunesTs;
//# sourceMappingURL=RunesTs.d.svelte.ts.map