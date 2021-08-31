import { SvelteComponentTyped } from "svelte";
declare class __sveltets_Render<T extends boolean> {
    props(): {
        a: T;
    };
    events(): {
        b: CustomEvent<T>;
    };
    slots(): {
        default: {
            c: T;
        };
    };
}
export declare type InterfacesProps<T extends boolean> = ReturnType<__sveltets_Render<T>['props']>;
export declare type InterfacesEvents<T extends boolean> = ReturnType<__sveltets_Render<T>['events']>;
export declare type InterfacesSlots<T extends boolean> = ReturnType<__sveltets_Render<T>['slots']>;
export default class Interfaces<T extends boolean> extends SvelteComponentTyped<InterfacesProps<T>, InterfacesEvents<T>, InterfacesSlots<T>> {
}
export {};
