const fs = require('fs');
const e = fs.readFileSync('entry-browser.js', 'utf8');
const re = /require\(['"]\.\/dist\/([^'"]+)['"]\)/g;
let m;
const reqs = [];
while ((m = re.exec(e)) !== null) {
    reqs.push(m[1]);
}
const r = fs.readFileSync('public/module-registry.js', 'utf8');
const missing = [];
for (const req of reqs) {
    const key = req.replace(/\.js$/, '');
    const searchKey = '_r("' + key + '"';
    if (!r.includes(searchKey)) {
        missing.push(key);
    }
}
console.log('Total requires in entry-browser:', reqs.length);
console.log('Missing from registry:', missing.length);
console.log('Missing modules:\n  ' + missing.join('\n  '));
