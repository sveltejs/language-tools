<></>;function render() { let $$props = __sveltets_allPropsType();
<><h1>{$$props['name']}</h1></>
return { props: {}, slots: {} }}

export default class Input {
    $$prop_def = __sveltets_partial_with_any(render().props)
    $$slot_def = render().slots
}
