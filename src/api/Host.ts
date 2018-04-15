import { Document } from './Document';

export interface Host {
    on(evt: 'documentOpen|pre', listener: (document: Document) => void): this;
    on(evt: 'documentOpen', listener: (document: Document) => void): this;
    on(evt: 'documentOpen|post', listener: (document: Document) => void): this;

    on(evt: 'documentUpdate|pre', listener: (document: Document) => void): this;
    on(evt: 'documentUpdate', listener: (document: Document) => void): this;
    on(evt: 'documentUpdate|post', listener: (document: Document) => void): this;

    on(evt: 'documentChange|pre', listener: (document: Document) => void): this;
    on(evt: 'documentChange', listener: (document: Document) => void): this;
    on(evt: 'documentChange|post', listener: (document: Document) => void): this;

    on(name: string, listener: (...args: any[]) => void): void;
}
