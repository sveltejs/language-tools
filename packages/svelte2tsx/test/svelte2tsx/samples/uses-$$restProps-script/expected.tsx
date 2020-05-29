<></>;function render() { let $$restProps = __sveltets_restPropsType();

    let name = $$restProps['name'];
;
<><h1>{name}</h1>
</>
return { props: {}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial_with_any(render().props)
    $$slot_def = render().slots
}
