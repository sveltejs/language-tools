<>{(hello) ? <>
    <Comp >{() => { let {foo} = __sveltets_instanceOf(Comp).$$slot_def['default'];((hello)) && <>
        {foo}
    </>}}</Comp>
    {(hi && bye) ? <>
        <Comp >{() => { let {foo:bar} = __sveltets_instanceOf(Comp).$$slot_def['default'];(((hello))) && ((hi && bye)) && <>
            {bar}
        </>}}</Comp>
    </> : (cool) ? <>
        <Comp>
            {() => { let {foo, foo1} = __sveltets_instanceOf(Comp).$$slot_def['named'];(((hello))) && (!(hi && bye) && (cool)) && <><div   >
                {foo}
            </div></>}}
        </Comp>
    </> : <>
        <Comp>
            {() => { let {foo:bar} = __sveltets_instanceOf(Comp).$$slot_def['named'];(((hello))) && (!(hi && bye) && !(cool)) && <><div  >
                {bar}
            </div></>}}
        </Comp>
    </> }
</> : <></>}</>