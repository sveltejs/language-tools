import type tsAst from '@typescript/native/ast' with { 'resolution-mode': 'import' };
import type tsApiSync from '@typescript/native/sync' with { 'resolution-mode': 'import' };
import type tsFs from '@typescript/native/fs' with { 'resolution-mode': 'import' };
import type tsApiAsync from '@typescript/native/async' with { 'resolution-mode': 'import' };

export { tsAst, tsApiSync, tsFs, tsApiAsync };
