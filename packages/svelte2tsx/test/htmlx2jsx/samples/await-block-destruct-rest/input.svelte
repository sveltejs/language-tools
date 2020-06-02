{#await object then { a, ...rest }}
    then
{/await}

{#await array then [a, b, ...rest]}
    then
{/await}

{#await objectReject then value}
    then
{:catch { a, ...rest }}
    catch
{/await}

{#await arrayReject then value}
    then
{:catch [a, b, ...rest]}
    catch
{/await}