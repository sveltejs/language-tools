import { GenericToken } from '@test/core';
export declare class MyService {
    private name;
    constructor(name: string);
    getName(): string;
}
export declare const SERVICE_TOKEN: GenericToken<MyService>;
export declare const ANNOTATED_TOKEN: GenericToken<MyService>;
export declare const ASSERTION_TOKEN: GenericToken<MyService>;
export declare class AnotherService {
    value: number;
}
export declare const ANOTHER_TOKEN: GenericToken<AnotherService>;
