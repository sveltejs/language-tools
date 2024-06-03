 var foo/*Ωignore_startΩ*/: import('svelte').Snippet<[any]>/*Ωignore_endΩ*/ = (x) => {async () => {
	 { svelteHTML.createElement("div", {}); x; }
};return __sveltets_2_any(0)};

  var bar/*Ωignore_startΩ*/: import('svelte').Snippet/*Ωignore_endΩ*/ = () => {async () => {
	 { svelteHTML.createElement("div", {});  }
};return __sveltets_2_any(0)};

  var await_inside/*Ωignore_startΩ*/: import('svelte').Snippet/*Ωignore_endΩ*/ = () => {async () => {
	   { const $$_value = await (foo);{ const bar = $$_value; bar;}}
};return __sveltets_2_any(0)};

 var default_parameter/*Ωignore_startΩ*/: import('svelte').Snippet<[any]>/*Ωignore_endΩ*/ = (a = '') => {async () => {
	a;
};return __sveltets_2_any(0)};

;__sveltets_2_ensureSnippet(foo(1));
;__sveltets_2_ensureSnippet(bar());
;__sveltets_2_ensureSnippet(await_inside());

 { const $$_tnenopmoC0C = __sveltets_2_ensureComponent(Component); new $$_tnenopmoC0C({ target: __sveltets_2_any(), props: {children:() => { return __sveltets_2_any(0); },bar:(x) => {async () => {
		 { svelteHTML.createElement("div", {}); x; }
	};return __sveltets_2_any(0)},}});
	 { svelteHTML.createElement("div", {});asd; }
	
 Component}

 { const $$_tsiL0C = __sveltets_2_ensureComponent(List); new $$_tsiL0C({ target: __sveltets_2_any(), props: { 
	"data":[1, 2, 3],row:(item) => {async () => {
		item;
	};return __sveltets_2_any(0)},await_inside:() => {async () => {
		   { const $$_value = await (foo);{ const bar = $$_value; bar;}}
	};return __sveltets_2_any(0)},}});
	
 List}

 { const $$_tsiL0C = __sveltets_2_ensureComponent(List); new $$_tsiL0C({ target: __sveltets_2_any(), props: {children:() => { return __sveltets_2_any(0); },}});
	 
 List}

;__sveltets_2_ensureSnippet(children());