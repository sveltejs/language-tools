declare const TestRunes: import("svelte").Component<{
    foo: string;
    bar?: number;
}, {
    baz: () => void;
}, "bar">;
type TestRunes = ReturnType<typeof TestRunes>;
export default TestRunes;
