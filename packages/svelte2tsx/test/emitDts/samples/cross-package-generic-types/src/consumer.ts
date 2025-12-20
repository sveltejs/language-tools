import { GenericToken } from 'test-package';

export class MyService {
	constructor(private name: string) {}
	getName() { return this.name; }
}

// This should preserve the generic type as GenericToken<MyService>
// Before the fix, this would be compiled as 'any' due to module resolution issues
export const SERVICE_TOKEN = new GenericToken<MyService>('MyService');

// These explicit annotations should work regardless
export const ANNOTATED_TOKEN: GenericToken<MyService> = new GenericToken<MyService>('MyService');
export const ASSERTION_TOKEN = new GenericToken<MyService>('MyService') as GenericToken<MyService>;

// Test with different generic types
export class AnotherService {
	value = 42;
}

export const ANOTHER_TOKEN = new GenericToken<AnotherService>('AnotherService');
