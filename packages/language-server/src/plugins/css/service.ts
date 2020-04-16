import {
    getCSSLanguageService,
    getSCSSLanguageService,
    getLESSLanguageService,
    LanguageService,
} from 'vscode-css-languageservice';

const langs = {
    css: getCSSLanguageService(),
    scss: getSCSSLanguageService(),
    less: getLESSLanguageService(),
};

export function getLanguage(kind?: string) {
    switch (kind) {
        case 'scss':
        case 'text/scss':
            return 'scss' as const;
        case 'less':
        case 'text/less':
            return 'less' as const;
        case 'css':
        case 'text/css':
        default:
            return 'css' as const;
    }
}

export function getLanguageService(kind?: string): LanguageService {
    const lang = getLanguage(kind);
    return langs[lang];
}
