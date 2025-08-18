#!/bin/bash
set -e

echo "Adding Svelte 5 overrides to package.json..."
json -I -f package.json -e 'this.pnpm={"overrides":{"svelte":"^5.0.0-next.100"}}'

echo "Installing dependencies with Svelte 5..."
pnpm install --no-frozen-lockfile

echo "Svelte 5 setup complete!"