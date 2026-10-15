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
    expect(keys).toHaveLength(290);
    expect(signature).toBe('adaf18c7080a0cf1d51cd3443deadff9c15bfeeea9f79ebb6db9ebe81f8c71c4');
  });
});
