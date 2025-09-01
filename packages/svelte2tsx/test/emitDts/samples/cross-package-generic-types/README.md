# Cross-Package Generic Types Test

This test validates that generic type information is correctly preserved when importing generic classes from external packages during `.d.ts` generation.

## Issue
Before the fix, when using modern module resolution (bundler/node16), cross-package imports of generic classes would lose their type information and fall back to `any` in generated declaration files.

## Test Structure
- `core-package/` - Mock external package containing `GenericToken<T>` class
- `src/consumer.ts` - Consumes the generic class with type parameters
- `expected/` - Expected output showing preserved generic types

## Key Test Case
```typescript
// This should preserve the generic type as GenericToken<MyService>
// Before the fix: compiled as 'any' due to module resolution issues
// After the fix: correctly typed as GenericToken<MyService>
export const SERVICE_TOKEN = new GenericToken<MyService>('MyService');
```

## Fix
Updated `emitDts.ts` to use modern module resolution (bundler/node16) instead of legacy node10 resolution.