///<reference types="svelte" />
<></>;function render() {


    interface $$Props {
        exported1: string;
        exported2?: boolean;
        exported3: number;
        exported4?: 'foo';
        exported5?: '1';
        exported6?: '2';
    }

     let exported1: $$Props['exported1'];
     let exported2: $$Props['exported2'] = true;exported2 = __sveltets_1_any(exported2);;
     let exported3: number;
     let exported4: 'foo' = 'foo';exported4 = __sveltets_1_any(exported4);;
     let exported5: '1' = '1';exported5 = __sveltets_1_any(exported5);;let  exported6: $$Props['exported6'] = '2';
;
() => (<></>);
return { props: {...__sveltets_1_ensureRightProps<{exported1: typeof exported1,exported2?: typeof exported2,exported3: number,exported4?: 'foo',exported5?: '1',exported6?: typeof exported6}>(__sveltets_1_any("") as $$Props), ...__sveltets_1_ensureRightProps<Partial<$$Props>>({exported1: exported1,exported2: exported2,exported3: exported3,exported4: exported4,exported5: exported5,exported6: exported6}), ...{} as unknown as $$Props, ...{} as {}}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_with_any_event(render())) {
}