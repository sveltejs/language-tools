export const tsLocals = [
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
] as const;
export type TsLocals = (typeof tsLocals)[number];
export type MessageKey =
    | '_0_references_95198'
    | '1_reference_95199'
    | 'Add_all_missing_imports_95064';
export const localizedMessages: Record<TsLocals, Record<MessageKey, string>> = {
    '': {
        _0_references_95198: '{0} references',
        '1_reference_95199': '1 reference',
        Add_all_missing_imports_95064: 'Add all missing imports'
    },
    'cs-CZ': {
        _0_references_95198: 'Počet odkazů: {0}',
        '1_reference_95199': 'jeden odkaz',
        Add_all_missing_imports_95064: 'Přidat všechny chybějící importy'
    },
    'de-DE': {
        _0_references_95198: '{0} Verweise',
        '1_reference_95199': '1 Verweis',
        Add_all_missing_imports_95064: 'Alle fehlenden Importe hinzufügen'
    },
    'es-ES': {
        _0_references_95198: '{0} referencias',
        '1_reference_95199': '1 referencia',
        Add_all_missing_imports_95064: 'Agregar todas las importaciones que faltan'
    },
    'fr-FR': {
        _0_references_95198: '{0} références',
        '1_reference_95199': '1 référence',
        Add_all_missing_imports_95064: 'Ajouter toutes les importations manquantes'
    },
    'it-IT': {
        _0_references_95198: '{0} riferimenti',
        '1_reference_95199': '1 riferimento',
        Add_all_missing_imports_95064: 'Aggiungi tutte le importazioni mancanti'
    },
    'ja-JP': {
        _0_references_95198: '{0} 個の参照',
        '1_reference_95199': '1 件の参照',
        Add_all_missing_imports_95064: '不足しているすべてのインポートを追加する'
    },
    'ko-KR': {
        _0_references_95198: '참조 {0}개',
        '1_reference_95199': '참조 1개',
        Add_all_missing_imports_95064: '누락된 모든 가져오기 추가'
    },
    'pl-PL': {
        _0_references_95198: 'Odwołania: {0}',
        '1_reference_95199': '1 odwołanie',
        Add_all_missing_imports_95064: 'Dodaj wszystkie brakujące importy'
    },
    'pt-BR': {
        _0_references_95198: '{0} referências',
        '1_reference_95199': '1 referência',
        Add_all_missing_imports_95064: 'Adicionar todas as importações ausentes'
    },
    'ru-RU': {
        _0_references_95198: 'Ссылок: {0}',
        '1_reference_95199': '1 ссылка',
        Add_all_missing_imports_95064: 'Добавить все отсутствующие импорты'
    },
    'tr-TR': {
        _0_references_95198: '{0} başvuru',
        '1_reference_95199': '1 başvuru',
        Add_all_missing_imports_95064: 'Tüm eksik içeri aktarmaları ekleyin'
    },
    'zh-CN': {
        _0_references_95198: '{0} 个引用',
        '1_reference_95199': '1 个引用',
        Add_all_missing_imports_95064: '添加所有缺少的导入'
    },
    'zh-TW': {
        _0_references_95198: '{0} 個參考',
        '1_reference_95199': '1 個參考',
        Add_all_missing_imports_95064: '新增所有缺少的匯入'
    }
};
export function getFormatTemplate(locale: TsLocals, key: MessageKey): string {
    return localizedMessages[locale]?.[key] ?? localizedMessages['']?.[key];
}
