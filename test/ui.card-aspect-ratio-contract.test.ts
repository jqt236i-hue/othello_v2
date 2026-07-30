import {
  escapeCssSelectorForRegExp,
  readCssBlock,
  readRepoTextFile,
} from './helpers/css-test-helpers';

const variablesCss = readRepoTextFile('styles-variables.css');
const responsiveCss = readRepoTextFile('styles-responsive.css');
const deckBuilderCss = readRepoTextFile('styles-feature-deck-builder.css');

function readVariablePixels(css: string, variableName: string): number[] {
  return Array.from(css.matchAll(new RegExp(
    `${escapeCssSelectorForRegExp(variableName)}:\\s*calc\\((\\d+)px\\s*\\*\\s*var\\(--layout-stage-scale\\)\\)`,
    'g',
  ))).map((match) => Number(match[1]));
}

function readNumericDimensions(css: string, selector: string): Array<{ width: number; height: number }> {
  const escapedSelector = escapeCssSelectorForRegExp(selector);
  return Array.from(css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'g')))
    .map((match) => match[1])
    .map((declarations) => {
      const width = declarations.match(/width:\s*calc\((\d+)px\s*\*\s*var\(--layout-stage-scale\)\)/);
      const height = declarations.match(/height:\s*calc\((\d+)px\s*\*\s*var\(--layout-stage-scale\)\)/);
      return width && height
        ? { width: Number(width[1]), height: Number(height[1]) }
        : null;
    })
    .filter((value): value is { width: number; height: number } => value !== null);
}

function expectFourByFiveCard({ width, height }: { width: number; height: number }): void {
  expect(height / width).toBeGreaterThanOrEqual(1.24);
  expect(height / width).toBeLessThanOrEqual(1.26);
}

describe('global card aspect-ratio contract', () => {
  test('keeps the canonical standard and large widths while shortening their heights', () => {
    expect(readVariablePixels(variablesCss, '--layout-size-card-width')).toEqual([91]);
    expect(readVariablePixels(variablesCss, '--layout-size-card-height')).toEqual([114]);
    expect(readVariablePixels(variablesCss, '--layout-size-card-large-width')).toEqual([114, 112, 112]);
    expect(readVariablePixels(variablesCss, '--layout-size-card-large-height')).toEqual([143, 140, 140]);

    expectFourByFiveCard({ width: 91, height: 114 });
    expectFourByFiveCard({ width: 114, height: 143 });
    expectFourByFiveCard({ width: 112, height: 140 });
  });

  test('uses the same compact portrait ratio for both smartphone hands', () => {
    const opponentCards = readNumericDimensions(
      responsiveCss,
      'html.layout-profile-phone-portrait #hand-white .card-item',
    );
    const playerCards = readNumericDimensions(
      responsiveCss,
      'html.layout-profile-phone-portrait #hand-black .card-item',
    );

    expect(opponentCards).toContainEqual({ width: 61, height: 76 });
    expect(playerCards).toContainEqual({ width: 92, height: 115 });
    expectFourByFiveCard(opponentCards[0]);
    expectFourByFiveCard(playerCards[0]);
  });

  test('normalizes the iPad portrait and compact landscape rescue sizes', () => {
    const playerCardOverrides = readNumericDimensions(responsiveCss, '#hand-black .card-item');

    expect(playerCardOverrides).toContainEqual({ width: 88, height: 110 });
    expect(playerCardOverrides).toContainEqual({ width: 96, height: 120 });
    expectFourByFiveCard({ width: 88, height: 110 });
    expectFourByFiveCard({ width: 96, height: 120 });
  });

  test('derives the deck-builder control reserve from the canonical card height', () => {
    expect(readCssBlock(deckBuilderCss, '.deck-builder-card')).toEqual(expect.stringMatching(
      /min-height:\s*calc\(var\(--layout-size-card-height\)\s*\+\s*\(20px\s*\*\s*var\(--layout-stage-scale\)\)\)/,
    ));
  });
});
