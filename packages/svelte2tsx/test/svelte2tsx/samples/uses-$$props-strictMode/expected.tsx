<></>;function render() { let $$props = __sveltets_allPropsType();
<><h1>{$$props['name']}</h1></>
return { props: {}, slots: {} }}

export default class {
    $$prop_def = __sveltets_with_any(render().props)
    $$slot_def = render().slots
}
