<>{(name == "world") ? <>{(bla) ? <>asd</> : <></>}{(bla) ? <>asd</> : <></>}</> : (foo) ? <>{(bla) ? <>asd</> : <>bar</> }</> : <>{(bla) ? <>asd</> : (blubb) ? <>asd</> : <></> }</> }

{(name == "world") ? <>
    {(bla) ? <>asd</> : <></>}
    {(bla) ? <>
        asd
    </> : <>
        bar
    </> }
    {(bla) ? <>
        asd
    </> : (blubb) ? <>
        bar
    </> : <></> }
    {(bla) ? <>
        asd
    </> : (blubb) ? <>
        bar
    </> : <>
        foo
    </> }
</> : (foo) ? <>
    {(bla) ? <>asd</> : <></>}
    {(bla) ? <>
        asd
    </> : <>
        bar
    </> }
    {(bla) ? <>
        asd
    </> : (blubb) ? <>
        bar
    </> : <></> }
    {(bla) ? <>
        asd
    </> : (blubb) ? <>
        bar
    </> : <>
        foo
    </> }
</> : <>
    {(bla) ? <>asd</> : <></>}
    {(bla) ? <>
        asd
    </> : <>
        bar
    </> }
    {(bla) ? <>
        asd
    </> : (blubb) ? <>
        bar
    </> : <></> }
    {(bla) ? <>
        asd
    </> : (blubb) ? <>
        bar
    </> : <>
        foo
    </> }
</> }</>