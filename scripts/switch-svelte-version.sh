#!/bin/bash

# Switch between Svelte versions for testing
# Usage: ./switch-svelte-version.sh [4|5]

VERSION=${1:-4}

case $VERSION in
  4)
    echo "Setting up Svelte 4..."
    # Remove overrides for Svelte 4
    json -I -f package.json -e 'delete this.pnpm'
    pnpm install --no-frozen-lockfile
    ;;
  5)
    echo "Setting up Svelte 5..."
    # Use pnpm overrides to force Svelte 5 everywhere
    json -I -f package.json -e 'this.pnpm={"overrides":{"svelte":"^5.0.0"}}'
    pnpm install --no-frozen-lockfile
    ;;
  *)
    echo "Usage: $0 [4|5]"
    exit 1
    ;;
esac

echo "Svelte version switched to:"
pnpm list svelte --depth=0 2>/dev/null | grep svelte@ || true