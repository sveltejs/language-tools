<><Component >{() => { let {var:new_var} = __sveltets_instanceOf(Component).$$slot_def['default'];<>
    <h1>Hello {new_var}</h1>
    {() => { let {slotvar:newvar} = __sveltets_instanceOf(Component).$$slot_def['someslot'];<><div   {...__sveltets_ensureType(Boolean, !!(newvar))}>
        <h2>Hi Slot {newvar}</h2>
    </div></>}}
    {() => { let {newvar2} = __sveltets_instanceOf(Component).$$slot_def['slotwithoutchildren'];<><div   {...__sveltets_ensureType(Boolean, !!(newvar2))}></div></>}}
    {() => { let {hi1, hi2, hi3:hi3alias} = __sveltets_instanceOf(Component).$$slot_def['slotwithmultiplelets'];<><div    ></div></>}}
    <p >
        Test
    </p>
</>}}</Component></>
