/**
 * @file card-interaction-effects.ts
 * @description Card detail/quick description dictionaries and resolvers
 * Restored from worker-public mirror.
 */

// Optional dependency with graceful degradation
declare const __non_webpack_require__: NodeRequire | undefined;

const SpecialStoneRegistry = (function() {
  try {
    const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
      ? __non_webpack_require__
      : require;
    return _require('../shared/special-stone-registry');
  } catch (e) { return null; }
})();

function getSpecialStoneDisplayName(rawType: string, fallback?: string) {
  if (SpecialStoneRegistry && typeof SpecialStoneRegistry.getSpecialStoneDisplayName === 'function') {
    return SpecialStoneRegistry.getSpecialStoneDisplayName(rawType, fallback);
  }
  return fallback !== undefined ? fallback : (rawType ? String(rawType) : '');
}

const timeStopStoneName = getSpecialStoneDisplayName('TIME_STOP', '時間停石');

const CARD_EFFECT_TAG_KIND = Object.freeze({
  SPECIAL_STONE: 'special-stone',
  HOLE_CELL: 'hole-cell',
  ERASURE: 'erasure',
  ABSOLUTE_EXECUTION: 'absolute-execution',
  FLIP_PROTECTION: 'flip-protection',
  FULL_PROTECTION: 'full-protection',
  ABSOLUTE_PROTECTION: 'absolute-protection',
  INVIOLABLE: 'inviolable',
  FLIP_EVASION: 'flip-evasion',
  DESTROY_EVASION: 'destroy-evasion',
  DURATION_TURNS: 'duration-turns',
  DELAYED_ACTIVATION_TURNS: 'delayed-activation-turns',
  USAGE_CONDITION: 'usage-condition'
});

const CARD_NUMERIC_TAG_KIND = Object.freeze({
  FLIP_EVASION: CARD_EFFECT_TAG_KIND.FLIP_EVASION,
  DESTROY_EVASION: CARD_EFFECT_TAG_KIND.DESTROY_EVASION,
  DURATION_TURNS: CARD_EFFECT_TAG_KIND.DURATION_TURNS,
  DELAYED_ACTIVATION_TURNS: CARD_EFFECT_TAG_KIND.DELAYED_ACTIVATION_TURNS
});

const CARD_NUMERIC_TAG_KIND_SET = new Set<string>(Object.values(CARD_NUMERIC_TAG_KIND));

function isCardNumericTagKind(kind: string) {
  return CARD_NUMERIC_TAG_KIND_SET.has(String(kind || '').trim());
}

function buildCardEffectTag(kind: string, value?: number) {
  const normalizedKind = String(kind || '').trim();

  if (normalizedKind === CARD_EFFECT_TAG_KIND.FLIP_PROTECTION) {
    return Object.freeze({ kind: normalizedKind, label: '反転保護' });
  }
  if (normalizedKind === CARD_EFFECT_TAG_KIND.SPECIAL_STONE) {
    return Object.freeze({ kind: normalizedKind, label: '特殊石' });
  }
  if (normalizedKind === CARD_EFFECT_TAG_KIND.HOLE_CELL) {
    return Object.freeze({ kind: normalizedKind, label: '穴マス' });
  }
  if (normalizedKind === CARD_EFFECT_TAG_KIND.ERASURE) {
    return Object.freeze({ kind: normalizedKind, label: '抹消' });
  }
  if (normalizedKind === CARD_EFFECT_TAG_KIND.ABSOLUTE_EXECUTION) {
    return Object.freeze({ kind: normalizedKind, label: '絶対執行' });
  }
  if (normalizedKind === CARD_EFFECT_TAG_KIND.FULL_PROTECTION) {
    return Object.freeze({ kind: normalizedKind, label: '完全保護' });
  }
  if (normalizedKind === CARD_EFFECT_TAG_KIND.ABSOLUTE_PROTECTION) {
    return Object.freeze({ kind: normalizedKind, label: '絶対保護' });
  }
  if (normalizedKind === CARD_EFFECT_TAG_KIND.INVIOLABLE) {
    return Object.freeze({ kind: normalizedKind, label: '不可侵' });
  }

  const normalizedValue = Math.floor(Number(value));
  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) return null;

  let label = '';
  if (normalizedKind === CARD_EFFECT_TAG_KIND.FLIP_EVASION) {
    label = '反転回避';
  } else if (normalizedKind === CARD_EFFECT_TAG_KIND.DESTROY_EVASION) {
    label = '破壊回避';
  } else if (normalizedKind === CARD_EFFECT_TAG_KIND.DURATION_TURNS) {
    label = `${normalizedValue}ターン持続`;
  } else if (normalizedKind === CARD_EFFECT_TAG_KIND.DELAYED_ACTIVATION_TURNS) {
    label = `${normalizedValue}ターン後に発動`;
  } else {
    return null;
  }

  return Object.freeze({
    kind: normalizedKind,
    value: normalizedValue,
    label
  });
}

function buildCardNumericTag(kind: string, value?: number) {
  if (!isCardNumericTagKind(kind)) return null;
  return buildCardEffectTag(kind, value);
}

const flipProtectionTag = () => buildCardEffectTag(CARD_EFFECT_TAG_KIND.FLIP_PROTECTION);
const specialStoneTag = () => buildCardEffectTag(CARD_EFFECT_TAG_KIND.SPECIAL_STONE);
const holeCellTag = () => buildCardEffectTag(CARD_EFFECT_TAG_KIND.HOLE_CELL);
const erasureTag = () => buildCardEffectTag(CARD_EFFECT_TAG_KIND.ERASURE);
const absoluteExecutionTag = () => buildCardEffectTag(CARD_EFFECT_TAG_KIND.ABSOLUTE_EXECUTION);
const fullProtectionTag = () => buildCardEffectTag(CARD_EFFECT_TAG_KIND.FULL_PROTECTION);
const absoluteProtectionTag = () => buildCardEffectTag(CARD_EFFECT_TAG_KIND.ABSOLUTE_PROTECTION);
const inviolableTag = () => buildCardEffectTag(CARD_EFFECT_TAG_KIND.INVIOLABLE);
const flipEvasionTag = (value?: number) => buildCardEffectTag(CARD_EFFECT_TAG_KIND.FLIP_EVASION, value);
const destroyEvasionTag = (value?: number) => buildCardEffectTag(CARD_EFFECT_TAG_KIND.DESTROY_EVASION, value);
const durationTurnsTag = (value?: number) => buildCardEffectTag(CARD_EFFECT_TAG_KIND.DURATION_TURNS, value);
const delayedActivationTurnsTag = (value?: number) => buildCardEffectTag(CARD_EFFECT_TAG_KIND.DELAYED_ACTIVATION_TURNS, value);
const usageConditionTag = (label: string) => Object.freeze({
  kind: CARD_EFFECT_TAG_KIND.USAGE_CONDITION,
  label
});

function freezeCardEffectTags(tags: any[]) {
  return Object.freeze((Array.isArray(tags) ? tags : []).filter(Boolean));
}

const quickCardEffectByType: Record<string, string> = Object.freeze({
  TREASURE_BOX: '布石を1〜6獲得',
  PLACE_ON_EMPTY: '反転0でも空きマスに置ける',
  FREE_PLACEMENT: '次の1手だけ、反転0でも空きマスに置ける。',
  LAST_RESORT: '石数負けかつ合法手0の時に使用可能、空きマスに石を3個配置できる。',
  SNIPER_WILL: '次に置く石を狙撃石化。空きマスに自由配置でき、最も近い敵石を破壊する',
  SHIELD_WILL: '次に置く石を1ターン保護',
  PROTECTED_NEXT_STONE: '次に置く石を弱い石化。次の相手ターン中だけ反転されず、特殊石として扱う',
  GHOST_WILL: '次に置く石を幽体石化。反転・破壊だけを受け流す',
  SACRIFICE_WILL: '次に置く石を犠牲石にする。盤面にいる間、相手がカードを使用すると自らを犠牲にしてそのカードを無効化する。',
  AFTERIMAGE_WILL: '次に置く石を残像石化。反転回避3回と破壊回避3回を持つ特殊石。',
  SWAP_WITH_ENEMY: '相手通常石1つを自分の通常石に交換する。(反転可能)。使用後、手番終了。',
  POSITION_SWAP_WILL: '盤面の石2つを入れ替える',
  ANCHOR_WILL: '次に置く石を完全固定',
  PERMA_PROTECT_NEXT_STONE: '次に置く石を強い石化。ずっと反転されず、特殊石として扱う。20ターン経過で絶対保護石へ進化。',
  STRONG_WIND_WILL: '選択した石を左右どちらかランダム方向へ端まで移動させる。',
  BUOYANCY_WILL: '石1つ選び上方向の端まで移動させる',
  SUPER_BUOYANCY_WILL: '石1つを上端まで押し上げ、進路上の石を破壊',
  GRAVITY_WILL: '石1つ選び下方向の端まで移動させる。',
  SUPER_GRAVITY_WILL: '石1つを下端まで落下させ、進路上の石を破壊',
  SUPER_ATTRACTION_WILL: '石1つを任意マスまで引き寄せ、経路上の石を破壊',
  TELEPORT_WILL: '石1つをランダムな空きマスへ移動',
  CELL_TELEPORT_WILL: 'マスを1つ選び、盤面外側へランダムテレポートさせ、元マスを穴マスにする。',
  TRAP_WILL: '自分石1つを罠化してターン終了。次の相手ターンに反転されると相手の布石を最大10奪う+手札全破壊。',
  TEMPT_WILL: '相手の誘惑可能な石効果を1つ選んで自分の色に変える。特殊石・罠石・時限爆弾・生きる意志が対象。',
  CAPTURE_WILL: '相手の特殊石1つを捕獲して手札にする。弱い石・強い石・幽体石も対象。',
  DOUBLE_CHAIN_WILL: '反転後新たに挟める列ができた場合、1列追加反転する。使用後、三連鎖の意志が手札に加わる。',
  TRIPLE_CHAIN_WILL: '反転後新たに挟める列ができた場合、2列追加反転する。使用後、四連鎖の意志が手札に加わる。',
  QUAD_CHAIN_WILL: '反転後新たに挟める列ができた場合、3列追加反転する。使用後、無限連鎖の意志が手札に加わる。',
  INFINITE_CHAIN_WILL: '反転後新たに挟める列ができた場合、可能な限り追加反転する。',
  TABOO_REVERSE_WILL: '次に置く石は挟めなくても反転可能。最も反転枚数が多い列1方向のみ。',
  REVERSE_WILL: '盤面上の石1つを選び、その石の色で通常の挟み反転をもう一度行う。',
  REGEN_WILL: '次に置く石を復活石化。反転でも破壊でも最大3回復活し、挟める列があれば反転させる。',
  DESTROY_ONE_STONE: '盤面の石1つを破壊',
  TIME_BOMB: '自分石1つを時限爆弾化。3ターン後にそのマス+周囲1マスを爆破',
  TIME_STOP_GOD: '手札に残り、使用時に自分石3つを破壊して次石を時間停石化。5ターン後に2連続行動。',
  ULTIMATE_REVERSE_DRAGON: '空きマス自由配置可。置いた石が龍化し、配置時に周囲1マスを反転。自ターン開始時はランダムな空きマスへ移動してから周囲1マスを反転（8ターン）。',
  BREEDING_WILL: '次に置く石を繁殖化。周囲優先で1個生成し、詰まり時は最寄り空きへ生成。各生成後に通常反転判定。',
  PROLIFERATION_WILL: '次に置く石を増殖石化。破壊時に最も近い空きへ1個増殖して破壊を防ぎ、増殖先で通常反転',
  CLONE_WILL: '自分石1つを選び、周囲優先・詰まり時は最寄り空きへ1個複製。生成石で通常反転',
  SEED_WILL: '空きマス1つに種をまき、5回目の自ターン開始で通常石が芽生える。芽生え石で通常反転',
  CROSS_BOMB: '次に置く石へ十字爆弾の配置時効果を付け、縦横2マスを爆破（通常反転後）',
  X_BOMB: '次に置く石へクロス爆弾の配置時効果を付け、斜め2マスを爆破（通常反転後）',
  HYPERACTIVE_WILL: '次に置く石を多動化。両者ターン開始時に1マス移動、反転回避を1回持つ。',
  EXTREME_HYPERACTIVE_WILL: '次に置く石を極悪多動魔化。毎ターン移動し、近くの石を押しのける',
  ESCAPE_WILL: '次に置く石を逃亡石化。毎ターン1マス逃げるように移動し、移動できるマスがなくなると爆発。反転回避を1回持つ。',
  ROBOT_VACUUM_WILL: '次に置く石は毎ターン1マス移動し、周囲の敵石を1個吸い込む。吸い込むと持続ターンが1増える。',
  GLUTTONOUS_WILL: '使用後に特殊カード以外の手札を破壊し、次石を悪食石化。敵を食べながら進み、2連続で食べられないと消滅。反転保護を持つ特殊石。',
  WILL_HUNTER_KING: '次に置く石を意志狩り化。自ターン開始時、敵石を1つ破壊してそのマスへ移動する。敵の特殊石を優先して狙う。',
  INSTANT_HYPERACTIVE_WILL: '次に置く石へ瞬間多動の配置時効果を付け、3マス分移動して通常石に戻す。',
  BLOCKADE_WILL: '空きマス1つを封鎖（配置・移動不可）',
  METEOR_WILL: 'マスを1つ選んで石ごと抹消し、穴マスにする。',
  BOARD_SHRINK_WILL: '外周から連続する3マスを選んで石ごと抹消し、穴マスにして盤面を縮小する。',
  BOARD_SHRINK_GOD: '角を含む外周1列を選んで石ごと抹消し、穴マスにして盤面を縮小する。',
  FREEZE_WILL: 'マス1つを凍結し、反転・破壊と持続減少を止める',
  REBUILD_WILL: '特殊カード以外の手札を破壊し、新たに3枚ドローする',
  WORK_WILL: '次石をアンカー化し毎ターン布石を獲得',
  LOSS_WILL: '盤面上の特殊石を全て通常石に戻す。自分の手札を全て破壊して使用。',
  DOUBLE_PLACE: '使用ターンだけ石を2連続で置ける。使用後、三連投石が手札に加わる。',
  TRIPLE_PLACE: '使用ターンだけ石を3連続で置ける。使用後、四連投石が手札に加わる。',
  QUAD_PLACE: '使用ターンだけ石を4連続で置ける。使用後、無限投石が手札に加わる。',
  INFINITE_PLACE: '使用ターンだけ合法手がなくなるまで石を連続で置ける。置けなくなった時点で終了する。',
  HEAVEN_BLESSING: '候補5枚から1枚を選んで獲得',
  REVEAL_HAND_WILL: '現在の相手手札をすべて表にする',
  THEORY_INCARNATION: '空きマスを理論数字マス化し、理論の化身を顕現。顕現中は石配置後に理論数字マスから特殊石が現れる。',
  BOARD_EXECUTOR: '盤面上のすべての特殊石を絶対執行し、全ての保護を貫通して穴マスにする。盤界の執行者を顕現。顕現中は両者のカード使用を封じ、手札枚数に応じて布石を失う。',
  OBSERVER_WILL: '相手手札を1つ奪って0コスト化し、観測者を顕現させる。ターン持続中は常時相手の手札を観測でき、観測した手札のコスト＋5。終了後観測の代償を支払う。',
  CONDEMN_WILL: '相手手札を見て1枚破壊',
  EXECUTION_WILL: '直前の相手ターンで自分石が破壊されていれば、相手手札をランダムで最大3枚破壊。',
  GOLD_STONE: '次の配置石へ1回だけ反転布石4倍の配置時効果を付ける',
  RAINBOW_STONE: '次の配置石へ1回だけ反転布石6倍の配置時効果を付ける',
  SILVER_STONE: '次の配置石へ1回だけ反転布石3倍の配置時効果を付ける',
  CRYSTAL_STONE: '次の数字マス布石を2倍。理論の化身の条件にも2倍分を加算',
  EXTEND_LIFE_WILL: '自分の特殊石または石状態1つの持続ターンを2倍にする',
  EXTEND_LIFE_GOD: '自分の特殊石または石状態1つの持続ターンを4倍にする',
  CORROSION_WILL: '盤面上の特殊石または石状態1つを選び、持続ターンを半減させる',
  GUARD_WILL: '完全保護中の石は反転・破壊・移動・誘惑・捕獲などの対象効果を受けない。\n保護は3ターン持続する。\n因果抹消や盤面縮小のセル消滅だけは防げない。',
  GUARDIAN_GOD: '完全保護中の石は反転・破壊・移動・誘惑・捕獲などの対象効果を受けない。\n守護神の保護は10ターン持続する。\n因果抹消や盤面縮小のセル消滅だけは防げない。',
  DESTROY_DRAGON_WILL: '次に置く石を破壊龍化。配置時+自ターン開始時に周囲1マスの敵石をランダム1個破壊',
  LIGHTNING_WILL: '次に置く石を落雷石化。配置時+自ターン開始時に盤面上の敵石をランダム1個破壊',
  METEOR_GOD: '次に置く石を因果抹消神石化。配置時+自ターン開始時に盤面上の敵石をランダム1個、石ごと抹消して穴マスにする。',
  ULTIMATE_DESTROY_GOD: '次に置く石を究極破壊神化。自由配置でき、周囲1マスの敵石を破壊する',
  ULTIMATE_HYPERACTIVE_GOD: '次に置く石を究極多動神化。毎ターン直線移動を2回行う',
  BOARD_EXPANSION_WILL: '盤面の左右どちらか外側に1マスを追加する',
  BOARD_EXPANSION_GOD: '初期8x8の角を選び、外側3マスを同時に盤面拡張',
  LIVING_WILL: '自分の石1つに生きる意志を付与。失われる時に1回だけ復活',
  EQUALITY_WILL: '相手の布石を最大10奪う。自分の布石が0のときに使用可能。',
  REINFORCEMENT_WILL: '既存石の近くの空きマスに、自分の通常石を1個ランダム配置(反転可)',
  SUPPORT_TROOPS_WILL: '既存石の近くの空きマスに、自分の通常石を3個ランダム配置(反転可)',
  RIBO_WILL: '布石を30得る。その後9ターンの間4返済。足りない場合は自石4個を消滅させる。',
  SALVATION_WILL: '直前の相手ターンで破壊された全ての石を救済し、自分の通常石として空きマスにランダム配置。復活石で通常反転',
  STONE_SALVATION_GOD: '次に置く石を救済神化。救済神が盤面にいる間、破壊された石を救済神の持ち主の通常石として空きマスに復活させる。救済神自身は復活しない。',
  FATE_WILL: '次の相手のターンを自分が操作できる。'
});

const detailCardEffectByType: Record<string, string | ((resolveChargeMaxText?: () => string | number) => string)> = Object.freeze({
  TREASURE_BOX: '獲得量は1〜6のランダム。\n使用直後に布石へ加算される。',
  PLACE_ON_EMPTY: '次の1手だけ有効。',
  FREE_PLACEMENT: '次の1手だけ有効。',
  LAST_RESORT: '相手より石数が少なく、通常の合法手がない（パスしかない）時だけ使える。\nこのターン、自由配置でちょうど3回置く。\n3回目の後に通常手は追加されない。',
  SHIELD_WILL: '有効なのは次の相手ターン中のみ。\nその後は通常の石として扱う。',
  PROTECTED_NEXT_STONE: '有効なのは次の相手ターン中のみ。\n弱い石は特殊石として扱い、誘惑・捕獲・意志の喪失の対象になる。\n保護期間が終わると通常石へ戻る。',
  GHOST_WILL: '持続する特殊石。\n反転・石破壊の対象にはなるが、その石自身は受けない。\n誘惑・捕獲など、対象条件を満たす反転・破壊以外の効果は通常どおり受ける。\n交換の意志は相手通常石のみ対象のため対象外。\n意志の喪失で通常石に戻る。',
  SACRIFICE_WILL: '犠牲石は5ターン持続。\n相手が通常カードを使うと自壊し、そのカード効果を無効化する。\n特殊カードは対象外。\n持続切れでは通常石に戻る。',
  AFTERIMAGE_WILL: '次に置く石を残像石化する。\n残像石は反転回避3回と破壊回避3回を持つ特殊石。\n意志の喪失で通常石に戻る。\n回避に成功した時だけ対応する回数を1消費する。\n片方だけ0になっても、もう片方が残る間は残像石のまま継続する。\n反転・破壊対象時は、盤面上の最も近い有効な空きマスへ移動して回避する。\n回避移動後、移動先で挟める列があればその石の色で反転する。\n同距離候補が複数ある場合はランダムで選ばれる。\n有効な空きマスが1つも無い場合だけ回避不成立となり、回数は消費しない。\n両方0になると通常石へ戻る。',
  SWAP_WITH_ENEMY: '相手の通常石1つを自分色に交換する。\n交換後、その位置を起点に挟める相手石を通常反転する。\nそのターンは石を置かず、そこで手番終了する。',
  POSITION_SWAP_WILL: '対象は通常石・特殊石・爆弾を問わない。',
  ANCHOR_WILL: '反転保護はターンをまたいで継続する。\n置いた石は相手ターンでも反転されない。',
  PERMA_PROTECT_NEXT_STONE: '強い石は特殊石として扱い、誘惑・捕獲・意志の喪失の対象になる。\n昇格前は反転だけを防ぎ、交換・破壊・誘惑・捕獲・意志の喪失までは防がない。\n所有者ターン開始20回で絶対保護石へ昇格する。\n絶対保護石も特殊石だが、対象効果は絶対保護で受けない。',
  STRONG_WIND_WILL: '移動方向は左右どちらかランダムで決まる。\n進路上の空きマスを進み、端または進入できないマスの直前で止まる。',
  BUOYANCY_WILL: '選んだ石を同じ列の上方向へ移動させる。\n進路上の空きマスを進み、上端または進入できないマスの直前で止まる。',
  SUPER_BUOYANCY_WILL: '盤面上の石を1つ選び、上方向へ限界まで移動させる。\n移動経路にある石は衝突時にすべて破壊する。\n封鎖マス・穴マスには入れない。',
  GRAVITY_WILL: '選んだ石を同じ列の下方向へ移動させる。\n進路上の空きマスを進み、下端または進入できないマスの直前で止まる。',
  SUPER_GRAVITY_WILL: '盤面上の石を1つ選び、下方向へ限界まで移動させる。\n移動経路にある石は衝突時にすべて破壊する。\n封鎖マス・穴マスには入れない。',
  SUPER_ATTRACTION_WILL: '盤面上の石を1つ選び、盤面上の別マス1つまで引き寄せる。\n移動は縦・横・斜め45度を組み合わせた最短経路で行い、最短経路が複数ある場合はどちらか1つをランダムに選ぶ。\n移動経路と指定マスにある石は衝突時にすべて破壊する。\n封鎖マス・穴マス・完全保護石は貫通できない。',
  TELEPORT_WILL: '対象は敵味方・通常石・特殊石・爆弾を問わない。',
  CELL_TELEPORT_WILL: '現在の盤面上に存在する石のあるマスを1つ選ぶ。\n選ばれた石を、盤面拡張・盤面拡張神で追加可能な外側マスのうち空いている1マスへランダムにテレポートさせる。\n移動先が未生成ならその拡張マスを作ってから移動し、元マスをセル消滅で永続の穴マスにする。\n元マスが穴マスになる処理は石破壊ではなく、生きる意志・復活の意志・破壊回避では残らない。\n対象は敵味方・通常石・特殊石・爆弾を問わない。',
  TRAP_WILL: 'そのターンは石を置かない。\n次の相手ターン中に反転されると、相手の布石を最大10奪い相手手札を全破壊する。\n反転されなければ不発で終了する。',
  TEMPT_WILL: '対象は相手の誘惑可能な石効果。\n特殊石、罠石、時限爆弾、生きる意志を対象に含む。\n弱い石・強い石・幽体石は特殊石として対象に含まれる。\n完全保護中の石と絶対保護石は対象効果を受けない。\n顕現石・盤面マーカー・配置時効果は対象外。\n残りターンなどの状態を維持したまま自分側になる。',
  CAPTURE_WILL: '盤面から取り除き、その特殊石の元になったカードとして自分の手札へ加える。\n弱い石・強い石・幽体石は対象に含まれる。\n完全保護が付いた相手特殊石と絶対保護石は対象効果を受けない。\n幽体石にも通常どおり成立する。',
  DOUBLE_CHAIN_WILL: 'この手の通常反転を起点に、追加反転を1回行う。\n使用後、三連鎖の意志が手札に加わる。',
  TRIPLE_CHAIN_WILL: 'この手の通常反転を起点に、追加反転を2回行う。\n使用後、四連鎖の意志が手札に加わる。',
  QUAD_CHAIN_WILL: 'この手の通常反転を起点に、追加反転を3回行う。\n使用後、無限連鎖の意志が手札に加わる。',
  INFINITE_CHAIN_WILL: 'この手の通常反転を起点に、追加反転を可能な限り続ける。\n追加反転できなくなった時点で終了する。',
  TABOO_REVERSE_WILL: '同じ反転枚数の列が複数ある場合はランダムで1方向を選ぶ。\n禁忌反転ができないマスでは通常の挟み反転を行う。\n通常反転と禁忌反転の両方が可能なマスでは禁忌反転を優先する。',
  REVERSE_WILL: '盤面上の自分または相手の石を1つ選ぶ。\nその石を起点として、その石の色で通常の挟み反転が成立する列を反転する。\n反転できる石が盤面に1つもない時は使用できない。\n反転後も手番は続き、通常の配置を行う。',
  REGEN_WILL: '次に置く石を復活石化する。\n復活石は特殊石として扱い、意志の喪失で通常石に戻る。\n反転または破壊された瞬間に、復活可能回数を1回ぶん消費して元色へ戻る。\nこの復活は最大3回まで発動する。\n戻った位置から挟める列があれば追加で反転する。',
  DESTROY_ONE_STONE: '対象を1つ選んで即時に除去する。',
  TIME_BOMB: '3ターン後に「そのマス+周囲1マス（3x3）」を爆破。\n反転されると爆弾は解除される。',
  TIME_STOP_GOD: '使用時に自分石3つを破壊し、次に置く石を時間停石化する。\n5回目の所有者ターン開始時に時間停止し、そのターンと次のターンを連続で行動する。\n発動後は通常石に戻り、先に空マスになるか相手色になると不発。\n反転保護は持たない。',
  SNIPER_WILL: '空きマスに自由配置できる。\n配置したターン即時と、自ターン開始時に最も近い敵石を1つ破壊する。\n同距離の候補はランダムで選ばれる。',
  ULTIMATE_REVERSE_DRAGON: '反転が0でも空きマスに配置できる。\n配置時に周囲1マス（8方向）を反転する。\n自ターン開始時はランダムな空きマスへ移動してから周囲1マス（8方向）を反転する。\n移動先が無いときはその場で反転する。\n持続は8ターン。\n反転保護を持つ特殊石として扱う。',
  BREEDING_WILL: '生成先は起点の周囲8マスの空きを優先する。\n周囲8マスに空きが無い場合は、盤面上の最も近い有効な空きマスへ生成する。\n近さは8方向距離で判定し、同距離候補はランダム。\n盤面上に有効な空きが1つも無い場合だけ生成しない。\n持続中は前回生成石の周囲へ拡散する。\n各生成石は、そのマスを起点に通常の挟み反転を行う。',
  PROLIFERATION_WILL: '破壊される時、盤面上の有効な空きマスから最も近い1マスへ同色の増殖石を1個生成して破壊を防ぐ。\n近さは8方向距離で判定し、同距離の候補はランダムで選ばれる。\n空きが1つも無い場合だけ通常どおり破壊される。\n増殖で生まれた石は、そのマスを起点に通常の挟み反転を行う。\n増殖で生まれた石は持続終了時や反転時に通常石に戻る。',
  CLONE_WILL: '複製先は選んだ石の周囲8マスの空きを優先する。\n周囲8マスに空きが無い場合は、盤面上の最も近い有効な空きマスへ複製する。\n近さは8方向距離で判定し、同距離候補はランダム。\n盤面上に有効な空きマスが1つも無い場合だけ複製しない。\n複製で生まれた石は、そのマスを起点に通常の挟み反転を行う。\n特殊石は残り持続ターンを引き継ぐ。',
  CROSS_BOMB: '次に置く石へ十字爆弾の配置時効果を付ける。\n中心マスを含む十字範囲を爆破する。',
  X_BOMB: '次に置く石へクロス爆弾の配置時効果を付ける。\n中心マスを含むX字範囲を爆破する。',
  HYPERACTIVE_WILL: 'ターン開始移動の移動先は周囲の空きマスから選ばれる。\nターン開始移動で空きが無い場合は同色の通常石に戻る。\n移動後に挟める列があれば反転する。\n反転対象時は、盤面上の最も近い有効な空きマスへ1回だけ移動して回避する。\n回避移動後、移動先で挟める列があればその石の色で反転する。\n有効な空きマスが1つも無い場合だけ回避不成立となり、回数は消費しない。',
  EXTREME_HYPERACTIVE_WILL: '両者ターン開始時に周囲8マス（空き・占有）からランダム1マス移動する。\n占有マスへ入る時は、その石を退避させるか位置交換する。\n進入・退避・位置交換ができる候補が無い場合は同色の通常石に戻る。\n移動後に挟める列があれば反転し、隣接石を敵味方問わず遠ざける。\n反転対象時は最大5回、破壊対象時は5回だけ、盤面上の最も近い有効な空きマスへ移動して回避する。\n回避移動後、移動先で挟める列があればその石の色で反転する。\n有効な空きマスが1つも無い場合だけ回避不成立となり、回数は消費しない。\nターン制限はない。',
  ESCAPE_WILL: '毎ターン1マス逃げるように移動する。\n反転対象時は、盤面上の最も近い有効な空きマスへ1回だけ移動して回避する。\n回避移動後、移動先で挟める列があればその石の色で反転する。\nターン開始時の移動で移動先が無い場合は爆発する。\n反転回避で有効な空きマスが1つも無い場合は爆発せず通常どおり反転され、回数は消費しない。',
  INSTANT_HYPERACTIVE_WILL: '次に置く石へ瞬間多動の配置時効果を付ける。\n配置直後にランダム1マス移動を3回行う。\n各移動後に挟める列があれば反転し、最後に通常石へ戻る。',
  ROBOT_VACUUM_WILL: '移動先は周囲8マスの空きから敵石に近づく候補を優先して1マス選ぶ（同優先度はランダム）。\n空きが無い場合はその場で同色の通常石に戻る。\n吸い込み後も反転は発生しない。\n吸い込み成功ごとに持続ターン+1（所有者ターン開始時のみ減算）。\n守る意志の完全保護中の石は吸い込めない。',
  GLUTTONOUS_WILL: '隣接敵石があれば優先してそのマスへ進入し、同時に捕食する。\n隣接敵石が無い場合は敵石へ近づくように移動する。\n2連続で捕食できないと飢えて消滅する。',
  WILL_HUNTER_KING: '次に置く石を意志狩りの王石化する。\n自ターン開始時、敵石を1つ選んでそのマスへ移動しながら破壊する。\n敵の特殊石があればそちらを優先して狙う。\n反転回避2回と破壊回避2回を持ち、回避時は盤面上の最も近い有効な空きマスへ移動する。\n回避移動後、移動先で挟める列があればその石の色で反転する。',
  BLOCKADE_WILL: '封鎖したマスには両者とも配置・移動で入れない。\n持続終了時に解除される。',
  SEED_WILL: '種マスは通常どおり配置・移動に使える。\n石が置かれた時点で種は消える。\n所有者ターン開始時だけ残り回数が減る。\n5回目の所有者ターン開始で芽生えた石は、そのマスを起点に通常の挟み反転を行う。\n封鎖の意志・凍結の意志では種マスを選べない。',
  METEOR_WILL: 'マスを1つ選んで石ごと抹消し、穴マスにする。',
  BOARD_SHRINK_WILL: '外周から連続する3マスを選んで石ごと抹消し、穴マスにして盤面を縮小する。',
  BOARD_SHRINK_GOD: '角を含む外周1列を選んで石ごと抹消し、穴マスにして盤面を縮小する。',
  FREEZE_WILL: '凍結マスと、そのマス上の石は反転・破壊されない。\n凍結中の特殊石は持続ターンが減らず、解除後に再び減り始める。',
  REBUILD_WILL: '使用カードと特殊カード以外の手札をすべて先に破壊してから引き直す。\n山札が足りない場合は引ける枚数だけ補充する。',
  WORK_WILL: function resolveWorkLine(resolveChargeMaxText?: () => string | number) {
    const chargeMaxText = (typeof resolveChargeMaxText === 'function')
      ? String(resolveChargeMaxText() || '99')
      : '99';
    return `ターン開始ごとの獲得量は1→2→4→8→16で増加。\n布石上限は${chargeMaxText}。`;
  },
  DOUBLE_PLACE: '1手目の後にターン切替は発生しない。',
  TRIPLE_PLACE: '1手目と2手目の後にターン切替は発生しない。',
  QUAD_PLACE: '1手目から3手目までの途中でターン切替は発生しない。',
  INFINITE_PLACE: '合法手がなくなった時点でそのまま終了する。',
  HEAVEN_BLESSING: '選ばなかった候補は消える。',
  REVEAL_HAND_WILL: '使用時点の相手手札をすべて公開する。\n使用後に相手が引いたカードは公開しない。\n一度公開した同じカードは、手札を離れて後で戻っても表のまま。',
  THEORY_INCARNATION: '演算の意志などで数字マス布石が増えた場合は、増加後の獲得量で数える。通常反転ぶんの布石は数えない。\n盤面に顕現石が存在する間は使用できない。\n使用時、盤面上の空きマスを特殊石カードのコストに対応した理論数字マスへ書き換える。\n次に置く自石として理論の化身を4T不可侵の顕現石として出し、配置直後にも理論数字マスから特殊石を1体出現させる。\n理論の化身が盤上にいる間、自分はカードを使用できないが、合法手があれば通常通り石を置ける。\n次の自分ターン以降、合法手があれば通常配置後に理論数字マスから対応コストの特殊石がランダムで1体現れる。合法手がない場合は通常のパスを選ぶ。\n理論の化身による特殊石出現では理論数字マス値の布石を獲得しないが、出現時に反転した枚数ぶんの布石は獲得する。\n配置直後の出現は4Tぶんの出現回数を消費しないため、最大5回特殊石を出現できる。\n罠石と時限爆弾は理論の出現候補に含まれない。\n理論の化身が消滅すると、未消費の理論数字マスは元の数字マスへ戻る。',
  BOARD_EXECUTOR: '使用時、盤面上のすべての特殊石を絶対執行し、全ての保護を貫通して穴マスにする。罠石と時限爆弾も対象に含む。\n顕現石・石状態・盤面マーカー・配置時効果は対象に含まれない。\n使用後、次に置く自石として盤界の執行者を4T不可侵の顕現石として出す。\n盤界の執行者が盤上にいる間、両者は手札からカードを使用できない。\n両者ターン開始時、その手番プレイヤーはドロー前の所持カード枚数に応じて布石を失う。',
  OBSERVER_WILL: '盤面に顕現石が存在する間は使用できない。\n使用時に相手手札を公開して1枚選ぶ。選んだカードは自分の手札に加わり0コストになる。\n観測済みになった相手手札はカードcopyごとに1回だけコスト+5になる。奪ったカードは0コストになり、盤理の観測者による+5は残らない。特殊カードは観測で表表示にはなるが、コスト+5は受けない。\n選択後、次に置く自石として盤理の観測者を5T不可侵の顕現石として出す。盤理の観測者が盤上にいる間、相手手札は常に表表示。\n一度観測した相手手札は観測済みとなり、盤理の観測者が消滅した後も表表示のまま残る。盤理の観測者が盤上にいる間に相手が新たに引いた手札も観測済みになる。観測済みカードには双方にタグを表示する。\n盤理の観測者が消滅した後、観測の代償として奪ったカードの元コスト20%を自ターン開始時に最大9回返済する。布石不足時は自石4個をランダム破壊する。',
  CONDEMN_WILL: '公開された手札から1枚を選んで破壊する。',
  EXECUTION_WILL: '使用条件は、直前に終了した相手ターン中に自分の石が1つ以上破壊されていること。\n使用時、相手の現在の手札からランダムに最大3枚を破壊する。\n相手手札が3枚未満なら、存在する枚数ぶんだけ破壊する。',
  GOLD_STONE: '次に置く石へ1回だけ反転布石4倍の配置時効果を付ける。\n効果解決後、その石は消滅する。',
  RAINBOW_STONE: '次に置く石へ1回だけ反転布石6倍の配置時効果を付ける。\n効果解決後、その石は消滅する。',
  SILVER_STONE: '次に置く石へ1回だけ反転布石3倍の配置時効果を付ける。\n効果解決後、その石は消滅する。',
  CRYSTAL_STONE: '次に置く1手だけ有効。\n数字マスに置いた場合、その数字ぶんの布石獲得が合計2倍になる。\n2倍になった数字マス布石は、理論の化身の使用条件にも2倍分として加算される。\n数字マス以外では追加効果は起こらない。\n置いた石は通常石のまま残る。',
  EXTEND_LIFE_WILL: '対象は盤面上の自分の特殊石または石状態。\n完全保護中の自分特殊石・石状態にも使える。\n現在の持続ターン値を2倍に延長する。',
  EXTEND_LIFE_GOD: '対象は盤面上の自分の特殊石または石状態。\n完全保護中の自分特殊石・石状態にも使える。\n現在の持続ターン値を4倍に延長する。',
  CORROSION_WILL: '選んだ特殊石または石状態の残り持続ターンを半減する。\n小数は切り捨て、最小値は1。\n爆弾・罠・盤面マーカー・配置時効果・完全保護中の対象は選べない。\n対象がない場合は使用できない。',
  GUARD_WILL: '自石を1つ選び、完全保護を付与。穴マス以外の全ての効果を無効化する。',
  GUARDIAN_GOD: '自石を1つ選び、完全保護を付与。穴マス以外の全ての効果を無効化する。',
  DESTROY_DRAGON_WILL: '反転保護を持つ特殊石として扱う。',
  LIGHTNING_WILL: '配置ターン即時も発動回数に含まれるが、その時点では持続ターンは減らない。\n反転保護を持つ特殊石として扱う。',
  METEOR_GOD: '配置ターン即時も発動回数に含まれるが、その時点では持続ターンは減らない。\n選ばれた敵石のマスを石ごと抹消し、穴マスにする。穴マスにできない場合は不発となり、再抽選しない。\nセル消滅として扱い、生きる意志・復活の意志・破壊回避では残らない。\n反転保護を持つ特殊石として扱う。',
  ULTIMATE_DESTROY_GOD: '空きマスに自由配置できる。\n配置時と自ターン開始時に周囲1マスの敵石を破壊する。\n自ターン開始時はランダムな空きマスへ移動してから破壊し、移動先が無いときはその場で破壊する。',
  ULTIMATE_HYPERACTIVE_GOD: '両者ターン開始時に直線1〜5マス移動を2回行い、2マス以上は途中の石を飛び越える。\n移動後に挟めば反転する。\nターン開始移動で移動先が無い場合は同色の通常石に戻る。\n反転対象時は最大5回、破壊対象時は2回だけ、盤面上の最も近い有効な空きマスへ移動して回避する。\n回避移動後、移動先で挟める列があればその石の色で反転する。\n有効な空きマスが1つも無い場合だけ回避不成立となり、回数は消費しない。',
  BOARD_EXPANSION_WILL: '追加位置は左右端マスから選び、1対局で1回のみ使える。',
  BOARD_EXPANSION_GOD: '3マスのうち1つでも既存拡張セルと重なる角は選べない。',
  LIVING_WILL: '対象は自分の通常石・特殊石。\n失われる時に1回だけ、付与時点の石状態で復活する。\n後から追加された別効果は復元しない。\n元マスが使えない時は別の空きマスへ復活し、空きが無い時は復活しない。\n復活した石で挟める列があれば通常反転する。\n捕獲の意志は無効化してその場に残る。\n因果抹消・盤面縮小・盤面縮小神・マステレポートのセル消滅では復活しない。',
  EQUALITY_WILL: '自分の布石が0の時のみ使用できる。\n使用時、相手の布石を最大10奪い、奪った分を自分へ加算する。\n相手の布石が10未満なら、存在する布石数ぶんだけ奪う。\n相手の布石が0でも使用条件を満たしていれば使用でき、奪取量0として解決する。',
  REINFORCEMENT_WILL: '使用時、盤面の角と辺を除く空きマスのうち、いずれかの石に隣接1マス（周囲8マス）で接している候補だけを集める。\n候補からランダム1マスを選び、自分色の通常石を1個配置する。\n候補条件に通常反転の可否は含めず、配置後は通常配置と同じ反転処理を行う。\n候補が無い局面では使用できない。',
  SUPPORT_TROOPS_WILL: '使用時、盤面の角と辺を除く空きマスのうち、いずれかの石に隣接1マス（周囲8マス）で接している候補だけを集める。\n候補からランダムに最大3マスを選び、自分色の通常石を1個ずつ配置する。\n候補条件に通常反転の可否は含めず、各配置後は通常配置と同じ反転処理を行う。\n候補が1〜2マスしか無い場合は、その数だけ配置する。',
  RIBO_WILL: '使用時に布石を30得る。\nその後9回の自ターン開始ごとに4布石を返済する。\n返済に必要な布石が足りない場合は、自石をランダム4個消滅させる。',
  LOSS_WILL: '盤面上の特殊石を全て通常石に戻す。\n自分の手札を全て破壊して使用。\n幽体石・残像石・復活石・罠石も特殊石として通常石化する。\n絶対保護石は特殊石だが、対象効果を受けない。\n守る石・生きる意志・盤面マーカー・配置時効果は対象外。\n完全保護中の石は対象外。\n解除できる特殊石も爆弾も無い局面では使用できない。',
  SALVATION_WILL: '直前の相手ターンで破壊された全ての石を自分の通常石としてランダムな空きマスへ配置する。\n対象0枚の時は使用不可。\n対象は自分・相手、通常石・特殊石を問わない。\n各復活石は、そのマスを起点に通常の挟み反転を行う。',
  STONE_SALVATION_GOD: '次に置く石を救済神にする。\n救済神は反転されないが、破壊は通常どおり受ける。\n救済神が盤面にいる間、破壊された石を救済神の持ち主の通常石としてランダムな空きマスへ復活させる。\n両プレイヤーの救済神がいる場合は、破壊された石の元所有者側を優先する。\n救済神自身が破壊された場合、その救済神は復活せず効果も終了する。',
  FATE_WILL: '次の相手ターン1回だけ操作権を得る。\n相手の手札を見て、カード使用や石配置まで行える。\n配置可能マスが無ければ通常のパスとして終了する。\n発動中に再び使っても重ならず、その回の制御だけで終わる。'
});

const cardEffectTagsByType = Object.freeze({
  PROTECTED_NEXT_STONE: freezeCardEffectTags([specialStoneTag(), flipProtectionTag()]),
  ANCHOR_WILL: freezeCardEffectTags([flipProtectionTag()]),
  SNIPER_WILL: freezeCardEffectTags([specialStoneTag(), durationTurnsTag(6)]),
  GHOST_WILL: freezeCardEffectTags([specialStoneTag(), durationTurnsTag(8)]),
  SACRIFICE_WILL: freezeCardEffectTags([specialStoneTag(), durationTurnsTag(5)]),
  AFTERIMAGE_WILL: freezeCardEffectTags([specialStoneTag(), flipEvasionTag(3), destroyEvasionTag(3)]),
  PERMA_PROTECT_NEXT_STONE: freezeCardEffectTags([specialStoneTag(), flipProtectionTag(), delayedActivationTurnsTag(20)]),
  TRAP_WILL: freezeCardEffectTags([specialStoneTag()]),
  TIME_BOMB: freezeCardEffectTags([specialStoneTag(), delayedActivationTurnsTag(3)]),
  TIME_STOP_GOD: freezeCardEffectTags([specialStoneTag(), delayedActivationTurnsTag(5)]),
  REGEN_WILL: freezeCardEffectTags([specialStoneTag()]),
  ULTIMATE_REVERSE_DRAGON: freezeCardEffectTags([specialStoneTag(), durationTurnsTag(8), flipProtectionTag()]),
  BREEDING_WILL: freezeCardEffectTags([specialStoneTag(), durationTurnsTag(5), flipProtectionTag()]),
  PROLIFERATION_WILL: freezeCardEffectTags([specialStoneTag(), durationTurnsTag(10)]),
  CELL_TELEPORT_WILL: freezeCardEffectTags([holeCellTag()]),
  SEED_WILL: freezeCardEffectTags([delayedActivationTurnsTag(5)]),
  HYPERACTIVE_WILL: freezeCardEffectTags([specialStoneTag(), flipEvasionTag(1)]),
  ESCAPE_WILL: freezeCardEffectTags([specialStoneTag(), flipEvasionTag(1)]),
  ROBOT_VACUUM_WILL: freezeCardEffectTags([specialStoneTag(), durationTurnsTag(5)]),
  GLUTTONOUS_WILL: freezeCardEffectTags([specialStoneTag(), flipProtectionTag()]),
  WILL_HUNTER_KING: freezeCardEffectTags([specialStoneTag(), flipEvasionTag(2), destroyEvasionTag(2), durationTurnsTag(8)]),
  EXTREME_HYPERACTIVE_WILL: freezeCardEffectTags([specialStoneTag(), flipEvasionTag(5), destroyEvasionTag(5)]),
  WORK_WILL: freezeCardEffectTags([specialStoneTag(), durationTurnsTag(5)]),
  GUARD_WILL: freezeCardEffectTags([fullProtectionTag(), durationTurnsTag(3)]),
  GUARDIAN_GOD: freezeCardEffectTags([fullProtectionTag(), durationTurnsTag(10)]),
  THEORY_INCARNATION: freezeCardEffectTags([usageConditionTag('数字マス42獲得で使用可能'), inviolableTag(), durationTurnsTag(4)]),
  BOARD_EXECUTOR: freezeCardEffectTags([usageConditionTag('自特殊石存在時使用可能'), holeCellTag(), absoluteExecutionTag(), inviolableTag(), durationTurnsTag(4)]),
  OBSERVER_WILL: freezeCardEffectTags([usageConditionTag('18手後使用可能'), inviolableTag(), durationTurnsTag(5)]),
  ULTIMATE_DESTROY_GOD: freezeCardEffectTags([specialStoneTag(), durationTurnsTag(6), flipProtectionTag()]),
  DESTROY_DRAGON_WILL: freezeCardEffectTags([specialStoneTag(), durationTurnsTag(3), flipProtectionTag()]),
  LIGHTNING_WILL: freezeCardEffectTags([specialStoneTag(), durationTurnsTag(6), flipProtectionTag()]),
  METEOR_WILL: freezeCardEffectTags([holeCellTag(), erasureTag()]),
  BOARD_SHRINK_WILL: freezeCardEffectTags([holeCellTag(), erasureTag()]),
  BOARD_SHRINK_GOD: freezeCardEffectTags([holeCellTag(), erasureTag()]),
  METEOR_GOD: freezeCardEffectTags([specialStoneTag(), durationTurnsTag(6), flipProtectionTag(), holeCellTag(), erasureTag()]),
  STONE_SALVATION_GOD: freezeCardEffectTags([specialStoneTag(), durationTurnsTag(12), flipProtectionTag()]),
  ULTIMATE_HYPERACTIVE_GOD: freezeCardEffectTags([specialStoneTag(), flipEvasionTag(5), destroyEvasionTag(2), durationTurnsTag(12)]),
  BLOCKADE_WILL: freezeCardEffectTags([durationTurnsTag(3)]),
  FREEZE_WILL: freezeCardEffectTags([durationTurnsTag(5)]),
});

const cardNumericTagsByType = Object.freeze(Object.fromEntries(
  Object.entries(cardEffectTagsByType)
    .map(([cardType, tags]) => [
      cardType,
      freezeCardEffectTags((Array.isArray(tags) ? tags : []).filter((tag: any) => tag && isCardNumericTagKind(tag.kind)))
    ])
    .filter(([, tags]) => Array.isArray(tags) && tags.length > 0)
));

function cloneCardEffectTag(tag: any) {
  if (!tag || typeof tag !== 'object') return null;
  const cloned: any = {
    kind: tag.kind,
    label: tag.label
  };
  if (Number.isFinite(Number(tag.value))) cloned.value = Number(tag.value);
  return cloned;
}

function resolveCardEffectTags(cardDef: any) {
  const cardType = cardDef && cardDef.type ? String(cardDef.type) : '';
  if (!cardType) return [];
  const mappedTags = (cardEffectTagsByType as any)[cardType];
  if (!Array.isArray(mappedTags) || mappedTags.length === 0) return [];
  return mappedTags.map(cloneCardEffectTag).filter(Boolean);
}

function resolveCardNumericTags(cardDef: any) {
  return resolveCardEffectTags(cardDef).filter((tag: any) => isCardNumericTagKind(tag.kind));
}

function normalizeCardDescText(text: string) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/。+/g, '。')
    .trim();
}

function splitCardDescSentences(text: string) {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const sentences: string[] = [];
  for (const line of lines) {
    const chunks = line.match(/[^。！？!?]+[。！？!?]?/g);
    if (!chunks || chunks.length === 0) {
      sentences.push(line);
      continue;
    }
    for (const chunk of chunks) {
      const normalized = chunk.trim();
      if (normalized) sentences.push(normalized);
    }
  }
  return sentences;
}

function buildCardDescComparisonKey(text: string) {
  return normalizeCardDescText(text)
    .replace(/[\s\u3000]/g, '')
    .replace(/[。\.。、,，:：;；!！?？'""“”‘’\-ー／/（）()\[\]{}「」『』【】<>《》・]/g, '')
    .toLowerCase();
}

function isCardDescPlaceholderText(text: string) {
  const key = buildCardDescComparisonKey(text);
  if (!key) return true;
  return key === buildCardDescComparisonKey('効果説明は準備中')
    || key === buildCardDescComparisonKey('詳細説明は準備中')
    || key === buildCardDescComparisonKey('効果説明が未登録です');
}

function fallbackQuickCardEffect(cardDef: any, options?: any) {
  const normalized = normalizeCardDescText(cardDef && cardDef.desc ? cardDef.desc : '');
  if (!normalized) return '効果説明は準備中';
  const configuredMaxLength = Number(options && options.maxLength);
  const maxLength = Number.isFinite(configuredMaxLength) && configuredMaxLength > 0
    ? configuredMaxLength
    : 32;
  const firstSentence = normalized.split('。').map((s) => s.trim()).filter(Boolean)[0] || normalized;
  return firstSentence.length > maxLength ? `${firstSentence.slice(0, maxLength)}...` : firstSentence;
}

function fallbackDetailCardEffect(cardDef: any) {
  const normalized = normalizeCardDescText(cardDef && cardDef.desc ? cardDef.desc : '');
  if (!normalized) return '詳細説明は準備中';
  return normalized.replace(/。/g, '。\n').trim();
}

function resolveNonDuplicateDetailText(quickText: string, detailText: string) {
  const quick = String(quickText || '').trim();
  const detail = String(detailText || '').trim();
  if (!detail) return '';
  if (!quick) return detail;
  if (isCardDescPlaceholderText(detail)) return '';

  const quickKey = buildCardDescComparisonKey(quick);
  const detailKey = buildCardDescComparisonKey(detail);
  if (!detailKey) return '';
  if (!quickKey) return detail;
  if (detailKey === quickKey) return '';

  const detailSentences = splitCardDescSentences(detail);
  if (detailSentences.length === 0) return '';

  const keepSentences: string[] = [];
  const seenSentenceKeys = new Set<string>();
  for (const sentence of detailSentences) {
    const sentenceKey = buildCardDescComparisonKey(sentence);
    if (!sentenceKey) continue;
    const isExactDuplicate = sentenceKey === quickKey;
    const isContainedDuplicate = sentenceKey.length >= 12
      && quickKey.length >= 12
      && (quickKey.includes(sentenceKey) || sentenceKey.includes(quickKey));
    if (isExactDuplicate || isContainedDuplicate) continue;
    if (seenSentenceKeys.has(sentenceKey)) continue;
    seenSentenceKeys.add(sentenceKey);
    keepSentences.push(sentence);
  }

  if (keepSentences.length === 0) return '';
  if (keepSentences.length === detailSentences.length) return detail;
  return keepSentences.join('\n');
}

function getQuickCardEffect(cardDef: any, options?: any) {
  if (!cardDef) return 'カードを選択してください';
  if (cardDef.type && (quickCardEffectByType as any)[cardDef.type]) return (quickCardEffectByType as any)[cardDef.type];
  return fallbackQuickCardEffect(cardDef, options);
}

function getDetailCardEffect(cardDef: any, resolveChargeMaxText?: () => string | number) {
  if (!cardDef) return '';
  const mapped = cardDef.type ? (detailCardEffectByType as any)[cardDef.type] : null;
  if (typeof mapped === 'function') return mapped(resolveChargeMaxText);
  if (typeof mapped === 'string') return mapped;
  return fallbackDetailCardEffect(cardDef);
}

function resolveCardDescriptionTexts(cardDef: any, options?: any) {
  const quickText = getQuickCardEffect(cardDef, {
    maxLength: options && options.quickTextMaxLength
  });
  const detailText = getDetailCardEffect(
    cardDef,
    options && typeof options.resolveChargeMaxText === 'function'
      ? options.resolveChargeMaxText
      : undefined
  );
  return {
    quickText,
    detailText,
    distinctDetailText: resolveNonDuplicateDetailText(quickText, detailText),
    effectTags: resolveCardEffectTags(cardDef),
    numericTags: resolveCardNumericTags(cardDef)
  };
}

export = {
  CARD_EFFECT_TAG_KIND,
  CARD_NUMERIC_TAG_KIND,
  isCardNumericTagKind,
  quickCardEffectByType,
  detailCardEffectByType,
  cardEffectTagsByType,
  cardNumericTagsByType,
  normalizeCardDescText,
  splitCardDescSentences,
  buildCardDescComparisonKey,
  isCardDescPlaceholderText,
  buildCardEffectTag,
  fallbackQuickCardEffect,
  fallbackDetailCardEffect,
  buildCardNumericTag,
  resolveCardEffectTags,
  resolveCardNumericTags,
  resolveNonDuplicateDetailText,
  resolveCardDescriptionTexts,
  getQuickCardEffect,
  getDetailCardEffect
};
