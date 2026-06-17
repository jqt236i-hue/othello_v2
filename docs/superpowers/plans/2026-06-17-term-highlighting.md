# Term Highlighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add consistent, category-colored highlighting for game terminology across long player-facing explanatory text.

**Architecture:** Create one UI-owned terminology module that contains the glossary, longest-match tokenizer, and safe DOM renderer. Replace the existing rules-help-only highlighter and apply the same renderer to card detail summaries, expanded detail text, detail popovers, overlay descriptions, and stone info descriptions without changing game authority or card logic.

**Tech Stack:** TypeScript, classic browser/CommonJS interop, Jest + JSDOM, existing CSS files, existing `npm run build:ts` / focused Jest scripts.

---

## Scope And Constraints

- Do not edit `worker-public/` by hand. Run `npm run worker:prepare` after root source changes that mirror to worker public assets.
- Do not change gameplay behavior, card costs, rules text, catalog content, card target logic, CPU logic, or network authority.
- Keep the feature in `ui/` and card UI modules. Do not import DOM helpers into `game/`, `shared/`, or pure card logic.
- Initial text surfaces:
  - Card compact summary: `#card-detail-desc`
  - Card expanded inline text: `#card-detail-more`
  - Card detail tab body: `#card-detail-tab-body`
  - Rules help card descriptions: `#rules-help-card-desc`
  - Rules help effect descriptions and tag popovers
  - Card selection overlay detail description
  - Stone info panel description
- Initial non-target surfaces:
  - Buttons such as `使用`, `破壊`, `詳細`
  - Card names such as `究極反転龍`
  - Log/status messages during animation playback
  - Debug-only controls

## File Structure

- Create `ui/text-term-highlighter.ts`
  - Owns the term glossary, aliases, categories, longest-match tokenizer, HTML escaping, and DOM rendering helpers.
  - Has no dependency on game state, card logic, network, sound, timers, or globals except an optional injected `document`.
- Modify `ui/handlers/rules-help.ts`
  - Reuse the shared glossary and renderer.
  - Remove local-only duplicated term pattern logic.
- Modify `cards/card-interaction-detail-panel.ts`
  - Render summary/detail text with highlighted term spans instead of plain `textContent`.
  - Keep name, live state, and tag chips as plain text.
- Modify `cards/card-interaction-detail-tab.ts`
  - Render detail body with highlighted term spans.
- Modify `cards/card-interaction-overlay-view.ts`
  - Render selected offer description with highlighted term spans.
- Modify `ui/diff-renderer.ts` or `ui/stone-info-panel.ts`
  - Apply highlighting only to stone info description text, not stone names or marker badges.
- Modify `styles-layout-info.css`
  - Replace or extend `.rules-help-term-highlight` to shared `.game-term-highlight` classes for help surfaces.
- Modify `styles-cards.css`
  - Add card-detail-compatible term highlight styles.
- Modify `test/ui.rules-help-panel.test.ts`
  - Update tests to assert shared class/category output instead of rules-help-only class.
- Modify `test/ui.card-interaction-detail-panel-module.test.ts`
  - Add JSDOM assertions for card detail highlighting and HTML escaping.
- Create `test/ui.text-term-highlighter.test.ts`
  - Unit-test tokenizer, longest-match behavior, aliases, protected text, and DOM rendering.
- Modify focused stone info or overlay tests if existing coverage fails due to child spans replacing direct text nodes.

## Terminology Categories

Use a small set of categories to avoid a noisy rainbow effect:

- `flip`: `反転`, `通常反転`, `連鎖反転`, `禁忌反転`, `反転枚数`
- `destroy`: `破壊`, `爆破`, `爆発`, `マス破壊`, `斬撃破壊`
- `stone`: `通常石`, `特殊石`, `顕現石`, `幽体石`, `残像石`, `復活石`, `罠石`, `時限爆弾`
- `protection`: `反転保護`, `完全保護`, `絶対保護`, `反転回避`, `破壊回避`, `不可侵`
- `cell`: `穴マス化`, `穴化`, `穴マス`, `封鎖`, `凍結`
- `resource`: `布石`, `コスト`, `持続ターン`, `ターン開始`, `時間停止`

Longer terms must win over shorter terms. For example:

- `反転保護` is one `protection` match, not `反転` plus unmatched `保護`.
- `マス破壊` is one `destroy` match, not `破壊`.
- `穴マス化` is one `cell` match, not `穴マス`.

---

### Task 1: Add Shared Term Highlighter

**Files:**
- Create: `ui/text-term-highlighter.ts`
- Test: `test/ui.text-term-highlighter.test.ts`

- [ ] **Step 1: Write the failing tokenizer and DOM rendering tests**

Create `test/ui.text-term-highlighter.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the failing tests**

Run:

```powershell
npx jest test/ui.text-term-highlighter.test.ts --runInBand
```

Expected: FAIL because `../ui/text-term-highlighter` does not exist.

- [ ] **Step 3: Add the shared module**

Create `ui/text-term-highlighter.ts`:

```ts
export type GameTermCategory = 'flip' | 'destroy' | 'stone' | 'protection' | 'cell' | 'resource';

export type GameTermGlossaryEntry = Readonly<{
  id: string;
  label: string;
  category: GameTermCategory;
  description: string;
  aliases?: readonly string[];
}>;

export type GameTermMatch = Readonly<{
  start: number;
  end: number;
  text: string;
  id: string;
  label: string;
  category: GameTermCategory;
}>;

export type RenderGameTermOptions = Readonly<{
  documentRef?: Document | null;
  classPrefix?: string;
  preserveLineBreaks?: boolean;
  skipLabels?: readonly string[];
}>;

export const GAME_TERM_GLOSSARY: readonly GameTermGlossaryEntry[] = Object.freeze([
  Object.freeze({ id: 'flip', label: '反転', category: 'flip', description: '石の色が変わる処理。通常リバーシの挟み反転とカード効果による反転を含む。' }),
  Object.freeze({ id: 'normal-flip', label: '通常反転', category: 'flip', description: '通常リバーシの挟み条件で発生する反転。' }),
  Object.freeze({ id: 'chain-flip', label: '連鎖反転', category: 'flip', description: '通常反転の後、さらに挟める列ができた場合に追加で発生する反転。' }),
  Object.freeze({ id: 'taboo-flip', label: '禁忌反転', category: 'flip', description: '挟めなくても成立し得る特殊な反転。' }),
  Object.freeze({ id: 'flip-count', label: '反転枚数', category: 'flip', description: '反転で布石に加算される枚数。破壊は含まない。' }),
  Object.freeze({ id: 'destroy', label: '破壊', category: 'destroy', description: '石を消滅させる処理。反転とは別扱い。' }),
  Object.freeze({ id: 'blast', label: '爆破', category: 'destroy', description: '爆弾や範囲効果で石を破壊する処理。', aliases: Object.freeze(['爆発']) }),
  Object.freeze({ id: 'cell-destroy', label: 'マス破壊', category: 'destroy', description: 'マスごと穴にして永続封鎖する処理。' }),
  Object.freeze({ id: 'slash-destroy', label: '斬撃破壊', category: 'destroy', description: '意志狩りの王などの斬撃演出を伴う破壊。' }),
  Object.freeze({ id: 'normal-stone', label: '通常石', category: 'stone', description: '特殊効果を持たない通常の石。' }),
  Object.freeze({ id: 'special-stone', label: '特殊石', category: 'stone', description: '通常石ではなく、盤面に残って能力主体として生きる石。' }),
  Object.freeze({ id: 'manifest-stone', label: '顕現石', category: 'stone', description: '特殊カードから出現する専用石。通常カード効果の対象外になる場合がある。' }),
  Object.freeze({ id: 'ghost-stone', label: '幽体石', category: 'stone', description: '反転・破壊の対象にはなるが、その石自身は受けない特殊石。', aliases: Object.freeze(['幽体']) }),
  Object.freeze({ id: 'afterimage-stone', label: '残像石', category: 'stone', description: '反転回避と破壊回避を持つ特殊石。' }),
  Object.freeze({ id: 'regen-stone', label: '復活石', category: 'stone', description: '反転または破壊されると復活回数を消費して戻る特殊石。' }),
  Object.freeze({ id: 'trap-stone', label: '罠石', category: 'stone', description: '相手の反転などに反応して発動する特殊石。' }),
  Object.freeze({ id: 'time-bomb', label: '時限爆弾', category: 'stone', description: '爆発予約を持つ特殊石分類の効果。' }),
  Object.freeze({ id: 'flip-protection', label: '反転保護', category: 'protection', description: '反転されない状態。' }),
  Object.freeze({ id: 'full-protection', label: '完全保護', category: 'protection', description: '石に対する敵対的・強制的な効果を無効化する状態。' }),
  Object.freeze({ id: 'absolute-protection', label: '絶対保護', category: 'protection', description: '多くの直接効果を無効化し、解除されない最上位の保護状態。' }),
  Object.freeze({ id: 'flip-evasion', label: '反転回避', category: 'protection', description: '反転対象になった時に移動して回避する能力。' }),
  Object.freeze({ id: 'destroy-evasion', label: '破壊回避', category: 'protection', description: '破壊対象になった時に移動して回避する能力。' }),
  Object.freeze({ id: 'inviolable', label: '不可侵', category: 'protection', description: '通常のカード効果や手札効果の対象から外す特殊カード固有の保護。' }),
  Object.freeze({ id: 'hole-cell', label: '穴マス化', category: 'cell', description: 'マスを永続の穴にする処理。', aliases: Object.freeze(['穴化', '穴マス']) }),
  Object.freeze({ id: 'blockade', label: '封鎖', category: 'cell', description: '一時的にそのマスを塞ぐ状態。' }),
  Object.freeze({ id: 'freeze', label: '凍結', category: 'cell', description: 'そのマスと上の石の反転・破壊・持続減少を止める状態。' }),
  Object.freeze({ id: 'charge', label: '布石', category: 'resource', description: 'カード使用に使うリソース。' }),
  Object.freeze({ id: 'cost', label: 'コスト', category: 'resource', description: 'カード使用に必要な布石量。' }),
  Object.freeze({ id: 'duration-turn', label: '持続ターン', category: 'resource', description: 'カードや石状態が効果を持ち続けるターン数。' }),
  Object.freeze({ id: 'turn-start', label: 'ターン開始', category: 'resource', description: '手番開始時に効果や持続管理を処理するタイミング。' }),
  Object.freeze({ id: 'time-stop', label: '時間停止', category: 'resource', description: '発動したプレイヤーが2ターン連続で行動する効果。' })
]);

type TermCandidate = Readonly<{
  text: string;
  entry: GameTermGlossaryEntry;
}>;

let cachedCandidates: readonly TermCandidate[] | null = null;

function buildCandidates(): readonly TermCandidate[] {
  if (cachedCandidates) return cachedCandidates;
  const seen = new Set<string>();
  const candidates: TermCandidate[] = [];
  for (const entry of GAME_TERM_GLOSSARY) {
    const terms = [entry.label, ...(entry.aliases || [])];
    for (const term of terms) {
      if (!term || seen.has(term)) continue;
      seen.add(term);
      candidates.push(Object.freeze({ text: term, entry }));
    }
  }
  candidates.sort((a, b) => b.text.length - a.text.length || a.text.localeCompare(b.text, 'ja'));
  cachedCandidates = Object.freeze(candidates);
  return cachedCandidates;
}

export function getGameTermGlossary(): readonly GameTermGlossaryEntry[] {
  return GAME_TERM_GLOSSARY;
}

export function findGameTermMatches(text: string, options?: Pick<RenderGameTermOptions, 'skipLabels'>): GameTermMatch[] {
  const source = String(text || '');
  if (!source) return [];
  const skip = new Set((options && options.skipLabels) || []);
  const matches: GameTermMatch[] = [];
  let index = 0;
  const candidates = buildCandidates();

  while (index < source.length) {
    let matched: TermCandidate | null = null;
    for (const candidate of candidates) {
      if (skip.has(candidate.entry.label)) continue;
      if (source.startsWith(candidate.text, index)) {
        matched = candidate;
        break;
      }
    }
    if (!matched) {
      index += 1;
      continue;
    }
    const end = index + matched.text.length;
    matches.push(Object.freeze({
      start: index,
      end,
      text: source.slice(index, end),
      id: matched.entry.id,
      label: matched.entry.label,
      category: matched.entry.category
    }));
    index = end;
  }

  return matches;
}

function resolveDocument(target: Element, documentRef?: Document | null): Document {
  return documentRef || target.ownerDocument || document;
}

function appendTextWithLineBreaks(documentRef: Document, parent: Element | DocumentFragment, text: string) {
  const parts = String(text || '').split('\n');
  parts.forEach((part, index) => {
    if (index > 0) parent.appendChild(documentRef.createElement('br'));
    if (part) parent.appendChild(documentRef.createTextNode(part));
  });
}

function appendText(documentRef: Document, parent: Element | DocumentFragment, text: string, preserveLineBreaks: boolean) {
  if (preserveLineBreaks) {
    appendTextWithLineBreaks(documentRef, parent, text);
    return;
  }
  if (text) parent.appendChild(documentRef.createTextNode(text));
}

export function renderTextWithGameTermHighlights(target: Element | null | undefined, text: string, options?: RenderGameTermOptions): void {
  if (!target) return;
  const documentRef = resolveDocument(target, options && options.documentRef);
  const source = String(text || '');
  const preserveLineBreaks = !!(options && options.preserveLineBreaks);
  const classPrefix = String(options && options.classPrefix || 'game-term');
  const matches = findGameTermMatches(source, options);
  target.textContent = '';

  if (matches.length === 0) {
    appendText(documentRef, target, source, preserveLineBreaks);
    return;
  }

  let cursor = 0;
  const fragment = documentRef.createDocumentFragment();
  for (const match of matches) {
    appendText(documentRef, fragment, source.slice(cursor, match.start), preserveLineBreaks);
    const span = documentRef.createElement('span');
    span.className = `${classPrefix}-highlight ${classPrefix}-highlight--${match.category}`;
    span.setAttribute('data-term-id', match.id);
    span.setAttribute('data-term-label', match.label);
    span.setAttribute('data-term-category', match.category);
    span.textContent = match.text;
    fragment.appendChild(span);
    cursor = match.end;
  }
  appendText(documentRef, fragment, source.slice(cursor), preserveLineBreaks);
  target.appendChild(fragment);
}

module.exports = {
  GAME_TERM_GLOSSARY,
  findGameTermMatches,
  getGameTermGlossary,
  renderTextWithGameTermHighlights
};
```

- [ ] **Step 4: Run the term highlighter tests**

Run:

```powershell
npx jest test/ui.text-term-highlighter.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit the shared highlighter**

Run:

```powershell
git status --short
git add ui/text-term-highlighter.ts test/ui.text-term-highlighter.test.ts
git commit -m "Add shared terminology highlighter"
```

Expected: a commit containing only the new shared module and its unit test. If unrelated dirty files remain, leave them unstaged.

---

### Task 2: Reuse Shared Glossary In Rules Help

**Files:**
- Modify: `ui/handlers/rules-help.ts`
- Modify: `test/ui.rules-help-panel.test.ts`

- [ ] **Step 1: Write failing rules-help assertions for shared classes and longest match**

In `test/ui.rules-help-panel.test.ts`, update the existing card description highlight assertion near the catalog rendering test:

```ts
const highlightedTerms = Array.from(cardDescEl.querySelectorAll('.game-term-highlight')) as HTMLElement[];
expect(highlightedTerms.length).toBeGreaterThan(0);
expect(highlightedTerms.some((el) => el.dataset.termLabel === '反転保護')).toBe(true);
expect(highlightedTerms.every((el) => el.className.includes('game-term-highlight--'))).toBe(true);
```

Add this test near the existing glossary tests:

```ts
test('rules help card descriptions use shared longest-match term highlighting', () => {
  document.body.innerHTML = `
    <div id="rules-help-panel" aria-hidden="true">
      <button id="rules-help-close-btn" type="button"></button>
      <button data-help-tab="catalog" class="rules-help-tab is-active" type="button"></button>
      <button data-help-tab="effects" class="rules-help-tab" type="button"></button>
      <section data-help-page="catalog" id="rules-help-page-catalog" class="rules-help-page is-active">
        <div id="rules-help-card-list"></div>
        <div id="rules-help-card-name"></div>
        <div id="rules-help-card-desc"></div>
      </section>
      <section data-help-page="effects" id="rules-help-page-effects" class="rules-help-page"></section>
    </div>
  `;

  const mod = require('../ui/handlers/rules-help.js');
  mod.initRulesHelpPanel({
    catalogCards: [{
      id: 'sample',
      name: '説明確認',
      type: 'SAMPLE',
      cost: 1,
      display_type_ja: '守護',
      desc: '反転保護を持つ特殊石。マス破壊は受ける。'
    }]
  });
  (document.getElementById('rules-help-open-btn') || document.body).dispatchEvent(new Event('click'));

  const cardDescEl = document.getElementById('rules-help-card-desc') as HTMLElement;
  const terms = Array.from(cardDescEl.querySelectorAll('.game-term-highlight')) as HTMLElement[];
  expect(terms.map((el) => el.textContent)).toEqual(['反転保護', '特殊石', 'マス破壊']);
  expect(terms.map((el) => el.dataset.termCategory)).toEqual(['protection', 'stone', 'destroy']);
  expect(cardDescEl.querySelectorAll('[data-term-label="反転"]')).toHaveLength(0);
});
```

- [ ] **Step 2: Run the focused rules-help test and confirm failure**

Run:

```powershell
npx jest test/ui.rules-help-panel.test.ts --runInBand
```

Expected: FAIL because rules help still emits `.rules-help-term-highlight`.

- [ ] **Step 3: Replace local highlighter in `ui/handlers/rules-help.ts`**

At the top-level helper area of `ui/handlers/rules-help.ts`, require the shared module:

```ts
const _textTermHighlighterModule = _requireFirstRulesHelpModuleOrNull([
  '../text-term-highlighter',
  '../../ui/text-term-highlighter'
]);
const GAME_TERM_GLOSSARY = _textTermHighlighterModule && typeof _textTermHighlighterModule.getGameTermGlossary === 'function'
  ? _textTermHighlighterModule.getGameTermGlossary()
  : RULES_HELP_EFFECT_GLOSSARY;
```

Replace `_highlightEffectTerms()` and `_formatHelpText()` usage with a DOM renderer helper:

```ts
function _renderHelpText(targetEl: any, text: string): void {
  if (!targetEl) return;
  if (_textTermHighlighterModule && typeof _textTermHighlighterModule.renderTextWithGameTermHighlights === 'function') {
    _textTermHighlighterModule.renderTextWithGameTermHighlights(targetEl, String(text || ''), {
      documentRef: targetEl.ownerDocument || (typeof document !== 'undefined' ? document : null),
      preserveLineBreaks: true
    });
    return;
  }
  targetEl.textContent = String(text || '');
}
```

Use `_renderHelpText(bodyEl, bodyText)` anywhere `_formatHelpText()` was assigned to `innerHTML`. Keep title/card name rendering as plain text.

For effect list population, use `GAME_TERM_GLOSSARY` as the source instead of `RULES_HELP_EFFECT_GLOSSARY`, while keeping the same button/popover behavior.

- [ ] **Step 4: Run the focused rules-help tests**

Run:

```powershell
npx jest test/ui.rules-help-panel.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit rules-help integration**

Run:

```powershell
git status --short
git add ui/handlers/rules-help.ts test/ui.rules-help-panel.test.ts
git commit -m "Use shared term highlights in rules help"
```

Expected: a commit containing only rules-help integration and tests.

---

### Task 3: Apply Highlighting To Card Detail Text

**Files:**
- Modify: `cards/card-interaction-detail-panel.ts`
- Modify: `cards/card-interaction-detail-tab.ts`
- Modify: `test/ui.card-interaction-detail-panel-module.test.ts`

- [ ] **Step 1: Add failing card detail tests**

Append this test to `test/ui.card-interaction-detail-panel-module.test.ts`:

```ts
test('applies shared term highlighting to summary and expanded detail text', () => {
  const ctx = createController();
  const cardDef = {
    id: 'sample_01',
    name: '確認カード',
    type: 'SAMPLE',
    quickText: '反転保護を持つ特殊石を置く',
    detailText: '破壊<script>alert(1)</script>とマス破壊を受ける。',
    distinctDetailText: '破壊<script>alert(1)</script>とマス破壊を受ける。',
    effectTags: []
  };
  const model = ctx.controller.buildCardDetailDisplayModel(cardDef, 'black');
  const doc = ctx.dom.window.document;
  const nameEl = doc.getElementById('card-detail-name');
  const descEl = doc.getElementById('card-detail-desc') as HTMLElement;
  const detailMoreEl = doc.getElementById('card-detail-more') as HTMLElement;
  const liveStateEl = ctx.controller.ensureCardDetailLiveStateElement();
  const tagsEl = ctx.controller.ensureCardDetailEffectTagsElement();

  ctx.controller.applyCardDetailDisplayModel(nameEl, descEl, liveStateEl, detailMoreEl, tagsEl, model);

  expect(descEl.textContent).toBe('反転保護を持つ特殊石を置く。');
  expect(Array.from(descEl.querySelectorAll('.game-term-highlight')).map((el) => el.textContent)).toEqual(['反転保護', '特殊石']);
  expect(detailMoreEl.querySelector('script')).toBeNull();
  expect(detailMoreEl.textContent).toBe('破壊<script>alert(1)</script>とマス破壊を受ける。');
  expect(Array.from(detailMoreEl.querySelectorAll('.game-term-highlight')).map((el) => el.textContent)).toEqual(['破壊', 'マス破壊']);
});
```

If the stripped summary still includes punctuation after implementation, adjust only the expected text around non-highlight text, not the `.game-term-highlight` expectations.

- [ ] **Step 2: Run the focused card detail module test and confirm failure**

Run:

```powershell
npx jest test/ui.card-interaction-detail-panel-module.test.ts --runInBand
```

Expected: FAIL because `descEl` and `detailMoreEl` are still plain `textContent`.

- [ ] **Step 3: Add renderer dependency to card detail panel**

In `cards/card-interaction-detail-panel.ts`, add an optional dependency:

```ts
type CardInteractionDetailPanelDeps = {
    effectsModule?: any;
    textTermHighlighterModule?: any;
    getQuickCardEffect: (cardDef: any) => any;
    getDetailCardEffect: (cardDef: any) => any;
    resolveChargeMaxText: () => any;
    isHiddenHandToken: (cardId: any) => boolean;
    getDocumentRef: () => any;
    getCardStateValue: () => any;
    getGameStateValue: () => any;
    getCardLogic: () => any;
    getRiboWillUnlockTurnIndex: () => number;
};
```

Inside `createCardInteractionDetailPanel`, add:

```ts
    function renderGameTermText(el: any, text: any, options?: { preserveLineBreaks?: boolean }) {
        if (!el) return;
        const highlighter = cfg.textTermHighlighterModule;
        if (highlighter && typeof highlighter.renderTextWithGameTermHighlights === 'function') {
            highlighter.renderTextWithGameTermHighlights(el, String(text || ''), {
                documentRef: cfg.getDocumentRef(),
                preserveLineBreaks: !!(options && options.preserveLineBreaks)
            });
            return;
        }
        el.textContent = String(text || '');
    }
```

Change `applyCardDetailDisplayModel()`:

```ts
        nameEl.textContent = model.cardName;
        renderGameTermText(descEl, model.summaryText);
        renderCardDetailLiveState(detailStateEl, model.liveStateText);
        if (detailMoreEl) renderGameTermText(detailMoreEl, model.detailPanelText, { preserveLineBreaks: true });
        renderCardDetailEffectTags(detailTagsEl, model.tags);
```

- [ ] **Step 4: Wire the dependency from `cards/card-interaction.ts`**

In `cards/card-interaction.ts`, require the shared module near other optional modules:

```ts
const _textTermHighlighterModule = _requireFirstAvailableCardInteractionModule([
    './ui/text-term-highlighter',
    '../ui/text-term-highlighter',
    './text-term-highlighter'
]);
```

Pass it into `createCardInteractionDetailPanel`:

```ts
        textTermHighlighterModule: _textTermHighlighterModule,
```

- [ ] **Step 5: Update the detail tab renderer**

In `cards/card-interaction-detail-tab.ts`, add optional dependency support or a local optional require matching the existing module style. Replace body plain text rendering:

```ts
        refs.title.textContent = title;
        if (textTermHighlighterModule && typeof textTermHighlighterModule.renderTextWithGameTermHighlights === 'function') {
            textTermHighlighterModule.renderTextWithGameTermHighlights(refs.body, body, {
                documentRef: refs.body.ownerDocument,
                preserveLineBreaks: true
            });
        } else {
            refs.body.textContent = body;
        }
```

Keep `refs.title.textContent = title`.

- [ ] **Step 6: Run focused card detail tests**

Run:

```powershell
npx jest test/ui.card-interaction-detail-panel-module.test.ts test/ui.card-detail-effect-tags.test.ts --runInBand
```

Expected: PASS. Existing tests that read `textContent` should keep passing because spans preserve text content.

- [ ] **Step 7: Commit card detail integration**

Run:

```powershell
git status --short
git add cards/card-interaction-detail-panel.ts cards/card-interaction-detail-tab.ts cards/card-interaction.ts test/ui.card-interaction-detail-panel-module.test.ts
git commit -m "Highlight terminology in card details"
```

Expected: a commit containing only card detail integration and tests.

---

### Task 4: Apply Highlighting To Overlay And Stone Info Descriptions

**Files:**
- Modify: `cards/card-interaction-overlay-view.ts`
- Modify: `ui/diff-renderer.ts` or `ui/stone-info-panel.ts`
- Test: existing overlay/stone info tests, adjusted only where they inspect markup

- [ ] **Step 1: Locate the stone info render owner**

Run:

```powershell
rg -n "STONE_INFO_IDLE_STATE|stone info|refs\\.desc|stone-info" ui test -g "*.ts"
```

Expected: identify the current owner of `refs.desc.textContent = info.desc`, currently visible in `ui/diff-renderer.ts`.

- [ ] **Step 2: Write or update focused assertions**

If an existing stone info test renders the panel, add:

```ts
const desc = document.querySelector('.stone-info-desc') as HTMLElement;
expect(desc.textContent).toContain('特殊石');
expect(Array.from(desc.querySelectorAll('.game-term-highlight')).some((el) => el.textContent === '特殊石')).toBe(true);
```

If no direct test exists, add a focused JSDOM test around the exported renderer function that owns the stone info update. Use an input description like:

```ts
const info = { name: '特殊石', desc: '特殊石は反転保護や破壊回避を持つことがある。' };
```

- [ ] **Step 3: Inject or require the shared renderer in overlay view**

In `cards/card-interaction-overlay-view.ts`, add a small helper near render helpers:

```ts
function renderOverlayTermText(targetEl: any, text: any, deps: any) {
    const highlighter = deps && deps.textTermHighlighterModule;
    if (targetEl && highlighter && typeof highlighter.renderTextWithGameTermHighlights === 'function') {
        highlighter.renderTextWithGameTermHighlights(targetEl, String(text || ''), {
            documentRef: targetEl.ownerDocument,
            preserveLineBreaks: true
        });
        return;
    }
    if (targetEl) targetEl.textContent = String(text || '');
}
```

Replace:

```ts
refs.detailDesc.textContent = deps.getOverlayCardDescriptionText(selectedDef, selectedCardId);
```

with:

```ts
renderOverlayTermText(refs.detailDesc, deps.getOverlayCardDescriptionText(selectedDef, selectedCardId), deps);
```

Wire `textTermHighlighterModule` through the existing overlay creation dependency object in `cards/card-interaction.ts`.

- [ ] **Step 4: Apply renderer to stone info descriptions only**

In the stone info render owner, replace only the description assignment:

```ts
refs.name.textContent = info.name;
renderTextWithGameTermHighlights(refs.desc, info.desc, {
  documentRef: refs.desc.ownerDocument,
  preserveLineBreaks: true
});
```

Keep stone names, badges, timers, and board labels plain text.

- [ ] **Step 5: Run focused tests**

Run the narrow tests that cover modified surfaces:

```powershell
npx jest test/ui.heaven-blessing-overlay.test.ts test/ui.card-interaction-detail-panel-module.test.ts --runInBand
```

If stone info has a dedicated test, include it in the command.

Expected: PASS.

- [ ] **Step 6: Commit overlay and stone info integration**

Run:

```powershell
git status --short
git add cards/card-interaction-overlay-view.ts cards/card-interaction.ts ui/diff-renderer.ts test
git commit -m "Highlight terminology in overlay descriptions"
```

Before staging `test`, inspect `git diff --name-only -- test` and stage only tests intentionally changed for this task.

---

### Task 5: Add Shared Visual Styling

**Files:**
- Modify: `styles-layout-info.css`
- Modify: `styles-cards.css`
- Test: `test/ui.card-surface-layout-contract.test.ts`, `test/ui.rules-help-panel.test.ts`

- [ ] **Step 1: Add CSS contract assertions**

In `test/ui.card-surface-layout-contract.test.ts`, add:

```ts
test('shared game term highlight styles exist for card and help text', () => {
  const cardsCss = fs.readFileSync(path.resolve(__dirname, '../styles-cards.css'), 'utf8');
  const infoCss = fs.readFileSync(path.resolve(__dirname, '../styles-layout-info.css'), 'utf8');

  expect(`${cardsCss}\n${infoCss}`).toMatch(/\.game-term-highlight\s*\{/);
  expect(`${cardsCss}\n${infoCss}`).toMatch(/\.game-term-highlight--flip\s*\{/);
  expect(`${cardsCss}\n${infoCss}`).toMatch(/\.game-term-highlight--destroy\s*\{/);
  expect(`${cardsCss}\n${infoCss}`).toMatch(/\.game-term-highlight--stone\s*\{/);
  expect(`${cardsCss}\n${infoCss}`).toMatch(/\.game-term-highlight--protection\s*\{/);
  expect(`${cardsCss}\n${infoCss}`).toMatch(/\.game-term-highlight--cell\s*\{/);
  expect(`${cardsCss}\n${infoCss}`).toMatch(/\.game-term-highlight--resource\s*\{/);
});
```

- [ ] **Step 2: Run the CSS contract test and confirm failure**

Run:

```powershell
npx jest test/ui.card-surface-layout-contract.test.ts --runInBand
```

Expected: FAIL until the shared classes are added.

- [ ] **Step 3: Add restrained shared styles**

In `styles-layout-info.css`, replace `.rules-help-term-highlight` or add below it:

```css
.game-term-highlight {
  font-weight: 800;
  border-radius: 4px;
  padding: 0 0.12em;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.game-term-highlight--flip {
  color: #88d8ff;
  background: rgba(72, 166, 255, 0.16);
}

.game-term-highlight--destroy {
  color: #ff9a8d;
  background: rgba(255, 76, 76, 0.17);
}

.game-term-highlight--stone {
  color: #82e6b1;
  background: rgba(46, 204, 113, 0.16);
}

.game-term-highlight--protection {
  color: #f3d36b;
  background: rgba(231, 184, 58, 0.18);
}

.game-term-highlight--cell {
  color: #c6a6ff;
  background: rgba(151, 108, 255, 0.18);
}

.game-term-highlight--resource {
  color: #f4c7ff;
  background: rgba(220, 111, 255, 0.15);
}
```

In `styles-cards.css`, add a card-detail-specific compact adjustment if the text feels too heavy:

```css
#card-detail-desc .game-term-highlight,
#card-detail-more .game-term-highlight,
#card-detail-tab-body .game-term-highlight {
  font-weight: 800;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
}
```

- [ ] **Step 4: Run CSS and focused UI tests**

Run:

```powershell
npx jest test/ui.card-surface-layout-contract.test.ts test/ui.rules-help-panel.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit styles**

Run:

```powershell
git status --short
git add styles-layout-info.css styles-cards.css test/ui.card-surface-layout-contract.test.ts
git commit -m "Style shared terminology highlights"
```

Expected: a commit containing only CSS and the CSS contract test.

---

### Task 6: Build, Mirror, And Verify Integration

**Files:**
- Generated after build/mirror: inspect before staging
- Potential generated/mirror files: `worker-public/*`, `public/module-registry.js`

- [ ] **Step 1: Run type/build checks**

Run:

```powershell
npm run typecheck
npm run build:ts
```

Expected: both commands exit 0.

- [ ] **Step 2: Run focused Jest suite**

Run:

```powershell
npx jest test/ui.text-term-highlighter.test.ts test/ui.rules-help-panel.test.ts test/ui.card-interaction-detail-panel-module.test.ts test/ui.card-detail-effect-tags.test.ts test/ui.card-surface-layout-contract.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 3: Prepare worker mirror**

Run:

```powershell
npm run worker:prepare
```

Expected: exits 0 and updates only expected mirror/generated files for root source changes.

- [ ] **Step 4: Inspect generated changes**

Run:

```powershell
git status --short
git diff -- ui/text-term-highlighter.ts ui/handlers/rules-help.ts cards/card-interaction-detail-panel.ts cards/card-interaction-detail-tab.ts cards/card-interaction-overlay-view.ts ui/diff-renderer.ts styles-layout-info.css styles-cards.css test/ui.text-term-highlighter.test.ts test/ui.rules-help-panel.test.ts test/ui.card-interaction-detail-panel-module.test.ts test/ui.card-surface-layout-contract.test.ts
git diff -- worker-public public/module-registry.js
```

Expected:

- Source diffs contain only terminology highlighting code, styles, and tests.
- Generated/mirror diffs are produced by `npm run worker:prepare`, not manual edits.
- Pre-existing unrelated dirty files remain unstaged.

- [ ] **Step 5: Commit mirror/build outputs if needed**

If `npm run worker:prepare` generated required mirror files for this feature, stage only those files:

```powershell
git add worker-public/index.html worker-public/styles-layout-info.css worker-public/styles-cards.css worker-public/public/module-registry.js public/module-registry.js
git commit -m "Sync terminology highlight worker assets"
```

If no mirror files changed for this feature, skip this commit.

- [ ] **Step 6: Optional browser smoke check**

Start a local server only if no suitable dev server is running:

```powershell
npm run serve
```

Open the local URL, select a card with long text such as `救済神` or `因果抹消神`, and verify:

- Long card text contains colored terms.
- `反転保護` appears as one highlighted phrase.
- Card names and action buttons are not split into highlighted fragments.
- Help `効果一覧` uses the same categories.
- Text remains readable on the screenshot sizes supplied by the user.

Do not leave the server running if the task ends and it was started only for this check.

---

## Final Verification Command Set

Run these before marking implementation complete:

```powershell
npm run typecheck
npm run build:ts
npx jest test/ui.text-term-highlighter.test.ts test/ui.rules-help-panel.test.ts test/ui.card-interaction-detail-panel-module.test.ts test/ui.card-detail-effect-tags.test.ts test/ui.card-surface-layout-contract.test.ts --runInBand
npm run worker:prepare
git status --short
```

Expected final state:

- All verification commands exit 0.
- The implemented feature is committed in small coherent commits.
- Any unrelated dirty files that existed before this work remain unstaged and are reported separately.
- No source edits are made directly under `worker-public/`.

## Self-Review

- Spec coverage: The plan covers one shared glossary, longest-match matching, category colors, safe DOM rendering, and staged application to help/card/overlay/stone-description text.
- Placeholder scan: No implementation step relies on unspecified behavior; code snippets define exact functions, names, tests, and commands.
- Type consistency: Public names are consistent across tasks: `GAME_TERM_GLOSSARY`, `getGameTermGlossary`, `findGameTermMatches`, and `renderTextWithGameTermHighlights`.
