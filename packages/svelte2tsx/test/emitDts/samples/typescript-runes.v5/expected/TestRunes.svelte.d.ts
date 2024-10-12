declare const TestRunes: import("svelte").Component<{
    foo: string;
    bar?: number;
}, {
    baz: () => void;
}, "bar">;
export default TestRunes;
