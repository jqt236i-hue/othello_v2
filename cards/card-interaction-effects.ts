// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../src/types';

function getSpecialStoneDisplayName(rawType, fallback) {
        if (SpecialStoneRegistry && typeof SpecialStoneRegistry.getSpecialStoneDisplayName === 'function') {
            return SpecialStoneRegistry.getSpecialStoneDisplayName(rawType, fallback);
        }
        return fallback !== undefined ? fallback : (rawType ? String(rawType) : '');
    }

    const timeStopStoneName = getSpecialStoneDisplayName('TIME_STOP', '時間停石');

    const CARD_EFFECT_TAG_KIND = Object.freeze({
        FLIP_PROTECTION: 'flip-protection',
        FULL_PROTECTION: 'full-protection',
        FLIP_EVASION: 'flip-evasion',
        DESTROY_EVASION: 'destroy-evasion',
        DURATION_TURNS: 'duration-turns',
        DELAYED_ACTIVATION_TURNS: 'delayed-activation-turns'
    });

    const CARD_NUMERIC_TAG_KIND = Object.freeze({
        FLIP_EVASION: CARD_EFFECT_TAG_KIND.FLIP_EVASION,
        DESTROY_EVASION: CARD_EFFECT_TAG_KIND.DESTROY_EVASION,
        DURATION_TURNS: CARD_EFFECT_TAG_KIND.DURATION_TURNS,
        DELAYED_ACTIVATION_TURNS: CARD_EFFECT_TAG_KIND.DELAYED_ACTIVATION_TURNS
    });

    const CARD_NUMERIC_TAG_KIND_SET = new Set(Object.values(CARD_NUMERIC_TAG_KIND));

    function isCardNumericTagKind(kind) {
        return CARD_NUMERIC_TAG_KIND_SET.has(String(kind || '').trim());
    }

    function buildCardEffectTag(kind, value) {
        const normalizedKind = String(kind || '').trim();

        if (normalizedKind === CARD_EFFECT_TAG_KIND.FLIP_PROTECTION) {
            return Object.freeze({ kind: normalizedKind, label: '反転保護' });
        }
        if (normalizedKind === CARD_EFFECT_TAG_KIND.FULL_PROTECTION) {
            return Object.freeze({ kind: normalizedKind, label: '完全保護' });
        }

        const normalizedValue = Math.floor(Number(value));
        if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) return null;

        let label = '';
        if (normalizedKind === CARD_EFFECT_TAG_KIND.FLIP_EVASION) {
            label = `反転回避${normalizedValue}回`;
        } else if (normalizedKind === CARD_EFFECT_TAG_KIND.DESTROY_EVASION) {
            label = `破壊回避${normalizedValue}回`;
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

    function buildCardNumericTag(kind, value) {
        if (!isCardNumericTagKind(kind)) return null;
        return buildCardEffectTag(kind, value);
    }

    const flipProtectionTag = () => buildCardEffectTag(CARD_EFFECT_TAG_KIND.FLIP_PROTECTION);
    const fullProtectionTag = () => buildCardEffectTag(CARD_EFFECT_TAG_KIND.FULL_PROTECTION);
    const flipEvasionTag = (value) => buildCardEffectTag(CARD_EFFECT_TAG_KIND.FLIP_EVASION, value);
    const destroyEvasionTag = (value) => buildCardEffectTag(CARD_EFFECT_TAG_KIND.DESTROY_EVASION, value);
    const durationTurnsTag = (value) => buildCardEffectTag(CARD_EFFECT_TAG_KIND.DURATION_TURNS, value);
    const delayedActivationTurnsTag = (value) => buildCardEffectTag(CARD_EFFECT_TAG_KIND.DELAYED_ACTIVATION_TURNS, value);

    function freezeCardEffectTags(tags) {
        return Object.freeze((Array.isArray(tags) ? tags : []).filter(Boolean));
    }

    const quickCardEffectByType = Object.freeze({
        TREASURE_BOX: '布石を1〜3獲得',
        PLACE_ON_EMPTY: '反転0でも空きマスに置ける',
        FREE_PLACEMENT: '反転0でも空きマスに置ける',
        LAST_RESORT: '石数負けかつ合法手0の時に使用可能、空きマスに石を3個配置できる。',
        SNIPER_WILL: '空きマスに自由配置し、最も近い敵石を配置時+毎ターン1つ破壊（5ターン）',
        SHIELD_WILL: '次に置く石を1ターン保護',
        PROTECTED_NEXT_STONE: '次に置く石は次の相手ターン中だけ反転されない',
        GHOST_WILL: '次に置く石を幽体化。5ターン、反転・破壊の対象にはなるがその石自身は受けない',
        AFTERIMAGE_WILL: '次に置く石は反転または破壊されたとき3回まで復活する、復活後挟める列があれば反転させる。',
        SWAP_WITH_ENEMY: '相手通常石1つ選んで自分の通常石に交換する。(反転可能)',
        POSITION_SWAP_WILL: '盤面の石2つを入れ替える',
        ANCHOR_WILL: '次に置く石を完全固定',
        PERMA_PROTECT_NEXT_STONE: '次に置く石はずっと反転されない。10ターン経過すると最強の意志に進化して絶対保護を得る。',
        STRONG_WIND_WILL: '石1つを飛ばし、最長方向へ移動させる',
        SUPER_BUOYANCY_WILL: '石1つを上端まで押し上げ、進路上の石を破壊',
        SUPER_GRAVITY_WILL: '石1つを下端まで落下させ、進路上の石を破壊',
        TELEPORT_WILL: '石1つをランダムな空きマスへ移動',
        CELL_TELEPORT_WILL: 'マスを1つ選び、盤面外側へランダムテレポートさせ、元マスを穴化。',
        TRAP_WILL: '自分石1つを罠化してターン終了。次の相手ターンに反転されると相手の布石を最大20奪う+手札全破壊。',
        TEMPT_WILL: '相手の特殊石を1つ選んで自分の色に変える。',
        CAPTURE_WILL: '相手の特殊石1つを捕獲して手札にする',
        DOUBLE_CHAIN_WILL: '反転後新たに挟める列ができた場合、1列追加反転する。使用後、三連鎖の意志が手札に加わる。',
        TRIPLE_CHAIN_WILL: '反転後新たに挟める列ができた場合、2列追加反転する。使用後、四連鎖の意志が手札に加わる。',
        QUAD_CHAIN_WILL: '反転後新たに挟める列ができた場合、3列追加反転する。使用後、無限連鎖の意志が手札に加わる。',
        INFINITE_CHAIN_WILL: '反転後新たに挟める列ができた場合、可能な限り追加反転する。',
        TABOO_REVERSE_WILL: '次に置く石は挟めなくても反転可能。最も反転枚数が多い列1方向のみ。',
        REGEN_WILL: '次に置く石は反転でも破壊でも最大3回復活し、挟める列があれば反転させる。',
        DESTROY_ONE_STONE: '盤面の石1つを破壊',
        TIME_BOMB: '自分石1つを時限爆弾化。3ターン後にそのマス+周囲1マスを爆破',
        TIME_STOP_GOD: '手札に入った時点で即時破壊され、通常プレイでは使用しない。',
        ULTIMATE_REVERSE_DRAGON: '空きマス自由配置可。置いた石が龍化し、配置時に周囲1マスを反転。自ターン開始時はランダムな空きマスへ移動してから周囲1マスを反転（5ターン）。',
        BREEDING_WILL: '次に置く石を繁殖化。配置時+自ターン開始時周囲に石を1個生成。(5ターン)',
        PROLIFERATION_WILL: '次に置く石を増殖石化。破壊時は周囲8マスの空きへ1個増殖。各増殖石は所有者ターン10回持続し、期限切れや反転で通常石に戻る',
        CLONE_WILL: '自分石1つを選び、周囲1マスの空きへ1個複製',
        SPLIT_WILL: '自分石1つを選び、周囲1マスへ分裂（残りターン半減）',
        SEED_WILL: '空きマス1つに種をまき、5回目の自ターン開始で通常石が芽生える',
        CROSS_BOMB: '次に置く石を起点に縦横2マスを爆破（通常反転後）',
        X_BOMB: '次に置く石を起点に斜め2マスを爆破（通常反転後）',
        HYPERACTIVE_WILL: '次に置く石を多動化。両者ターン開始時に1マス移動、反転回避を1回持つ。',
        HYPERACTIVE_INHERIT_WILL: '自分石1つに多動を継承。10ターン継続、反転対象時1回+破壊対象時1回回避',
        EXTREME_HYPERACTIVE_WILL: '次に置く石を極悪多動魔化。1マス移動後、隣接石を敵味方問わず1マス退避。反転回避3回+破壊回避1回',
        ESCAPE_WILL: '次に置く石を逃亡石化。毎ターン1マス逃げるように移動し、移動できるマスがなくなると爆発。反転回避を1回持つ。',
        ROBOT_VACUUM_WILL: '次に置く石は毎ターン1マス移動し、周囲の敵石を1個吸い込む。吸い込むと持続ターンが1増える。',
        GLUTTONOUS_WILL: '使用後に手札を全破壊し、次石を悪食石化。敵を食べながら進み、2連続で食べられないと消滅。反転保護を持つ特殊石。',
        WILL_HUNTER_KING: '次に置く石を意志狩り化。自ターン開始時、敵石を1つ破壊してそのマスへ移動する。敵の特殊石を優先して狙う。',
        INSTANT_HYPERACTIVE_WILL: '次に置く石を瞬間多動石化、3マス分移動し消滅。',
        BLOCKADE_WILL: '空きマス1つを3ターン封鎖（配置・移動不可）',
        METEOR_WILL: 'マス1つを石ごと破壊し、永続の穴にする',
        BOARD_SHRINK_WILL: '外周マス3つを穴にする（絶対保護石は残る）',
        BOARD_SHRINK_GOD: '角を含む辺1列を穴にする（絶対保護石は残る）',
        FREEZE_WILL: 'マス1つを5ターン凍結し、反転・破壊と持続減少を止める',
        REBUILD_WILL: '手札をすべて破壊し、新たに3枚ドローする',
        SUPPLY_WILL: '山札から2枚ドローする',
        PLUNDER_WILL: '次の反転枚数ぶん相手布石を吸収',
        CORNER_TRIBUTE: '相手角石が4個以上ある時、布石を最大20奪う',
        WORK_WILL: '次石をアンカー化し毎ターン布石を獲得',
        LOSS_WILL: '盤面上の特殊石をすべて通常石に戻す',
        DOUBLE_PLACE: '使用ターンだけ石を2連続で置ける。使用後、三連投石が手札に加わる。',
        TRIPLE_PLACE: '使用ターンだけ石を3連続で置ける。使用後、四連投石が手札に加わる。',
        QUAD_PLACE: '使用ターンだけ石を4連続で置ける。使用後、無限投石が手札に加わる。',
        INFINITE_PLACE: '使用ターンだけ合法手がなくなるまで石を連続で置ける。置けなくなった時点で終了する。',
        HEAVEN_BLESSING: '候補5枚から1枚を選んで獲得',
        REVEAL_HAND_WILL: '現在の相手手札をすべて表にする',
        CONDEMN_WILL: '相手手札を見て1枚破壊',
        GOLD_STONE: '次の反転布石を4倍',
        RAINBOW_STONE: '次の反転布石を6倍',
        SILVER_STONE: '次の反転布石を3倍',
        CRYSTAL_STONE: '次の数字マス布石を4倍',
        EXTEND_LIFE_WILL: '自分の特殊石1つの持続ターンを2倍にする',
        EXTEND_LIFE_GOD: '自分の特殊石1つの持続ターンを4倍にする',
        CORROSION_WILL: '盤面上の特殊石1つを選び、持続ターンを半減させる',
        GUARD_WILL: '自分石1つに3ターン完全保護',
        GUARDIAN_GOD: '自分石1つに10ターン完全保護',
        DESTROY_DRAGON_WILL: '次に置く石を破壊龍化。配置時+自ターン開始時に周囲1マスの敵石をランダム1個破壊（3ターン）',
        LIGHTNING_WILL: '次に置く石を落雷石化。配置時+自ターン開始時に盤面上の敵石をランダム1個破壊（5ターン）',
        ULTIMATE_DESTROY_GOD: '反転0でも空きマスに置ける。置いた石が究極破壊神化し、配置時に周囲1マスの敵石を破壊。自ターン開始時はランダムな空きマスへ移動してから周囲1マスの敵石を破壊（5ターン）',
        ULTIMATE_HYPERACTIVE_GOD: '次に置く石を究極多動神化。両者ターン開始時に直線1〜5マス移動を2回。反転回避3回+破壊回避1回（10ターン）',
        BOARD_EXPANSION_WILL: '盤面の左右どちらか外側に1マスを追加する',
        BOARD_EXPANSION_GOD: '初期8x8の角を選び、外側3マスを同時に盤面拡張',
        OBSERVER_WILL: '次に置く石を観測化し、毎ターン30%の確率で布石1〜5を獲得（5ターン）',
        LIVING_WILL: '自分石1つに生きる意志を付与。失われる時に1回だけ付与時点の石状態を初期値で復元',
        EQUALITY_WILL: '空きマスに3個石をランダム配置、石数が10個以上負けているときに使用可能。',
        REINFORCEMENT_WILL: '石に隣接する内側空きマスへランダム1マス通常石を配置する。(反転可能)',
        RIBO_WILL: '布石を30得る。その後9ターンの間4返済。足りない場合は自石2個を消滅させる。',
        SALVATION_WILL: '直前の相手ターンで破壊された全ての石を救済し、自分の通常石として空きマスにランダム配置。',
        FATE_WILL: '次の相手のターンを自分が操作できる。'
    });

    const detailCardEffectByType = Object.freeze({
        TREASURE_BOX: '獲得量は1〜3のランダム。\n使用直後に布石へ加算される。',
        PLACE_ON_EMPTY: '次の1手だけ有効。',
        FREE_PLACEMENT: '次の1手だけ有効。',
        LAST_RESORT: '相手より石数が少なく、通常の合法手がない（パスしかない）時だけ使える。\nこのターン、自由配置でちょうど3回置く。\n3回目の後に通常手は追加されない。',
        SHIELD_WILL: '有効なのは次の相手ターン中のみ。\nその後は通常の石として扱う。',
        PROTECTED_NEXT_STONE: '有効なのは次の相手ターン中のみ。\nその後は通常の石として扱う。',
        GHOST_WILL: '5ターン持続する特殊石。\n反転・石破壊の対象にはなるが、その石自身は受けない。\n交換の意志の対象外で、入替やテレポートなどは通常どおり受ける。',
        AFTERIMAGE_WILL: '次に置く石を残像石化する。\n残像石は反転回避3回と破壊回避3回を持つ特殊石。\n回避に成功した時だけ対応する回数を1消費する。\n片方だけ0になっても、もう片方が残る間は残像石のまま継続する。\n反転回避で移動先が無い場合は消滅し、破壊回避で空きマスが無い場合はそのまま破壊される。\n両方0になると特殊石状態を解除して通常石へ戻る。',
        SWAP_WITH_ENEMY: '相手の通常石1つを自分色に交換する。\n交換後、その位置を起点に挟める相手石を通常反転する。\nそのターンは石を置かず、そこで手番終了する。',
        POSITION_SWAP_WILL: '対象は通常石・特殊石・爆弾を問わない。',
        ANCHOR_WILL: '反転保護はターンをまたいで継続する。\n置いた石は相手ターンでも反転されない。',
        PERMA_PROTECT_NEXT_STONE: '昇格前は反転だけを防ぎ、交換・破壊・誘惑・意志の喪失までは防がない。\n所有者ターン開始10回で絶対保護石へ昇格する。',
        STRONG_WIND_WILL: '最も長く進める上下左右方向へ飛ばす（同距離はランダム）。',
        SUPER_BUOYANCY_WILL: '盤面上の石を1つ選び、上方向へ限界まで移動させる。\n移動経路にある石は衝突時にすべて破壊する。\n封鎖マス・穴マスには入れない。',
        SUPER_GRAVITY_WILL: '盤面上の石を1つ選び、下方向へ限界まで移動させる。\n移動経路にある石は衝突時にすべて破壊する。\n封鎖マス・穴マスには入れない。',
        TELEPORT_WILL: '対象は敵味方・通常石・特殊石・爆弾を問わない。',
        CELL_TELEPORT_WILL: '現在の盤面上に存在する石のあるマスを1つ選ぶ。\n選ばれた石を、盤面拡張・盤面拡張神で追加可能な外側マスのうち空いている1マスへランダムにテレポートさせる。\n移動先が未生成ならその拡張マスを作ってから移動し、元のマスは永続の穴になる。\n対象は敵味方・通常石・特殊石・爆弾を問わない。',
        TRAP_WILL: 'そのターンは石を置かない。\n次の相手ターン中に反転されると、相手の布石を最大20奪い相手手札を全破壊する。\n反転されなければ不発で終了する。',
        TEMPT_WILL: '対象は相手の特殊石のみ。\n残りターンなどの状態を維持したまま自分側になる。',
        CAPTURE_WILL: '盤面から取り除き、その特殊石の元になったカードとして自分の手札へ加える。\n完全保護が付いた相手特殊石は対象にできない。',
        DOUBLE_CHAIN_WILL: 'この手の通常反転を起点に、追加反転を1回行う。\n使用後、三連鎖の意志が手札に加わる。',
        TRIPLE_CHAIN_WILL: 'この手の通常反転を起点に、追加反転を2回行う。\n使用後、四連鎖の意志が手札に加わる。',
        QUAD_CHAIN_WILL: 'この手の通常反転を起点に、追加反転を3回行う。\n使用後、無限連鎖の意志が手札に加わる。',
        INFINITE_CHAIN_WILL: 'この手の通常反転を起点に、追加反転を可能な限り続ける。\n追加反転できなくなった時点で終了する。',
        TABOO_REVERSE_WILL: '同じ反転枚数の列が複数ある場合はランダムで1方向を選ぶ。\n禁忌反転ができないマスでは通常の挟み反転を行う。\n通常反転と禁忌反転の両方が可能なマスでは禁忌反転を優先する。',
        REGEN_WILL: '反転または破壊された瞬間に、復活可能回数を1回ぶん消費して元色へ戻る。\nこの復活は最大3回まで発動する。\n戻った位置から挟める列があれば追加で反転する。',
        DESTROY_ONE_STONE: '対象を1つ選んで即時に除去する。',
        TIME_BOMB: '3ターン後に「そのマス+周囲1マス（3x3）」を爆破。\n反転されると爆弾は解除される。',
        TIME_STOP_GOD: '通常プレイでは発動しない。\nデバッグ等で手札に残った場合のみ、5回目の所有者ターン開始時に時間停止し、そのターンと次のターンを連続で行動する。\n発動後は通常石に戻り、先に空マスになるか相手色になると不発。\n反転保護は持たない。',
        SNIPER_WILL: '配置したターン即時と、自ターン開始時に最も近い敵石を1つ破壊する。\n同距離の候補はランダムで選ばれる。',
        ULTIMATE_REVERSE_DRAGON: '反転が0でも空きマスに配置できる。\n配置時に周囲1マス（8方向）を反転する。\n自ターン開始時はランダムな空きマスへ移動してから周囲1マス（8方向）を反転する。\n移動先が無いときはその場で反転する。\n持続は5ターン。\n反転保護を持つ特殊石として扱う。',
        BREEDING_WILL: '生成先は周囲8マスの空きからランダム1個。\n前回生成石の周囲へ拡散し、5ターン継続。',
        PROLIFERATION_WILL: '所有者ターン開始時だけ残りターンが減る。\n破壊される時は周囲8マスの空きからランダム1マスへ同色の増殖石を1個生成し、空きが無い場合だけ通常どおり破壊される。\n増殖で生まれた石は親の残りターンを引き継がず、それぞれ10ターンから数える。\n10ターン後や反転時は通常石に戻る。',
        CLONE_WILL: '生成では反転せず、特殊石は残り持続ターンを引き継ぐ。',
        SPLIT_WILL: '生成では反転せず、特殊石の残り持続ターンは元石・生成石とも半減する（小数切り捨て、最小1）。',
        CROSS_BOMB: '中心マスを含む十字範囲を爆破する。',
        X_BOMB: '中心マスを含むX字範囲を爆破する。',
        HYPERACTIVE_WILL: '移動先は周囲の空きマスから選ばれる。\n移動後に挟める列があれば反転する。\n反転対象になった時は1回だけマス移動で回避する。',
        HYPERACTIVE_INHERIT_WILL: '対象は通常石・特殊石を問わない。\n移動後に挟める列があれば反転する。\n破壊対象時も1回だけ空きマスへ移動して回避する。',
        EXTREME_HYPERACTIVE_WILL: '両者ターン開始時に周囲8マス（空き・占有）からランダム1マス移動する。\n占有マスを選んだ場合は、その石を1マス退避させてから進入し、退避先が無い場合はその石と位置交換して進入する。\n退避も位置交換もできる候補が無い場合は消滅する。\n移動後に挟める列があれば反転する。\n移動後、隣接1マス（周囲8マス）の石を敵味方問わず遠ざかるように1マス退避させる。\n退避先が無い石はその場に残る。\n反転対象時はマス移動で回避し、最大3回まで。\nターン制限はない。',
        ESCAPE_WILL: '毎ターン1マス逃げるように移動する。\n反転対象時は1回回避する。\n移動できるマスがなくなると爆発する。',
        INSTANT_HYPERACTIVE_WILL: '配置直後にランダム1マス移動を3回行う。\n各移動後に挟める列があれば反転し、最後に消滅する。',
        ROBOT_VACUUM_WILL: '移動先は周囲8マスの空きから敵石に近づく候補を優先して1マス選ぶ（同優先度はランダム）。\n空きが無い場合はその場で消滅する。\n吸い込み後も反転は発生しない。\n吸い込み成功ごとに持続ターン+1（基本5ターン、所有者ターン開始時のみ減算）。\n守る意志の完全保護中の石は吸い込めない。',
        GLUTTONOUS_WILL: '隣接敵石があれば優先してそのマスへ進入し、同時に捕食する。\n隣接敵石が無い場合は敵石へ近づくように移動する。\n2連続で捕食できないと飢えて消滅する。',
        WILL_HUNTER_KING: '次に置く石を意志狩りの王石化する。\n自ターン開始時、敵石を1つ選んでそのマスへ移動しながら破壊する。\n敵の特殊石があればそちらを優先して狙う。\n8ターン持続。\n反転回避2回と破壊回避2回を持つ特殊石として扱う。',
        BLOCKADE_WILL: '封鎖したマスには両者とも配置・移動で入れない。\n3ターン経過で解除される。',
        SEED_WILL: '種マスは通常どおり配置・移動に使える。\n石が置かれた時点で種は消える。\n所有者ターン開始時だけ残り回数が減る。\n封鎖の意志・凍結の意志では種マスを選べない。',
        METEOR_WILL: '穴は永続し、誰も配置できず反転経路も遮断する。\n完全保護中の石があっても穴にできる。',
        BOARD_SHRINK_WILL: '現在の盤面外周から3マスを順に選ぶ。\n選んだ3マスを石ごと穴にする。\n絶対保護石のあるマスだけは穴にならず残る。\n盤面拡張マスも対象に含まれる。',
        BOARD_SHRINK_GOD: '現在の盤面形状の角を1つ選び、続けてその角から伸ばす辺方向を選ぶ。\n選んだ辺1列をまとめて穴にする。\n絶対保護石のあるマスだけは穴にならず残る。\n盤面拡張マスも対象に含まれる。',
        FREEZE_WILL: '凍結マスと、そのマス上の石は反転・破壊されない。\n凍結中の特殊石は持続ターンが減らず、解除後に再び減り始める。',
        REBUILD_WILL: '使用カード以外の手札をすべて先に破壊してから引き直す。\n山札が足りない場合は引ける枚数だけ補充する。',
        SUPPLY_WILL: '手札上限5枚や山札不足時は引ける分のみ。\n選択不要の即時効果。',
        PLUNDER_WILL: '相手から減らしたぶんをそのまま自分へ加算する。',
        CORNER_TRIBUTE: '相手が現在の盤面形状の角に4個以上石を置いている時だけ使える。\n使用時に相手の布石を最大20奪って自分へ加算する。\n角には盤面拡張で増えた角と、隕石で角マスが穴になった結果できる疑似角も含む。',
        WORK_WILL: function resolveWorkLine(resolveChargeMaxText) {
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
        CONDEMN_WILL: '公開された手札から1枚を選んで破壊する。',
        GOLD_STONE: '使用後その石は消滅する。',
        RAINBOW_STONE: '使用後その石は消滅する。',
        SILVER_STONE: '使用後その石は消滅する。',
        CRYSTAL_STONE: '使用後その石は消滅する。',
        EXTEND_LIFE_WILL: '対象は盤面上の自分の特殊石のみ。\n現在の持続ターン値を2倍に延長する。',
        EXTEND_LIFE_GOD: '対象は盤面上の自分の特殊石のみ。\n現在の持続ターン値を4倍に延長する。',
        CORROSION_WILL: '選んだ特殊石の残り持続ターンを半減する。\n小数は切り捨て、最小値は1。\n対象がない場合は使用できない。',
        GUARD_WILL: '完全保護中は反転・交換・破壊・誘惑を受けない。\n3ターン持続。',
        GUARDIAN_GOD: '完全保護中は反転・交換・破壊・誘惑を受けない。\n10ターン持続。',
        DESTROY_DRAGON_WILL: '持続は3ターン。\n反転保護を持つ特殊石として扱う。',
        LIGHTNING_WILL: '配置ターン即時も発動回数に含まれるが、その時点では持続ターンは減らない。\n反転保護を持つ特殊石として扱う。',
        ULTIMATE_DESTROY_GOD: '移動先が無いときはその場で破壊する。',
        ULTIMATE_HYPERACTIVE_GOD: '両者ターン開始時に直線1〜5マス移動を2回行い、2マス以上は途中の石を飛び越える。\n移動後に挟めば反転し、反転対象時はマス移動で回避する（最大3回）。\n破壊対象時も1回だけマス移動で回避する。移動先が無いと消滅する。10ターン後は同色の通常石に戻る。',
        BOARD_EXPANSION_WILL: '追加位置は左右端マスから選び、1対局で1回のみ使える。',
        BOARD_EXPANSION_GOD: '3マスのうち1つでも既存拡張セルと重なる角は選べない。',
        OBSERVER_WILL: '所有者ターンの開始時に判定を行い、成功（確率30%）するとランダムで1〜5の布石を得る。\n持続は5ターン。',
        LIVING_WILL: '対象は通常石・特殊石を問わない。\n失われる時に1回だけ付与時点の石状態を初期値で復元する。\n後から追加された別効果は復元しない。\n元マスが使えない時は別の空きマスへ復活し、空きが無い時は復活しない。\n捕獲の意志は無効化してその場に残る。',
        EQUALITY_WILL: '相手の石数が自分より10個以上多い時のみ使用できる。\n使用時、盤面の空きマスからランダムに最大3マスへ、自分色の通常石を1個ずつ生成する。\n各生成石は、そのマスを起点に通常の挟み反転を行う。\n空きマスが3未満なら、存在する空きマス数ぶんだけ生成する。',
        REINFORCEMENT_WILL: '使用時、盤面の角と辺を除く空きマスのうち、いずれかの石に隣接1マス（周囲8マス）で接している候補だけを集める。\n候補からランダム1マスを選び、自分色の通常石を1個配置する。\n候補条件に通常反転の可否は含めず、配置後は通常配置と同じ反転処理を行う。\n候補が無い局面では使用できない。',
        RIBO_WILL: '使用時に布石を30得る。\nその後9回の自ターン開始ごとに4布石を返済する。\n返済に必要な布石が足りない場合は、自石をランダム2個消滅させる。',
        LOSS_WILL: '完全保護中の石は対象外。\n爆弾も解除対象に含まれる。\n特殊石も爆弾も無い局面では使用できない。',
        SALVATION_WILL: '直前の相手ターンで破壊された全ての石を自分の通常石としてランダムな空きマスへ配置する。\n対象0枚の時は使用不可。\n対象は自分・相手、通常石・特殊石を問わない。\n各復活石は、そのマスを起点に通常の挟み反転を行う。',
        FATE_WILL: '次の相手ターン1回だけ操作権を得る。\n相手の手札を見て、カード使用や石配置まで行える。\n配置可能マスが無ければ通常のパスとして終了する。\n発動中に再び使っても重ならず、その回の制御だけで終わる。',
    });

    const cardEffectTagsByType = Object.freeze({
        PROTECTED_NEXT_STONE: freezeCardEffectTags([flipProtectionTag()]),
        ANCHOR_WILL: freezeCardEffectTags([flipProtectionTag()]),
        SNIPER_WILL: freezeCardEffectTags([durationTurnsTag(5)]),
        GHOST_WILL: freezeCardEffectTags([durationTurnsTag(5)]),
        AFTERIMAGE_WILL: freezeCardEffectTags([flipEvasionTag(3), destroyEvasionTag(3)]),
        PERMA_PROTECT_NEXT_STONE: freezeCardEffectTags([flipProtectionTag(), delayedActivationTurnsTag(10)]),
        TIME_BOMB: freezeCardEffectTags([delayedActivationTurnsTag(3)]),
        TIME_STOP_GOD: freezeCardEffectTags([delayedActivationTurnsTag(5)]),
        ULTIMATE_REVERSE_DRAGON: freezeCardEffectTags([flipProtectionTag(), durationTurnsTag(5)]),
        BREEDING_WILL: freezeCardEffectTags([flipProtectionTag(), durationTurnsTag(5)]),
        PROLIFERATION_WILL: freezeCardEffectTags([durationTurnsTag(10)]),
        SEED_WILL: freezeCardEffectTags([delayedActivationTurnsTag(5)]),
        HYPERACTIVE_WILL: freezeCardEffectTags([flipEvasionTag(1)]),
        ESCAPE_WILL: freezeCardEffectTags([flipEvasionTag(1)]),
        ROBOT_VACUUM_WILL: freezeCardEffectTags([durationTurnsTag(5)]),
        GLUTTONOUS_WILL: freezeCardEffectTags([flipProtectionTag()]),
        WILL_HUNTER_KING: freezeCardEffectTags([flipEvasionTag(2), destroyEvasionTag(2), durationTurnsTag(8)]),
        HYPERACTIVE_INHERIT_WILL: freezeCardEffectTags([flipEvasionTag(1), destroyEvasionTag(1), durationTurnsTag(10)]),
        EXTREME_HYPERACTIVE_WILL: freezeCardEffectTags([flipEvasionTag(3), destroyEvasionTag(1)]),
        WORK_WILL: freezeCardEffectTags([durationTurnsTag(5)]),
        GUARD_WILL: freezeCardEffectTags([fullProtectionTag(), durationTurnsTag(3)]),
        GUARDIAN_GOD: freezeCardEffectTags([fullProtectionTag(), durationTurnsTag(10)]),
        ULTIMATE_DESTROY_GOD: freezeCardEffectTags([flipProtectionTag(), durationTurnsTag(5)]),
        DESTROY_DRAGON_WILL: freezeCardEffectTags([flipProtectionTag(), durationTurnsTag(3)]),
        LIGHTNING_WILL: freezeCardEffectTags([flipProtectionTag(), durationTurnsTag(5)]),
        ULTIMATE_HYPERACTIVE_GOD: freezeCardEffectTags([flipEvasionTag(3), destroyEvasionTag(1), durationTurnsTag(10)]),
        BLOCKADE_WILL: freezeCardEffectTags([durationTurnsTag(3)]),
        FREEZE_WILL: freezeCardEffectTags([durationTurnsTag(5)]),
        OBSERVER_WILL: freezeCardEffectTags([durationTurnsTag(5)])
    });

    const cardNumericTagsByType = Object.freeze(Object.fromEntries(
        Object.entries(cardEffectTagsByType)
            .map(([cardType, tags]) => [
                cardType,
                freezeCardEffectTags((Array.isArray(tags) ? tags : []).filter((tag) => tag && isCardNumericTagKind(tag.kind)))
            ])
            .filter(([, tags]) => Array.isArray(tags) && tags.length > 0)
    ));

    function cloneCardEffectTag(tag) {
        if (!tag || typeof tag !== 'object') return null;
        const cloned = {
            kind: tag.kind,
            label: tag.label
        };
        if (Number.isFinite(Number(tag.value))) cloned.value = Number(tag.value);
        return cloned;
    }

    function resolveCardEffectTags(cardDef) {
        const cardType = cardDef && cardDef.type ? String(cardDef.type) : '';
        if (!cardType) return [];
        const mappedTags = cardEffectTagsByType[cardType];
        if (!Array.isArray(mappedTags) || mappedTags.length === 0) return [];
        return mappedTags.map(cloneCardEffectTag).filter(Boolean);
    }

    function resolveCardNumericTags(cardDef) {
        return resolveCardEffectTags(cardDef).filter((tag) => isCardNumericTagKind(tag.kind));
    }

    function normalizeCardDescText(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .replace(/。+/g, '。')
            .trim();
    }

    function splitCardDescSentences(text) {
        const lines = String(text || '')
            .replace(/\r\n?/g, '\n')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
        const sentences = [];
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

    function buildCardDescComparisonKey(text) {
        return normalizeCardDescText(text)
            .replace(/[\s\u3000]/g, '')
            .replace(/[。\.、,，:：;；!！?？'"“”‘’\-ー／/（）()\[\]{}「」『』【】<>《》・]/g, '')
            .toLowerCase();
    }

    function isCardDescPlaceholderText(text) {
        const key = buildCardDescComparisonKey(text);
        if (!key) return true;
        return key === buildCardDescComparisonKey('効果説明は準備中')
            || key === buildCardDescComparisonKey('詳細説明は準備中')
            || key === buildCardDescComparisonKey('効果説明が未登録です');
    }

    function fallbackQuickCardEffect(cardDef, options) {
        const normalized = normalizeCardDescText(cardDef && cardDef.desc ? cardDef.desc : '');
        if (!normalized) return '効果説明は準備中';
        const configuredMaxLength = Number(options && options.maxLength);
        const maxLength = Number.isFinite(configuredMaxLength) && configuredMaxLength > 0
            ? configuredMaxLength
            : 32;
        const firstSentence = normalized.split('。').map((s) => s.trim()).filter(Boolean)[0] || normalized;
        return firstSentence.length > maxLength ? `${firstSentence.slice(0, maxLength)}...` : firstSentence;
    }

    function fallbackDetailCardEffect(cardDef) {
        const normalized = normalizeCardDescText(cardDef && cardDef.desc ? cardDef.desc : '');
        if (!normalized) return '詳細説明は準備中';
        return normalized.replace(/。/g, '。\n').trim();
    }

    function resolveNonDuplicateDetailText(quickText, detailText) {
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

        const keepSentences = [];
        const seenSentenceKeys = new Set();
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

    function getQuickCardEffect(cardDef, options) {
        if (!cardDef) return 'カードを選択してください';
        if (cardDef.type && quickCardEffectByType[cardDef.type]) return quickCardEffectByType[cardDef.type];
        return fallbackQuickCardEffect(cardDef, options);
    }

    function getDetailCardEffect(cardDef, resolveChargeMaxText) {
        if (!cardDef) return '';
        const mapped = cardDef.type ? detailCardEffectByType[cardDef.type] : null;
        if (typeof mapped === 'function') return mapped(resolveChargeMaxText);
        if (typeof mapped === 'string') return mapped;
        return fallbackDetailCardEffect(cardDef);
    }

    function resolveCardDescriptionTexts(cardDef, options) {
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
