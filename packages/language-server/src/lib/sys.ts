import fs from 'fs';

export interface System {
    useCaseSensitiveFileNames: boolean;
}

export const sys = initNodeSys();

function initNodeSys(): System {
    const platform = process.platform;

    return {
        useCaseSensitiveFileNames: isFileSystemCaseSensitive()
    };

    function isFileSystemCaseSensitive() {
        // windows are case insensitive platforms
        if (platform === 'win32') {
            return false;
        }
        return !fs.existsSync(swapCase(__filename));
    }
    function swapCase(s: string): string {
        return s.replace(/\w/g, (ch) => {
            const up = ch.toUpperCase();
            return ch === up ? ch.toLowerCase() : up;
        });
    }
}
