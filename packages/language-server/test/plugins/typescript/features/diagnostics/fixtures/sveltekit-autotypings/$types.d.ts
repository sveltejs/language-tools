export interface PageLoadEvent<> {
    test: {
        exists: boolean;
    };
}

export type PageData = ReturnType<typeof import('./+page').load>;
