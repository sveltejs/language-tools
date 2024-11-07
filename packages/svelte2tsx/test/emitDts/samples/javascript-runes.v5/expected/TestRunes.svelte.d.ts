export default TestRunes;
type TestRunes = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
} & {
    baz: () => void;
};
declare const TestRunes: import("svelte").Component<{
    foo: string;
    bar?: number;
}, {
    baz: () => void;
}, "bar">;
type $$ComponentProps = {
    foo: string;
    bar?: number;
};
