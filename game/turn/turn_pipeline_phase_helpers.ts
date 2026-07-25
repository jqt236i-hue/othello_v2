const SPECIAL_STONE_BUBBLE_SCENARIO_KEYS = Object.freeze([
    'place', 'destroy', 'duration_end', 'normal_revert',
    'proliferation_triggered', 'time_stop_triggered', 'time_stop_deity_triggered',
    'regen_triggered', 'zombie_infection', 'zombie_revived', 'card_nullified',
    'ghost_protected', 'escape_exploded', 'special_destroy_triggered', 'work_income',
    'income', 'self_destruct', 'living_will_restored'
]);

type SpeechEntry = Record<string, readonly string[] | Record<number, string>>;

function five(stem: string, a: string, b: string, c: string, d: string, e: string): readonly string[] {
    return Object.freeze([a, b, c, d, e].map((tail) => `${stem}${tail}`));
}

function voice(place: readonly string[], destroy: readonly string[], restored: readonly string[], extra: SpeechEntry = {}): SpeechEntry {
    return Object.freeze({ place, destroy, living_will_restored: restored, ...extra });
}

const SPECIAL_STONE_BUBBLE_SPEECH: Record<string, SpeechEntry> = Object.freeze({
    PROTECTED: voice(
        five('僕が守る', 'よ。', 'からね。', '、怖くても。', '、今度こそ。', '、一手だけでも。'),
        five('僕じゃ守れなかった', 'よ……。', 'んだね。', '、ごめん。', '、まただ。', '、悔しいよ。'),
        five('守れなかった子のため', '、戻るよ。', 'に立つよ。', '、まだ消えない。', 'にもう一手。', '、僕は生きる。'),
        { duration_end: five('僕の守りは', 'ここまでだよ。', '解けるよ。', '役目を終えたよ。', 'もう切れるね。', '一手ぶん届いた。') }
    ),
    PERMA_PROTECTED: voice(
        five('私はここで', '耐える。', '待つ。', '揺るがない。', '守り抜く。', '時を受け止める。'),
        five('私の守りも', 'ここまでか。', '砕けた。', '永遠ではない。', '届かなかった。', '終わる時が来た。'),
        five('待ち続けた約束がある', '、戻る。', '、まだ立つ。', '、終われない。', '、私は残る。', '、再び守る。')
    ),
    SNIPER: voice(
        five('私の照準は', '合っている。', '既に敵を捉えた。', '静かに定まった。', '一発で足りる。', '任務を外さない。'),
        five('私が先に落ちた', 'か。', '、任務失敗だ。', '、照準解除。', '、報告は以上。', '、無念だ。'),
        five('未送信の帰還報告がある', '、復帰する。', '、任務続行。', '、まだ撃てる。', '、私は戻る。', '、照準を戻す。'),
        { duration_end: five('私の狙撃任務は', '終了する。', 'ここまでだ。', '時間切れだ。', '撤収へ移る。', '完了とする。') }
    ),
    GHOST: voice(
        five('私なら', 'ここにいるよ。', '少し透けてるよ。', '触れられないよ。', '静かに漂うよ。', '向こう側から見るよ。'),
        five('私の輪郭が', '消えていくね。', 'ほどけるね。', 'もう保てない。', '夜へ戻るよ。', '薄くなるよ。'),
        five('最後のお別れを言うまで', '戻るね。', '消えないよ。', 'まだ漂うよ。', 'ここにいるよ。', 'もう一度だけ。'),
        {
            duration_end: five('私の幽かな時間は', '終わりだね。', 'もう満ちたよ。', '静かに閉じるよ。', 'ここまでだよ。', '夜へ返すね。'),
            ghost_protected: five('その一撃は', '私をすり抜けたよ。', '空を切ったね。', '届いてないよ。', '影に触れただけ。', '手応えがないでしょ。')
        }
    ),
    SACRIFICE: voice(
        five('私めが', '盾となりましょう。', 'その一手を預かります。', '誓いを果たします。', '主命を守ります。', '身代わりになります。'),
        five('私めの務めは', 'ここまでです。', '果たせませんでした。', '途絶えました。', '無念にございます。', 'これにて終幕です。'),
        five('守れなかった主君のため', '、再び盾に。', '、私めは戻る。', '、まだ倒れぬ。', '、誓いを継ぐ。', '、命を拾う。'),
        {
            duration_end: five('私めの任期は', '満ちました。', 'これにて終了です。', '静かに閉じます。', '役目を返上します。', 'ここまでにございます。'),
            card_nullified: five('その札は', '私めが断ちます。', 'ここで無効です。', '主へ届かせません。', 'この身で止めます。', '誓いにより封じます。')
        }
    ),
    AFTERIMAGE_WILL: voice(
        five('僕の輪郭は', 'どれが本物かな。', 'もう先にいるよ。', '追うほど遠いよ。', '影だけ残すよ。', '答えを隠すよ。'),
        five('僕の残像まで', '見切ったんだね。', '消える時だ。', '捕まったか。', 'ほどけていくよ。', '答えになったね。'),
        five('忘れた顔を探すため', '、僕は戻る。', '、影を結ぶよ。', '、まだ揺らぐ。', '、もう一度走る。', '、答えを追う。'),
        { normal_revert: five('僕の残像は', '普通へ戻るよ。', '使い切ったよ。', 'もう揺らがない。', '影を閉じるね。', 'ここで一つになる。') }
    ),
    TIME_STOP: voice(
        five('私の時計を', 'ここへ置きます。', '巻いておきますね。', '静かに合わせます。', '一刻進めましょう。', '盤へ預けます。'),
        five('私の時計が', '止まりましたね。', '壊れました。', '時を失いました。', '針を落としました。', '眠りにつきます。'),
        five('直せなかった大時計のため', '、戻ります。', '、針を起こします。', '、まだ刻みます。', '、時を拾います。', '、再び盤へ。'),
        { time_stop_triggered: five('皆さまの時を', '止めますね。', '少し預かります。', '一刻休ませます。', '静かに閉じます。', 'この針で留めます。') }
    ),
    TIME_STOP_DEITY: voice(
        five('我が刻を', '盤へ顕す。', '汝らへ授けよう。', 'ここに定める。', '永劫へ刻む。', '運命に重ねる。'),
        five('我が刻さえ', '砕けるか。', '終端を迎えるか。', '虚無へ還るか。', '閉じられたか。', '定めを外れたか。'),
        five('終末を見届けるため', '、我は還る。', '、刻を再び。', '、まだ滅びぬ。', '、輪廻を越える。', '、盤へ顕れる。'),
        { time_stop_deity_triggered: five('我が神刻に', '平伏せ。', '万象よ止まれ。', '盤上よ沈黙せよ。', '汝らの時はない。', '永劫の一瞬を見よ。') }
    ),
    REGEN: voice(
        five('俺の芽は', 'ここから伸びるぞ。', 'まだ元気だぞ。', '何度でも育つ。', '盤に根を張る。', 'へこたれないぞ。'),
        five('俺の芽が', '折れちまった。', '枯れたか。', 'ここで尽きるか。', '土へ戻るな。', '育ち切れなかった。'),
        five('枯らした畑を緑にするまで', '、俺は戻る。', '、まだ育つ。', '、根は残る。', '、諦めない。', '、もう一度だ。'),
        { regen_triggered: five('俺の再生は', 'ここからだ！', '大成功だ！', 'まだ止まらない！', '根っこから復活！', '元気満タンだ！') }
    ),
    ZOMBIE: voice(
        five('あたしゃ', 'ここで見てるよ。', 'まだ歩けるよ。', 'しぶとい婆だよ。', '墓には早いよ。', '孫を探すよ。'),
        five('あたしゃまた', '眠るだけさ。', '土へ帰るよ。', '倒れちまったね。', '墓へ戻るかね。', '孫に会えずじまいさ。'),
        five('孫の顔を見るまでは', '、起きるよ。', '、眠れないね。', '、あたしゃ戻る。', '、墓を出るよ。', '、まだ歩くよ。'),
        {
            zombie_infection: five('あたしの仲間に', 'おなりよ。', 'なっておくれ。', 'なる時間だよ。', 'してあげるよ。', '加わりな。'),
            zombie_revived: five('あたしゃ墓から', '戻ったよ。', 'また出たよ。', '起き上がったよ。', '這い出たよ。', '帰ってきたよ。')
        }
    ),
    DRAGON: voice(
        five('我が龍威を', '盤に刻む。', '刮目して見よ。', 'この地へ降ろす。', '牙に宿す。', '戦場へ示す。'),
        five('我が龍身も', 'ここで尽きるか。', '地へ伏すか。', '牙を折られたか。', '炎を失うか。', '敗北を知るか。'),
        five('守れなかった一族のため', '、我は甦る。', '、再び翔ぶ。', '、牙を取る。', '、まだ戦う。', '、炎を灯す。'),
        { duration_end: five('我が龍威は', 'ここで鎮まる。', '刻限を迎えた。', '石へ還る。', '戦を終える。', '眠りにつく。') }
    ),
    BREEDING: voice(
        five('私がみんなを', '育てるよ。', '増やしてあげる。', '温めてあげる。', 'ここで見守るよ。', '家族にするね。'),
        five('私の巣が', '壊れちゃったね。', '空になったね。', '冷えていくね。', 'ここで終わるね。', '守れなかったね。'),
        five('失った子どもを探すまで', '、私は戻る。', '、巣を守るよ。', '、まだ育てる。', '、手を離さない。', '、母でいるよ。'),
        { duration_end: five('私の子育ては', '今日はここまで。', 'ひと休みだね。', '時間になったね。', '巣を閉じるね。', '無事に終わったよ。') }
    ),
    PROLIFERATION: voice(
        five('ぼくらは', 'ここから増えるよ。', 'ひとりじゃないよ。', '遊びに来たよ。', 'みんなで立つよ。', '仲間を呼ぶよ。'),
        five('ぼくらが', 'ひとり減ったよ。', '消えちゃった。', 'ばらばらになるよ。', '遊べなくなるよ。', '寂しくなるよ。'),
        five('置いてきた仲間を迎えるまで', '、ぼくらは戻る。', '、まだ増えるよ。', '、手をつなぐよ。', '、消えないよ。', '、また遊ぶよ。'),
        {
            duration_end: five('ぼくらの増える時間は', 'おしまいだよ。', 'もう終わりだよ。', 'ここまでだね。', 'ひと休みだよ。', 'また今度だよ。'),
            proliferation_triggered: five('ぼくらがまた', '増えたよ！', 'ふたりになった！', '仲間を呼んだよ！', '広がったよ！', 'ひとり生まれた！')
        }
    ),
    HYPERACTIVE: voice(
        five('俺はもう', '走り出すぞ！', '止まれない！', '次へ行く！', 'じっとしない！', '盤を駆ける！'),
        five('俺の足が', '止まっちまった。', '捕まった！', '動かないぞ。', 'ここで終わるか。', '追いつかれた。'),
        five('助けに戻れなかった友のため', '、俺は走る。', '、まだ動く。', '、立ち上がる。', '、止まらない。', '、もう一周だ。'),
        { normal_revert: five('俺の全力は', 'ここまでだ！', '使い切った！', 'もう動けない！', '普通へ戻る！', 'ひと休みだ！') }
    ),
    EXTREME_HYPERACTIVE: voice(
        five('あたしが全部', 'ぶっ飛ばす！', '蹴散らす！', '踏み荒らす！', '騒がせる！', '退屈を壊す！'),
        five('あたしを', '止めやがったな。', '捕まえたか。', '黙らせる気か。', '倒したつもりか。', 'ここで終わらすか。'),
        five('閉じ込められた過去を壊すまで', '、あたしは戻る。', '、まだ暴れる。', '、また蹴る。', '、黙らない。', '、檻を破る。'),
        { normal_revert: five('あたしの暴走は', 'ここで打ち止め。', '燃料切れだ。', 'もう散らせない。', '普通へ戻る。', 'いったん終わり。') }
    ),
    ESCAPE_HYPERACTIVE: voice(
        five('私、ここから', '逃げるから！', '走るからね！', '捕まらないよ！', '生き残るよ！', '出口を探すよ！'),
        five('私、とうとう', '捕まったよ……。', '逃げ損ねたね。', '囲まれたよ。', '足が止まった。', '出口を失ったよ。'),
        five('帰れなかった家を探すまで', '、私は戻る！', '、まだ逃げる！', '、走り続ける！', '、諦めない！', '、出口へ行く！'),
        { escape_exploded: five('私、逃げ道がないなら', '爆発する！', '吹き飛ぶから！', '巻き込むよ！', '派手に散る！', '盤を荒らす！') }
    ),
    ROBOT_VACUUM: voice(
        five('当機は', '清掃を開始します。', '敵石を回収します。', '盤面を整えます。', '稼働を確認しました。', '吸引任務へ移ります。'),
        five('当機は', '機能を停止します。', '破損しました。', '任務を中断します。', '電力を失いました。', '廃棄状態へ移行します。'),
        five('捨てられた家へ帰還するため', '、当機は復帰。', '、再起動します。', '、任務を継続。', '、停止しません。', '、再び清掃。'),
        {
            duration_end: five('当機の清掃時間は', '終了しました。', '満了しました。', 'ここまでです。', '規定に達しました。', '通常状態へ移行。'),
            normal_revert: five('当機の移動候補は', 'ゼロです。', '存在しません。', '枯渇しました。', '検出できません。', '通常化を要求。')
        }
    ),
    GLUTTONOUS: voice(
        Object.freeze(['いっぱい食べる俺が好き', '俺の腹に全部よこせ！', '俺は敵石までいただくぞ！', '俺の飯場はここだ！', '俺は空腹で強くなる！']),
        five('俺の腹が', '満ちる前に終わるか。', '空のままだ。', 'もう食えない。', '負けを噛んでる。', '最後まで鳴ってる。'),
        five('飢えた弟に食わせるまでは', '、俺は戻る。', '、まだ食う。', '、腹は止まらん。', '、倒れられない。', '、もう一皿だ。')
    ),
    WILL_HUNTER_KING: voice(
        five('余の狩場へ', 'ようこそ。', '異能を差し出せ。', '獲物が来たな。', '王が降りたぞ。', '首を並べよ。'),
        five('余を討つとは', 'よい度胸だ。', '王殺しか。', '見事である。', '狩りも終幕か。', '玉座が遠のくな。'),
        five('滅びた王国を取り戻すまで', '、余は還る。', '、王は死なぬ。', '、狩りを続ける。', '、玉座へ戻る。', '、再び立つ。'),
        {
            duration_end: five('余の狩猟時間は', 'ここまでだ。', '満ちたようだ。', '閉幕とする。', '今日は終いだ。', '玉座へ戻る。'),
            special_destroy_triggered: five('余が異能を', '狩り取ったぞ。', 'また討ったぞ。', '王手で潰した。', '首級に加えた。', '見事に断った。')
        }
    ),
    WORK: voice(
        five('わいはここで', '働くで！', '稼ぐんや！', '家計を支えるで！', '一旗揚げるで！', '汗かくで！'),
        five('わいの仕事場が', '潰れたわ。', 'なくなったで。', '閉店や。', '更地やないか。', '終わってもうた。'),
        five('家族を食わせるため', '、わいは戻るで！', '、まだ働くで！', '、休めへん！', '、もう一稼ぎや！', '、踏ん張るで！'),
        {
            duration_end: five('わいの勤務は', 'ここまでや。', '定時やで。', 'もう上がりや。', '店じまいや。', '今日は終了や。'),
            incomeLinesByStep: Object.freeze({ 1: '布石＋1、初給料や！', 2: '布石＋2、残業代やで！', 3: '布石＋4、家計が助かるわ！', 4: '布石＋8、今月は黒字や！', 5: '布石＋16、家族にご馳走や！' })
        }
    ),
    ULTIMATE_WORK_GOD: Object.freeze({
        income: Object.freeze([
            'もっと稼がないと……。',
            'まだ足りない……もっと働かないと。',
            '休んでいる暇なんてない……。',
            'あと少し……もう少し稼げば。',
            'あの人を救うには、まだ足りない……。'
        ]),
        self_destruct: Object.freeze([
            'もう……何のために働いていたんだろう。',
            '何も救えないなら……もういい。',
            '心が……もう動かない。',
            '稼いでも、失うだけだった……。',
            'もう……立ち上がれない。'
        ]),
        destroy: Object.freeze([
            'まただ……あの時も、お金が足りなくて救えなかった。',
            'あと少し稼げていたら、あの人は……。',
            'この手はまた、大切な人を救えなかった……。',
            'あの時も、お金がなくて間に合わなかった……。',
            'あの日の未練まで、砕かれるのか……。'
        ]),
        living_will_restored: Object.freeze([
            'まだ働ける……今度こそ間に合わせる。',
            'もう一度だけ……あの人のために。',
            '戻れたなら、まだ稼げる……。',
            '今度は救う……絶対に。',
            '未練がある限り、まだ倒れられない……。'
        ])
    }),
    STONE_SALVATION_GOD: voice(
        five('私の祈りで', '石を救いましょう。', '迷いを包みます。', '盤を照らします。', '帰る道を示します。', '傷を抱き留めます。'),
        five('私の祈りが', '途切れます。', '届きませんでした。', '光を失います。', 'ここで沈みます。', '救いを残せません。'),
        five('救えなかった魂を導くまで', '、私は戻ります。', '、祈り続けます。', '、光を灯します。', '、手を伸ばします。', '、まだ眠れません。'),
        { duration_end: five('私の救済は', 'ここまでです。', '時を満たしました。', '静かに閉じます。', '祈りへ戻ります。', '盤へ託します。') }
    ),
    DESTROY_DRAGON: voice(
        five('俺の牙で', '一つずつ壊す。', '敵を噛み砕く。', '狙いを外さない。', '邪魔を消す。', '盤を切り開く。'),
        five('俺の牙まで', '折れたか。', '砕かれたな。', '届かなかった。', 'ここで止まるか。', '鈍っちまった。'),
        five('守れなかった相棒のため', '、俺は戻る。', '、もう一度噛む。', '、牙を研ぐ。', '、まだ戦う。', '、敵を討つ。'),
        { duration_end: five('俺の破壊は', 'ここまでだ。', '時間切れだ。', 'もう終わりだ。', '牙をしまう。', '一度休む。') }
    ),
    LIGHTNING: voice(
        five('あたしの雷で', '痺れな！', '目を覚ましな！', '盤を照らすよ！', '敵を焼くよ！', '派手にいくよ！'),
        five('あたしの火花が', '消えちまうよ。', '散っちゃった。', '地へ落ちたね。', 'もう鳴らない。', '雨に負けたよ。'),
        five('嵐で失った故郷を照らすまで', '、あたしは戻る！', '、まだ光る！', '、また落ちる！', '、雷は消えない！', '、空へ昇る！'),
        { duration_end: five('あたしの雷雲は', '通り過ぎたよ。', 'もう晴れるよ。', 'ここで消えるよ。', '放電終了！', '空へ帰るよ。') }
    ),
    ULTIMATE_DESTROY_GOD: voice(
        five('私の破壊劇を', '始めましょう。', 'ご覧なさい。', '華麗に開幕します。', '盤へ捧げます。', '存分に味わって。'),
        five('私の終幕まで', '美しいでしょう。', '見届けなさい。', '破壊されたのね。', '喝采をください。', '幕が降ります。'),
        five('忘れられた名を刻むため', '、私は再演します。', '、まだ壊します。', '、神座へ戻ります。', '、幕を上げます。', '、終われません。'),
        { duration_end: five('私の破壊公演は', 'これにて終幕。', '満員御礼です。', '時間となりました。', '幕を閉じましょう。', '次幕へ続きます。') }
    ),
    ULTIMATE_HYPERACTIVE: voice(
        five('私は', '走る。', '止まらない。', '先へ行く。', '一瞬で着く。', '盤を抜ける。'),
        five('私は', '止められた。', '追いつかれた。', 'ここで終わる。', '速度を失った。', 'まだ足りない。'),
        five('置き去りにした友へ戻るため', '、私は走る。', '、再起する。', '、まだ速い。', '、止まらない。', '、時を越える。'),
        {
            duration_end: five('私の神速は', '終了。', 'ここまで。', '使い切った。', '通常へ戻る。', '一度止まる。'),
            normal_revert: five('私の走路は', 'もうない。', '閉じた。', '尽きた。', '通常へ戻る。', 'ここで止まる。')
        }
    ),
    METEOR_GOD: voice(
        five('私が因果を', '裁定する。', '抹消する。', '盤から除く。', '穴へ還す。', 'ここに断つ。'),
        five('私の因果も', 'ここで尽きる。', '裁かれたか。', '断たれた。', '穴へ沈む。', '終端を迎える。'),
        five('消した者の名を償うまで', '、私は戻る。', '、裁定を続ける。', '、まだ消えない。', '、因果を結ぶ。', '、盤へ立つ。'),
        { duration_end: five('私の因果裁定は', '終了する。', '刻限を迎えた。', 'ここで閉じる。', '盤へ返す。', '抹消を止める。') }
    )
});

const WORK_INCOME_LINES_BY_STEP = SPECIAL_STONE_BUBBLE_SPEECH.WORK.incomeLinesByStep as Record<number, string>;

function pickRandomLine(lines: readonly string[] | null | undefined, prng?: { random?: () => number }): string | null {
    if (!Array.isArray(lines) || lines.length === 0) return null;
    let value = Number(prng && typeof prng.random === 'function' ? prng.random() : Math.random()); // network-authority-random-allowlist: presentation text only
    if (!Number.isFinite(value)) value = 0;
    value = Math.max(0, Math.min(0.999999, value));
    return lines[Math.floor(value * lines.length)] || null;
}

function resolveWorkIncomeLine(gained: unknown, incomeStep: unknown): string {
    const step = Number.isFinite(Number(incomeStep)) ? Math.max(1, Math.min(5, Math.trunc(Number(incomeStep)))) : null;
    if (step && WORK_INCOME_LINES_BY_STEP[step]) return WORK_INCOME_LINES_BY_STEP[step];
    const amount = Number(gained) || 0;
    const inferred = amount >= 16 ? 5 : amount >= 8 ? 4 : amount >= 4 ? 3 : amount >= 2 ? 2 : 1;
    return WORK_INCOME_LINES_BY_STEP[inferred];
}

function getSpecialStoneBubbleSpeech(type: string, scenario?: string): SpeechEntry | readonly string[] | null {
    const speech = SPECIAL_STONE_BUBBLE_SPEECH[String(type || '').trim().toUpperCase()] || null;
    if (!speech) return null;
    return arguments.length >= 2 ? getSpecialStoneBubbleSpeechLines(type, scenario || '') : speech;
}

function getSpecialStoneBubbleSpeechLines(type: string, scenario: string): readonly string[] | null {
    const speech = SPECIAL_STONE_BUBBLE_SPEECH[String(type || '').trim().toUpperCase()] || null;
    if (!speech) return null;
    const value = speech[String(scenario || '').trim().toLowerCase().replace(/-/g, '_')];
    return Array.isArray(value) ? value : null;
}

function pickSpecialStoneBubbleSpeechLine(type: string, scenario: string, prng?: { random?: () => number }): string | null {
    return pickRandomLine(getSpecialStoneBubbleSpeechLines(type, scenario), prng);
}

export {
    SPECIAL_STONE_BUBBLE_SCENARIO_KEYS, SPECIAL_STONE_BUBBLE_SPEECH, WORK_INCOME_LINES_BY_STEP,
    getSpecialStoneBubbleSpeech, getSpecialStoneBubbleSpeechLines, pickSpecialStoneBubbleSpeechLine,
    pickRandomLine, resolveWorkIncomeLine
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SPECIAL_STONE_BUBBLE_SCENARIO_KEYS, SPECIAL_STONE_BUBBLE_SPEECH, WORK_INCOME_LINES_BY_STEP,
        getSpecialStoneBubbleSpeech, getSpecialStoneBubbleSpeechLines, pickSpecialStoneBubbleSpeechLine,
        pickRandomLine, resolveWorkIncomeLine
    };
}
