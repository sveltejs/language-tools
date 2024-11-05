/** tested-ranges: [[22,5,"check"],[28,19,"? method1 : method2"],[71,5,"check"],[77,19,"? method1 : method2"]] */                                     {/**
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
<><Component  />{/*Ωignore_startΩ*/new Component({target: __sveltets_2_any(''), props: {}})/*Ωignore_endΩ*/.$on('click', (__sveltets_2_store_get(check), $check) ? method1 : method2)}{/**
                                                                                                                                                 1====           2==================    [generated] line 3 */}
<Component on:click={$check ? method1 : method2} />                                                                                                   {/**
                      1==== 2==================                                                                                                                                         [original] line 1
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
<button onclick={(__sveltets_2_store_get(check), $check) ? method1 : method2} >Bla</button></>                                                        {/**
                                         1====           2==================                                                                                                            [generated] line 4 */}
<button on:click={$check ? method1 : method2} >Bla</button>                                                                                           {/**
                   1==== 2==================                                                                                                                                            [original] line 2
------------------------------------------------------------------------------------------------------------------------------------------------------ */}
/** origin-hash: 25dzah */