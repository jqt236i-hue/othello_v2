import * as fs from 'fs';

type RegistryIssue = {
  line: number;
  key: string;
  issue: string;
};

const registry = fs.readFileSync('public/module-registry.js', 'utf8');
const lines = registry.split('\n');
const issues: RegistryIssue[] = [];

for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index];
  if (line.includes('_r(') && line.includes('new Function(')) {
    const keyMatch = line.match(/_r\("([^"]+)"/);
    if (!keyMatch) continue;
    const key = keyMatch[1];
    const bodyStart = line.indexOf('`');
    if (bodyStart < 0) continue;
    let body = line.substring(bodyStart + 1);
    for (let bodyIndex = index + 1; bodyIndex < lines.length && !lines[bodyIndex].includes('`));'); bodyIndex += 1) {
      body += `\n${lines[bodyIndex]}`;
    }
    if (body.includes('const exports =')) {
      issues.push({ line: index + 1, key, issue: 'const exports' });
    }
    if (body.includes('const _require =')) {
      issues.push({ line: index + 1, key, issue: 'const _require' });
    }
  }
}

console.log('Issues found:', issues.length);
for (const issue of issues.slice(0, 20)) {
  console.log(`L${issue.line}: ${issue.key} - ${issue.issue}`);
}
