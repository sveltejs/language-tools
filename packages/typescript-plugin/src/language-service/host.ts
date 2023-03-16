import type ts from 'typescript/lib/tsserverlibrary';

export function decorateLanguageServiceHost(host: ts.LanguageServiceHost) {
    const originalReadDirectory = host.readDirectory?.bind(host);
    host.readDirectory = originalReadDirectory
        ? (path, extensions, exclude, include, depth) => {
              const extensionsWithSvelte = extensions ? [...extensions, '.svelte'] : undefined;

              return originalReadDirectory(path, extensionsWithSvelte, exclude, include, depth);
          }
        : undefined;
}
