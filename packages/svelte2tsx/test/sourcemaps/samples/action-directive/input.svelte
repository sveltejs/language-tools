<element use:action/>

<element
	use:action 
/>

<element use:action.nested.method={foo}/>

<element 
	use:action={$foo}
/>

<element
	use:action={{ foo }}
/>

<element
	use:action={{ 
		...leet,
		foo: $bar
	}}
/>