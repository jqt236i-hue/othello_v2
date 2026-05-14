const SPECIAL_STONE_BUBBLE_SCENARIO_KEYS = Object.freeze([
    'place',
    'destroy',
    'duration_end',
    'proliferation_triggered',
    'time_stop_triggered',
    'regen_triggered',
    'ghost_protected',
    'inherit_selected',
    'inherit_applied',
    'escape_exploded',
    'absolute_protected_promoted',
    'special_destroy_triggered',
    'living_will_restored'
]);

const GENERIC_LIVING_WILL_RESTORED_LINES = Object.freeze([
    'まだ終わらない、ここから立て直す。',
    '一度沈んだくらいで、この未練は消えない。',
    '戻ってきた、もう一手ぶん働くよ。',
    '消えたつもりなら誤算だ、私はまだ盤にいる。',
    '生きる意志が残っていた、もう一度だけ立つ。'
]);

const SPECIAL_STONE_BUBBLE_SPEECH: Record<string, Record<string, readonly string[] | string | Record<number, string>>> = Object.freeze({
    OBSERVER: Object.freeze({
        placeLines: Object.freeze(['今日も観測しますかっと', '盤理は観測するためにある', '観測最高！']),
        lostLine: '盤理観測してる場合じゃなかったわ',
        living_will_restored: Object.freeze(['観測再開っと、まだ盤理は追える。', '消えかけたけど、観測ログは続行だよ。', '戻った戻った、まだ盤面を見てるからね。'])
    }),
    WORK: Object.freeze({
        placeLines: Object.freeze(['ここで稼いで一発逆転や！', '布石いっぱい掘るでー！', 'ワイには夢があるんや！', '一攫千金や！']),
        lostLine: 'あああああああああああああ',
        living_will_restored: Object.freeze(['まだ稼げる！ ここから巻き返しや！', '持ち直したで！ もうひと掘りや！', '危なかったわ、でもまだ働けるで！']),
        incomeLinesByStep: Object.freeze({
            1: '布石＋1 初儲けや！',
            2: '布石＋2 もっと掘るでー！',
            3: '布石＋4 順調やな！',
            4: '布石＋8 ぼろ儲けや！',
            5: '布石＋16 これで家族が養える...！'
        })
    }),
    GLUTTONOUS: Object.freeze({
        place: Object.freeze(['いっぱい食べる俺が好き', '腹が減ってる、まずは一口くれ。', '食える盤なら全部うまい。', 'いただきますは言う、遠慮はしない。', '目の前の敵から順にごちそうだ。']),
        destroy: Object.freeze(['食べても埋まらなかった空腹が、また残ったままだ。', '腹じゃない、満たされなかった昔の穴が痛む。', '食う側が食われる日もあるな。', 'もう一口だけ欲しかった。', '満腹前に倒れるのはつらい。'])
    }),
    GHOST: Object.freeze({
        place: Object.freeze(['触れたつもりで、触れていないよ。', '見えても実体は薄いんだ。', '対象にはなる、でも当たらない。', 'ここにいるけど、少し向こう側だ。', '透けたまま盤に立つよ。']),
        destroy: Object.freeze(['向こう側へ戻るたび、戻りたくなかった理由が蘇る。', '消えるのは慣れてる、でも未練までは薄れない。', '形を保てなくなったね。', 'かすかな身体も、ここまでか。', '消える時は静かに消えるよ。']),
        ghost_protected: Object.freeze(['当たってないよ。', 'それ、私には届かない。', '狙いは正しいけど、手応えは無いだろ。', '触れたつもりの空振りだね。', '幽体って、そういうものだよ。'])
    }),
    ESCAPE_HYPERACTIVE: Object.freeze({
        place: Object.freeze(['近寄らないで！ 私、逃げるから！', '生き残るためなら何だってするよ！', '追われる前に走るのが一番だよ！', 'ここから先は逃走劇だよ！', '捕まるわけにはいかないの！']),
        destroy: Object.freeze(['逃げ損ねるなんて、やっぱり悔しいよ…！', '囲まれると、さすがに怖いよ…！', '足場を奪われた時点で負けだったよ！', '追手が多すぎるってば！', '今回の逃走はここまでみたい…！']),
        escape_exploded: Object.freeze(['行き場がないなら、もう吹き飛ぶしかないよ！', '逃げ道なしなら、景気よく爆ぜるね！', '追い詰めたつもりでも、巻き添えだからね！', 'もう無理！ 派手に散ってやるんだから！', '捕まるくらいなら盤ごと荒らしちゃうよ！'])
    }),
    INHERITED_HYPERACTIVE: Object.freeze({
        inherit_selected: Object.freeze(['よし、お前に落ち着きの無さを継がせる。', 'その石だ、走る役目を渡す。', '決めた、お前が次の多動だ。', 'じっとしてるには向かない顔だな。', 'その一石、せわしなさで染める。']),
        inherit_applied: Object.freeze(['継承完了、さあ落ち着かなくなれ。', '走る癖、ちゃんと移ったぞ。', '今日からお前も多動石だ。', '足の速さじゃない、心の忙しさを渡した。', '継いだな、その石はもう止まらない。']),
        duration_end: Object.freeze(['走り切った、ここで普通の石に戻る。', '忙しさはここまでだ、少し落ち着くよ。', '継いだ衝動が抜けた、盤面に静けさが戻る。', 'もう十分動いた、あとは通常石として残る。', '多動の役目は終わり、次の一手へ渡す。']),
        living_will_restored: GENERIC_LIVING_WILL_RESTORED_LINES
    }),
    PROLIFERATION: Object.freeze({
        proliferation_triggered: Object.freeze(['壊しに来た？ じゃあ増えるね。', '一体分の覚悟で、二体ぶん返すよ。', '触れた瞬間、仲間がもう一人。', 'その一手、私の増殖に変わったよ。', '潰すつもりが、増やしちゃったね。'])
    }),
    REGEN: Object.freeze({
        regen_triggered: Object.freeze(['倒れても芽は残る、もう一度盤に戻るよ。', '再生完了、まだこのマスは渡さない。', '砕けた分だけ根を張った、ここから復帰だ。', '消えたと思った？ 芽吹きはここからだよ。', '再生の意志が残っていた、もう一度立つ。'])
    }),
    TIME_STOP: Object.freeze({
        time_stop_triggered: Object.freeze(['時を止める、動けるのは私だけだ。', '盤上の時間を凍らせる、次の一手を奪う。', '止まれ、ここから先は私の間合いだ。', '一瞬を支配する、それで十分だ。', '時は止まった、動き出す前に決める。'])
    }),
    WILL_HUNTER_KING: Object.freeze({
        place: Object.freeze(['王の狩場だ、異能の石から首を差し出せ。', '盤上の意志を嗅ぎ分ける、狩りの始まりだ。', '特殊石の気配がするな、王が刈り取りに来たぞ。', '目立つ力ほど狙いやすい、まずは一つ沈める。', '意志を掲げた石から順に、王の獲物になる。']),
        special_destroy_triggered: Object.freeze(['光る首ほど、刈った時によく響く。', '特殊石の断末魔は、王の耳によく馴染む。', '異能ごと断つ、それが王の狩りだ。', '盤の切り札ほど、落とす価値がある。', '珍しい石から沈む、実にいい眺めだ。'])
    }),
    ABSOLUTE_PROTECTED: Object.freeze({
        absolute_protected_promoted: Object.freeze(['ここから先は、何ものも届かない。', '進化完了、もう誰にも触れさせない。', '守りは極まった、私は絶対だ。', '世界ごと拒んで立ち続ける。', '完成した、この身はもう揺るがない。'])
    }),
    DRAGON: Object.freeze({
        living_will_restored: GENERIC_LIVING_WILL_RESTORED_LINES
    })
});

const OBSERVER_PLACE_LINES = SPECIAL_STONE_BUBBLE_SPEECH.OBSERVER.placeLines;
const OBSERVER_LOST_LINE = SPECIAL_STONE_BUBBLE_SPEECH.OBSERVER.lostLine;
const WORK_PLACE_LINES = SPECIAL_STONE_BUBBLE_SPEECH.WORK.placeLines;
const WORK_LOST_LINE = SPECIAL_STONE_BUBBLE_SPEECH.WORK.lostLine;
const WORK_INCOME_LINES_BY_STEP = SPECIAL_STONE_BUBBLE_SPEECH.WORK.incomeLinesByStep;

const OBSERVER_CARD_ONE_LINERS = Object.freeze({
    TREASURE_BOX: '宝箱は即布石化',
    FREE_PLACEMENT: '挟めず置ける',
    LAST_RESORT: '石数劣勢かつパス時に3連続自由配置',
    SNIPER_WILL: '狙撃は毎開幕判定',
    BREEDING_WILL: '周囲へ石を増殖',
    CLONE_WILL: '隣接空きへ複製',
    SPLIT_WILL: '隣接空きへ分裂',
    TELEPORT_WILL: '石を空きへ転送',
    BLOCKADE_WILL: '空き1マス封鎖',
    METEOR_WILL: 'マスごと1セル破壊',
    FREEZE_WILL: '1マス凍結',
    SALVATION_WILL: '前ターン破壊の通常石を復活'
});

function pickRandomLine(lines: readonly string[] | null | undefined, prng?: { random?: () => number }): string | null {
    if (!Array.isArray(lines) || lines.length === 0) return null;
    let value = Number(
        prng && typeof prng.random === 'function'
            ? prng.random()
            : Math.random()
    );
    if (!Number.isFinite(value)) value = 0;
    if (value < 0) value = 0;
    if (value >= 1) value = 0.999999;
    const index = Math.floor(value * lines.length);
    return lines[Math.max(0, Math.min(lines.length - 1, index))] || null;
}

function resolveWorkIncomeLine(gained: unknown, incomeStep: unknown): string {
    const normalizedStep = Number.isFinite(Number(incomeStep))
        ? Math.max(1, Math.min(5, Math.trunc(Number(incomeStep))))
        : null;
    const incomeLines = WORK_INCOME_LINES_BY_STEP as Record<number, string>;
    if (normalizedStep && incomeLines[normalizedStep]) return incomeLines[normalizedStep];
    const g = Number(gained) || 0;
    const inferredStep = g >= 16 ? 5 : (g >= 8 ? 4 : (g >= 4 ? 3 : (g >= 2 ? 2 : 1)));
    return incomeLines[inferredStep] || incomeLines[1];
}

function getSpecialStoneBubbleSpeech(type: string, scenario?: string): Record<string, unknown> | readonly string[] | null {
    const key = String(type || '').trim().toUpperCase();
    const speech = SPECIAL_STONE_BUBBLE_SPEECH[key] || null;
    if (!speech) return null;
    if (arguments.length >= 2) return getSpecialStoneBubbleSpeechLines(type, scenario || '');
    return speech;
}

function getSpecialStoneBubbleSpeechLines(type: string, scenario: string): readonly string[] | null {
    const key = String(type || '').trim().toUpperCase();
    const speech = SPECIAL_STONE_BUBBLE_SPEECH[key] || null;
    if (!speech) return null;
    const scenarioKey = String(scenario || '').trim().toLowerCase().replace(/-/g, '_');
    if (Array.isArray(speech[scenarioKey])) return speech[scenarioKey] as readonly string[];
    if (scenarioKey === 'place' && Array.isArray(speech.placeLines)) return speech.placeLines as readonly string[];
    if (scenarioKey === 'destroy' && typeof speech.lostLine === 'string') return [speech.lostLine];
    return null;
}

function pickSpecialStoneBubbleSpeechLine(type: string, scenario: string, prng?: { random?: () => number }): string | null {
    return pickRandomLine(getSpecialStoneBubbleSpeechLines(type, scenario), prng);
}

export {
    SPECIAL_STONE_BUBBLE_SCENARIO_KEYS,
    SPECIAL_STONE_BUBBLE_SPEECH,
    OBSERVER_PLACE_LINES,
    OBSERVER_LOST_LINE,
    WORK_PLACE_LINES,
    WORK_LOST_LINE,
    WORK_INCOME_LINES_BY_STEP,
    OBSERVER_CARD_ONE_LINERS,
    getSpecialStoneBubbleSpeech,
    getSpecialStoneBubbleSpeechLines,
    pickSpecialStoneBubbleSpeechLine,
    pickRandomLine,
    resolveWorkIncomeLine
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SPECIAL_STONE_BUBBLE_SCENARIO_KEYS,
        SPECIAL_STONE_BUBBLE_SPEECH,
        OBSERVER_PLACE_LINES,
        OBSERVER_LOST_LINE,
        WORK_PLACE_LINES,
        WORK_LOST_LINE,
        WORK_INCOME_LINES_BY_STEP,
        OBSERVER_CARD_ONE_LINERS,
        getSpecialStoneBubbleSpeech,
        getSpecialStoneBubbleSpeechLines,
        pickSpecialStoneBubbleSpeechLine,
        pickRandomLine,
        resolveWorkIncomeLine
    };
}
