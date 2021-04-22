{#if hello && hello1}
    <Comp let:hello>
        {hello}
        <Comp let:hello>
            {#if hello}
                {hello}
            {/if}
        </Comp>
        <Comp {hello} let:hello>
            {#if hello}
                {hello}
            {/if}
        </Comp>
        <svelte:fragment slot="named1" let:hello>
            {#if hello}
                {hello}
            {/if}
        </svelte:fragment>
        <p slot="named2" let:hello>
            {#if hello}
                {hello}
            {/if}
        </p>
        <Comp slot="named3" let:hello>
            {#if hello}
                {hello}
            {/if}
        </Comp>
        {#if hello}
            <Comp let:hello>
                {#if hello}
                    {hello}
                {/if}
            </Comp>
        {/if}
    </Comp>
    {#if hi && bye}
        <Comp let:foo={bye}>
            {bye}
        </Comp>
    {:else if cool}
        <Comp>
            <div slot="named" let:cool let:hello>
                {hello}
            </div>
        </Comp>
    {:else}
        <Comp>
            <div slot="named" let:foo={hello} let:hello1={other}>
                {hello}
            </div>
        </Comp>
    {/if}
{/if}

<Comp let:hello>
    {#if hello && bye}
        {hello} {bye}
    {:else if hello && bye}
        {hello} {bye}
    {:else}
        {hello} {bye}
    {/if}
    <svelte:fragment slot="named1" let:hello>
        {#if hello && bye}
            {hello} {bye}
        {:else if hello && bye}
            {hello} {bye}
        {:else}
            {hello} {bye}
        {/if}
    </svelte:fragment>
    <p slot="named2" let:hello>
        {#if hello && bye}
            {hello} {bye}
        {:else if hello && bye}
            {hello} {bye}
        {:else}
            {hello} {bye}
        {/if}
    </p>
</Comp>