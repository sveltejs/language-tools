import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { format } from 'prettier';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const locals = [
    '',
    'cs-CZ',
    'de-DE',
    'es-ES',
    'fr-FR',
    'it-IT',
    'ja-JP',
    'ko-KR',
    'pl-PL',
    'pt-BR',
    'ru-RU',
    'tr-TR',
    'zh-CN',
    'zh-TW'
];

const keeps = [
    'Cannot_find_module_0_or_its_corresponding_type_declarations_2307',
    'Add_import_from_0_90057',
    'Update_import_from_0_90058',
    '_0_references_95198',
    '1_reference_95199',
];

const result: Record<string, Record<string, string>> = {};

for (const local of locals) {
    const url =
        local === ''
            ? `https://raw.githubusercontent.com/microsoft/TypeScript/refs/heads/main/tsc/internal/diagnostics/diagnosticMessages.generated.json`
            : `https://raw.githubusercontent.com/microsoft/TypeScript/refs/heads/main/tsc/internal/diagnostics/loc/${local}.generated.json`;
    const res = await fetch(url);
    const data = await res.json();

    result[local] = {};
    for (const key of keeps) {
        if (data[key]) {
            result[local][key] = data[key];
        }
    }
}

const json = JSON.stringify(result, null, 2);
const text = [
    'export const tsLocals = ' + JSON.stringify(locals, null, 2) + ' as const;',
    'export type TsLocals = (typeof tsLocals)[number];',
    'export type MessageKey = ' + keeps.map((k) => `'${k}'`).join(' | ') + ';',
    'export const localizedMessages: Record<TsLocals, Record<MessageKey, string>> = ' + json,
    'export function getFormatTemplate(locale: TsLocals, key: MessageKey): string {',
    "    return localizedMessages[locale]?.[key] ?? localizedMessages['']?.[key];",
    '}'
].join('\n');

fs.writeFileSync(
    path.resolve(__dirname, `../src/plugins/typescript-go/localization.ts`),
    await format(text, {
        parser: 'typescript',
        useTabs: false,
        printWidth: 100,
        tabWidth: 4,
        semi: true,
        trailingComma: 'none',
        singleQuote: true
    })
);
