import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const cardsPath = path.resolve(__dirname, '..', 'game', 'logic', 'cards.ts');

function exportedCardApiKeys(source: string): string[] {
  const start = source.indexOf('const cardsApi: any = {');
  const end = source.indexOf('export = cardsApi;');
  if (start < 0 || end < start) throw new Error('cardsApi export boundary was not found');

  return Array.from(
    source.slice(start, end).matchAll(/^\s{8}([A-Za-z_$][\w$]*),?\s*(?:\/\/.*)?$/gm),
    (match) => match[1]
  );
}

describe('cards API export inventory', () => {
  test('keeps the public facade key set stable while internals are extracted', () => {
    const keys = exportedCardApiKeys(fs.readFileSync(cardsPath, 'utf8'));
    const signature = crypto
      .createHash('sha256')
      .update(JSON.stringify([...keys].sort()))
      .digest('hex');

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(262);
    expect(signature).toBe('829025afa92462c85be19f479b86e1cb1d5ef441e9370fff105f8ef861ef5ad5');
  });
});
