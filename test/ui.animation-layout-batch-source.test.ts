import fs from 'fs';
import path from 'path';

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function directRectReadLines(source: string): string[] {
  const lines = source.split(/\r?\n/);
  let readElementRectDepth = 0;
  const offenders: string[] = [];
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    const isReadElementRectStart = /^function readElementRect\(/.test(line);
    const insideReadElementRect = readElementRectDepth > 0 || isReadElementRectStart;
    if (/^function readElementRect\(/.test(line)) {
      readElementRectDepth = 0;
    }
    if (line.includes('.getBoundingClientRect(') && !insideReadElementRect) {
      offenders.push(`${index + 1}: ${line}`);
    }
    if (insideReadElementRect) {
      const opens = (line.match(/{/g) || []).length;
      const closes = (line.match(/}/g) || []).length;
      readElementRectDepth += opens - closes;
      if (readElementRectDepth < 0) readElementRectDepth = 0;
    }
  });
  return offenders;
}

describe('animation layout read batching source contract', () => {
  test('destroy source animations use readElementRect outside the helper fallback', () => {
    const source = readRepoFile('ui/animation-destroy-source-events.ts');
    expect(directRectReadLines(source)).toEqual([]);
  });

  test('move animations use readElementRect outside the helper fallback', () => {
    const source = readRepoFile('ui/animation-move-events.ts');
    expect(directRectReadLines(source)).toEqual([]);
  });
});
