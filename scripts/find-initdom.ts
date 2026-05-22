import * as fs from 'fs';

function searchDir(dir: string, depth: number): void {
  if (depth > 4) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const target = `${dir}/${entry.name}`;
    if (entry.isDirectory() && !entry.name.includes('node_modules') && !entry.name.includes('.git')) {
      searchDir(target, depth + 1);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      try {
        const content = fs.readFileSync(target, 'utf8');
        if (content.includes('init-dom') || content.includes('init_dom') || content.includes('initDom')) {
          const lines = content.split('\n');
          for (let index = 0; index < lines.length; index += 1) {
            if (lines[index].includes('init-dom') || lines[index].includes('init_dom') || lines[index].includes('initDom')) {
              console.log(`${target}:${index + 1}: ${lines[index].trim()}`);
            }
          }
        }
      } catch (error) {
        // Keep searching other files; this is a one-off inspection helper.
      }
    }
  }
}

console.log('=== Searching for init-dom references ===');
searchDir('dist', 0);
