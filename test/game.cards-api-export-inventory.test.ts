import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const cardsFactoryPath = path.resolve(__dirname, '..', 'game', 'logic', 'cards-runtime-factory.ts');

function exportedCardApiKeys(source: string): string[] {
  const start = source.indexOf('const cardsApi: any = {');
  const end = source.indexOf('return cardsApi;');
  if (start < 0 || end < start) throw new Error('cardsApi export boundary was not found');

  return Array.from(
    source.slice(start, end).matchAll(/^\s{8}([A-Za-z_$][\w$]*),?\s*(?:\/\/.*)?$/gm),
    (match) => match[1]
  );
}

describe('cards API export inventory', () => {
  test('keeps the public facade key set stable while internals are extracted', () => {
    const keys = exportedCardApiKeys(fs.readFileSync(cardsFactoryPath, 'utf8'));
    const signature = crypto
      .createHash('sha256')
      .update(JSON.stringify([...keys].sort()))
      .digest('hex');

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(291);
    expect(signature).toBe('c481c9dea87aa285e4fca476f95bc98ee5f813b6b494bf022f315b786836cdf7');
  });
});
