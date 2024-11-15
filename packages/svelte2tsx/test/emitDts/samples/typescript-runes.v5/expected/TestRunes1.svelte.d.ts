type $$ComponentProps = {
    foo: string;
    bar?: number;
};
declare const TestRunes1: import("svelte").Component<$$ComponentProps, {
    baz: () => void;
}, "bar">;
type TestRunes1 = ReturnType<typeof TestRunes1>;
export default TestRunes1;
