export function createCounter(initial = 0) {
    let count = $state(initial);
    return {
        get count() {
            return count;
        },
        increment: () => count++
    };
}
