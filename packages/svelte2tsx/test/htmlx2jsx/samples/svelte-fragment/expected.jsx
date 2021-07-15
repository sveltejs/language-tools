<><Component>
    <sveltefragment>
        <p>hi</p>
    </sveltefragment>

    <sveltefragment >
        <p>hi</p>
    </sveltefragment>
</Component>

<Component>
    {() => { let {foo, bar:baz} = /*Ωignore_startΩ*/new Component({target: __sveltets_1_any(''), props: {}})/*Ωignore_endΩ*/.$$slot_def['default'];<><sveltefragment  >
        <p>{foo} {baz}</p>
    </sveltefragment></>}}

    {() => { let {foo, bar:baz} = /*Ωignore_startΩ*/new Component({target: __sveltets_1_any(''), props: {}})/*Ωignore_endΩ*/.$$slot_def['named'];<><sveltefragment   >
        <p>{foo} {baz}</p>
    </sveltefragment></>}}
</Component></>