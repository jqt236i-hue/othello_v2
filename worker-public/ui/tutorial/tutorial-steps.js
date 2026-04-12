(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.TutorialStepsModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const DEFAULT_SCENARIO_ID = 'chapter0';
    const SCENARIO_KINDS = deepFreeze({
        TUTORIAL: 'tutorial',
        STORY: 'story'
    });
    const OBSERVER_NAME = '盤理の観測者';
    const OBSERVER_STAGE_TOP = 'top';
    const OBSERVER_IMAGE_SRC = 'assets/images/cpu/level6.png';
    const STUDENT_ROOM_BG_SRC = 'assets/story/background/ただの学生の部屋.png';
    const FOREST_BG_SRC = 'assets/story/background/森背景.png';
    const REAL_WORLD_HERO_NAME = '現実世界の勇者';
    const REAL_WORLD_HERO_IMAGE_SRC = 'assets/story/hero/現実世界の勇者.png';

    function deepFreeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.freeze(value);
        for (const key of Object.keys(value)) {
            deepFreeze(value[key]);
        }
        return value;
    }

    function buildChoiceResponseMap(step) {
        if (!step || !Array.isArray(step.responses)) return {};
        const out = {};
        for (const response of step.responses) {
            if (!response || !response.choiceId) continue;
            out[String(response.choiceId)] = response;
        }
        return out;
    }

    const STEP_ID_PATTERNS = deepFreeze({
        main: /^STEP_\d{3}$/,
        modernIntro: /^INTRO_SCENE_00[1-4]$/,
        observerIntro: /^(INTRO_SCENE_005|INTRO_BRANCH)$/
    });

    const STEP_PRESETS = deepFreeze({
        modernIntroScene: {
            characterVisible: true,
            characterImageSrc: REAL_WORLD_HERO_IMAGE_SRC,
            characterImageAlt: REAL_WORLD_HERO_NAME,
            sceneBackgroundSrc: STUDENT_ROOM_BG_SRC
        },
        observerIntroScene: {
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            sceneBackgroundSrc: FOREST_BG_SRC,
            observerStage: OBSERVER_STAGE_TOP
        },
        observerBoardScene: {
            observerVisible: true,
            observerStage: OBSERVER_STAGE_TOP
        }
    });

    function resolveChapter0StepDefaults(step) {
        const stepId = step && step.id ? String(step.id) : '';
        if (STEP_ID_PATTERNS.modernIntro.test(stepId)) return STEP_PRESETS.modernIntroScene;
        if (STEP_ID_PATTERNS.observerIntro.test(stepId)) return STEP_PRESETS.observerIntroScene;
        if (STEP_ID_PATTERNS.main.test(stepId)) return STEP_PRESETS.observerBoardScene;
        return null;
    }

    function normalizeScenarioSteps(stepDefinitions, resolveDefaults) {
        const steps = [];
        const stepsById = {};
        for (const stepDefinition of stepDefinitions) {
            const defaults = typeof resolveDefaults === 'function' ? resolveDefaults(stepDefinition) : null;
            const normalized = deepFreeze(Object.assign({}, defaults || {}, stepDefinition, {
                responseMap: buildChoiceResponseMap(stepDefinition)
            }));
            steps.push(normalized);
            stepsById[normalized.id] = normalized;
        }
        return deepFreeze({
            steps,
            stepsById
        });
    }

    function createScenarioRecord(definition) {
        const source = definition && typeof definition === 'object' ? definition : {};
        return deepFreeze(Object.assign({
            kind: SCENARIO_KINDS.TUTORIAL,
            progressionGroup: SCENARIO_KINDS.TUTORIAL,
            progressionId: source.id || null,
            unlocksScenarioIds: []
        }, source));
    }

    const chapter0StepDefinitions = [
        {
            id: 'INTRO_SCENE_001',
            chapterLabel: '0章 導入',
            type: 'dialogue',
            sceneTransition: 'fade_black',
            speaker: 'ただの学生',
            emotion: 'normal',
            text: [
                '退屈だなー、どのボードゲームやっても俺強すぎて相手がいなくなっちゃう。唯一相手してくれるのはAIだけ。',
                'どうせ新しいボードゲーム始めても最強になっちゃうし、何か良い刺激はないかな～'
            ],
            next: 'INTRO_SCENE_002'
        },
        {
            id: 'INTRO_SCENE_002',
            chapterLabel: '0章 導入',
            type: 'dialogue',
            speaker: '???',
            emotion: 'mystic',
            text: [
                'ミツケタゾ...キュウセイシュヨ...ココヘ..ワレヲ..'
            ],
            next: 'INTRO_SCENE_003'
        },
        {
            id: 'INTRO_SCENE_003',
            chapterLabel: '0章 導入',
            type: 'dialogue',
            speaker: 'ただの学生',
            emotion: 'surprised',
            text: [
                '声がする...？頭の中に直接...！？',
                'うわああああああああああああ'
            ],
            next: 'INTRO_SCENE_004'
        },
        {
            id: 'INTRO_SCENE_004',
            chapterLabel: '0章 導入',
            type: 'dialogue',
            speaker: '',
            emotion: 'normal',
            text: [
                '(床に魔法陣が現れ、視界がモノクロになり、体がバラバラになった)'
            ],
            next: 'INTRO_SCENE_005'
        },
        {
            id: 'INTRO_SCENE_005',
            chapterLabel: '0章 導入',
            type: 'dialogue',
            sceneTransition: 'fade_black',
            speaker: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                'ようこそ。オセロの勇者よ。ここはオセロが不可逆的に何者かに書き換えられてしまった世界だ。',
                '私はこの星で行われている対局を全て観測している、『観測者』と呼んでくれ。',
                '目的は書き換えられる前の美しいオセロを取り戻すこと、強制対局させられている全ての生命を解放すること、そして、オセロを書き換えた黒幕を暴き始末すること。',
                'そのために観測して突破口を探しているが、行き詰まっている。だからお主、前世で最もゲームが強いお主を召喚した。',
                'お主にはこの異常なオセロ通称“カードオセロ”で最強になってもらう。私と一緒に美しいオセロを取り戻し、生命を強制対局から解放し、黒幕を始末しようではないか！'
            ],
            next: 'INTRO_BRANCH'
        },
        {
            id: 'INTRO_BRANCH',
            chapterLabel: '0章 導入',
            type: 'choice',
            prompt: '',
            choices: [
                { id: 'intro_yes', label: 'はい' },
                { id: 'intro_no', label: 'いいえ' }
            ],
            responses: [
                {
                    choiceId: 'intro_yes',
                    speaker: OBSERVER_NAME,
                    emotion: 'smile',
                    text: '感謝しよう。それではルール説明に入るぞ！'
                },
                {
                    choiceId: 'intro_no',
                    speaker: OBSERVER_NAME,
                    emotion: 'serious',
                    headBubbleText: 'お前には失望したよ。ここで消えてもらおうか。',
                    text: 'お前には失望したよ。ここで消えてもらおうか。'
                }
            ],
            nextByChoice: {
                intro_yes: 'STEP_001',
                intro_no: null
            },
            actionByChoice: {
                intro_yes: 'start_main_tutorial',
                intro_no: 'start_observer_duel'
            }
        },
        {
            id: 'STEP_001',
            chapterLabel: 'CHAPTER 1 導入',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'normal',
            text: [
                'ふふっ。来たか、オセロの勇者。',
                'では始めよう。この世界の理を、私が順に教えてやる。'
            ],
            next: 'STEP_002'
        },
        {
            id: 'STEP_002',
            chapterLabel: 'CHAPTER 1 導入',
            type: 'choice',
            prompt: 'どう返す？',
            choices: [
                { id: 'straight_1', label: 'よろしく頼む', addPersonality: { straight: 1 } },
                { id: 'snark_1', label: '話が大きすぎる', addPersonality: { snark: 1 } },
                { id: 'bold_1', label: '要するに勝てばいいんだろ', addPersonality: { bold: 1 } }
            ],
            responses: [
                { choiceId: 'straight_1', speaker: OBSERVER_NAME, emotion: 'smile', text: 'うむ、素直で助かる。そういう勇者は嫌いではない。' },
                { choiceId: 'snark_1', speaker: OBSERVER_NAME, emotion: 'amused', text: '当然だ。この世界は実際に厄介だからな。だが、すぐ慣れる。' },
                { choiceId: 'bold_1', speaker: OBSERVER_NAME, emotion: 'smile', text: '……ふふ、乱暴だな。だがそのくらいでよい。' }
            ],
            next: 'STEP_003'
        },
        {
            id: 'STEP_003',
            chapterLabel: 'CHAPTER 1 導入',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                'まずは盤面を見るのだ。',
                '緑に光っている場所が、今お主の置ける場所だ。'
            ],
            next: 'STEP_004'
        },
        {
            id: 'STEP_004',
            chapterLabel: 'CHAPTER 2 最初の一手',
            type: 'choice',
            prompt: 'どう返す？',
            choices: [
                { id: 'straight_2', label: 'わかった', addPersonality: { straight: 1 } },
                { id: 'timid_1', label: '少し緊張してきた', addPersonality: { straight: 1 } },
                { id: 'bold_2', label: '見れば分かる', addPersonality: { bold: 1 } }
            ],
            responses: [
                { choiceId: 'straight_2', speaker: OBSERVER_NAME, emotion: 'smile', text: 'いい返事だ。では行け。' },
                { choiceId: 'timid_1', speaker: OBSERVER_NAME, emotion: 'soft', text: 'ふふ、初めてなら当然だ。だが安心しろ、盤は逃げぬ。' },
                { choiceId: 'bold_2', speaker: OBSERVER_NAME, emotion: 'amused', text: '言うな。そういう顔で崩れる者も多いのだぞ？' }
            ],
            next: 'STEP_005'
        },
        {
            id: 'STEP_005',
            chapterLabel: 'CHAPTER 2 最初の一手',
            type: 'action_wait',
            overlayMode: 'passthrough',
            instruction: '緑マーカーのあるマスを1つ押して石を置く',
            highlight: 'board.validMoves',
            lock: ['hand', 'useButton', 'destroyButton', 'passButton'],
            successCondition: { playerPlacedStone: true },
            next: 'STEP_006'
        },
        {
            id: 'STEP_006',
            chapterLabel: 'CHAPTER 2 最初の一手',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'smile',
            text: [
                'うん、いいじゃないか。',
                '相手の石を挟めば、石は反転する。ここまでは普通のオセロと同じだ。'
            ],
            next: 'STEP_007'
        },
        {
            id: 'STEP_007',
            chapterLabel: 'CHAPTER 3 反転と布石',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                'だが、この世界はそれだけでは終わらぬ。',
                '反転させた枚数ぶん、お主は布石を得る。'
            ],
            next: 'STEP_008'
        },
        {
            id: 'STEP_008',
            chapterLabel: 'CHAPTER 3 反転と布石',
            type: 'choice',
            prompt: 'どう思う？',
            choices: [
                { id: 'ask_charge', label: '布石ってそんなに大事なのか？', addPersonality: { straight: 1 } },
                { id: 'fun_1', label: 'ちょっと面白くなってきた', addPersonality: { bold: 1 } },
                { id: 'snark_2', label: 'ややこしいな', addPersonality: { snark: 1 } }
            ],
            responses: [
                { choiceId: 'ask_charge', speaker: OBSERVER_NAME, emotion: 'serious', text: '大事どころではない。この世界では、力そのものだ。' },
                { choiceId: 'fun_1', speaker: OBSERVER_NAME, emotion: 'smile', text: '……ほう。もうその顔になるか。見込みがあるな。' },
                { choiceId: 'snark_2', speaker: OBSERVER_NAME, emotion: 'amused', text: '安心しろ。最初は皆そう言う。すぐにもっとややこしくなる。' }
            ],
            next: 'STEP_009'
        },
        {
            id: 'STEP_009',
            chapterLabel: 'CHAPTER 3 反転と布石',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                '反転は盤面の得であると同時に、次の行動の資源にもなる。',
                'それが、この世界のいやらしくも面白いところだ。'
            ],
            next: 'STEP_010'
        },
        {
            id: 'STEP_010',
            chapterLabel: 'CHAPTER 4 手番の流れとドロー',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'normal',
            text: [
                '次は手番の流れだ。',
                'お主の手番が始まると、まずカードを1枚引く。'
            ],
            next: 'STEP_011'
        },
        {
            id: 'STEP_011',
            chapterLabel: 'CHAPTER 4 手番の流れとドロー',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'normal',
            text: [
                'そのあと、必要ならカードを1枚使える。',
                '使わずにそのまま石を置いてもよい。'
            ],
            next: 'STEP_012'
        },
        {
            id: 'STEP_012',
            chapterLabel: 'CHAPTER 4 手番の流れとドロー',
            type: 'choice',
            prompt: 'どう返す？',
            choices: [
                { id: 'straight_3', label: 'なるほど', addPersonality: { straight: 1 } },
                { id: 'fear_cards', label: 'カードはあまり得意じゃない', addPersonality: { straight: 1 } },
                { id: 'bold_3', label: 'じゃあ使いどころ勝負か', addPersonality: { bold: 1 } }
            ],
            responses: [
                { choiceId: 'straight_3', speaker: OBSERVER_NAME, emotion: 'smile', text: 'うむ。飲み込みは悪くない。' },
                { choiceId: 'fear_cards', speaker: OBSERVER_NAME, emotion: 'soft', text: '最初から得意な者などおらぬ。扱いながら覚えれば十分だ。' },
                { choiceId: 'bold_3', speaker: OBSERVER_NAME, emotion: 'smile', text: 'そういうことだ。力は、切るタイミングで価値が変わる。' }
            ],
            next: 'STEP_013'
        },
        {
            id: 'STEP_013',
            chapterLabel: 'CHAPTER 5 カードを見る',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'normal',
            enterSetupKey: 'ensure_observer_card_ready',
            text: [
                'では手札を見てみよ。',
                '手札を押すと、右のカード詳細で内容を確認できる。'
            ],
            next: 'STEP_014'
        },
        {
            id: 'STEP_014',
            chapterLabel: 'CHAPTER 5 カードを見る',
            type: 'action_wait',
            overlayMode: 'passthrough',
            instruction: '手札の指定カードを押して詳細を開く',
            highlight: ['tutorialTargetCard', 'cardDetailPanel'],
            lock: ['board'],
            successCondition: { selectedCardId: 'observer_01' },
            next: 'STEP_015'
        },
        {
            id: 'STEP_015',
            chapterLabel: 'CHAPTER 5 カードを見る',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'smile',
            text: [
                'よし。今見ているのは『盤理の観測者』だ。',
                'コスト1で使え、次に置く石を観測者石に変える。',
                '観測者石は、所有者ターン開始時に30%で布石を1〜5獲得する。5ターン持続だ。'
            ],
            meta: { existingCardRef: 'observer_01' },
            next: 'STEP_016'
        },
        {
            id: 'STEP_016',
            chapterLabel: 'CHAPTER 5 カードを見る',
            type: 'choice',
            prompt: 'どう返す？',
            choices: [
                { id: 'straight_4', label: '思ったより使いやすそうだ', addPersonality: { straight: 1 } },
                { id: 'snark_3', label: '名前からして怪しい', addPersonality: { snark: 1 } },
                { id: 'bold_4', label: 'つまり強い場所に置けばいいんだな', addPersonality: { bold: 1 } }
            ],
            responses: [
                { choiceId: 'straight_4', speaker: OBSERVER_NAME, emotion: 'smile', text: 'うむ、導入役としてはちょうどよい。' },
                { choiceId: 'snark_3', speaker: OBSERVER_NAME, emotion: 'amused', text: '怪しいのは否定せぬ。だが役には立つ。' },
                { choiceId: 'bold_4', speaker: OBSERVER_NAME, emotion: 'serious', text: 'その理解でよい。残りやすい場所へ置くほど価値は上がる。' }
            ],
            next: 'STEP_017'
        },
        {
            id: 'STEP_017',
            chapterLabel: 'CHAPTER 6 数字マス',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'serious',
            enterSetupKey: 'prepare_numeric_demo',
            text: [
                '次は数字マスだ。',
                '数字の刻まれたマスに置くと、追加で布石を得られる。'
            ],
            next: 'STEP_018'
        },
        {
            id: 'STEP_018',
            chapterLabel: 'CHAPTER 6 数字マス',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'normal',
            text: [
                'つまりこの世界では、どこに置くかがただの陣地取りでは終わらぬ。',
                '盤を取る意味と、布石を稼ぐ意味が重なっている。'
            ],
            next: 'STEP_019'
        },
        {
            id: 'STEP_019',
            chapterLabel: 'CHAPTER 6 数字マス',
            type: 'choice',
            prompt: 'どう感じる？',
            choices: [
                { id: 'straight_5', label: '考えることが増えるな', addPersonality: { straight: 1 } },
                { id: 'fun_2', label: '欲張りたくなるな', addPersonality: { bold: 1 } },
                { id: 'snark_4', label: '普通のオセロに戻れなくなりそうだ', addPersonality: { snark: 1 } }
            ],
            responses: [
                { choiceId: 'straight_5', speaker: OBSERVER_NAME, emotion: 'serious', text: 'そうだ。その増えた一段が、この世界の深さでもある。' },
                { choiceId: 'fun_2', speaker: OBSERVER_NAME, emotion: 'amused', text: '欲張る者は崩れやすい。だが欲を知らぬ者も勝てぬ。' },
                { choiceId: 'snark_4', speaker: OBSERVER_NAME, emotion: 'smile', text: 'ふふ、それはもう手遅れかもしれぬな。' }
            ],
            next: 'STEP_020'
        },
        {
            id: 'STEP_020',
            chapterLabel: 'CHAPTER 6 数字マス',
            type: 'action_wait',
            overlayMode: 'passthrough',
            instruction: '光っている数字マスに石を置く',
            highlight: 'board.numericValidMove',
            lock: ['hand', 'useButton', 'destroyButton', 'passButton'],
            successCondition: { playerPlacedOnNumericCell: true },
            next: 'STEP_021'
        },
        {
            id: 'STEP_021',
            chapterLabel: 'CHAPTER 6 数字マス',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'smile',
            text: [
                '今ので分かっただろう。',
                '一手の価値が一つではない。それがカードオセロだ。'
            ],
            next: 'STEP_022'
        },
        {
            id: 'STEP_022',
            chapterLabel: 'CHAPTER 7 カードを実際に使う',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'serious',
            enterSetupKey: 'prepare_observer_use_demo',
            text: [
                'では、今度は実際にカードを使ってみる。',
                'カードは布石を消費して使う。現行UIでは、手札を選んで『使用』を押す。'
            ],
            meta: { controlRef: 'useButton' },
            next: 'STEP_023'
        },
        {
            id: 'STEP_023',
            chapterLabel: 'CHAPTER 7 カードを実際に使う',
            type: 'choice',
            prompt: 'どうする？',
            choices: [
                { id: 'straight_6', label: 'やってみる', addPersonality: { straight: 1 } },
                { id: 'timid_2', label: '失敗したらどうする', addPersonality: { straight: 1 } },
                { id: 'bold_5', label: 'これで流れを変える', addPersonality: { bold: 1 } }
            ],
            responses: [
                { choiceId: 'straight_6', speaker: OBSERVER_NAME, emotion: 'smile', text: 'うむ。その一歩を踏み出せる者は強い。' },
                { choiceId: 'timid_2', speaker: OBSERVER_NAME, emotion: 'soft', text: '失敗も観測のうちだ。今は大崩れせぬよう見ていてやる。' },
                { choiceId: 'bold_5', speaker: OBSERVER_NAME, emotion: 'smile', text: 'いい目だ。では、その勢いを盤上で証明してみせよ。' }
            ],
            next: 'STEP_024'
        },
        {
            id: 'STEP_024',
            chapterLabel: 'CHAPTER 7 カードを実際に使う',
            type: 'action_wait',
            overlayMode: 'passthrough',
            instruction: '『盤理の観測者』を選び、『使用』を押す',
            highlight: ['hand.observer_01', 'useButton'],
            lock: ['board', 'destroyButton', 'passButton'],
            successCondition: { usedCardId: 'observer_01' },
            next: 'STEP_025'
        },
        {
            id: 'STEP_025',
            chapterLabel: 'CHAPTER 7 カードを実際に使う',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'smile',
            text: [
                'よし。これで次に置く石が観測者石になる。',
                'こういう“次に置く石へ効果を乗せるカード”は、この世界では基本の一群だ。'
            ],
            next: 'STEP_026'
        },
        {
            id: 'STEP_026',
            chapterLabel: 'CHAPTER 7 カードを実際に使う',
            type: 'action_wait',
            overlayMode: 'passthrough',
            instruction: '次に置ける場所へ石を置く',
            highlight: 'board.validMoves',
            lock: ['hand', 'useButton', 'destroyButton', 'passButton'],
            successCondition: { playerPlacedStoneAfterObserver: true },
            next: 'STEP_027'
        },
        {
            id: 'STEP_027',
            chapterLabel: 'CHAPTER 7 カードを実際に使う',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'smile',
            text: [
                'それが観測者石だ。',
                '配置時や成功時には、既存仕様どおり石の近くに吹き出しを出せる。'
            ],
            meta: { observerBubbleRef: true },
            next: 'STEP_028'
        },
        {
            id: 'STEP_028',
            chapterLabel: 'CHAPTER 7 カードを実際に使う',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                'ここで覚えるべきことは一つ。',
                'カードは派手なだけの飾りではない。盤面の意味を変える武器だ。'
            ],
            next: 'STEP_029'
        },
        {
            id: 'STEP_029',
            chapterLabel: 'CHAPTER 8 パス・手札上限・勝利条件・締め',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'normal',
            text: [
                'まだ大事なことがある。',
                '手札の上限は5枚だ。抱え込みすぎると新たなドローが無駄になる。'
            ],
            meta: { handLimitRef: true },
            next: 'STEP_030'
        },
        {
            id: 'STEP_030',
            chapterLabel: 'CHAPTER 8 パス・手札上限・勝利条件・締め',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'normal',
            text: [
                'そして、置ける場所がないときは終わりではない。',
                'カードを使うか、それも無理なら『パス』を押して手番を渡す。'
            ],
            next: 'STEP_031'
        },
        {
            id: 'STEP_031',
            chapterLabel: 'CHAPTER 8 パス・手札上限・勝利条件・締め',
            type: 'choice',
            prompt: 'どう返す？',
            choices: [
                { id: 'straight_7', label: '意外と逃げ道はあるんだな', addPersonality: { straight: 1 } },
                { id: 'snark_5', label: '面倒な世界だな', addPersonality: { snark: 1 } },
                { id: 'bold_6', label: '打てなくても諦める必要はないってことか', addPersonality: { bold: 1 } }
            ],
            responses: [
                { choiceId: 'straight_7', speaker: OBSERVER_NAME, emotion: 'smile', text: 'そうだ。詰んだように見える盤でも、手は残っていることがある。' },
                { choiceId: 'snark_5', speaker: OBSERVER_NAME, emotion: 'amused', text: '否定はせぬ。だからこそ見切りが重要になる。' },
                { choiceId: 'bold_6', speaker: OBSERVER_NAME, emotion: 'serious', text: 'その通りだ。最後まで手を探す者だけが奪い返せる。' }
            ],
            next: 'STEP_032'
        },
        {
            id: 'STEP_032',
            chapterLabel: 'CHAPTER 8 パス・手札上限・勝利条件・締め',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                'そして最後に、一番大事なことを言う。',
                'どれだけ布石を稼ごうが、どれだけ派手にカードを使おうが、それだけでは勝ちではない。'
            ],
            next: 'STEP_033'
        },
        {
            id: 'STEP_033',
            chapterLabel: 'CHAPTER 8 パス・手札上限・勝利条件・締め',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                '勝敗を決めるのは、終局時の石の数だ。',
                '布石は力。カードは武器。だが目的そのものではない。'
            ],
            next: 'STEP_034'
        },
        {
            id: 'STEP_034',
            chapterLabel: 'CHAPTER 8 パス・手札上限・勝利条件・締め',
            type: 'choice',
            prompt: 'どう受け取る？',
            choices: [
                { id: 'straight_8', label: '結局、最後はオセロなんだな', addPersonality: { straight: 1 } },
                { id: 'bold_7', label: 'なら勝つために全部使えばいい', addPersonality: { bold: 1 } },
                { id: 'snark_6', label: '派手でも勝てなきゃ意味ないってことか', addPersonality: { snark: 1 } }
            ],
            responses: [
                { choiceId: 'straight_8', speaker: OBSERVER_NAME, emotion: 'soft', text: '……そうだ。どれだけ歪んでも、最後の芯はまだそこにある。' },
                { choiceId: 'bold_7', speaker: OBSERVER_NAME, emotion: 'smile', text: 'その理解でよい。ただし、使い方を誤れば自分が沈む。' },
                { choiceId: 'snark_6', speaker: OBSERVER_NAME, emotion: 'amused', text: '耳に痛い者も多いだろうがな。だが事実だ。' }
            ],
            next: 'STEP_035'
        },
        {
            id: 'STEP_035',
            chapterLabel: 'CHAPTER 8 パス・手札上限・勝利条件・締め',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'smile',
            text: [
                'よし。基礎はこれで十分だ。',
                '対局して、迷って、負けて、奪い返して、少しずつ慣れていけばいい。'
            ],
            next: 'STEP_036'
        },
        {
            id: 'STEP_036',
            chapterLabel: 'CHAPTER 8 パス・手札上限・勝利条件・締め',
            type: 'choice',
            prompt: '最後にどう返す？',
            choices: [
                { id: 'straight_9', label: 'ありがとう。やってみる', addPersonality: { straight: 1 } },
                { id: 'timid_3', label: 'まだ少し不安だ', addPersonality: { straight: 1 } },
                { id: 'bold_8', label: '見てろ。勝ってみせる', addPersonality: { bold: 1 } }
            ],
            responses: [
                { choiceId: 'straight_9', speaker: OBSERVER_NAME, emotion: 'smile', text: 'うむ。そういう勇者は伸びる。' },
                { choiceId: 'timid_3', speaker: OBSERVER_NAME, emotion: 'soft', text: 'かまわぬ。不安がある者の方が盤を丁寧に見る。' },
                { choiceId: 'bold_8', speaker: OBSERVER_NAME, emotion: 'smile', text: 'ふふ、頼もしいな。では、その言葉どおりの一手を見せてもらおう。' }
            ],
            next: 'STEP_037'
        },
        {
            id: 'STEP_037',
            chapterLabel: 'CHAPTER 8 パス・手札上限・勝利条件・締め',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            emotion: 'smile',
            headBubbleText: 'さあ行け、オセロの勇者。',
            text: [
                'さあ行け、オセロの勇者。',
                'ここから先は実戦だ。私に、お主の打つ盤を見せてみろ。'
            ],
            next: 'STEP_038'
        },
        {
            id: 'STEP_038',
            chapterLabel: 'CHAPTER 8 パス・手札上限・勝利条件・締め',
            type: 'completed',
            result: {
                unlockNormalGame: true,
                openMatchStartModal: true,
                saveTutorialCleared: true
            }
        }
    ];

    const chapter0ScenarioSteps = normalizeScenarioSteps(chapter0StepDefinitions, resolveChapter0StepDefaults);
    const chapter0MainStepIds = chapter0ScenarioSteps.steps
        .filter((step) => STEP_ID_PATTERNS.main.test(step.id))
        .map((step) => step.id);

    const tutorialScenarios = deepFreeze({
        [DEFAULT_SCENARIO_ID]: createScenarioRecord({
            id: DEFAULT_SCENARIO_ID,
            title: '0章 観測者チュートリアル',
            menuLabel: '第零章 チュートリアル',
            menuDescription: '盤理の観測者と基本ルールを学ぶ導入章。',
            menuUnavailableMessage: 'この build ではチュートリアルを開始できません。',
            observerName: OBSERVER_NAME,
            observerImageSrc: OBSERVER_IMAGE_SRC,
            entryStepId: 'INTRO_SCENE_001',
            mainEntryStepId: 'STEP_001',
            mainStepIds: chapter0MainStepIds,
            steps: chapter0ScenarioSteps.steps,
            stepsById: chapter0ScenarioSteps.stepsById
        })
    });

    const storyScenarios = deepFreeze({});

    const scenarios = deepFreeze(
        Object.assign({}, tutorialScenarios, storyScenarios)
    );

    function getDefaultScenarioId() {
        return DEFAULT_SCENARIO_ID;
    }

    function getScenario(scenarioId) {
        const id = scenarioId || DEFAULT_SCENARIO_ID;
        return scenarios[id] || null;
    }

    function getScenarioStep(scenarioId, stepId) {
        const scenario = getScenario(scenarioId);
        if (!scenario || !stepId) return null;
        return scenario.stepsById[stepId] || null;
    }

    function getScenarioIds() {
        return Object.keys(scenarios);
    }

    function getScenarioKind(scenarioId) {
        const scenario = getScenario(scenarioId);
        return scenario ? scenario.kind || SCENARIO_KINDS.TUTORIAL : null;
    }

    function isTutorialScenario(scenarioId) {
        return getScenarioKind(scenarioId) === SCENARIO_KINDS.TUTORIAL;
    }

    function getScenarioIdsByKind(kind) {
        const targetKind = String(kind || '');
        return Object.keys(scenarios).filter((scenarioId) => getScenarioKind(scenarioId) === targetKind);
    }

    function getTutorialScenarioIds() {
        return getScenarioIdsByKind(SCENARIO_KINDS.TUTORIAL);
    }

    function getStoryScenarioIds() {
        return getScenarioIdsByKind(SCENARIO_KINDS.STORY);
    }

    return {
        DEFAULT_SCENARIO_ID,
        SCENARIO_KINDS,
        OBSERVER_NAME,
        OBSERVER_IMAGE_SRC,
        tutorialScenarios,
        storyScenarios,
        scenarios,
        getDefaultScenarioId,
        getScenario,
        getScenarioStep,
        getScenarioIds,
        getScenarioKind,
        isTutorialScenario,
        getScenarioIdsByKind,
        getTutorialScenarioIds,
        getStoryScenarioIds
    };
}));
