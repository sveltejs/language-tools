<Component let:var={new_var}>
    <h1>Hello {new_var}</h1>
    <div slot="someslot" let:slotvar={newvar} class:newvar>
        <h2>Hi Slot {newvar}</h2>
    </div>
    <div slot="slotwithoutchildren" let:newvar2 class:newvar2></div>
    <div slot="slotwithmultiplelets" let:hi1 let:hi2 let:hi3={hi3alias}></div>
    <p slot=desc>
        Test
    </p>
</Component>
