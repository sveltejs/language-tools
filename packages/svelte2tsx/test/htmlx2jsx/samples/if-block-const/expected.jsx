<>{(name == "world") ? <>{(() => {const hello = name;return <>
    { }
    <h1>Hello {hello}</h1>
</>})()}</> : (true) ? <>{(() => {const hello = name;return <>
    { }
    <h1>Hello {hello}</h1>
</> : <>
    {@const hello = name}
    <h1>Hello {hello}</h1>
</> }

{(typeof a === 'string') ? <>{(() => {const aStr = a;const aStr2 = aStr;return <>
    { }
    { }

    {a}
</>})()}</> : (typeof a === 'number') ? <>{(() => {const aNum = a;return <>
    { }
</>})()}</> : <></> }

{(typeof a === 'string') ? <>{(() => {const aStr = a;return <>
    { }
</>})()}</> : <></>}

{(typeof a === 'string') ? <>{(() => {const aStr = a;return <>
    { }
</>})()}</> : <>
</> }</>