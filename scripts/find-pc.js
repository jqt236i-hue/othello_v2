const fs = require('fs');
// Search all dist files for 'pending-coordinator' or 'turn/'
const dir = 'dist';
function search(d, depth) {
    if (depth > 3) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
        const p = d + '/' + e.name;
        if (e.isDirectory()) search(p, depth + 1);
        else if (e.isFile() && e.name.endsWith('.js')) {
            try {
                const c = fs.readFileSync(p, 'utf8');
                if (c.includes('pending-coordinator') && !c.includes('test')) {
                    const lines = c.split('\n');
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes('pending-coordinator')) {
                            console.log(p + ':' + (i + 1) + ': ' + lines[i].trim());
                        }
                    }
                }
            } catch (ex) {}
        }
    }
}
search(dir, 0);
