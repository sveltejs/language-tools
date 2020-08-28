{#if (name1 ?? "bla") == "world"}
    <h1>Hello {name2}</h1>
{:else if name3 ?? "blubb"}
    <h2>hello {name4}</h2>
{/if}