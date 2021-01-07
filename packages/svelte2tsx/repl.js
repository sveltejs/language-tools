/**
 * Try your changes to the svelte2tsx source code
 * Run the package script "repl" to run this file
 *
 * [VScode] Attach a debugger by clicking on the bug
 *   next to the play button at the "repl" package script
 *
 * Make sure to run an instance of npm dev to reflect your changes
 * Don't forget to unstage changes to this file once you're done
 *
 * Thank you for your contribution!
 */

const result = require('svelte2tsx')(
    `<script lang="ts">
		export let arr = [];
	 </script>

	 {#each arr as item}
	 	{item}
	 {/each}
`,
    { isTsFile: true }
);
result;
debugger;
