// test-success doesn't install SvelteKit, so declare the type its server hooks get
declare module '@sveltejs/kit' {
    export type Handle = (input: {
        event: { url: URL };
        resolve: (event: { url: URL }) => Response;
    }) => Response;
}
