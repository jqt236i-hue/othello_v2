import { JSDOM } from 'jsdom';
import {
  findGameTermMatches,
  getGameTermGlossary,
  renderTextWithGameTermHighlights
} from '../ui/text-term-highlighter';

describe('text term highlighter', () => {
  test('exposes a single glossary with core game terms', () => {
    const labels = getGameTermGlossary().map((entry) => entry.label);
    expect(labels).toEqual(expect.arrayContaining([
      '反転',
      '破壊',
      '穴マス化',
      '特殊石',
      '通常石',
      '反転保護',
      '完全保護',
      '絶対保護'
    ]));
  });

  test('uses longest-match terms before shorter terms', () => {
    const matches = findGameTermMatches('反転保護を持つ特殊石はマス破壊を受ける。');
    expect(matches.map((match) => match.text)).toEqual(['反転保護', '特殊石', 'マス破壊']);
    expect(matches.map((match) => match.category)).toEqual(['protection', 'stone', 'destroy']);
  });

  test('prioritizes proper names and special stone names over generic terms', () => {
    const labels = getGameTermGlossary().map((entry) => entry.label);
    expect(labels).toEqual(expect.arrayContaining(['究極破壊神', '破壊龍', '狙撃石']));

    const matches = findGameTermMatches('次に置く石を究極破壊神化。周囲の敵石を破壊する。');
    expect(matches.map((match) => match.text)).toEqual(['究極破壊神', '破壊']);
    expect(matches.map((match) => match.category)).toEqual(['unique', 'destroy']);
    expect(matches.map((match) => match.tone || match.category)).toEqual(['destroy', 'destroy']);
  });

  test('assigns secondary effect tones to proper names', () => {
    const matches = findGameTermMatches('究極反転龍と究極破壊神と盤界の執行者を比較する。');
    expect(matches.map((match) => [match.text, match.category, match.tone])).toEqual([
      ['究極反転龍', 'unique', 'flip'],
      ['究極破壊神', 'unique', 'destroy'],
      ['盤界の執行者', 'unique', 'cell']
    ]);
  });

  test('recognizes aliases while preserving displayed text', () => {
    const matches = findGameTermMatches('穴化できない場合は不発となり、通常石に戻る。');
    expect(matches.map((match) => match.text)).toEqual(['穴化', '通常石']);
    expect(matches[0].label).toBe('穴マス化');
    expect(matches[0].category).toBe('cell');
  });

  test('safe DOM renderer escapes non-term markup and wraps only terms', () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="target"></div></body></html>');
    const target = dom.window.document.getElementById('target') as HTMLElement;

    renderTextWithGameTermHighlights(target, '破壊<script>alert(1)</script>と反転保護', {
      documentRef: dom.window.document,
      classPrefix: 'game-term'
    });

    expect(target.textContent).toBe('破壊<script>alert(1)</script>と反転保護');
    expect(target.querySelector('script')).toBeNull();
    const terms = Array.from(target.querySelectorAll('.game-term-highlight')) as HTMLElement[];
    expect(terms.map((term) => term.textContent)).toEqual(['破壊', '反転保護']);
    expect(terms.map((term) => term.dataset.termCategory)).toEqual(['destroy', 'protection']);
  });

  test('safe DOM renderer adds secondary tone data and class for proper names', () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="target"></div></body></html>');
    const target = dom.window.document.getElementById('target') as HTMLElement;

    renderTextWithGameTermHighlights(target, '究極破壊神化して破壊する', {
      documentRef: dom.window.document,
      classPrefix: 'game-term'
    });

    const terms = Array.from(target.querySelectorAll('.game-term-highlight')) as HTMLElement[];
    expect(terms.map((term) => term.textContent)).toEqual(['究極破壊神', '破壊']);
    expect(terms[0].classList.contains('game-term-highlight--unique')).toBe(true);
    expect(terms[0].classList.contains('game-term-highlight--tone-destroy')).toBe(true);
    expect(terms[0].dataset.termCategory).toBe('unique');
    expect(terms[0].dataset.termTone).toBe('destroy');
  });

  test('keeps line breaks when requested', () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="target"></div></body></html>');
    const target = dom.window.document.getElementById('target') as HTMLElement;

    renderTextWithGameTermHighlights(target, '破壊\n反転', {
      documentRef: dom.window.document,
      preserveLineBreaks: true
    });

    expect(target.innerHTML).toContain('<br>');
    expect(Array.from(target.querySelectorAll('.game-term-highlight')).map((el) => el.textContent)).toEqual(['破壊', '反転']);
  });
});
