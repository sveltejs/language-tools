// @ts-check
import fs from 'fs';

const tsImportRegex = /import\s+.*\s+from\s+['"]typescript['"]/;
const typeOnlyTsImportRegex = /import\s+type\s+.*\s+from\s+['"]typescript['"]/;
const tsServerImportRegex = /import\s+.*\s+from\s+['"]typescript\/lib\/tsserverlibrary['"]/;
const typeOnlyTsServerImportRegex =
    /import\s+type\s+.*\s+from\s+['"]typescript\/lib\/tsserverlibrary['"]/;

checkDirectory('./packages/language-server/src');
checkDirectory('./packages/typescript-plugin/src');

/**
 *
 * @param {string} dir
 */
function checkDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
            checkDirectory(fullPath);
        } else if (entry.isFile() && fullPath.endsWith('.ts')) {
            checkFile(fullPath);
        }
    }
}

/**
 *
 * @param {string} file
 */
function checkFile(file) {
    const content = fs.readFileSync(file, 'utf-8');

    if (tsImportRegex.test(content) && !typeOnlyTsImportRegex.test(content)) {
        console.error(`Error: Found top-level import of 'typescript' in ${file}`);
        process.exit(1);
    }
    if (tsServerImportRegex.test(content) && !typeOnlyTsServerImportRegex.test(content)) {
        console.error(
            `Error: Found top-level import of 'typescript/lib/tsserverlibrary' in ${file}`
        );
        process.exit(1);
    }
}
