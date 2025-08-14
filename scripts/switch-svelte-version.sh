#!/bin/bash

# Switch between Svelte versions for testing
# Usage: ./switch-svelte-version.sh [4|5]

VERSION=${1:-4}

case $VERSION in
  4)
    echo "Installing Svelte 4..."
    pnpm install -w svelte@4
    ;;
  5)
    echo "Installing Svelte 5..."
    pnpm install -w svelte@5
    ;;
  *)
    echo "Usage: $0 [4|5]"
    exit 1
    ;;
esac

echo "Svelte version switched to:"
pnpm list svelte --depth=0 2>/dev/null | grep svelte@ || true