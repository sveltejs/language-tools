import { SvelteComponent } from "svelte";
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
export type InterfacesProps<T extends boolean> = ReturnType<__sveltets_Render<T>['props']>;
export type InterfacesEvents<T extends boolean> = ReturnType<__sveltets_Render<T>['events']>;
export type InterfacesSlots<T extends boolean> = ReturnType<__sveltets_Render<T>['slots']>;
export default class Interfaces<T extends boolean> extends SvelteComponent<InterfacesProps<T>, InterfacesEvents<T>, InterfacesSlots<T>> {
}
export {};
