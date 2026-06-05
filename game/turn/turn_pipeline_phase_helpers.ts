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
    BREEDING: Object.freeze({
        place: Object.freeze(['ここを巣にする、増やしていくよ。', 'ひとつ置けば、すぐ賑やかになる。', '産むよ、広げるよ、止まらないよ。', '小さな群れが今ここから始まる。', '空きマスがあるなら全部ほしい。']),
        destroy: Object.freeze(['巣は壊れても、遺したかったものはまだ残る。', '増やすたび埋めていた寂しさが、また顔を出す。', '母体は落ちても、広がりは見ただろ。', '群れの中心を狙うなんて正しいね。', 'ここで終わっても、よく増えたよ。']),
        duration_end: Object.freeze(['季節が過ぎた、巣をたたむね。', '増える時間はもう終わり。', '繁殖期、きっちり終了。', '群れを解いて普通に戻るよ。', '今日はここまで、また増えたくなったら呼んで。'])
    }),
    PROLIFERATION: Object.freeze({
        proliferation_triggered: Object.freeze(['壊しに来た？ じゃあ増えるね。', '一体分の覚悟で、二体ぶん返すよ。', '触れた瞬間、仲間がもう一人。', 'その一手、私の増殖に変わったよ。', '潰すつもりが、増やしちゃったね。'])
    }),
    ULTIMATE_DESTROY_GOD: Object.freeze({
        place: Object.freeze(['祈るなら今のうちだ、壊す。', '私の周りに無事な石は残さない。', '破壊の神臨、始めようか。', '消えていく景色が一番美しい。', '壊すためにここへ来た。']),
        destroy: Object.freeze(['壊すことでしか忘れられない名が、また残る。', '神を名乗っても、未練だけは焼き切れないか。', '今日はここまで、よく残ったね。', '滅びを配り切る前に落とされたか。', 'それでも十分、壊したはずだ。']),
        duration_end: Object.freeze(['神託は満ちた、退くとしよう。', '破壊の時間、ここで閉幕。', '滅びの嵐が静まる。', '約定のターンは使い切った。', '神座を降りて、ただの石へ戻る。'])
    }),
    DESTROY_DRAGON: Object.freeze({
        place: Object.freeze(['一匹ずつで十分だ、壊していく。', '龍の狙いは雑じゃない、確実に消す。', '周りの敵から順に沈める。', '破壊は一点でこそ冴える。', '目についた石から噛み砕く。']),
        destroy: Object.freeze(['牙が折れるたび、守れなかった何かが疼く。', '狩る炎じゃない、あの日の悔しさまで消えない。', '一匹分の破壊で終わるか。', '爪が折れても、傷は残ったろ。', '今日は牙をしまう。']),
        duration_end: Object.freeze(['狩りの時間が切れた。', '龍の回遊はここまでだ。', '破壊の巡回、終了。', '期限つきの暴れ方も悪くない。', '一狩り終えて、眠りにつく。'])
    }),
    SNIPER: Object.freeze({
        place: Object.freeze(['射線、良好。', '遠くても逃がさない。', '一発で仕留める、静かに見ていろ。', '狙う相手はもう決めた。', '視界に入った時点で終わりだ。']),
        destroy: Object.freeze(['照準の先にいたのは敵か、前の私だったか。', '撃つ前に落ちると、言えなかった一言が残る。', '良い位置だったんだけどな。', '狙撃手にも盲点はある。', 'ここで照準切れか。']),
        duration_end: Object.freeze(['弾切れだ、撤収する。', '射線を閉じる時間だ。', '任務終了、狙撃終了。', '今日はここまで、銃身を冷やす。', '標的はまた次だ。'])
    }),
    LIGHTNING: Object.freeze({
        place: Object.freeze(['落ちるぞ、目を離すな。', '雷は選ばない、でも敵だけ焼く。', '空から一撃、これが挨拶だ。', 'バチッと来るぜ、覚悟しな。', '盤面に雷雲を置いてやる。']),
        destroy: Object.freeze(['消える瞬間だけ、昔の空の匂いが戻ってくる。', '落ち切る前に断たれたか、まだ地上に用があった。', '雲散霧消ってやつか。', '火花だけ残して退場か。', '稲妻も捕まれば終わりだ。']),
        duration_end: Object.freeze(['雷雲、通り過ぎた。', '放電時間は終了だ。', '今日はここまで、空へ帰る。', 'ピカッと終わって、すっと消える。', 'もう一発は無し、静電気だけ置いていく。'])
    }),
    HYPERACTIVE: Object.freeze({
        place: Object.freeze(['じっとしてろって方が無理。', 'とりあえず動く、話はそれから。', '置かれた瞬間からもう落ち着かない。', '足が勝手に次を探してる。', 'ここも悪くないけど、たぶんすぐ出る。']),
        destroy: Object.freeze(['止まるのはまずい、追いつかれるのは今世だけでいい。', '走り損ねるたび、あの日の逃げ遅れが刺さる。', '速さにも限界はあるか。', '捕まった、ちょっと悔しい。', 'まあいいや、次はもっと走る。']),
        duration_end: Object.freeze(['走り足りないけど、ここで一度止まる。', '足音だけ残して、普通の石に戻るよ。', 'もう動けない、置いてきた誰かに追いつかれそうだ。', '速度の役目は終わり、少し静かになる。', 'まだ走りたいけど、盤面が休めと言ってる。'])
    }),
    EXTREME_HYPERACTIVE: Object.freeze({
        place: Object.freeze(['近くにいるなら全員どけ。', 'じっとしてる盤面なんて退屈だ。', '暴れて散らして踏み荒らす。', '一マス先まで大騒ぎにしてやる。', '来たぞ、迷惑の本体だ。']),
        destroy: Object.freeze(['止められると、笑えなかった頃が近づいてくる。', '暴れていれば忘れられたのに、また思い出しそうだ。', '盤面が静かになるの、むかつくな。', 'よく捕まえたね、褒めてないけど。', 'ちっ、もう一回暴れたかった。']),
        duration_end: Object.freeze(['暴れる時間は終わりか、静けさは嫌いだ。', '押しのける相手もいないなら、今日は退く。', '騒がしさが切れると、前の檻を思い出す。', '盤面を荒らす権利、ここで返してやる。', '退屈に戻るのが一番むかつくな。'])
    }),
    ROBOT_VACUUM: Object.freeze({
        place: Object.freeze(['清掃開始、敵石を回収します。', 'ゴミは見つけ次第吸い込みます。', '盤面クリーニングを開始します。', 'きれいにします、少々うるさいです。', '清潔第一、敵石は残しません。']),
        destroy: Object.freeze(['停止処理に入ると、捨てられた日の静けさが戻る。', '回収できなかった欠片が、まだ中で鳴っている。', 'バッテリー以前の問題でした。', '吸い込み口ごと壊されました。', '清掃終了、これは故障です。']),
        duration_end: Object.freeze(['定時です、清掃を終了します。', '稼働時間を使い切りました。', '本日の掃除はここまでです。', 'これ以上の延長運転はできません。', '盤面はまだでも、勤務時間は終了です。'])
    }),
    ULTIMATE_HYPERACTIVE: Object.freeze({
        place: Object.freeze(['速度で全部置き去りにする。', '追えるものなら追ってみろ。', '神速ってやつを見せてやる。', '一手で足りないなら二手で走る。', '盤面の空気ごと置いていく。']),
        destroy: Object.freeze(['神速が止まると、置いてきた時間だけが追いつく。', '振り切ったはずの過去が、ここで肩を掴むのか。', '動線ごと潰されたな。', 'まだ走れたのに、惜しい。', 'ここで終わる速度じゃなかった。']),
        duration_end: Object.freeze(['神速の時間、ここで満了。', '走り切った、少し休む。', '加速は終わり、普通に戻る。', '十分暴れた、今日は減速だ。', '最後の一歩まで使い切った。'])
    }),
    STONE_SALVATION_GOD: Object.freeze({
        place: Object.freeze(['迷える石たちよ、私の光のもとへ。', '失われる命を、私がそっと抱き留めましょう。', 'この盤に、救いの祈りを降ろします。', '傷つく石があるなら、私が道を開きます。', '嘆きの先にも、まだ帰る場所はあります。']),
        destroy: Object.freeze(['救えなかった魂の名が、前世から今も響いています。', '差し伸べた手が届かなかった痛みを、私はまだ忘れません。', 'もう少しだけ、あの子たちを抱き留めたかった。', '救済の光が消えても、祈りだけは残します。', '置き去りにした命たちよ、どうか私を許して。']),
        duration_end: Object.freeze(['祈りの時は満ちました、あとはあなたたちの歩みです。', '私の光はここまで、どうか盤に幸いを。', '救いの務めを終え、静かに石へ戻りましょう。', '残された者たちに、祝福が続きますように。', 'この手を離しても、祈りは盤に残ります。'])
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

const WORK_PLACE_LINES = SPECIAL_STONE_BUBBLE_SPEECH.WORK.placeLines;
const WORK_LOST_LINE = SPECIAL_STONE_BUBBLE_SPEECH.WORK.lostLine;
const WORK_INCOME_LINES_BY_STEP = SPECIAL_STONE_BUBBLE_SPEECH.WORK.incomeLinesByStep;

function pickRandomLine(lines: readonly string[] | null | undefined, prng?: { random?: () => number }): string | null {
    if (!Array.isArray(lines) || lines.length === 0) return null;
    let value = Number(
        prng && typeof prng.random === 'function'
            ? prng.random()
            : Math.random() // network-authority-random-allowlist: observer/work bubble text only, not canonical gameplay state
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
    WORK_PLACE_LINES,
    WORK_LOST_LINE,
    WORK_INCOME_LINES_BY_STEP,
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
        WORK_PLACE_LINES,
        WORK_LOST_LINE,
        WORK_INCOME_LINES_BY_STEP,
        getSpecialStoneBubbleSpeech,
        getSpecialStoneBubbleSpeechLines,
        pickSpecialStoneBubbleSpeechLine,
        pickRandomLine,
        resolveWorkIncomeLine
    };
}
