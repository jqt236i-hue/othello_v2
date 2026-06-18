import CardCatalog = require('../cards/catalog');
import {
  BASE_GAME_TERM_GLOSSARY,
  type GameTermCategory,
  type GameTermGlossaryEntry,
  type GameTermTone
} from '../shared/game-term-glossary';

export type { GameTermCategory, GameTermGlossaryEntry, GameTermTone } from '../shared/game-term-glossary';

export type GameTermMatch = Readonly<{
  start: number;
  end: number;
  text: string;
  id: string;
  label: string;
  category: GameTermCategory;
  tone?: GameTermTone;
}>;

export type RenderGameTermOptions = Readonly<{
  documentRef?: Document | null;
  classPrefix?: string;
  preserveLineBreaks?: boolean;
  skipLabels?: readonly string[];
  interactive?: boolean;
}>;

type CatalogCardText = Readonly<{
  id?: unknown;
  type?: unknown;
  name_ja?: unknown;
  name?: unknown;
  desc_ja?: unknown;
  desc?: unknown;
  display_type_ja?: unknown;
}>;

function toNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readCatalogCards(): readonly CatalogCardText[] {
  const cards = (CardCatalog as { cards?: unknown }).cards;
  return Array.isArray(cards) ? cards as CatalogCardText[] : [];
}

function createStableTermId(prefix: string, raw: string, index: number): string {
  const normalized = raw.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized ? `${prefix}-${normalized}` : `${prefix}-${index + 1}`;
}

function collectSpecialStoneNameTerms(text: string): string[] {
  const terms: string[] = [];
  const source = String(text || '');
  const stoneNamePattern = /(?:次に置く石を|次に置く特殊石を)([^。、\s「」]+?)化/g;
  const manifestNamePattern = /([^。、\s「」]+?)を顕現/g;
  let match: RegExpExecArray | null;

  while ((match = stoneNamePattern.exec(source)) !== null) {
    const term = toNonEmptyString(match[1]);
    if (term) terms.push(term);
  }
  while ((match = manifestNamePattern.exec(source)) !== null) {
    const term = toNonEmptyString(match[1]);
    if (term) terms.push(term);
  }

  return terms;
}

function inferUniqueTermTone(label: string, description: string, displayType: string): GameTermTone {
  if (/(破壊|爆破|爆発|消滅|捕食|狙撃|因果抹消|断罪|処刑)/.test(label)) return 'destroy';
  if (/(反転|連鎖|禁忌反転|龍)/.test(label)) return 'flip';
  if (/(保護|守|回避|幽体|残像|復活|救済|罠|生きる)/.test(label)) return 'protection';
  if (/(穴|封鎖|凍結|盤界|盤面縮小|盤面拡張|マステレポート)/.test(label)) return 'cell';
  if (/(自由配置|通常配置|追加配置|配置|合法手)/.test(label)) return 'placement';
  if (/(布石|コスト|持続|ターン|時間|ドロー|手札|理論|観測|延命|腐食|採掘)/.test(label)) return 'resource';
  if (/(石|顕現|化身|執行者)/.test(label)) return 'stone';

  const source = `${label} ${description} ${displayType}`;
  if (/(破壊|爆破|爆発|消滅|捕食|狙撃|因果抹消|断罪|処刑)/.test(source)) return 'destroy';
  if (/(反転|連鎖|禁忌反転|龍)/.test(source)) return 'flip';
  if (/(保護|守|回避|幽体|残像|復活|救済|罠|生きる)/.test(source)) return 'protection';
  if (/(穴|封鎖|凍結|盤界|盤面縮小|盤面拡張|マステレポート)/.test(source)) return 'cell';
  if (/(自由配置|通常配置|追加配置|配置|合法手)/.test(source)) return 'placement';
  if (/(布石|コスト|持続|ターン|時間|ドロー|手札|理論|観測|延命|腐食|採掘)/.test(source)) return 'resource';
  if (/(石|顕現|化身|執行者)/.test(source)) return 'stone';
  if (/戦闘/.test(displayType)) return 'destroy';
  if (/守護/.test(displayType)) return 'protection';
  if (/繁栄|採掘/.test(displayType)) return 'resource';
  if (/執行/.test(displayType)) return 'cell';
  return 'stone';
}

function buildCatalogProperNameEntries(): readonly GameTermGlossaryEntry[] {
  const baseLabels = new Set(BASE_GAME_TERM_GLOSSARY.map((entry) => entry.label));
  const seen = new Set<string>();
  const entries: GameTermGlossaryEntry[] = [];
  const addEntry = (label: string, id: string, description: string, toneSource: string, displayType: string) => {
    const normalized = toNonEmptyString(label);
    if (!normalized || baseLabels.has(normalized) || seen.has(normalized)) return;
    seen.add(normalized);
    entries.push(Object.freeze({
      id,
      label: normalized,
      category: 'unique',
      tone: inferUniqueTermTone(normalized, toneSource, displayType),
      description
    }));
  };

  readCatalogCards().forEach((card, cardIndex) => {
    const cardId = toNonEmptyString(card.id) || toNonEmptyString(card.type) || String(cardIndex + 1);
    const cardName = toNonEmptyString(card.name_ja) || toNonEmptyString(card.name);
    const desc = toNonEmptyString(card.desc_ja) || toNonEmptyString(card.desc);
    const displayType = toNonEmptyString(card.display_type_ja);
    if (cardName) {
      addEntry(cardName, createStableTermId('card', cardId, cardIndex), 'カード名。', desc, displayType);
    }
    collectSpecialStoneNameTerms(desc).forEach((term, termIndex) => {
      addEntry(term, createStableTermId('special-stone-name', `${cardId}-${termIndex + 1}`, entries.length), '特殊石や顕現石の固有名。', `${term} ${desc}`, displayType);
    });
  });

  return Object.freeze(entries);
}

export const GAME_TERM_GLOSSARY: readonly GameTermGlossaryEntry[] = Object.freeze([
  ...BASE_GAME_TERM_GLOSSARY,
  ...buildCatalogProperNameEntries()
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
      category: matched.entry.category,
      tone: matched.entry.tone
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
  const interactive = !!(options && options.interactive);
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
    const termEl = documentRef.createElement(interactive ? 'button' : 'span');
    termEl.className = [
      `${classPrefix}-highlight`,
      `${classPrefix}-highlight--${match.category}`,
      match.tone ? `${classPrefix}-highlight--tone-${match.tone}` : '',
      interactive ? `${classPrefix}-highlight-button` : ''
    ].filter(Boolean).join(' ');
    if (interactive) {
      termEl.setAttribute('type', 'button');
      termEl.setAttribute('aria-label', `${match.text}の意味を表示`);
    }
    termEl.setAttribute('data-term-id', match.id);
    termEl.setAttribute('data-term-label', match.label);
    termEl.setAttribute('data-term-category', match.category);
    if (match.tone) termEl.setAttribute('data-term-tone', match.tone);
    termEl.textContent = match.text;
    fragment.appendChild(termEl);
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
