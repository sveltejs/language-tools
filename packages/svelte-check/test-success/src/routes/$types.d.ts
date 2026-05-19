export type PageData = {};
export type RequestEvent = {
    url: URL;
    request: Request;
    params: Record<string, string>;
};
