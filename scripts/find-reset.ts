import * as fs from 'fs';

function printResetGameMatches(filePath: string): void {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('resetGame') && !content.includes('resetGame=')) return;
    const lines = content.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].includes('resetGame')) {
        console.log(`${filePath}:${index + 1}: ${lines[index].trim()}`);
      }
    }
  } catch (error) {
    // Keep searching other files; this is a one-off inspection helper.
  }
}

function search(dir: string, depth: number): void {
  if (depth > 4) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const target = `${dir}/${entry.name}`;
    if (entry.isDirectory() && !entry.name.includes('node_modules') && !entry.name.includes('.git')) {
      search(target, depth + 1);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      printResetGameMatches(target);
    }
  }
}

search('dist', 0);
console.log('---');

const rootFiles = fs.readdirSync('.').filter((file) => file.endsWith('.js'));
for (const file of rootFiles) {
  if (!file.includes('node_modules')) printResetGameMatches(file);
}
