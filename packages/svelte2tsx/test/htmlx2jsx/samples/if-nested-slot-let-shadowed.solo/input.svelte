{#if hello && hello1}
    <Comp let:hello>
        {hello}
        <Comp let:hello>
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
