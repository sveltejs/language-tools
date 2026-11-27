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
    | 'Cannot_find_module_0_or_its_corresponding_type_declarations_2307'
    | 'Add_import_from_0_90057'
    | 'Update_import_from_0_90058'
    | '_0_references_95198'
    | '1_reference_95199';
export const localizedMessages: Record<TsLocals, Record<MessageKey, string>> = {
    '': {
        Cannot_find_module_0_or_its_corresponding_type_declarations_2307:
            "Cannot find module '{0}' or its corresponding type declarations.",
        Add_import_from_0_90057: 'Add import from "{0}"',
        Update_import_from_0_90058: 'Update import from "{0}"',
        _0_references_95198: '{0} references',
        '1_reference_95199': '1 reference'
    },
    'cs-CZ': {
        Cannot_find_module_0_or_its_corresponding_type_declarations_2307:
            'Nepovedlo se najít modul {0} nebo jeho odpovídající deklarace typů.',
        Add_import_from_0_90057: 'Přidat import z {0}',
        Update_import_from_0_90058: 'Aktualizovat import z: {0}',
        _0_references_95198: 'Počet odkazů: {0}',
        '1_reference_95199': 'jeden odkaz'
    },
    'de-DE': {
        Cannot_find_module_0_or_its_corresponding_type_declarations_2307:
            'Das Modul "{0}" oder die zugehörigen Typdeklarationen wurden nicht gefunden.',
        Add_import_from_0_90057: 'Import aus "{0}" hinzufügen',
        Update_import_from_0_90058: 'Import von "{0}" aktualisieren',
        _0_references_95198: '{0} Verweise',
        '1_reference_95199': '1 Verweis'
    },
    'es-ES': {
        Cannot_find_module_0_or_its_corresponding_type_declarations_2307:
            'No se encuentra el módulo "{0}" ni sus declaraciones de tipos correspondientes.',
        Add_import_from_0_90057: 'Agregar importación desde “{0}”',
        Update_import_from_0_90058: 'Actualizar importación desde “{0}”',
        _0_references_95198: '{0} referencias',
        '1_reference_95199': '1 referencia'
    },
    'fr-FR': {
        Cannot_find_module_0_or_its_corresponding_type_declarations_2307:
            "Impossible de localiser le module '{0}' ou les déclarations de type correspondantes.",
        Add_import_from_0_90057: 'Ajouter l\'importation de "{0}"',
        Update_import_from_0_90058: 'Mettre à jour l’importation à partir de "{0}"',
        _0_references_95198: '{0} références',
        '1_reference_95199': '1 référence'
    },
    'it-IT': {
        Cannot_find_module_0_or_its_corresponding_type_declarations_2307:
            "Non è possibile trovare il modulo '{0}' o le relative dichiarazioni di tipo corrispondenti.",
        Add_import_from_0_90057: 'Aggiungere l\'importazione da "{0}"',
        Update_import_from_0_90058: 'Aggiornare l\'importazione da "{0}"',
        _0_references_95198: '{0} riferimenti',
        '1_reference_95199': '1 riferimento'
    },
    'ja-JP': {
        Cannot_find_module_0_or_its_corresponding_type_declarations_2307:
            "モジュール '{0}' またはそれに対応する型宣言が見つかりません。",
        Add_import_from_0_90057: '"{0}" からのインポートの追加',
        Update_import_from_0_90058: '"{0}" からのインポートの更新',
        _0_references_95198: '{0} 個の参照',
        '1_reference_95199': '1 件の参照'
    },
    'ko-KR': {
        Cannot_find_module_0_or_its_corresponding_type_declarations_2307:
            "'{0}' 모듈 또는 해당 형식 선언을 찾을 수 없습니다.",
        Add_import_from_0_90057: '"{0}"에서 가져오기 추가',
        Update_import_from_0_90058: '"{0}"에서 가져오기 업데이트',
        _0_references_95198: '참조 {0}개',
        '1_reference_95199': '참조 1개'
    },
    'pl-PL': {
        Cannot_find_module_0_or_its_corresponding_type_declarations_2307:
            'Nie można odnaleźć modułu „{0}” lub odpowiadających mu deklaracji typów.',
        Add_import_from_0_90057: 'Dodaj import z „{0}”',
        Update_import_from_0_90058: 'Aktualizuj import z „{0}”',
        _0_references_95198: 'Odwołania: {0}',
        '1_reference_95199': '1 odwołanie'
    },
    'pt-BR': {
        Cannot_find_module_0_or_its_corresponding_type_declarations_2307:
            "Não é possível localizar o módulo '{0}' ou suas declarações de tipo correspondentes.",
        Add_import_from_0_90057: 'Adicionar importação de "{0}"',
        Update_import_from_0_90058: 'Atualizar importação de "{0}"',
        _0_references_95198: '{0} referências',
        '1_reference_95199': '1 referência'
    },
    'ru-RU': {
        Cannot_find_module_0_or_its_corresponding_type_declarations_2307:
            'Не удается найти модуль "{0}" или связанные с ним объявления типов.',
        Add_import_from_0_90057: 'Добавить импорт из "{0}"',
        Update_import_from_0_90058: 'Обновить импорт из "{0}"',
        _0_references_95198: 'Ссылок: {0}',
        '1_reference_95199': '1 ссылка'
    },
    'tr-TR': {
        Cannot_find_module_0_or_its_corresponding_type_declarations_2307:
            "'{0}' modülü veya karşılık gelen tür bildirimleri bulunamıyor.",
        Add_import_from_0_90057: '"{0}" kaynağından içeri aktarma ekle',
        Update_import_from_0_90058: '"{0}" kaynağından içeri aktarmayı güncelleştir',
        _0_references_95198: '{0} başvuru',
        '1_reference_95199': '1 başvuru'
    },
    'zh-CN': {
        Cannot_find_module_0_or_its_corresponding_type_declarations_2307:
            '找不到模块“{0}”或其相应的类型声明。',
        Add_import_from_0_90057: '从“{0}”添加导入',
        Update_import_from_0_90058: '从“{0}”更新导入',
        _0_references_95198: '{0} 个引用',
        '1_reference_95199': '1 个引用'
    },
    'zh-TW': {
        Cannot_find_module_0_or_its_corresponding_type_declarations_2307:
            "找不到模組 '{0}' 或其對應的型別宣告。",
        Add_import_from_0_90057: '從 "{0}" 新增匯入',
        Update_import_from_0_90058: '從 "{0}" 更新匯入',
        _0_references_95198: '{0} 個參考',
        '1_reference_95199': '1 個參考'
    }
};
export function getFormatTemplate(locale: TsLocals, key: MessageKey): string {
    return localizedMessages[locale]?.[key] ?? localizedMessages['']?.[key];
}
