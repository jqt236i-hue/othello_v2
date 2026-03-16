/**
 * @file card-interaction-effects.js
 * @description Card detail/quick description dictionaries and resolvers (UMD)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CardInteractionEffects = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    const quickCardEffectByType = Object.freeze({
        TREASURE_BOX: '布石を1〜3獲得',
        PLACE_ON_EMPTY: '反転0でも空きマスに置ける',
        FREE_PLACEMENT: '反転0でも空きマスに置ける',
        LAST_RESORT: '合法手0の時だけ、自由配置で2回置ける',
        SNIPER_WILL: '空きマスに自由配置し、最も近い敵石を配置時+毎ターン1つ破壊（5ターン）',
        SHIELD_WILL: '次に置く石を1ターン保護',
        PROTECTED_NEXT_STONE: '次に置く石は次の相手ターン中だけ反転されない',
        SWAP_WITH_ENEMY: '相手通常石1つを交換し、反転してターン終了',
        POSITION_SWAP_WILL: '盤面の石2つを入れ替える',
        SACRIFICE_WILL: '自分石を壊して布石+5（最大3個）',
        ANCHOR_WILL: '次に置く石を完全固定',
        PERMA_PROTECT_NEXT_STONE: '次に置く石は以後ずっと反転されない',
        STRONG_WIND_WILL: '石1つを飛ばし、最長方向へ移動させる',
        SUPER_BUOYANCY_WILL: '石1つを上端まで押し上げ、進路上の石を破壊',
        SUPER_GRAVITY_WILL: '石1つを下端まで落下させ、進路上の石を破壊',
        TELEPORT_WILL: '石1つをランダムな空きマスへ移動',
        CELL_TELEPORT_WILL: '石1つを外側拡張マスへ移動し、元マスを穴化',
        TRAP_WILL: '自分石1つを罠化してターン終了。次の相手ターンに反転されると相手の布石を最大20奪う+手札全破壊。',
        TEMPT_WILL: '相手の特殊石1つを自分色にする',
        CHAIN_WILL: 'この手の反転後に追加反転を最大2回',
        TABOO_REVERSE_WILL: '次に置く石は挟めなくても反転可能。最も反転枚数が多い列1方向のみ。',
        REGEN_WILL: '次に置く石は反転されると3回まで復活して挟める列があれば反転させる。',
        DESTROY_ONE_STONE: '盤面の石1つを破壊',
        TIME_BOMB: '自分石1つを時限爆弾化。3ターン後にそのマス+周囲1マスを爆破',
        ULTIMATE_REVERSE_DRAGON: '反転0でも空きマスに置ける。置いた石が龍化し、配置時+自ターン開始時に周囲1マスを反転（5ターン）。反転保護を持つ特殊石。',
        BREEDING_WILL: '次に置く石を繁殖化。配置時+自ターン開始時に周囲へ1個生成',
        CLONE_WILL: '自分石1つを選び、周囲1マスの空きへ1個複製',
        SPLIT_WILL: '自分石1つを選び、周囲1マスへ分裂（残りターン半減）',
        CROSS_BOMB: '次に置く石を起点に縦横2マスを爆破（通常反転後）',
        X_BOMB: '次に置く石を起点に斜め2マスを爆破（通常反転後）',
        HYPERACTIVE_WILL: '次に置く石を多動化。両者ターン開始時に1マス移動、反転対象時は1回回避',
        HYPERACTIVE_INHERIT_WILL: '自分石1つに多動を継承。10ターン継続、反転対象時は1回回避',
        EXTREME_HYPERACTIVE_WILL: '次に置く石を極悪多動魔化。1マス移動後、隣接石を敵味方問わず1マス退避',
        ESCAPE_WILL: '次に置く石を逃亡石化。毎ターン1マス逃げるように移動し、反転対象時は1回回避。移動できるマスがなくなると爆発。',
        ROBOT_VACUUM_WILL: '次に置く石は毎ターン1マス移動し、周囲の敵石を1個吸い込む。',
        GLUTTONOUS_WILL: '使用後に手札を全破壊し、次石を悪食石化。敵を食べながら進み、2連続で食べられないと消滅。反転保護を持つ特殊石。',
        INSTANT_HYPERACTIVE_WILL: '次に置く石を瞬間多動石化、3マス分移動し消滅。',
        BLOCKADE_WILL: '空きマス1つを3ターン封鎖（配置・移動不可）',
        METEOR_WILL: 'マス1つを石ごと破壊し、永続の穴にする',
        FREEZE_WILL: 'マス1つを5ターン凍結し、反転・破壊と持続減少を止める',
        SELL_CARD_WILL: '手札1枚を売って布石に変換',
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
        CONDEMN_WILL: '相手手札を見て1枚破壊',
        GOLD_STONE: '次の反転布石を4倍',
        RAINBOW_STONE: '次の反転布石を6倍',
        SILVER_STONE: '次の反転布石を3倍',
        CRYSTAL_STONE: '次の数字マス布石を4倍',
        EXTEND_LIFE_WILL: '自分の特殊石1つの持続ターンを2倍にする',
        CORROSION_WILL: '盤面上の特殊石1つを選び、持続ターンを半減させる',
        GUARD_WILL: '自分石1つに3ターン完全保護',
        GUARDIAN_GOD: '自分石1つに10ターン完全保護',
        DESTROY_DRAGON_WILL: '次に置く石を破壊龍化。配置時+自ターン開始時に周囲1マスの敵石をランダム1個破壊（3ターン）',
        LIGHTNING_WILL: '次に置く石を落雷石化。配置時+自ターン開始時に盤面上の敵石をランダム1個破壊（5ターン）',
        ULTIMATE_DESTROY_GOD: '反転0でも空きマスに置ける。置いた石が究極破壊神化し、配置時+自ターン開始時に周囲1マスの敵石を破壊（5ターン）',
        ULTIMATE_HYPERACTIVE_GOD: '次に置く石を究極多動神化。両者ターン開始時に直線1〜5マス移動を2回（10ターン）',
        BOARD_EXPANSION_WILL: '盤面の左右どちらか外側に1マスを追加する',
        BOARD_EXPANSION_GOD: '初期8x8の角を選び、外側3マスを同時に盤面拡張',
        OBSERVER_WILL: '次に置く石を観測化し、毎ターン30%の確率で布石1〜5を獲得（5ターン）'
    });

    const detailCardEffectByType = Object.freeze({
        TREASURE_BOX: '獲得量は1〜3のランダム。\n使用直後に布石へ加算される。',
        PLACE_ON_EMPTY: '次の1手だけ有効。\n反転が0でも空きマスに配置できる。',
        FREE_PLACEMENT: '次の1手だけ有効。\n反転が0でも空きマスに配置できる。',
        LAST_RESORT: '通常の合法手がない（パスしかない）時だけ使える。\nこのターン、自由配置でちょうど2回置く。\n2回目の後に通常手は追加されない。',
        SHIELD_WILL: '有効なのは次の相手ターン中のみ。\nその後は通常の石として扱われる。',
        PROTECTED_NEXT_STONE: '有効なのは次の相手ターン中のみ。\nその後は通常の石として扱われる。',
        SWAP_WITH_ENEMY: '相手の通常石1つを自分色に交換する。\n交換後、その位置を起点に挟める相手石を通常反転する。\nそのターンは石を置かず、そこで手番終了する。',
        POSITION_SWAP_WILL: '盤面上の石2つを選び、位置を入れ替える。\n通常石・特殊石・爆弾を含む全種類が対象。',
        SACRIFICE_WILL: '自分石を最大3個まで破壊できる。\n破壊1個ごとに布石+5。',
        ANCHOR_WILL: '反転保護はターンをまたいで継続する。\n置いた石は相手ターンでも反転されない。',
        PERMA_PROTECT_NEXT_STONE: '反転保護はターンをまたいで継続する。\n置いた石は相手ターンでも反転されない。',
        STRONG_WIND_WILL: '最も長く進める上下左右方向へ飛ばす（同距離はランダム）。',
        SUPER_BUOYANCY_WILL: '盤面上の石を1つ選び、上方向へ限界まで移動させる。\n移動経路にある石は衝突時にすべて破壊する。\n封鎖マス・穴マスには入れない。',
        SUPER_GRAVITY_WILL: '盤面上の石を1つ選び、下方向へ限界まで移動させる。\n移動経路にある石は衝突時にすべて破壊する。\n封鎖マス・穴マスには入れない。',
        TELEPORT_WILL: '盤面上の石を1つ選ぶ。\n選ばれた石を、盤面内の空きマスへランダムに1つテレポートさせる。\n対象は敵味方・通常石・特殊石・爆弾を問わない。',
        CELL_TELEPORT_WILL: '現在の盤面上に存在する石のあるマスを1つ選ぶ。\n選ばれた石を、盤面拡張・盤面拡張神で追加可能な外側マスのうち空いている1マスへランダムにテレポートさせる。\n移動先が未生成ならその拡張マスを作ってから移動し、元のマスは永続の穴になる。\n対象は敵味方・通常石・特殊石・爆弾を問わない。',
        TRAP_WILL: '自分石1つを罠化した時点で手番終了。\nそのターンは石を置かない。\n次の相手ターン中に反転されると、相手の布石を最大20奪い相手手札を全破壊する。\n反転されなければ不発で終了。',
        TEMPT_WILL: '対象は相手の特殊石のみ。\n残りターンなどの状態を維持したまま自分側になる。',
        CHAIN_WILL: 'この手の通常反転を起点に、追加反転を最大2回行う。',
        TABOO_REVERSE_WILL: '同じ反転枚数の列が複数ある場合はランダムで1方向を選ぶ。\n禁忌反転ができないマスでは通常の挟み反転を行う。\n通常反転と禁忌反転の両方が可能なマスでは禁忌反転を優先する。',
        REGEN_WILL: '反転された瞬間に元色へ戻る。\nこの再生は最大3回まで発動する。\n戻った位置から挟める列があれば追加で反転する。',
        DESTROY_ONE_STONE: '対象を1つ選んで即時に除去する。',
        TIME_BOMB: '3ターン後に「そのマス+周囲1マス（3x3）」を爆破。\n反転されると爆弾は解除される。',
        SNIPER_WILL: '次に置く石は反転がなくても空きマスに配置できる。\n配置したターン即時と、自ターン開始時に最も近い敵石を1つ選んで破壊する。\n同距離の候補はランダムで選ばれる。\n持続は5ターン。',
        ULTIMATE_REVERSE_DRAGON: '反転が0でも空きマスに配置できる。\n配置時と自ターン開始時に周囲1マス（8方向）を反転する。\n持続は5ターン。\n反転保護を持つ特殊石として扱う。',
        BREEDING_WILL: '生成先は周囲8マスの空きからランダム1個。\n前回生成石の周囲へ拡散し、3ターン継続。',
        CLONE_WILL: '盤面上の自分の石を1つ選択。\n周囲8マスの空きからランダム1マスへ同じ石を複製する。\n生成では反転せず、特殊石は残り持続ターンを引き継ぐ。',
        SPLIT_WILL: '盤面上の自分の石を1つ選択。\n周囲8マスの空きからランダム1マスへ同じ石を分裂生成する。\n生成では反転せず、特殊石の残り持続ターンは元石・生成石とも半減する（小数切り捨て、最小1）。',
        CROSS_BOMB: '次に置く石を十字爆弾化。\n通常反転後、その石を起点に縦横2マス（中心含む十字）を爆破。',
        X_BOMB: '次に置く石をクロス爆弾化。\n通常反転後、その石を起点に斜め2マス（中心含むX字）を爆破。',
        HYPERACTIVE_WILL: '移動先は周囲の空きマスから選ばれる。\n移動後に挟める列があれば反転する。\n反転対象になった時は1回だけマス移動で回避する。',
        HYPERACTIVE_INHERIT_WILL: '盤面上の自分の石1つ（通常石・特殊石）を選び、多動状態を付与する。\n移動仕様は通常の多動と同じで、移動後に挟める列があれば反転する。\n反転対象になった時は1回だけマス移動で回避する。\n持続は10ターン（所有者ターン開始時のみ減算）。',
        EXTREME_HYPERACTIVE_WILL: '両者ターン開始時に周囲8マス（空き・占有）からランダム1マス移動する。\n占有マスを選んだ場合は、その石を1マス退避させてから進入する。\n移動後に挟める列があれば反転する。\n移動後、隣接1マス（周囲8マス）の石を敵味方問わず遠ざかるように1マス退避させる。\n退避先が無い石はその場に残る。\n反転対象時はマス移動で回避し、最大3回まで。\nターン制限はない。',
        ESCAPE_WILL: '毎ターン1マス逃げるように移動する。\n反転対象時は1回回避する。\n移動できるマスがなくなると爆発する。',
        INSTANT_HYPERACTIVE_WILL: '配置直後にランダム1マス移動を3回行う。\n各移動後に挟める列があれば反転し、最後に消滅する。',
        ROBOT_VACUUM_WILL: '移動先は周囲8マスの空きから敵石に近づく候補を優先して1マス選ぶ（同優先度はランダム）。\n空きが無い場合はその場で消滅する。\n吸い込み後も反転は発生しない。\n吸い込み成功ごとに持続ターン+1（基本5ターン、所有者ターン開始時のみ減算）。\n守る意志の完全保護中の石は吸い込めない。',
        GLUTTONOUS_WILL: '使用時に、使用カード以外の自分手札をすべて破壊する。\n次に置く石を悪食石化する。\n悪食石は両者ターン開始時に1マス移動し、隣接敵石があれば優先してそのマスへ進入し同時に捕食する。\n隣接敵石が無い場合は敵石へ近づくように移動し、捕食失敗カウントを増やす。\n捕食に成功したターンはカウントを0に戻し、2連続で捕食失敗すると飢えて消滅する。\n反転保護を持つ特殊石として扱う。',
        WILL_HUNTER_KING: '次に置く石を意志狩りの王石化する。\n自ターン開始時、敵石を1つ選んでそのマスへ移動しながら破壊する。\n敵の特殊石があればそちらを優先して狙う。\n8ターン持続。\n反転回避2回と破壊回避2回を持つ特殊石として扱う。',
        BLOCKADE_WILL: '封鎖したマスには両者とも配置・移動で入れない。\n3ターン経過で解除される。',
        METEOR_WILL: '盤面上のマスを1つ選び、石ごとマスを破壊して穴にする。\n穴は永続し、誰も配置できず反転経路も遮断する。\n守る意志・守護神の完全保護も貫通する。',
        FREEZE_WILL: '盤面上のマスを1つ選び、5ターン凍結する。\n凍結マスと、そのマス上の石は反転・破壊されない。\n凍結中の特殊石は持続ターンが減らず、解除後に再び減り始める。\nUIではICE画像を半透明で重ねて表示する。',
        SELL_CARD_WILL: '売却対象は手札から1枚選ぶ。\n得る布石は売却カードのコスト値。',
        SUPPLY_WILL: '使用時に山札から2枚ドローを試行する。\n手札上限5枚や山札不足時は引ける分のみ。\n選択不要の即時効果。',
        PLUNDER_WILL: '次の配置で反転した枚数ぶん、相手から減らして自分へ加算する。',
        CORNER_TRIBUTE: '相手が現在の盤面形状の角に4個以上石を置いている時だけ使える。\n使用時に相手の布石を最大20奪って自分へ加算する。\n角には盤面拡張で増えた角と、隕石で角マスが穴になった結果できる疑似角も含む。',
        WORK_WILL: function resolveWorkLine(resolveChargeMaxText) {
            const chargeMaxText = (typeof resolveChargeMaxText === 'function')
                ? String(resolveChargeMaxText() || '99')
                : '99';
            return `ターン開始ごとの獲得量は1→2→4→8→16で増加。\n布石上限は${chargeMaxText}。`;
        },
        DOUBLE_PLACE: '使用ターンだけ石を2連続で置ける。\n1手目の後にターン切替は発生しない。\n使用後、三連投石が手札に加わる。',
        TRIPLE_PLACE: '使用ターンだけ石を3連続で置ける。\n1手目と2手目の後にターン切替は発生しない。\n使用後、四連投石が手札に加わる。',
        QUAD_PLACE: '使用ターンだけ石を4連続で置ける。\n1手目から3手目までの途中でターン切替は発生しない。\n使用後、無限投石が手札に加わる。',
        INFINITE_PLACE: '使用ターンだけ合法手がある限り石を連続で置ける。\n合法手がなくなった時点でそのまま終了する。',
        HEAVEN_BLESSING: '表示された候補5枚から1枚だけ選んで獲得する。\n選ばなかった候補は消える。',
        CONDEMN_WILL: '相手手札を公開し、選んだ1枚を破壊。',
        GOLD_STONE: '次の反転で得る布石を4倍。\n使用後その石は消滅。',
        RAINBOW_STONE: '次の反転で得る布石を6倍。\n使用後その石は消滅。',
        SILVER_STONE: '次の反転で得る布石を3倍。\n使用後その石は消滅。',
        CRYSTAL_STONE: '次の数字マスで得る布石を4倍。\n使用後その石は消滅。',
        EXTEND_LIFE_WILL: '対象は盤面上の自分の特殊石のみ。\n現在の持続ターン値を2倍に延長する。',
        CORROSION_WILL: '盤面上の特殊石を1つ選んで発動する。\n選んだ特殊石の持続ターン値（remainingOwnerTurns）を半減する。\n小数は切り捨て、最小値は1。\n対象がない場合は使用できない。',
        GUARD_WILL: '完全保護中は反転・交換・破壊・誘惑を受けない。\n3ターン持続。',
        GUARDIAN_GOD: '完全保護中は反転・交換・破壊・誘惑を受けない。\n10ターン持続。',
        DESTROY_DRAGON_WILL: '配置時と自ターン開始時に周囲1マス（8方向）の敵石をランダムで1個だけ破壊する。\n持続3ターン（所有者ターン開始で減算）。\n反転保護を持つ特殊石として扱う。',
        LIGHTNING_WILL: '配置時と自ターン開始時に盤面上の敵石をランダムで1個だけ破壊する。\n持続5ターン（所有者ターン開始で減算、配置ターン即時発動では減算しない）。\n反転保護を持つ特殊石として扱う。',
        ULTIMATE_DESTROY_GOD: '反転が0でも空きマスに配置できる。\n配置時と自ターン開始時に周囲1マス（8方向）の敵石を破壊する。\n持続は5ターン。',
        ULTIMATE_HYPERACTIVE_GOD: '両者ターン開始時に直線1〜5マス移動を2回行い、2マス以上は途中の石を飛び越える。\n移動後に挟めば反転し、反転対象時はマス移動で回避する（最大3回）。\n移動先が無いと消滅する。10ターン後は自己消滅する。',
        BOARD_EXPANSION_WILL: '左右どちらか外側に1マスだけ盤面を拡張する。\n追加位置は左右端マスから選び、1対局で1回のみ使える。',
        BOARD_EXPANSION_GOD: '初期8x8の角マスを1つ選び、その外側3マス（直交2方向+斜め）に拡張セルを同時追加する。\n3マスのうち1つでも既存拡張セルと重なる角は選べない。',
        OBSERVER_WILL: '所有者ターンの開始時に判定を行い、成功（確率30%）するとランダムで1〜5の布石を得る。\n持続は5ターン。'
    });

    function normalizeCardDescText(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .replace(/。+/g, '。')
            .trim();
    }

    function fallbackQuickCardEffect(cardDef) {
        const normalized = normalizeCardDescText(cardDef && cardDef.desc ? cardDef.desc : '');
        if (!normalized) return '効果説明は準備中';
        const firstSentence = normalized.split('。').map((s) => s.trim()).filter(Boolean)[0] || normalized;
        return firstSentence.length > 32 ? `${firstSentence.slice(0, 32)}...` : firstSentence;
    }

    function fallbackDetailCardEffect(cardDef) {
        const normalized = normalizeCardDescText(cardDef && cardDef.desc ? cardDef.desc : '');
        if (!normalized) return '詳細説明は準備中';
        return normalized.replace(/。/g, '。\n').trim();
    }

    function getQuickCardEffect(cardDef) {
        if (!cardDef) return 'カードを選択してください';
        if (cardDef.type && quickCardEffectByType[cardDef.type]) return quickCardEffectByType[cardDef.type];
        return fallbackQuickCardEffect(cardDef);
    }

    function getDetailCardEffect(cardDef, resolveChargeMaxText) {
        if (!cardDef) return '';
        const mapped = cardDef.type ? detailCardEffectByType[cardDef.type] : null;
        if (typeof mapped === 'function') return mapped(resolveChargeMaxText);
        if (typeof mapped === 'string') return mapped;
        return fallbackDetailCardEffect(cardDef);
    }

    return {
        quickCardEffectByType,
        detailCardEffectByType,
        normalizeCardDescText,
        fallbackQuickCardEffect,
        fallbackDetailCardEffect,
        getQuickCardEffect,
        getDetailCardEffect
    };
}));
