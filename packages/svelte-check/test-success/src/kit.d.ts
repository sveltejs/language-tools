// The types SvelteKit's hooks are typed with
declare module '@sveltejs/kit' {
    export type Handle = (input: {
        event: { url: URL };
        resolve: (event: { url: URL }) => Response;
    }) => Response;
}
