import { SvelteComponent } from "svelte";
declare class __sveltets_Render<T extends {
    id: string;
}> {
    props(): {
        items: T[];
        selected?: T | undefined;
    };
    events(): {
        select: CustomEvent<T>;
    } & {
        [evt: string]: CustomEvent<any>;
    };
    slots(): {
        default: {
            item: T;
            isSelected: boolean;
        };
    };
}
export type TestGenericsProps<T extends {
    id: string;
}> = ReturnType<__sveltets_Render<T>['props']>;
export type TestGenericsEvents<T extends {
    id: string;
}> = ReturnType<__sveltets_Render<T>['events']>;
export type TestGenericsSlots<T extends {
    id: string;
}> = ReturnType<__sveltets_Render<T>['slots']>;
export default class TestGenerics<T extends {
    id: string;
}> extends SvelteComponent<TestGenericsProps<T>, TestGenericsEvents<T>, TestGenericsSlots<T>> {
}
export {};
