<>{() => {let _$$p = (object); _$$p.then(({ a = 3, b = 4, c }) => {<>
    then
</>})}}

{() => {let _$$p = (array); _$$p.then(([a, b, c = 3]) => {<>
    then
</>})}}

{() => {let _$$p = (objectReject); _$$p.then((value) => {<>
    then
</>}).catch(({ a = 3, b = 4, c }) => {<>
    catch
</>})}}

{() => {let _$$p = (arrayReject); _$$p.then((value) => {<>
    then
</>}).catch(([a, b, c = 3]) => {<>
    catch
</>})}}</>