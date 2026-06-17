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
  Object.freeze({ id: 'special-stone', label: '特殊石', category: 'stone', description: '通常石ではなく、盤面に残って次ターン以降も能力主体として生きる石。罠石・時限爆弾は含み、顕現石・石状態・盤面マーカー・配置時効果は含まない。' }),
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
