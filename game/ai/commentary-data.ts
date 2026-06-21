import type { CardDef } from '../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

let Shared: any = null;
try { Shared = _require('../../shared-constants'); } catch (e) { Shared = null; }

const CPU_COMMENTARY_DEFAULT_LEVEL = 4;
const ADVANTAGES = Object.freeze(['ahead', 'even', 'behind']);
const CARD_DEFS: CardDef[] = Array.isArray(Shared && Shared.CARD_DEFS) ? Shared.CARD_DEFS : [];

function uniqueCardTypes(): Array<[string, any]> {
  const byType = new Map<string, any>();
  for (const card of CARD_DEFS as any[]) {
    const type = String(card && card.type || '').trim();
    if (!type || byType.has(type)) continue;
    byType.set(type, card || {});
  }
  return [...byType.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function compactText(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/[。.!！?？]+$/g, '')
    .trim();
}

function shortenPhrase(value: unknown, maxChars = 24): string {
  const chars = Array.from(compactText(value));
  if (chars.length <= maxChars) return chars.join('');
  return chars.slice(0, maxChars).join('');
}

const CARD_SUMMARY_OVERRIDES: Record<string, string> = Object.freeze({
  TREASURE_BOX: '布石を得る',
  FREE_PLACEMENT: '空きマスへ自由に置く',
  LAST_RESORT: '空きマスへ石を増やす',
  SNIPER_WILL: '狙撃石を配置する',
  PROTECTED_NEXT_STONE: '次の石を一時保護する',
  GHOST_WILL: '次の石を幽体化する',
  AFTERIMAGE_WILL: '次の石に復活回数を持たせる',
  SWAP_WITH_ENEMY: '相手の石を自分の石に交換する',
  POSITION_SWAP_WILL: '盤面の石の位置を入れ替える',
  PERMA_PROTECT_NEXT_STONE: '次の石を永続保護する',
  STRONG_WIND_WILL: '石を遠くへ吹き飛ばす',
  BUOYANCY_WILL: '石を上方向へ押し上げる',
  SUPER_BUOYANCY_WILL: '石を上方向へ押し上げる',
  GRAVITY_WILL: '石を下方向へ押し込む',
  SUPER_GRAVITY_WILL: '石を下方向へ押し込む',
  SUPER_ATTRACTION_WILL: '石を指定マスへ引き寄せる',
  TRAP_WILL: '自分の石に罠を仕込む',
  TEMPT_WILL: '相手の特殊石を奪う',
  CAPTURE_WILL: '敵の特殊石を手札に加える',
  DESTROY_ONE_STONE: '盤上の石を破壊する',
  TIME_BOMB: '時限爆弾を仕掛ける',
  ULTIMATE_REVERSE_DRAGON: '反転龍を配置する',
  BREEDING_WILL: '繁殖石を配置する',
  PROLIFERATION_WILL: '増殖石を配置する',
  CLONE_WILL: '自分の石を複製する',
  TELEPORT_WILL: '石を別の空きマスへ移す',
  CELL_TELEPORT_WILL: 'マスを移動させて穴を作る',
  CROSS_BOMB: '十字範囲を爆破する',
  X_BOMB: '斜め範囲を爆破する',
  HYPERACTIVE_WILL: '次の石を多動化する',
  ESCAPE_WILL: '逃亡石を配置する',
  ROBOT_VACUUM_WILL: '掃除機石で敵石を吸い込む',
  GLUTTONOUS_WILL: '悪食石で敵石を捕食する',
  WILL_HUNTER_KING: '敵の特殊石を狙う',
  INSTANT_HYPERACTIVE_WILL: '配置直後に石を動かす',
  REBUILD_WILL: '手札を再構築する',
  PLUNDER_WILL: '相手の布石を吸収する',
  WORK_WILL: '石から布石収入を得る',
  RIBO_WILL: '布石を先に得る',
  LOSS_WILL: '特殊石を通常石へ戻す',
  DOUBLE_PLACE: 'このターンに二回置く',
  TRIPLE_PLACE: 'このターンに三回置く',
  QUAD_PLACE: 'このターンに四回置く',
  INFINITE_PLACE: '置ける限り連続で置く',
  HEAVEN_BLESSING: '候補からカードを得る',
  REVEAL_HAND_WILL: '相手の手札を公開する',
  CONDEMN_WILL: '相手の手札を破壊する',
  EXECUTION_WILL: '相手手札をまとめて破壊する',
  GOLD_STONE: '次の布石獲得を増やす',
  RAINBOW_STONE: '次の布石獲得を大きく増やす',
  SILVER_STONE: '次の布石獲得を強める',
  CRYSTAL_STONE: '数字マスの布石を増やす',
  EXTEND_LIFE_WILL: '特殊石の持続を延ばす',
  EXTEND_LIFE_GOD: '特殊石の持続を大きく延ばす',
  CORROSION_WILL: '特殊石の持続を削る',
  GUARD_WILL: '自分の石を完全保護する',
  GUARDIAN_GOD: '長く完全保護する',
  STONE_SALVATION_GOD: '破壊された石を救済する',
  DESTROY_DRAGON_WILL: '破壊龍で周囲を壊す',
  LIGHTNING_WILL: '落雷で敵石を破壊する',
  ULTIMATE_DESTROY_GOD: '破壊神で周囲を壊す',
  ULTIMATE_HYPERACTIVE_GOD: '究極多動神を配置する',
  BOARD_EXPANSION_WILL: '盤面を外側へ広げる',
  BOARD_EXPANSION_GOD: '角から盤面を広げる',
  BLOCKADE_WILL: '空きマスを封鎖する',
  METEOR_WILL: 'マスごと破壊して穴にする',
  METEOR_GOD: '因果抹消神で敵石を穴にする',
  FREEZE_WILL: 'マスを凍結する',
  SALVATION_WILL: '破壊された石を救済する',
  REINFORCEMENT_WILL: '内側空きマスへ増援する',
  SUPPORT_TROOPS_WILL: '既存石の近くへ援軍を出す',
  EQUALITY_WILL: '相手の布石を奪う'
});

function summarizeCardEffect(type: string, card: any): string {
  const override = CARD_SUMMARY_OVERRIDES[type];
  if (override) return override;
  const desc = compactText(card && (card.desc || card.desc_ja));
  if (!desc) return 'カード効果を使う';
  const firstClause = desc
    .split(/[、，。.!！?？]/)
    .map((part) => part.trim())
    .filter(Boolean)[0] || desc;
  return shortenPhrase(
    firstClause
      .replace(/^使用時に/, '')
      .replace(/^次に置く石は/, '次の石を')
      .replace(/^次に置いた石は/, '次の石を')
      .replace(/できる$/, 'する'),
    24
  ) || 'カード効果を使う';
}

const CARD_TYPE_LABELS = Object.freeze(Object.fromEntries(uniqueCardTypes().map(([type, card]) => [type, String(card.name || type)])));
const CARD_EFFECT_SUMMARIES = Object.freeze(Object.fromEntries(uniqueCardTypes().map(([type, card]) => [type, summarizeCardEffect(type, card)])));

function resolveCpuCommentaryTier(level: unknown): string {
  const n = Number(level);
  if (Number.isFinite(n) && n >= 6) return 'finalBoss';
  if (Number.isFinite(n) && n >= 3) return 'boss';
  return 'goblin';
}

const CPU_TIER = Object.freeze({
  goblin: Object.freeze({ even: '盤面をじっと見る', ahead: 'この流れなら押し切れる', behind: 'まだ取り返す手はある', cornerGain: '角を取れたのは大きい', cornerLoss: '角を取られたが、まだ終わらない' }),
  boss: Object.freeze({ even: '盤面を静かに見渡す', ahead: '優位を崩さず広げる', behind: '不利でも勝ち筋は残っている', cornerGain: '角を押さえて主導権を握る', cornerLoss: '角を失っても受けは残す' }),
  finalBoss: Object.freeze({ even: '盤面の変化を読み直す', ahead: '優位を確定へ近づける', behind: '不利な局面を再計算する', cornerGain: '角の確保で勝率を上げる', cornerLoss: '角の損失を補正する' })
});

const CPU_SUBJECTS = Object.freeze(['次の一手', 'この局面', '盤の端', '中央の形', '相手の手', '残りの手', '角の周り', '返し筋', '安全な場所', '勝負どころ']);
const CPU_ACTIONS = Object.freeze(['を確認する', 'を丁寧に読む', 'を先に整える', 'を崩さず進める', 'を少しずつ詰める', 'を見落とさない']);
const CPU_OPENINGS = Object.freeze(['まずは', 'ここは', '今は', '次に備えて', '焦らず']);
const CPU_AHEAD_PLANS = Object.freeze(['差を広げる', '形を固める', '角を狙う', '安全に進める', '主導権を守る']);
const CPU_BEHIND_PLANS = Object.freeze(['返す手を探す', '角周りを受ける', '無理をせず立て直す', '相手の隙を待つ', '終盤に残す']);
const CPU_CORNER_PLANS = Object.freeze(['端を固める', '次の角も見る', '返されにくい形にする', '中央へつなげる', '終盤まで残す']);
const CPU_CORNER_RECOVERY_PLANS = Object.freeze(['辺を整える', '返し筋を作る', '中央で受ける', '次の角を狙う', '石差を詰める']);
const CPU_CARD_USE_LEAD_INS = Object.freeze(['ここで', 'このタイミングで', '手札から', '流れを変えるために', '盤面を見て']);
const CPU_CARD_HIT_LEAD_INS = Object.freeze(['それでも', '痛いが', '相手の一手を受けて', '崩されても', 'ここは耐えて']);
const CPU_USE_MARKER = Object.freeze({ ahead: '押し切る', even: '流れを動かす', behind: 'まだ返す' });
const CPU_HIT_MARKER = Object.freeze({ ahead: '主導権は渡さない', even: '受けて返す', behind: 'ここから立て直す' });

function makePool(size: number, makeLine: (index: number) => string): readonly string[] {
  return Object.freeze(Array.from({ length: size }, (_, index) => makeLine(index + 1)));
}

const CPU_POOLS = Object.freeze(Object.fromEntries(Object.keys(CPU_TIER).map((tierKey) => {
  const t = (CPU_TIER as any)[tierKey];
  return [tierKey, Object.freeze({
    chatter: makePool(300, (i) => {
      const index = i - 1;
      const opening = CPU_OPENINGS[index % CPU_OPENINGS.length];
      const subject = CPU_SUBJECTS[Math.floor(index / CPU_OPENINGS.length) % CPU_SUBJECTS.length];
      const action = CPU_ACTIONS[Math.floor(index / (CPU_OPENINGS.length * CPU_SUBJECTS.length)) % CPU_ACTIONS.length];
      return `${opening}、${subject}${action}。`;
    }),
    ahead: makePool(50, (i) => `${t.ahead}。${CPU_SUBJECTS[Math.floor((i - 1) / 5) % CPU_SUBJECTS.length]}で${CPU_AHEAD_PLANS[(i - 1) % CPU_AHEAD_PLANS.length]}。`),
    behind: makePool(50, (i) => `${t.behind}。${CPU_SUBJECTS[Math.floor((i - 1) / 5) % CPU_SUBJECTS.length]}から${CPU_BEHIND_PLANS[(i - 1) % CPU_BEHIND_PLANS.length]}。`),
    cornerGain: makePool(30, (i) => `${t.cornerGain}。${CPU_SUBJECTS[Math.floor((i - 1) / 5) % CPU_SUBJECTS.length]}から${CPU_CORNER_PLANS[(i - 1) % CPU_CORNER_PLANS.length]}。`),
    cornerLoss: makePool(30, (i) => `${t.cornerLoss}。${CPU_SUBJECTS[Math.floor((i - 1) / 5) % CPU_SUBJECTS.length]}で${CPU_CORNER_RECOVERY_PLANS[(i - 1) % CPU_CORNER_RECOVERY_PLANS.length]}。`)
  })];
})));

function normalizeAdvantage(value: unknown): string {
  const key = String(value || '').toLowerCase();
  return (ADVANTAGES as readonly string[]).includes(key) ? key : 'even';
}

function getCardLabel(cardType: unknown): string {
  const key = String(cardType || '').trim();
  return (CARD_TYPE_LABELS as any)[key] || key || 'カード';
}

function getCardSummary(cardType: unknown): string {
  const key = String(cardType || '').trim();
  return (CARD_EFFECT_SUMMARIES as any)[key] || 'カード効果を使う';
}

function getCpuChatterLines(level: unknown): readonly string[] { return (CPU_POOLS as any)[resolveCpuCommentaryTier(level)].chatter; }
function getCpuAheadLines(level: unknown): readonly string[] { return (CPU_POOLS as any)[resolveCpuCommentaryTier(level)].ahead; }
function getCpuBehindLines(level: unknown): readonly string[] { return (CPU_POOLS as any)[resolveCpuCommentaryTier(level)].behind; }
function getCpuCornerGainLines(level: unknown): readonly string[] { return (CPU_POOLS as any)[resolveCpuCommentaryTier(level)].cornerGain; }
function getCpuCornerLossLines(level: unknown): readonly string[] { return (CPU_POOLS as any)[resolveCpuCommentaryTier(level)].cornerLoss; }

function getCardUseLines(cardType: unknown, advantage: unknown): readonly string[] {
  const label = getCardLabel(cardType);
  const summary = getCardSummary(cardType);
  const marker = (CPU_USE_MARKER as any)[normalizeAdvantage(advantage)];
  return makePool(10, (i) => {
    const leadIn = CPU_CARD_USE_LEAD_INS[(i - 1) % CPU_CARD_USE_LEAD_INS.length];
    const subject = CPU_SUBJECTS[Math.floor((i - 1) / CPU_CARD_USE_LEAD_INS.length) % CPU_SUBJECTS.length];
    return `${leadIn}、${label}で${summary}。${subject}を見て${marker}。`;
  });
}

function getCardHitLines(cardType: unknown, advantage: unknown): readonly string[] {
  const label = getCardLabel(cardType);
  const summary = getCardSummary(cardType);
  const marker = (CPU_HIT_MARKER as any)[normalizeAdvantage(advantage)];
  return makePool(10, (i) => {
    const leadIn = CPU_CARD_HIT_LEAD_INS[(i - 1) % CPU_CARD_HIT_LEAD_INS.length];
    const subject = CPU_SUBJECTS[Math.floor((i - 1) / CPU_CARD_HIT_LEAD_INS.length) % CPU_SUBJECTS.length];
    return `${leadIn}、相手は${label}で${summary}。${subject}で${marker}。`;
  });
}

const cpuChatterLines = getCpuChatterLines(CPU_COMMENTARY_DEFAULT_LEVEL);
const cpuAheadLines = getCpuAheadLines(CPU_COMMENTARY_DEFAULT_LEVEL);
const cpuBehindLines = getCpuBehindLines(CPU_COMMENTARY_DEFAULT_LEVEL);
const cpuCornerGainLines = getCpuCornerGainLines(CPU_COMMENTARY_DEFAULT_LEVEL);
const cpuCornerLossLines = getCpuCornerLossLines(CPU_COMMENTARY_DEFAULT_LEVEL);

const api = {
  CPU_COMMENTARY_DEFAULT_LEVEL,
  CARD_TYPE_LABELS,
  CARD_EFFECT_SUMMARIES,
  resolveCpuCommentaryTier,
  getCpuChatterLines,
  getCpuAheadLines,
  getCpuBehindLines,
  getCpuCornerGainLines,
  getCpuCornerLossLines,
  cpuChatterLines,
  cpuAheadLines,
  cpuBehindLines,
  cpuCornerGainLines,
  cpuCornerLossLines,
  openingLines: cpuChatterLines,
  middleEvenLines: cpuChatterLines,
  endEvenLines: cpuChatterLines,
  chatterLines: cpuChatterLines,
  boardSwingLines: cpuChatterLines,
  passLines: cpuChatterLines,
  cardTargetLines: cpuChatterLines,
  middleAheadLines: cpuAheadLines,
  endAheadLines: cpuAheadLines,
  tauntLines: cpuAheadLines,
  middleBehindLines: cpuBehindLines,
  endBehindLines: cpuBehindLines,
  negativeLines: cpuBehindLines,
  bluffLines: cpuBehindLines,
  cornerFirstOwnedLines: cpuCornerGainLines,
  cornerStreakTwoOwnedLines: cpuCornerGainLines,
  cornerStreakThreeOwnedLines: cpuCornerGainLines,
  cornerAllOwnedLines: cpuCornerGainLines,
  cornerFirstLostLines: cpuCornerLossLines,
  cornerStreakTwoLostLines: cpuCornerLossLines,
  cornerStreakThreeLostLines: cpuCornerLossLines,
  cornerAllLostLines: cpuCornerLossLines,
  getCardUseLines,
  getCardHitLines
};

export = api;
