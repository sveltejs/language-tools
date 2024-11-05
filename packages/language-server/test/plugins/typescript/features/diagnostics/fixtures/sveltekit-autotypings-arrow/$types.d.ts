export interface PageLoadEvent<> {
    test: {
        exists: boolean;
    };
}

export type PageLoad<OutputData = Record<string, any>> = (event: PageLoadEvent) => OutputData;

export type PageData = ReturnType<typeof import('./+page').load>;
