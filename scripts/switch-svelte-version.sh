#!/bin/bash

# Switch between Svelte versions for testing
# Usage: ./switch-svelte-version.sh [4|5|cleanup]

VERSION=${1:-4}

case $VERSION in
  4)
    echo "Setting up Svelte 4..."
    # Remove overrides for Svelte 4
    json -I -f package.json -e 'delete this.pnpm'
    pnpm install --no-frozen-lockfile
    echo "Svelte version switched to:"
    pnpm list svelte --depth=0 2>/dev/null | grep svelte@ || true
    ;;
  5)
    echo "Setting up Svelte 5..."
    # Use pnpm overrides to force Svelte 5 everywhere
    json -I -f package.json -e 'this.pnpm={"overrides":{"svelte":"^5.0.0"}}'
    pnpm install --no-frozen-lockfile
    echo "Svelte version switched to:"
    pnpm list svelte --depth=0 2>/dev/null | grep svelte@ || true
    ;;
  cleanup)
    echo "Cleaning up package.json..."
    # Remove any pnpm overrides
    json -I -f package.json -e 'delete this.pnpm'
    # Don't run install, just clean up package.json
    ;;
  *)
    echo "Usage: $0 [4|5|cleanup]"
    exit 1
    ;;
esac