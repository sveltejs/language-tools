<>{(hello) ? <>
    <Comp >{() => { let {foo} = __sveltets_instanceOf(Comp).$$slot_def['default'];/*Ωignore_startΩ*/((hello)) && /*Ωignore_endΩ*/<>
        {foo}
    </>}}</Comp>
    {(hi && bye) ? <>
        <Comp >{() => { let {foo:bar} = __sveltets_instanceOf(Comp).$$slot_def['default'];/*Ωignore_startΩ*/(((hello))) && ((hi && bye)) && /*Ωignore_endΩ*/<>
            {bar}
        </>}}</Comp>
    </> : (cool) ? <>
        <Comp>
            {() => { let {foo, foo1} = __sveltets_instanceOf(Comp).$$slot_def['named'];/*Ωignore_startΩ*/(((hello))) && (!(hi && bye) && (cool)) && /*Ωignore_endΩ*/<><div   >
                {foo}
            </div></>}}
        </Comp>
    </> : <>
        <Comp>
            {() => { let {foo:bar} = __sveltets_instanceOf(Comp).$$slot_def['named'];/*Ωignore_startΩ*/(((hello))) && (!(hi && bye) && !(cool)) && /*Ωignore_endΩ*/<><div  >
                {bar}
            </div></>}}
        </Comp>
    </> }
</> : <></>}</>