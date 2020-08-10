<></>;
interface ComponentDef<T> {
        props: {items: T[]}
        events: {select: CustomEvent<T>}
        slots: {item: T}
    }
function render() {

    interface ComponentDef<T> {
        props: {items: T[]}
        events: {select: CustomEvent<T>}
        slots: {item: T}
    }
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, events: {} }}
render();
export default class Input__SvelteComponent_<T> extends Svelte2TsxComponent<ComponentDef<T>['props'], ComponentDef<T>['events'],ComponentDef<T>['slots']> {
}