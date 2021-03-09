<>{(hello) ? <>
    {() => {let _$$p = (x); __sveltets_awaitThen(_$$p, (y) => {/*Ωignore_startΩ*/((hello)) && /*Ωignore_endΩ*/<>
        {y}
    </>})}}
    {() => {let _$$p = (aPromise); /*Ωignore_startΩ*/((hello)) && /*Ωignore_endΩ*/<>
      {hello}
    </>; __sveltets_awaitThen(_$$p, () => {<></>})}}
    {(hi && bye) ? <>
        {() => {let _$$p = (x); __sveltets_awaitThen(_$$p, (y) => {/*Ωignore_startΩ*/(((hello))) && ((hi && bye)) && /*Ωignore_endΩ*/<>
            {y}
        </>}, () => {/*Ωignore_startΩ*/(((hello))) && ((hi && bye)) && /*Ωignore_endΩ*/<>
            z
        </>})}}
    </> : (cool) ? <>
        {() => {let _$$p = (x); /*Ωignore_startΩ*/(((hello))) && (!(hi && bye) && (cool)) && /*Ωignore_endΩ*/<>
            loading
        </>; __sveltets_awaitThen(_$$p, (y) => {/*Ωignore_startΩ*/(((hello))) && (!(hi && bye) && (cool)) && /*Ωignore_endΩ*/<>
            {y}
        </>}, () => {/*Ωignore_startΩ*/(((hello))) && (!(hi && bye) && (cool)) && /*Ωignore_endΩ*/<>
            z
        </>})}}
    </> : <>
        {() => {let _$$p = (x); __sveltets_awaitThen(_$$p, (y) => {/*Ωignore_startΩ*/(((hello))) && (!(hi && bye) && !(cool)) && /*Ωignore_endΩ*/<>
            {y}
        </>})}}
    </> }
</> : <></>}</>