{#await thePromise}
    loading
{:then { result, error }}
    then
{:catch { error: { message, code } }}
    catch
{/await}