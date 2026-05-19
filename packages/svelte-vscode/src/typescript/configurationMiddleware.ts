import * as vscode from 'vscode';

import type { MessageSignature } from 'vscode-languageserver-protocol';

export function sendNotificationMiddleware(
    type: string | MessageSignature,
    next: (type: string | MessageSignature, params?: any) => Promise<void>,
    params: any
): Promise<void> {
    const method = typeof type === 'string' ? type : type.method;
    if (method === 'workspace/didChangeConfiguration') {
        const merged = getMergedConfiguration();
        const settings: Record<string, any> = {
            ...params.settings,
            ...merged
        };
        return next(type, { settings });
    }
    return next(type, params);
}

export function getMergedConfiguration(): Record<'typescript' | 'javascript' | 'js/ts', any> {
    const result = JSON.parse(
        JSON.stringify({
            typescript: vscode.workspace.getConfiguration('typescript'),
            javascript: vscode.workspace.getConfiguration('javascript'),
            'js/ts': vscode.workspace.getConfiguration('js/ts')
        })
    );

    const unifyConfig = vscode.workspace.getConfiguration('js/ts');
    const languageOverrides = new Map<string, vscode.WorkspaceConfiguration>();
    const keys = collectConfigurationKeys(unifyConfig);

    for (const key of keys) {
        const inspect = unifyConfig.inspect(key);
        if (!hasModifiedValue(inspect)) {
            continue;
        }

        if (inspect?.languageIds == null) {
            const value = unifyConfig.get(key);
            setNestedValue(result.typescript, key, value);
            setNestedValue(result.javascript, key, value);
            continue;
        }

        if (inspect.languageIds.includes('svelte')) {
            const svelteOverride = overrideForLanguage('svelte', key);
            setNestedValue(result.typescript, key, svelteOverride);
            setNestedValue(result.javascript, key, svelteOverride);
            continue;
        }

        if (inspect.languageIds.includes('typescript')) {
            const tsOverride = overrideForLanguage('typescript', key);
            setNestedValue(result.typescript, key, tsOverride);
        }
        if (inspect.languageIds.includes('javascript')) {
            const jsOverride = overrideForLanguage('javascript', key);
            setNestedValue(result.javascript, key, jsOverride);
        }
    }

    return result;

    function getLanguageOverride(language: string): vscode.WorkspaceConfiguration {
        let cache = languageOverrides.get(language);
        if (!cache) {
            cache = vscode.workspace.getConfiguration('js/ts', { languageId: language });
            languageOverrides.set(language, cache);
        }
        return cache;
    }

    function overrideForLanguage(language: string, key: string): any {
        const config = getLanguageOverride(language);
        return config.get(key);
    }
}

/**
 * Checks if an inspected configuration value has any user-defined values set.
 * https://github.com/microsoft/vscode/blob/746d849b0fce24c671374ea176a27a7292a49c33/extensions/typescript-language-features/src/utils/configuration.ts#L41
 */
function hasModifiedValue(inspect: ReturnType<vscode.WorkspaceConfiguration['inspect']>): boolean {
    if (!inspect) {
        return false;
    }

    return (
        typeof inspect.globalValue !== 'undefined' ||
        typeof inspect.workspaceValue !== 'undefined' ||
        typeof inspect.workspaceFolderValue !== 'undefined' ||
        typeof inspect.globalLanguageValue !== 'undefined' ||
        typeof inspect.workspaceLanguageValue !== 'undefined' ||
        typeof inspect.workspaceFolderLanguageValue !== 'undefined' ||
        (inspect.languageIds?.length ?? 0) > 0
    );
}

const prototypeKeys = new Set(['__proto__', 'constructor', 'prototype']);
/**
 *
 * https://github.com/microsoft/typescript-go/blob/8a834dad086d6912b091e8b467e98499dab68cd9/_extension/src/configurationMiddleware.ts#L143
 */
function setNestedValue(obj: Record<string, any>, dottedKey: string, value: any): void {
    const parts = dottedKey.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (prototypeKeys.has(part)) {
            return;
        }
        if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
            current[part] = Object.create(null);
        }
        current = current[part];
    }
    const lastPart = parts[parts.length - 1];
    if (!prototypeKeys.has(lastPart)) {
        current[lastPart] = value;
    }
}

/**
 * Collect all leaf key paths from a workspace configuration section.
 * https://github.com/microsoft/typescript-go/blob/8a834dad086d6912b091e8b467e98499dab68cd9/_extension/src/configurationMiddleware.ts#L114
 */
function collectConfigurationKeys(config: vscode.WorkspaceConfiguration): string[] {
    const keys: string[] = [];
    const configMethods = new Set(['get', 'has', 'inspect', 'update']);

    function walk(obj: any, prefix: string) {
        if (obj === null || obj === undefined || typeof obj !== 'object' || Array.isArray(obj)) {
            return;
        }
        for (const key of Object.keys(obj)) {
            if (configMethods.has(key)) {
                continue;
            }
            const fullKey = prefix ? `${prefix}.${key}` : key;
            const value = obj[key];
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                walk(value, fullKey);
            } else {
                keys.push(fullKey);
            }
        }
    }

    walk(config, '');
    return keys;
}
