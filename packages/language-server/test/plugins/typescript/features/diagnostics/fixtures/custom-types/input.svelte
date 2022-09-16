<script lang="ts"></script>

<!-- valid for both -->
<div owntypefromold="foo" />
<div on:ownclickfromold={(e) => e.detail.foo} />

<own-element attribute="foo" />

<own-element-from-old attribute="foo" />

<!-- valid for new, invalid for old -->
<div owntype="foo" />
<div on:ownclick={(e) => e.detail.foo} />

<!-- valid for old, invalid for new -->
<own-element attribute={false} />
<own-element doesnexist="wrong" />

<!-- invalid -->
<div owntype={false} />
<div owntypefromold={false} />
<div on:ownclick={(e) => e.detail.wrong} />
<div on:ownclickfromold={(e) => e.detail.wrong} />

<own-element-from-old attribute={false} />
<own-element-from-old doesnexist="wrong" />
