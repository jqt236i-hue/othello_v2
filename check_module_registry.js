const fs = require('fs');
const content = fs.readFileSync('public/module-registry.js', 'utf8');
const match = content.match(/_r\("game\/turn\/pipeline_ui_adapter", "(.*?)"\);/s);
if (match) {
  const code = match[1].replace(/\\n/g, '\n');
  const hasDef = code.includes('function isInheritedHyperactiveType');
  console.log('Function definition found:', hasDef);
  if (hasDef) {
    const idx = code.indexOf('function isInheritedHyperactiveType');
    console.log('Context:', code.substring(idx - 50, idx + 100));
  } else {
    console.log('NOT defined in module-registry.js');
    const hasCall = code.includes('isInheritedHyperactiveType');
    console.log('Function is called:', hasCall);
  }
} else {
  console.log('Could not find pipeline_ui_adapter');
}
