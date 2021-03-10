{#if hello}
    <Comp let:foo>
        {foo}
    </Comp>
    {#if hi && bye}
        <Comp let:foo={bar}>
            {bar}
        </Comp>
    {:else if cool}
        <Comp>
            <div slot="named" let:foo let:foo1>
                {foo}
            </div>
        </Comp>
    {:else}
        <Comp>
            <div slot="named" let:foo={bar}>
                {bar}
            </div>
        </Comp>
    {/if}
{/if}
