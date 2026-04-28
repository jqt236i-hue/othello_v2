"use strict";
/**
 * @file turn_pipeline_phase_helpers.js
 * @description Shared constants and pure helpers for turn_pipeline_phases (UMD)
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    }
    else {
        root.TurnPipelinePhaseHelpers = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    function freezeSpeechScenarioCatalog(definition) {
        const frozen = {};
        if (!definition || typeof definition !== 'object')
            return Object.freeze(frozen);
        Object.keys(definition).forEach((scenarioKey) => {
            const lines = definition[scenarioKey];
            frozen[scenarioKey] = Array.isArray(lines)
                ? Object.freeze(lines.slice())
                : lines;
        });
        return Object.freeze(frozen);
    }
    const SPECIAL_STONE_BUBBLE_SCENARIO_KEYS = Object.freeze(['place', 'destroy', 'duration_end', 'proliferation_triggered', 'time_stop_triggered', 'regen_triggered', 'ghost_protected', 'inherit_selected', 'inherit_applied', 'escape_exploded', 'absolute_protected_promoted', 'special_destroy_triggered', 'living_will_restored'].map((key) => String(key)));
    const SPECIAL_STONE_BUBBLE_SCENARIO_ALIASES = Object.freeze({
        placelines: 'place',
        'place-lines': 'place',
        place_lines: 'place',
        lost: 'destroy',
        lostline: 'destroy',
        'lost-line': 'destroy',
        lost_line: 'destroy',
        durationend: 'duration_end',
        'duration-end': 'duration_end',
        proliferationtriggered: 'proliferation_triggered',
        'proliferation-triggered': 'proliferation_triggered',
        time_stop: 'time_stop_triggered',
        timestoptriggered: 'time_stop_triggered',
        'time-stop-triggered': 'time_stop_triggered',
        regentriggered: 'regen_triggered',
        'regen-triggered': 'regen_triggered',
        ghostprotected: 'ghost_protected',
        'ghost-protected': 'ghost_protected',
        inheritselected: 'inherit_selected',
        'inherit-selected': 'inherit_selected',
        inheritapplied: 'inherit_applied',
        'inherit-applied': 'inherit_applied',
        escapeexploded: 'escape_exploded',
        'escape-exploded': 'escape_exploded',
        absoluteprotectedpromoted: 'absolute_protected_promoted',
        'absolute-protected-promoted': 'absolute_protected_promoted',
        specialdestroytriggered: 'special_destroy_triggered',
        'special-destroy-triggered': 'special_destroy_triggered',
        livingwillrestored: 'living_will_restored',
        'living-will-restored': 'living_will_restored',
        revived: 'living_will_restored',
        revive: 'living_will_restored'
    });
    const GENERIC_LIVING_WILL_RESTORED_LINES = Object.freeze([
        'まだ終わらない、ここから立て直す。',
        '一度沈んだくらいで、この未練は消えない。',
        '戻ってきた、もう一手ぶん働くよ。',
        '消えたつもりなら誤算だ、私はまだ盤にいる。',
        '生きる意志が残っていた、もう一度だけ立つ。'
    ]);
    const SPECIAL_STONE_SCENARIO_BUBBLE_SPEECH = Object.freeze({
        PROTECTED: freezeSpeechScenarioCatalog({
            place: [
                '今日は守られ役でいくよ。',
                '一手だけでも、しぶとく残る。',
                '今だけは、ひっくり返らない。',
                '脆く見えても、次までは耐える。',
                'まずは一息、まだ倒れない。',
            ],
            destroy: [
                '守りきれなかったか……この悔しさ、前にも覚えがある。',
                'また誰かを残して消えるのか、それだけは慣れない。',
                'くっ、耐え切れなかった。',
                '一手分の命、使い切ったよ。',
                '防ぎきれずに終わるのも役目だ。',
            ],
            duration_end: [
                '約束の一手は終わり、ただの石に戻る。',
                '守りの膜が剥がれた、ここからは素だ。',
                'もう特別扱いは終わりだね。',
                '耐久時間、きっちり終了。',
                'ここから先は、普通に勝負する。',
            ],
        }),
        PERMA_PROTECTED: freezeSpeechScenarioCatalog({
            place: [
                '反転ごときでは崩れない。',
                'じっくり強くなる、焦るな。',
                '守り抜いて、次の段へ行く。',
                '時間は私の味方だ。',
                '揺るがず待つ、それが強さだ。',
            ],
            destroy: [
                '折られるたび、前の名を思い出しかける。',
                '進化を待つ未練まで、ここで断たれるのか。',
                '守りは厚くても、壊れる時は壊れる。',
                'まだ完成前だったか。',
                '強さの途中で終わるのは惜しいな。',
            ],
        }),
        ABSOLUTE_PROTECTED: freezeSpeechScenarioCatalog({
            absolute_protected_promoted: [
                'ここから先は、何ものも届かない。',
                '進化完了、もう誰にも触れさせない。',
                '守りは極まった、私は絶対だ。',
                '世界ごと拒んで立ち続ける。',
                '完成した、この身はもう揺るがない。',
            ],
        }),
        DRAGON: freezeSpeechScenarioCatalog({
            place: [
                '盤面を裏返す牙、見せてやる。',
                '龍の一声で色が変わる。',
                'ひっくり返る準備はいいか。',
                '我が鱗の風で盤理を捻る。',
                'ここからは反転の縄張りだ。',
            ],
            destroy: [
                '墜ちるたび、空より昔の炎景色がちらつく。',
                '砕けた鱗の奥で、返していない怒りが鳴く。',
                '反転の宴はここまでだ。',
                '空へ帰る、次はもっと荒らす。',
                '盤面を掻き回せず終わるか。',
            ],
            duration_end: [
                '翼を休める時だ、龍は眠る。',
                '暴れる刻限は尽きた。',
                '龍の時間、ここで満了。',
                '反転の嵐は静まった。',
                '今はただの石として眠ろう。',
            ],
        }),
        BREEDING: freezeSpeechScenarioCatalog({
            place: [
                'ここを巣にする、増やしていくよ。',
                'ひとつ置けば、すぐ賑やかになる。',
                '産むよ、広げるよ、止まらないよ。',
                '小さな群れが今ここから始まる。',
                '空きマスがあるなら全部ほしい。',
            ],
            destroy: [
                '巣は壊れても、遺したかったものはまだ残る。',
                '増やすたび埋めていた寂しさが、また顔を出す。',
                '母体は落ちても、広がりは見ただろ。',
                '群れの中心を狙うなんて正しいね。',
                'ここで終わっても、よく増えたよ。',
            ],
            duration_end: [
                '季節が過ぎた、巣をたたむね。',
                '増える時間はもう終わり。',
                '繁殖期、きっちり終了。',
                '群れを解いて普通に戻るよ。',
                '今日はここまで、また増えたくなったら呼んで。',
            ],
        }),
        PROLIFERATION: freezeSpeechScenarioCatalog({
            place: [
                '壊すなら増える、それだけの話。',
                '一体じゃ足りない、もっと私になる。',
                '触れた瞬間に数で返すよ。',
                '狭いなら広げればいい。',
                'ひとつ潰しても、増えるだけだよ。',
            ],
            destroy: [
                '増え損ねるたび、行き場のなかった頃を思い出す。',
                '塞がれたのは進路だけじゃない、あの願いもだ。',
                'ついに本体を落とせたみたいだ。',
                '行き場が尽きた、今回は負け。',
                '数で押せない盤は苦しいな。',
            ],
            duration_end: [
                '増殖の波、ここで止まる。',
                '数合わせの時間は終わり。',
                'もう分かれない、普通に戻るよ。',
                '拡散終了、集合の時間だ。',
                '増え続ける季節じゃなくなった。',
            ],
            proliferation_triggered: [
                '壊しに来た？ じゃあ増えるね。',
                '一体分の覚悟で、二体ぶん返すよ。',
                '触れた瞬間、仲間がもう一人。',
                'その一手、私の増殖に変わったよ。',
                '潰すつもりが、増やしちゃったね。',
            ],
        }),
        ULTIMATE_DESTROY_GOD: freezeSpeechScenarioCatalog({
            place: [
                '祈るなら今のうちだ、壊す。',
                '私の周りに無事な石は残さない。',
                '破壊の神臨、始めようか。',
                '消えていく景色が一番美しい。',
                '壊すためにここへ来た。',
            ],
            destroy: [
                '壊すことでしか忘れられない名が、また残る。',
                '神を名乗っても、未練だけは焼き切れないか。',
                '今日はここまで、よく残ったね。',
                '滅びを配り切る前に落とされたか。',
                'それでも十分、壊したはずだ。',
            ],
            duration_end: [
                '神託は満ちた、退くとしよう。',
                '破壊の時間、ここで閉幕。',
                '滅びの嵐が静まる。',
                '約定のターンは使い切った。',
                '神座を降りて、ただの石へ戻る。',
            ],
        }),
        DESTROY_DRAGON: freezeSpeechScenarioCatalog({
            place: [
                '一匹ずつで十分だ、壊していく。',
                '龍の狙いは雑じゃない、確実に消す。',
                '周りの敵から順に沈める。',
                '破壊は一点でこそ冴える。',
                '目についた石から噛み砕く。',
            ],
            destroy: [
                '牙が折れるたび、守れなかった何かが疼く。',
                '狩る炎じゃない、あの日の悔しさまで消えない。',
                '一匹分の破壊で終わるか。',
                '爪が折れても、傷は残ったろ。',
                '今日は牙をしまう。',
            ],
            duration_end: [
                '狩りの時間が切れた。',
                '龍の回遊はここまでだ。',
                '破壊の巡回、終了。',
                '期限つきの暴れ方も悪くない。',
                '一狩り終えて、眠りにつく。',
            ],
        }),
        SNIPER: freezeSpeechScenarioCatalog({
            place: [
                '射線、良好。',
                '遠くても逃がさない。',
                '一発で仕留める、静かに見ていろ。',
                '狙う相手はもう決めた。',
                '視界に入った時点で終わりだ。',
            ],
            destroy: [
                '照準の先にいたのは敵か、前の私だったか。',
                '撃つ前に落ちると、言えなかった一言が残る。',
                '良い位置だったんだけどな。',
                '狙撃手にも盲点はある。',
                'ここで照準切れか。',
            ],
            duration_end: [
                '弾切れだ、撤収する。',
                '射線を閉じる時間だ。',
                '任務終了、狙撃終了。',
                '今日はここまで、銃身を冷やす。',
                '標的はまた次だ。',
            ],
        }),
        LIGHTNING: freezeSpeechScenarioCatalog({
            place: [
                '落ちるぞ、目を離すな。',
                '雷は選ばない、でも敵だけ焼く。',
                '空から一撃、これが挨拶だ。',
                'バチッと来るぜ、覚悟しな。',
                '盤面に雷雲を置いてやる。',
            ],
            destroy: [
                '消える瞬間だけ、昔の空の匂いが戻ってくる。',
                '落ち切る前に断たれたか、まだ地上に用があった。',
                '雲散霧消ってやつか。',
                '火花だけ残して退場か。',
                '稲妻も捕まれば終わりだ。',
            ],
            duration_end: [
                '雷雲、通り過ぎた。',
                '放電時間は終了だ。',
                '今日はここまで、空へ帰る。',
                'ピカッと終わって、すっと消える。',
                'もう一発は無し、静電気だけ置いていく。',
            ],
        }),
        HYPERACTIVE: freezeSpeechScenarioCatalog({
            place: [
                'じっとしてろって方が無理。',
                'とりあえず動く、話はそれから。',
                '置かれた瞬間からもう落ち着かない。',
                '足が勝手に次を探してる。',
                'ここも悪くないけど、たぶんすぐ出る。',
            ],
            destroy: [
                '止まるのはまずい、追いつかれるのは今世だけでいい。',
                '走り損ねるたび、あの日の逃げ遅れが刺さる。',
                '速さにも限界はあるか。',
                '捕まった、ちょっと悔しい。',
                'まあいいや、次はもっと走る。',
            ],
        }),
        EXTREME_HYPERACTIVE: freezeSpeechScenarioCatalog({
            place: [
                '近くにいるなら全員どけ。',
                'じっとしてる盤面なんて退屈だ。',
                '暴れて散らして踏み荒らす。',
                '一マス先まで大騒ぎにしてやる。',
                '来たぞ、迷惑の本体だ。',
            ],
            destroy: [
                '止められると、笑えなかった頃が近づいてくる。',
                '暴れていれば忘れられたのに、また思い出しそうだ。',
                '盤面が静かになるの、むかつくな。',
                'よく捕まえたね、褒めてないけど。',
                'ちっ、もう一回暴れたかった。',
            ],
        }),
        ESCAPE_HYPERACTIVE: freezeSpeechScenarioCatalog({
            place: [
                '近寄らないで！ 私、逃げるから！',
                '生き残るためなら何だってするよ！',
                '追われる前に走るのが一番だよ！',
                'ここから先は逃走劇だよ！',
                '捕まるわけにはいかないの！',
            ],
            destroy: [
                '逃げ損ねるなんて、やっぱり悔しいよ…！',
                '囲まれると、さすがに怖いよ…！',
                '足場を奪われた時点で負けだったよ！',
                '追手が多すぎるってば！',
                '今回の逃走はここまでみたい…！',
            ],
            escape_exploded: [
                '行き場がないなら、もう吹き飛ぶしかないよ！',
                '逃げ道なしなら、景気よく爆ぜるね！',
                '追い詰めたつもりでも、巻き添えだからね！',
                'もう無理！ 派手に散ってやるんだから！',
                '捕まるくらいなら盤ごと荒らしちゃうよ！',
            ],
        }),
        ROBOT_VACUUM: freezeSpeechScenarioCatalog({
            place: [
                '清掃開始、敵石を回収します。',
                'ゴミは見つけ次第吸い込みます。',
                '盤面クリーニングを開始します。',
                'きれいにします、少々うるさいです。',
                '清潔第一、敵石は残しません。',
            ],
            destroy: [
                '停止処理に入ると、捨てられた日の静けさが戻る。',
                '回収できなかった欠片が、まだ中で鳴っている。',
                'バッテリー以前の問題でした。',
                '吸い込み口ごと壊されました。',
                '清掃終了、これは故障です。',
            ],
            duration_end: [
                '定時です、清掃を終了します。',
                '稼働時間を使い切りました。',
                '本日の掃除はここまでです。',
                'これ以上の延長運転はできません。',
                '盤面はまだでも、勤務時間は終了です。',
            ],
        }),
        GLUTTONOUS: freezeSpeechScenarioCatalog({
            place: [
                'いっぱい食べる俺が好き',
                '腹が減ってる、まずは一口くれ。',
                '食える盤なら全部うまい。',
                'いただきますは言う、遠慮はしない。',
                '目の前の敵から順にごちそうだ。',
            ],
            destroy: [
                '食べても埋まらなかった空腹が、また残ったままだ。',
                '腹じゃない、満たされなかった昔の穴が痛む。',
                '食う側が食われる日もあるな。',
                'もう一口だけ欲しかった。',
                '満腹前に倒れるのはつらい。',
            ],
        }),
        ULTIMATE_HYPERACTIVE: freezeSpeechScenarioCatalog({
            place: [
                '速度で全部置き去りにする。',
                '追えるものなら追ってみろ。',
                '神速ってやつを見せてやる。',
                '一手で足りないなら二手で走る。',
                '盤面の空気ごと置いていく。',
            ],
            destroy: [
                '神速が止まると、置いてきた時間だけが追いつく。',
                '振り切ったはずの過去が、ここで肩を掴むのか。',
                '動線ごと潰されたな。',
                'まだ走れたのに、惜しい。',
                'ここで終わる速度じゃなかった。',
            ],
            duration_end: [
                '神速の時間、ここで満了。',
                '走り切った、少し休む。',
                '加速は終わり、普通に戻る。',
                '十分暴れた、今日は減速だ。',
                '最後の一歩まで使い切った。',
            ],
        }),
        INHERITED_HYPERACTIVE: freezeSpeechScenarioCatalog({
            inherit_selected: [
                'よし、お前に落ち着きの無さを継がせる。',
                'その石だ、走る役目を渡す。',
                '決めた、お前が次の多動だ。',
                'じっとしてるには向かない顔だな。',
                'その一石、せわしなさで染める。',
            ],
            inherit_applied: [
                '継承完了、さあ落ち着かなくなれ。',
                '走る癖、ちゃんと移ったぞ。',
                '今日からお前も多動石だ。',
                '足の速さじゃない、心の忙しさを渡した。',
                '継いだな、その石はもう止まらない。',
            ],
            destroy: [
                '継いだのは速さだけじゃない、未練までだ。',
                '受け継いだ先で散ると、前の影まで残るな。',
                '多動の血統、ここで途切れるか。',
                'せわしなさも止まる時は止まる。',
                '継承先ごと落とされたか。',
            ],
            duration_end: [
                '継いだ多動は使い切った。',
                '借りた忙しさ、ここで返却だ。',
                '継承期間、終了。',
                'もう普通の石に戻っていい。',
                '落ち着きを取り戻す時間だ。',
            ],
        }),
        REGEN: freezeSpeechScenarioCatalog({
            place: [
                'まだ終わらない、何度でも戻る。',
                '一度倒しても足りないよ。',
                '復活の支度は済ませてある。',
                '死に際からが本番だ。',
                '倒れるたびに、もう一度立つ。',
            ],
            destroy: [
                'また戻れるのに、毎回これが最後みたいに痛む。',
                '蘇りの底で、まだ名前を呼ぶ声がする。',
                'その程度で終わったと思うな。',
                '壊しても、次がある。',
                '落ちるのは演出、本番はこれから。',
            ],
            regen_triggered: [
                'ほらね、まだ生きてる。',
                '復活完了、もう一戦だ。',
                '立て直した、続きをやろう。',
                '何度でも戻るって言ったろ。',
                'その絶望、もう一回味わえ。',
            ],
        }),
        TIME_STOP: freezeSpeechScenarioCatalog({
            place: [
                '秒針をここに埋めた。',
                '時間は遅れるんじゃない、止める。',
                'いずれこの盤を静める。',
                '合図が来たら、時を噛み切る。',
                '今は仕込み、発動は後だ。',
            ],
            destroy: [
                '止めたかったのは盤じゃない、あの別れ際だった。',
                '針が折れると、置き去りにした瞬間が鮮明になる。',
                '時間を止める前に終わるとはね。',
                '仕掛けを見抜かれたか。',
                '不発でも、狙いは悪くなかった。',
            ],
            time_stop_triggered: [
                '止まれ。',
                'ここから先の秒針は私のものだ。',
                '時間停止、二手続けていただく。',
                '色も音も、全部黙れ。',
                '世界を一回、置き去りにする。',
            ],
        }),
        GHOST: freezeSpeechScenarioCatalog({
            place: [
                '触れたつもりで、触れていないよ。',
                '見えても実体は薄いんだ。',
                '対象にはなる、でも当たらない。',
                'ここにいるけど、少し向こう側だ。',
                '透けたまま盤に立つよ。',
            ],
            destroy: [
                '向こう側へ戻るたび、戻りたくなかった理由が蘇る。',
                '消えるのは慣れてる、でも未練までは薄れない。',
                '形を保てなくなったね。',
                'かすかな身体も、ここまでか。',
                '消える時は静かに消えるよ。',
            ],
            duration_end: [
                '透けていられる時間は終わり。',
                '幽体の幕を下ろすよ。',
                '向こう側との境目が閉じた。',
                'もう普通の重さに戻る。',
                '霊気切れ、実体に帰る。',
            ],
            ghost_protected: [
                '当たってないよ。',
                'それ、私には届かない。',
                '狙いは正しいけど、手応えは無いだろ。',
                '触れたつもりの空振りだね。',
                '幽体って、そういうものだよ。',
            ],
        }),
        AFTERIMAGE_WILL: freezeSpeechScenarioCatalog({
            place: [
                '本物はひとつ、でも見切れるかな。',
                '先に見えるのは残像の方だ。',
                '追うほど手元がずれるよ。',
                '揺らいだ輪郭で惑わせる。',
                'まずは見失ってもらおうか。',
            ],
            destroy: [
                '断たれたのは残像だけじゃない、置き忘れた面影までだ。',
                '揺らぎが消えると、本当に会いたかった顔が残る。',
                '幻もいつかは掴まれるね。',
                'ここまで見切られると潔い。',
                '影遊びは終わりだ。',
            ],
        }),
        WILL_HUNTER_KING: freezeSpeechScenarioCatalog({
            place: [
                '特殊石から狩る、王の流儀だ。',
                '価値ある首をもらいに来た。',
                '王の獲物は逃がさない。',
                '盤の意志ごと刈り取る。',
                'まずは高い石から落とす。',
            ],
            special_destroy_triggered: [
                '光る首ほど、刈った時によく響く。',
                '特殊石の断末魔は、王の耳によく馴染む。',
                '異能ごと断つ、それが王の狩りだ。',
                '盤の切り札ほど、落とす価値がある。',
                '珍しい石から沈む、実にいい眺めだ。',
            ],
            destroy: [
                '討たれるたび、狩るしかなかった理由を思い出す。',
                '首を集めても、あのひとつだけは戻らなかったな。',
                '狩場を去る時が来たな。',
                'この盤には強者がいた。',
                '王座から落ちる音も悪くない。',
            ],
            duration_end: [
                '狩りの刻限は終わりだ。',
                '王の巡行、ここで閉じる。',
                '十分に刈った、今日は退く。',
                '狩場の支配を解くとしよう。',
                '次の王命まで眠る。',
            ],
        }),
    });
    const SPECIAL_STONE_BUBBLE_SPEECH = Object.freeze({
        OBSERVER: Object.freeze({
            placeLines: Object.freeze([
                '今日も観測しますかっと',
                '盤理は観測するためにある',
                '観測最高！'
            ]),
            lostLine: '盤理観測してる場合じゃなかったわ',
            living_will_restored: Object.freeze([
                '観測再開っと、まだ盤理は追える。',
                '消えかけたけど、観測ログは続行だよ。',
                '戻った戻った、まだ盤面を見てるからね。'
            ])
        }),
        WORK: Object.freeze({
            placeLines: Object.freeze([
                'ここで稼いで一発逆転や！',
                '布石いっぱい掘るでー！',
                'ワイには夢があるんや！',
                '一攫千金や！'
            ]),
            lostLine: 'あああああああああああああ',
            living_will_restored: Object.freeze([
                'まだ稼げる！ ここから巻き返しや！',
                '持ち直したで！ もうひと掘りや！',
                '危なかったわ、でもまだ働けるで！'
            ]),
            incomeLinesByStep: Object.freeze({
                1: '布石＋1 初儲けや！',
                2: '布石＋2 もっと掘るでー！',
                3: '布石＋4 順調やな！',
                4: '布石＋8 ぼろ儲けや！',
                5: '布石＋16 これで家族が養える...！'
            })
        }),
        ...SPECIAL_STONE_SCENARIO_BUBBLE_SPEECH
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
        PROTECTED_NEXT_STONE: '次の被弾だけ守る',
        SWAP_WITH_ENEMY: '敵石1個を奪取',
        POSITION_SWAP_WILL: '石2つの位置交換',
        PERMA_PROTECT_NEXT_STONE: '次石を永続保護',
        STRONG_WIND_WILL: '石を最長直線移動',
        SUPER_BUOYANCY_WILL: '石を上方向へ貫通移動',
        SUPER_GRAVITY_WILL: '石を下方向へ貫通移動',
        TRAP_WILL: '罠設置でターン終了',
        TEMPT_WILL: '敵特殊石を奪う',
        DOUBLE_CHAIN_WILL: '追加反転1回で三連鎖生成',
        TRIPLE_CHAIN_WILL: '追加反転2回で四連鎖生成',
        QUAD_CHAIN_WILL: '追加反転3回で無限連鎖生成',
        INFINITE_CHAIN_WILL: '追加反転できる限り継続',
        REGEN_WILL: '反転/破壊を3回まで巻戻す',
        DESTROY_ONE_STONE: '石1つを即破壊',
        TIME_BOMB: '3ターン後に爆破',
        ULTIMATE_REVERSE_DRAGON: '周囲反転を連発',
        BREEDING_WILL: '周囲へ石を増殖',
        CLONE_WILL: '隣接空きへ複製',
        SPLIT_WILL: '隣接空きへ分裂',
        TELEPORT_WILL: '石を空きへ転送',
        CELL_TELEPORT_WILL: '外側へ転送して穴化',
        CROSS_BOMB: '十字2マス爆破',
        X_BOMB: '斜め2マス爆破',
        DOUBLE_PLACE: '2連続で置き三連投石生成',
        TRIPLE_PLACE: '3連続で置き四連投石生成',
        QUAD_PLACE: '4連続で置き無限投石生成',
        INFINITE_PLACE: '合法手が尽きるまで置く',
        HEAVEN_BLESSING: '候補5枚から選択',
        CONDEMN_WILL: '相手手札1枚破壊',
        PLUNDER_WILL: '反転分を吸収',
        CORNER_TRIBUTE: '敵角4個以上で布石を奪う',
        WORK_WILL: '布石収入が増加',
        LOSS_WILL: '特殊石を全解除',
        GOLD_STONE: '反転布石4倍',
        RAINBOW_STONE: '反転布石6倍',
        SILVER_STONE: '反転布石3倍',
        CRYSTAL_STONE: '数字マス布石4倍',
        EXTEND_LIFE_WILL: '特殊石寿命2倍',
        EXTEND_LIFE_GOD: '特殊石寿命4倍',
        CORROSION_WILL: '特殊石寿命を半減',
        GUARD_WILL: '完全保護3ターン',
        DESTROY_DRAGON_WILL: '周囲敵1体破壊',
        ULTIMATE_DESTROY_GOD: '周囲敵を毎破壊',
        ULTIMATE_HYPERACTIVE_GOD: '直線移動を2回',
        BOARD_EXPANSION_WILL: '盤を1マス拡張',
        BOARD_EXPANSION_GOD: '角から3マス拡張',
        BLOCKADE_WILL: '空き1マス封鎖',
        METEOR_WILL: 'マスごと1セル破壊',
        FREEZE_WILL: '1マス凍結',
        OBSERVER_WILL: '観測成功で布石',
        HYPERACTIVE_WILL: '毎開幕1マス移動',
        HYPERACTIVE_INHERIT_WILL: '多動を10ターン付与',
        EXTREME_HYPERACTIVE_WILL: '移動後に隣接石を後退',
        ESCAPE_WILL: '離れる移動を継続',
        ROBOT_VACUUM_WILL: '敵を吸い込み移動',
        GLUTTONOUS_WILL: '敵を食べて進み2連続空腹で消滅',
        INSTANT_HYPERACTIVE_WILL: '即3回移動して消滅',
        REBUILD_WILL: '手札全破壊3ドロー',
        SUPPLY_WILL: '2ドロー',
        REINFORCEMENT_WILL: '内側の隣接マスへ通常石を増援',
        SALVATION_WILL: '前ターン破壊の通常石を復活'
    });
    function pickRandomLine(lines, prng) {
        if (!Array.isArray(lines) || lines.length === 0)
            return null;
        const source = (prng && typeof prng.random === 'function') ? prng : Math;
        let value = Number(source.random());
        if (!Number.isFinite(value))
            value = 0;
        if (value < 0)
            value = 0;
        if (value >= 1)
            value = 0.999999;
        const index = Math.floor(value * lines.length);
        return lines[Math.max(0, Math.min(lines.length - 1, index))] || null;
    }
    function resolveWorkIncomeLine(gained, incomeStep) {
        const normalizedStep = Number.isFinite(Number(incomeStep))
            ? Math.max(1, Math.min(5, Math.trunc(Number(incomeStep))))
            : null;
        if (normalizedStep && WORK_INCOME_LINES_BY_STEP[normalizedStep]) {
            return WORK_INCOME_LINES_BY_STEP[normalizedStep];
        }
        const g = Number(gained) || 0;
        const inferredStep = g >= 16 ? 5 : (g >= 8 ? 4 : (g >= 4 ? 3 : (g >= 2 ? 2 : 1)));
        return WORK_INCOME_LINES_BY_STEP[inferredStep] || WORK_INCOME_LINES_BY_STEP[1];
    }
    function normalizeSpecialStoneBubbleScenario(rawScenario) {
        if (rawScenario === null || typeof rawScenario === 'undefined')
            return null;
        const asString = String(rawScenario).trim();
        if (!asString)
            return null;
        const lower = asString.toLowerCase();
        return SPECIAL_STONE_BUBBLE_SCENARIO_ALIASES[lower] || lower;
    }
    function resolveSpecialStoneBubbleSpeechLines(speech, scenario) {
        if (!speech)
            return null;
        const key = normalizeSpecialStoneBubbleScenario(scenario);
        if (!key)
            return null;
        if (Array.isArray(speech[key]) && speech[key].length > 0) {
            return speech[key];
        }
        if (key === 'place' && Array.isArray(speech.placeLines) && speech.placeLines.length > 0) {
            return speech.placeLines;
        }
        if (key === 'destroy' && typeof speech.lostLine === 'string' && speech.lostLine) {
            return [speech.lostLine];
        }
        if (key === 'living_will_restored') {
            return GENERIC_LIVING_WILL_RESTORED_LINES;
        }
        return null;
    }
    function getSpecialStoneBubbleSpeech(type, scenario) {
        const key = String(type || '').trim().toUpperCase();
        const speech = SPECIAL_STONE_BUBBLE_SPEECH[key] || null;
        if (!speech)
            return null;
        if (arguments.length >= 2) {
            return resolveSpecialStoneBubbleSpeechLines(speech, scenario);
        }
        return speech;
    }
    function getSpecialStoneBubbleSpeechLines(type, scenario) {
        const speech = getSpecialStoneBubbleSpeech(type);
        return resolveSpecialStoneBubbleSpeechLines(speech, scenario);
    }
    function pickSpecialStoneBubbleSpeechLine(type, scenario, prng) {
        return pickRandomLine(getSpecialStoneBubbleSpeechLines(type, scenario), prng);
    }
    return {
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
}));
//# sourceMappingURL=turn_pipeline_phase_helpers.js.map