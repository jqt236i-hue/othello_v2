const fs = require('fs');
const path = require('path');

// Search ALL dist files for references to bootstrap/init-dom
function searchDir(dir, depth) {
    if (depth > 4) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const p = dir + '/' + e.name;
        if (e.isDirectory() && !e.name.includes('node_modules') && !e.name.includes('.git')) {
            searchDir(p, depth + 1);
        } else if (e.isFile() && e.name.endsWith('.js')) {
            try {
                const c = fs.readFileSync(p, 'utf8');
                if (c.includes('init-dom') || c.includes('init_dom') || c.includes('initDom')) {
                    const lines = c.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes('init-dom') || lines[i].includes('init_dom') || lines[i].includes('initDom')) {
                            console.log(p + ':' + (i + 1) + ': ' + lines[i].trim());
                        }
                    }
                }
            } catch (ex) {}
        }
    }
}

console.log('=== Searching for init-dom references ===');
searchDir('dist', 0);
