#!/bin/bash
set -e

echo "Removing Svelte 5 overrides from package.json..."
json -I -f package.json -e 'delete this.pnpm'

echo "Installing dependencies with Svelte 4..."
pnpm install

echo "Svelte 4 setup complete!"