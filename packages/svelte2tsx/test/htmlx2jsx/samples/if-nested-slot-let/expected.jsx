<>{(hello) ? <>
    <Comp >{() => { let {foo} = /*Ωignore_startΩ*/new Comp({target: __sveltets_1_any(''), props: {}})/*Ωignore_endΩ*/.$$slot_def['default'];/*Ωignore_startΩ*/((hello)) && /*Ωignore_endΩ*/<>
        {foo}
    </>}}</Comp>
    {(hi && bye) ? <>
        <Comp >{() => { let {foo:bar} = /*Ωignore_startΩ*/new Comp({target: __sveltets_1_any(''), props: {}})/*Ωignore_endΩ*/.$$slot_def['default'];/*Ωignore_startΩ*/(((hello))) && ((hi && bye)) && /*Ωignore_endΩ*/<>
            {bar}
        </>}}</Comp>
    </> : (cool) ? <>
        <Comp>
            {() => { let {foo, foo1} = /*Ωignore_startΩ*/new Comp({target: __sveltets_1_any(''), props: {}})/*Ωignore_endΩ*/.$$slot_def['named'];/*Ωignore_startΩ*/(((hello))) && (!(hi && bye) && (cool)) && /*Ωignore_endΩ*/<><div   >
                {foo}
            </div></>}}
        </Comp>
    </> : <>
        <Comp>
            {() => { let {foo:bar} = /*Ωignore_startΩ*/new Comp({target: __sveltets_1_any(''), props: {}})/*Ωignore_endΩ*/.$$slot_def['named'];/*Ωignore_startΩ*/(((hello))) && (!(hi && bye) && !(cool)) && /*Ωignore_endΩ*/<><div  >
                {bar}
            </div></>}}
        </Comp>
    </> }
</> : <></>}</>