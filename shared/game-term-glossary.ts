export type GameTermCategory = 'flip' | 'destroy' | 'stone' | 'protection' | 'cell' | 'placement' | 'resource' | 'unique';
export type GameTermTone = Exclude<GameTermCategory, 'unique'>;

export type GameTermGlossaryEntry = Readonly<{
  id: string;
  label: string;
  category: GameTermCategory;
  description: string;
  tone?: GameTermTone;
  aliases?: readonly string[];
}>;

function normalizeLabel(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export const BASE_GAME_TERM_GLOSSARY: readonly GameTermGlossaryEntry[] = Object.freeze([
  Object.freeze({ id: 'flip', label: '反転', category: 'flip', description: '石の色が変わる処理。通常リバーシの挟み反転とカード効果による反転を含む。' }),
  Object.freeze({ id: 'normal-flip', label: '通常反転', category: 'flip', description: '通常リバーシの挟み条件で発生する反転。' }),
  Object.freeze({ id: 'chain-flip', label: '連鎖反転', category: 'flip', description: '通常反転の後さらに挟める列ができた場合追加で一方向だけ反転させる。' }),
  Object.freeze({ id: 'taboo-flip', label: '禁忌反転', category: 'flip', description: '挟めなくても反転可能。実際に反転する枚数が最大の列1方向のみ選ぶ。' }),
  Object.freeze({ id: 'flip-count', label: '反転枚数', category: 'flip', description: '反転で布石に加算される枚数。破壊は含まない。' }),
  Object.freeze({ id: 'destroy', label: '破壊', category: 'destroy', description: '石を破壊して盤面から消す効果。反転保護では防げないが、完全保護・不可侵には効かない。' }),
  Object.freeze({ id: 'erase', label: '抹消', category: 'destroy', description: 'そのマスの石を取り除きます。\n完全保護や反転保護では防げません。' }),
  Object.freeze({ id: 'blast', label: '破壊／爆発', category: 'destroy', description: '石を破壊して盤面から消す効果。反転保護では防げないが、完全保護・不可侵には効かない。', aliases: Object.freeze(['爆破', '爆発']) }),
  Object.freeze({ id: 'cell-destroy', label: 'マス破壊', category: 'destroy', description: 'マスごと穴にして永続封鎖。誰も置けず、反転経路も遮断する。' }),
  Object.freeze({ id: 'slash-destroy', label: '斬撃破壊', category: 'destroy', description: '意志狩りの王などの斬撃演出を伴う破壊。' }),
  Object.freeze({ id: 'normal-stone', label: '通常石', category: 'stone', description: '特殊効果を持たない通常の石。' }),
  Object.freeze({ id: 'special-stone', label: '特殊石', category: 'stone', description: '通常石ではなく、盤面に残って次ターン以降も能力主体として生きる石。罠石・時限爆弾は含み、顕現石・石状態・盤面マーカー・配置時効果は含まない。' }),
  Object.freeze({ id: 'manifest-stone', label: '顕現石', category: 'stone', description: '特殊カードから出現する専用石。通常カード効果の対象外になる場合がある。' }),
  Object.freeze({ id: 'ghost-stone', label: '幽体', category: 'stone', description: '反転・破壊の対象にはなるが、その石自身は受けない。反転列の成立は無効化せず、誘惑・捕獲・入替など対象条件を満たす反転・破壊以外の効果は通常どおり受ける。交換の意志は通常石のみ対象のため対象外。', aliases: Object.freeze(['幽体石']) }),
  Object.freeze({ id: 'afterimage-stone', label: '残像石', category: 'stone', description: '反転回避と破壊回避を持つ特殊石。' }),
  Object.freeze({ id: 'regen-stone', label: '復活石', category: 'stone', description: '反転または破壊されると復活回数を消費して戻る特殊石。' }),
  Object.freeze({ id: 'trap-stone', label: '罠石', category: 'stone', description: '相手の反転などに反応して発動する特殊石。' }),
  Object.freeze({ id: 'time-bomb', label: '時限爆弾', category: 'stone', description: '爆発予約を持つ特殊石分類の効果。' }),
  Object.freeze({ id: 'flip-protection', label: '反転保護', category: 'protection', description: '反転されない。挟める列ごと無効できる。' }),
  Object.freeze({ id: 'full-protection', label: '完全保護', category: 'protection', description: '石に対する敵対的・強制的な効果を無効化。自分への強化・維持効果は受けられ、マス破壊は貫通する。' }),
  Object.freeze({ id: 'flip-evasion', label: '反転回避', category: 'protection', description: '反転されるとき、元位置から最も近い空きマスに移動して避ける。隣接に空きがない場合、次に近い空きマスに移動し回避する。移動先で挟める列があれば、その石の色で反転する。' }),
  Object.freeze({ id: 'destroy-evasion', label: '破壊回避', category: 'protection', description: '破壊されるとき、元位置から最も近い空きマスに移動して避ける。隣接に空きがない場合、次に近い空きマスに移動し回避する。空きマスがなければ回避できない。移動先で挟める列があれば、その石の色で反転する。' }),
  Object.freeze({ id: 'inviolable', label: '不可侵', category: 'protection', description: '顕現石や特殊カードを、通常のカード効果や手札効果の対象から外す特殊カード固有の保護。' }),
  Object.freeze({ id: 'hole-cell', label: '穴マス', category: 'cell', description: 'マスを永続の穴にする。穴マスには誰も置けず、反転経路も遮断する。\n顕現石があるマス以外には確定で穴マスにできる。', aliases: Object.freeze(['穴マス化', '穴化']) }),
  Object.freeze({ id: 'absolute-execution', label: '絶対執行', category: 'destroy', description: '盤界の執行者専用の抹消。全ての保護を貫通して特殊石を穴マスにする。' }),
  Object.freeze({ id: 'blockade', label: '封鎖', category: 'cell', description: '一時的にそのマスを塞ぐ。両者とも置けず、移動でも入れない。' }),
  Object.freeze({ id: 'freeze', label: '凍結', category: 'cell', description: 'そのマスと上の石の反転・破壊・持続減少を止める。' }),
  Object.freeze({ id: 'free-placement', label: '自由配置', category: 'placement', description: '通常の挟み条件に関係なく、効果が許す空きマスへ石を置ける配置。穴マスや封鎖マスなど配置不可マスには置けない。' }),
  Object.freeze({ id: 'charge', label: '布石', category: 'resource', description: 'カード使用に使うリソース。' }),
  Object.freeze({ id: 'cost', label: 'コスト', category: 'resource', description: 'カード使用に必要な布石量。' }),
  Object.freeze({ id: 'duration-turn', label: '持続ターン', category: 'resource', description: 'このカードや石状態が盤面で効果を持ち続けるターン数。' }),
  Object.freeze({ id: 'observer-will-repayment', label: '観測の代償', category: 'unique', tone: 'resource', description: '盤理の観測者の顕現終了後に発生する返済。奪ったカードの元コスト20%分を自ターン開始時に最大9回支払い、布石不足時はその回、自石4個をランダム破壊する。' }),
  Object.freeze({ id: 'condition-number-cell-42', label: '数字マス42獲得で使用可能', category: 'resource', description: '対局中に数字マスから実際に得た布石合計が42以上になると使える。' }),
  Object.freeze({ id: 'condition-four-special-stones', label: '特殊石4個以上で使用可能', category: 'resource', description: '所有者を問わず、盤面に特殊石が4個以上ある時だけ使える。' }),
  Object.freeze({ id: 'condition-after-18-turns', label: '18手後使用可能', category: 'resource', description: '18手以上経過した後に使える。' }),
  Object.freeze({ id: 'turn-start', label: 'ターン開始', category: 'resource', description: '手番開始時に効果や持続管理を処理するタイミング。' }),
  Object.freeze({ id: 'time-stop', label: '時間停止', category: 'resource', description: '発動したプレイヤーが2ターン連続で行動する。' }),
  Object.freeze({ id: 'multi-move-state', label: '多動状態', category: 'stone', description: '両者ターン開始時マス移動する、基本ランダム移動。' })
]);

export function getBaseGameTermGlossary(): readonly GameTermGlossaryEntry[] {
  return BASE_GAME_TERM_GLOSSARY;
}

export function resolveGameTermGlossaryEntryByLabel(label: unknown): GameTermGlossaryEntry | null {
  const normalized = normalizeLabel(label);
  if (!normalized) return null;
  return BASE_GAME_TERM_GLOSSARY.find((entry) => entry.label === normalized || (entry.aliases || []).includes(normalized)) || null;
}

export function resolveGameTermDescriptionByLabel(label: unknown): string {
  const entry = resolveGameTermGlossaryEntryByLabel(label);
  return entry ? entry.description : '';
}

module.exports = {
  BASE_GAME_TERM_GLOSSARY,
  getBaseGameTermGlossary,
  resolveGameTermDescriptionByLabel,
  resolveGameTermGlossaryEntryByLabel
};
