const fs = require('fs');
// Search for resetGame definition in dist/
function search(dir, depth) {
    if (depth > 4) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const p = dir + '/' + e.name;
        if (e.isDirectory() && !e.name.includes('node_modules') && !e.name.includes('.git')) search(p, depth + 1);
        else if (e.isFile() && e.name.endsWith('.js')) {
            try {
                const c = fs.readFileSync(p, 'utf8');
                if (c.includes('resetGame') || c.includes('resetGame=')) {
                    const lines = c.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes('resetGame')) {
                            console.log(p + ':' + (i + 1) + ': ' + lines[i].trim());
                        }
                    }
                }
            } catch (ex) {}
        }
    }
}
search('dist', 0);
console.log('---');
// Also check root js files
const rootFiles = fs.readdirSync('.').filter(f => f.endsWith('.js'));
for (const f of rootFiles) {
    try {
        const c = fs.readFileSync(f, 'utf8');
        if (c.includes('resetGame') && !f.includes('node_modules')) {
            const lines = c.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('resetGame')) {
                    console.log(f + ':' + (i + 1) + ': ' + lines[i].trim());
                }
            }
        }
    } catch (ex) {}
}
