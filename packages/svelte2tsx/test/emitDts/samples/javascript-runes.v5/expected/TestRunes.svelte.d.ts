type $$ComponentProps = {
    foo: string;
    bar?: number;
};
declare const TestRunes: import("svelte").Component<$$ComponentProps, {
    baz: () => void;
}, "bar">;
type TestRunes = ReturnType<typeof TestRunes>;
export default TestRunes;
