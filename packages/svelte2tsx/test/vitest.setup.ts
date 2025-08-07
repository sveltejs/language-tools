import { glob } from 'tiny-glob/sync';

// Check for .solo files in CI mode
if (process.env.CI) {
    const arr = glob('**/*.solo', { cwd: 'test' });
    if (arr.length) throw new Error(`Forgot to remove ".solo" from test(s) ${arr}`);
}