import * as fs from 'fs';

function search(dir: string, depth: number): void {
  if (depth > 3) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const target = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      search(target, depth + 1);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      try {
        const content = fs.readFileSync(target, 'utf8');
        if (content.includes('pending-coordinator') && !content.includes('test')) {
          const lines = content.split('\n');
          for (let index = 0; index < lines.length; index += 1) {
            if (lines[index].includes('pending-coordinator')) {
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

search('dist', 0);
