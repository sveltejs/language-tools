// In a real SvelteKit application, $types are autogenerated, for this test we manually create them to our liking
// @ts-expect-error - to silence tsc
export const load = decorator((event) => event.test);

// Dummy decorator function, to open the door to SvelteKit extensions
function decorator<T>(fn: T): T {
    return fn;
}