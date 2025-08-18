#!/bin/bash
set -e

echo "Step 1: Updating snapshots with current Svelte version..."
UPDATE_SNAPSHOTS=true pnpm -w -r test

echo "Step 2: Setting up Svelte 5..."
./scripts/svelte5-up.sh

echo "Step 3: Updating snapshots with Svelte 5..."
UPDATE_SNAPSHOTS=true pnpm -w -r test

echo "Step 4: Reverting to original Svelte version..."
./scripts/svelte5-down.sh

echo "Step 5: Formatting code..."
pnpm format

echo "Snapshot update complete!"