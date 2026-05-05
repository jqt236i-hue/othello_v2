const fs = require('fs');

// Function definition to add
const functionDef = `function isInheritedHyperactiveType(special) {
    return String(special || '').toUpperCase() === 'INHERITED_HYPERACTIVE';
}`;

// Files to update
const files = [
  'public/module-registry.js',
  'worker-public/public/module-registry.js'
];

files.forEach(file => {
  console.log(`Processing ${file}...`);
  let content = fs.readFileSync(file, 'utf8');
  
  // Find the pipeline_ui_adapter registration
  const pattern = /(_r\("game\/turn\/pipeline_ui_adapter", ".*?)(function resolveDisplayTimerValue)/s;
  
  if (content.match(pattern)) {
    // Add the function definition before resolveDisplayTimerValue
    content = content.replace(pattern, `$1${functionDef}\n$2`);
    fs.writeFileSync(file, content);
    console.log(`  ✓ Added isInheritedHyperactiveType to ${file}`);
  } else {
    console.log(`  ✗ Could not find insertion point in ${file}`);
  }
});

console.log('Done!');
