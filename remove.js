const fs = require('fs');
const path = require('path');

const directory = 'test';

function remove(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const basename = path.basename(file);
        if (basename.includes('node_modules')) continue;
        if (fs.statSync(path.join(dir, file)).isDirectory()) {
            remove(path.join(dir, file));
        } else {
            if (
                basename === 'expected.jsx' ||
                basename === 'expected.tsx' ||
                basename === 'expected.json'
            ) {
                if (
                    fs.existsSync(
                        path.join(
                            dir,
                            file
                                .replace('expected', 'expectedv2')
                                .replace('.jsx', '.js')
                                .replace('.tsx', '.ts')
                        )
                    )
                ) {
                    fs.unlinkSync(path.join(dir, file));
                }
            }
        }
    }
}

remove('packages');
