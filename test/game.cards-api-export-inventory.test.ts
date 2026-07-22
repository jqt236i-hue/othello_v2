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
    expect(keys).toHaveLength(261);
    expect(signature).toBe('5af2d23f142bef57dc3241a34713376350212c8521bbaff92fc15b70884dca9c');
  });
});
