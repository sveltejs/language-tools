{#await object then { a = 3, b = 4, c }}
    then
{/await}

{#await array then [a, b, c = 3]}
    then
{/await}

{#await objectReject then value}
    then
{:catch { a = 3, b = 4, c }}
    catch
{/await}

{#await arrayReject then value}
    then
{:catch [a, b, c = 3]}
    catch
{/await}