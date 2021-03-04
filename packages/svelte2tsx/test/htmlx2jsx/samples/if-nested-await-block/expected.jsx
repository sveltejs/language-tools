<>{(hello) ? <>
    {() => {let _$$p = (x); __sveltets_awaitThen(_$$p, (y) => {((hello)) && <>
        {y}
    </>})}}
    {() => {let _$$p = (aPromise); ((hello)) && <>
      {hello}
    </>; __sveltets_awaitThen(_$$p, () => {((hello)) && <></>})}}
    {(hi && bye) ? <>
        {() => {let _$$p = (x); __sveltets_awaitThen(_$$p, (y) => {(((hello))) && ((hi && bye)) && <>
            {y}
        </>}, () => {(((hello))) && ((hi && bye)) && <>
            z
        </>})}}
    </> : (cool) ? <>
        {() => {let _$$p = (x); (((hello))) && (!(hi && bye) && (cool)) && <>
            loading
        </>; __sveltets_awaitThen(_$$p, (y) => {(((hello))) && (!(hi && bye) && (cool)) && <>
            {y}
        </>}, () => {(((hello))) && (!(hi && bye) && (cool)) && <>
            z
        </>})}}
    </> : <>
        {() => {let _$$p = (x); __sveltets_awaitThen(_$$p, (y) => {(((hello))) && (!(hi && bye) && !(cool)) && <>
            {y}
        </>})}}
    </> }
</> : <></>}</>