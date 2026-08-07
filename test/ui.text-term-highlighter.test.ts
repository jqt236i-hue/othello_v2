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
      '穴マス',
      '絶対執行',
      '特殊石',
      '通常石',
      '反転無効',
      '完全保護',
      '不可侵',
      '自由配置',
      '観測の代償'
    ]));
  });

  test('shares effect tag descriptions with highlighted game terms', () => {
    const holeCell = getGameTermGlossary().find((entry) => entry.label === '穴マス');
    expect(holeCell?.description).toBe('マスを永続の穴にする。穴マスには誰も置けず、反転経路も遮断する。\n顕現石があるマス以外には確定で穴マスにできる。');
    const erase = getGameTermGlossary().find((entry) => entry.label === '抹消');
    expect(erase?.description).toContain('完全保護や反転無効では防げません');
  });

  test('catalogs free placement as a placement action term', () => {
    const glossaryEntry = getGameTermGlossary().find((entry) => entry.label === '自由配置');
    expect(glossaryEntry).toMatchObject({
      id: 'free-placement',
      category: 'placement'
    });
    expect(glossaryEntry?.description).toContain('空きマス');

    const matches = findGameTermMatches('空きマスに自由配置できる。');
    expect(matches.map((match) => [match.text, match.category])).toEqual([
      ['自由配置', 'placement']
    ]);
  });

  test('catalogs observer repayment as a unique resource-toned term', () => {
    const glossaryEntry = getGameTermGlossary().find((entry) => entry.label === '観測の代償');
    expect(glossaryEntry).toMatchObject({
      id: 'observer-will-repayment',
      category: 'unique',
      tone: 'resource'
    });
    expect(glossaryEntry?.description).toContain('元コスト20%');

    const matches = findGameTermMatches('終了後観測の代償を支払う。');
    expect(matches.map((match) => [match.text, match.category, match.tone])).toEqual([
      ['観測の代償', 'unique', 'resource']
    ]);
  });

  test('uses longest-match terms before shorter terms', () => {
    const matches = findGameTermMatches('反転無効を持つ特殊石はマス破壊を受ける。');
    expect(matches.map((match) => match.text)).toEqual(['反転無効', '特殊石', 'マス破壊']);
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
    expect(matches[0].label).toBe('穴マス');
    expect(matches[0].category).toBe('cell');
  });

  test('safe DOM renderer escapes non-term markup and wraps only terms', () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="target"></div></body></html>');
    const target = dom.window.document.getElementById('target') as HTMLElement;

    renderTextWithGameTermHighlights(target, '破壊<script>alert(1)</script>と反転無効', {
      documentRef: dom.window.document,
      classPrefix: 'game-term'
    });

    expect(target.textContent).toBe('破壊<script>alert(1)</script>と反転無効');
    expect(target.querySelector('script')).toBeNull();
    const terms = Array.from(target.querySelectorAll('.game-term-highlight')) as HTMLElement[];
    expect(terms.map((term) => term.textContent)).toEqual(['破壊', '反転無効']);
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

  test('renders term highlights as accessible buttons when interactive', () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="target"></div></body></html>');
    const target = dom.window.document.getElementById('target') as HTMLElement;

    renderTextWithGameTermHighlights(target, '特殊石と不可侵', {
      documentRef: dom.window.document,
      interactive: true
    });

    const terms = Array.from(target.querySelectorAll('.game-term-highlight')) as HTMLElement[];
    expect(terms.map((term) => term.tagName)).toEqual(['BUTTON', 'BUTTON']);
    expect(terms.map((term) => term.textContent)).toEqual(['特殊石', '不可侵']);
    expect(terms[0].getAttribute('type')).toBe('button');
    expect(terms[0].classList.contains('game-term-highlight-button')).toBe(true);
    expect(terms[0].getAttribute('aria-label')).toBe('特殊石の意味を表示');
    expect(terms[0].dataset.termId).toBe('special-stone');
    expect(terms[1].dataset.termCategory).toBe('protection');
  });
});
