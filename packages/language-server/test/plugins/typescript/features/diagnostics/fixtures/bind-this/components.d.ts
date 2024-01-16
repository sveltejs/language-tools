import { SvelteComponentTyped } from 'svelte';
export class Component extends SvelteComponentTyped<{ prop: boolean }> {}
export class OtherComponent extends SvelteComponentTyped<{ prop: string }> {}
export class ComponentWithFunction1 extends SvelteComponentTyped {
    action(a: number): string | number;
}
export class ComponentWithFunction2 extends SvelteComponentTyped {
    action(): string;
}
export class ComponentWithGeneric<T> extends SvelteComponentTyped<{ prop: T }> {}
