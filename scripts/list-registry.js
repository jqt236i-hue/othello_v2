const fs = require('fs');
const c = fs.readFileSync('public/module-registry.js', 'utf8');
const matches = c.match(/_r\("[^"]+"\)/g);
if (matches) {
  matches.slice(0, 40).forEach(m => console.log(m));
  console.log('Total keys:', matches.length);
}
