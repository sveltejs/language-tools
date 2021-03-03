<><Component>
    <sveltefragment>
        <p>hi</p>
    </sveltefragment>

    <sveltefragment >
        <p>hi</p>
    </sveltefragment>
</Component>

<Component>
    {() => { let {foo, bar:baz} = __sveltets_instanceOf(Component).$$slot_def['default'];<><sveltefragment  >
        <p>{foo} {baz}</p>
    </sveltefragment></>}}

    {() => { let {foo, bar:baz} = __sveltets_instanceOf(Component).$$slot_def['named'];<><sveltefragment   >
        <p>{foo} {baz}</p>
    </sveltefragment></>}}
</Component></>