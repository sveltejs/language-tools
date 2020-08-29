declare const __sapperPreloadGlobals: {
    fetch: (url: string, options?: any) => Promise<any>;
    error: (statusCode: number, error: any) => void;
    redirect: (statusCode: number, location: string) => Promise<any>;
};
