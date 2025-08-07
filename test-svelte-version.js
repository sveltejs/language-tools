// Check which Svelte is being imported in different contexts
const svelte4 = require('svelte4/compiler');
const svelte5 = require('svelte/compiler');

console.log('svelte4 VERSION:', svelte4.VERSION);
console.log('svelte (v5) VERSION:', svelte5.VERSION);
