import type { Snippet } from 'svelte';

type Props = {
    badge?: Snippet;
    children?: Snippet;
};

type $$ComponentProps = Props & Record<string, unknown>;
declare const Button: import('svelte').Component<$$ComponentProps, {}, ''>;
export default Button;
