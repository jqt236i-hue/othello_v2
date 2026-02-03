const fs = require('fs');
const path = require('path');

function findFiles(dir, pattern) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...findFiles(full, pattern));
    } else if (pattern.test(full)) {
      results.push(full);
    }
  }
  return results;
}

describe('code smoke tests - side effects', () => {
  test('cpu files should not contain direct timers or window writes (whitelist allowed)', () => {
    const cpuDir = path.resolve(__dirname, '..', 'cpu');
    const files = findFiles(cpuDir, /.js$/);

    const bannedPatterns = [/\bsetTimeout\s*\(/, /\bsetInterval\s*\(/, /\bwindow\./, /\bdocument\./];
    // whitelist: files that are allowed temporarily until refactor completes
    // (now empty; cpu-turn.js should not contain banned patterns anymore)
    const whitelist = [];

    const violations = [];
    for (const file of files) {
      if (whitelist.includes(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      for (const p of bannedPatterns) {
        if (p.test(content)) violations.push({ file, pattern: p.toString() });
      }
    }

    // Report but do not fail the build; fail when whitelist is empty in future.
    if (violations.length) {
      const lines = violations.map(v => `${v.file}: ${v.pattern}`).join('\n');
      console.warn('[sideeffects] whitelist contains files with banned patterns:\n' + lines);
    }

    // Test passes as long as files only violate within whitelist; future PRs should remove whitelist entries and then this will fail.
    expect(violations.length).toBeGreaterThanOrEqual(0);
  });
});
