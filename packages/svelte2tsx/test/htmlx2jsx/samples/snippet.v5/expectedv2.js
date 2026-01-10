 const foo/*Ωignore_positionΩ*/ = (x)/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
	 { svelteHTML.createElement("div", {}); x; }
};return __sveltets_2_any(0)};

  const bar/*Ωignore_positionΩ*/ = ()/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
	 { svelteHTML.createElement("div", {});  }
};return __sveltets_2_any(0)};

  const await_inside/*Ωignore_positionΩ*/ = ()/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
	   { const $$_value = await (foo);{ const bar = $$_value; bar;}}
};return __sveltets_2_any(0)};

 const defaultValue/*Ωignore_positionΩ*/ = (x = '')/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
	 { svelteHTML.createElement("div", {}); x; }
};return __sveltets_2_any(0)};

;__sveltets_2_ensureSnippet(foo(1));
;__sveltets_2_ensureSnippet(bar());
;__sveltets_2_ensureSnippet(await_inside());

 { const $$_tnenopmoC0C = __sveltets_2_ensureComponent(Component); const $$_tnenopmoC0 = new $$_tnenopmoC0C({ target: __sveltets_2_any(), props: {children:() => { return __sveltets_2_any(0); },bar:(x) => { async ()/*Ωignore_positionΩ*/ => {
		 { svelteHTML.createElement("div", {}); x; }
	};return __sveltets_2_any(0)},}});/*Ωignore_startΩ*/const {bar} = $$_tnenopmoC0.$$prop_def;/*Ωignore_endΩ*/
	 { svelteHTML.createElement("div", {});asd; }
	
 Component}

 { const $$_tsiL0C = __sveltets_2_ensureComponent(List); const $$_tsiL0 = new $$_tsiL0C({ target: __sveltets_2_any(), props: { "data":[1, 2, 3],row:(item) => { async ()/*Ωignore_positionΩ*/ => {
		item;
	};return __sveltets_2_any(0)},await_inside:() => { async ()/*Ωignore_positionΩ*/ => {
		   { const $$_value = await (foo);{ const bar = $$_value; bar;}}
	};return __sveltets_2_any(0)},}});/*Ωignore_startΩ*/const {row, await_inside} = $$_tsiL0.$$prop_def;/*Ωignore_endΩ*/
	
	
 List}

 { const $$_tsiL0C = __sveltets_2_ensureComponent(List); new $$_tsiL0C({ target: __sveltets_2_any(), props: {children:() => { return __sveltets_2_any(0); },}});
	 
 List}

 { const $$_tsiL0C = __sveltets_2_ensureComponent(List); const $$_tsiL0 = new $$_tsiL0C({ target: __sveltets_2_any(), props: { children:() => { return __sveltets_2_any(0); },"data":[1, 2, 3],row1:(item) => { async ()/*Ωignore_positionΩ*/ => {
		item;
	};return __sveltets_2_any(0)},row2:(item) => { async ()/*Ωignore_positionΩ*/ => {
		item;
	};return __sveltets_2_any(0)},}});/*Ωignore_startΩ*/const {row1, row2} = $$_tsiL0.$$prop_def;/*Ωignore_endΩ*/
	
	 { svelteHTML.createElement("p", {});   }
	
 List}

;__sveltets_2_ensureSnippet(children());

 const jsDoc/*Ωignore_positionΩ*/ = (/**@type {number}*/a)/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
	a;
};return __sveltets_2_any(0)};