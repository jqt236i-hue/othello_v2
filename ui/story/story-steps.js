(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.StoryStepsModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const CHAPTER1_ID = 'chapter1';
    const CHAPTER1_LABEL = '第一章';
    const CHAPTER2_ID = 'chapter2';
    const CHAPTER2_LABEL = '第二章';
    const FOREST_BG_SRC = 'assets/story/background/森背景.png';
    const HYPERACTIVE_VILLAGE_BG_SRC = 'assets/story/background/多動の村.png';
    const THEORY_ROOM_BG_SRC = 'assets/story/background/理論の部屋.png';
    const OLD_LIBRARY_BG_SRC = 'assets/story/background/古い図書館.png';
    const HERO_NAME = 'オセロの勇者';
    const HERO_IMAGE_SRC = 'assets/story/hero/hero.png';
    const OBSERVER_NAME = '盤理の観測者';
    const OBSERVER_IMAGE_SRC = 'assets/story/cpu/level6.png';
    const GOBLIN_NAME = '盤喰いの小鬼';
    const GOBLIN_IMAGE_SRC = 'assets/story/cpu/level1.png';
    const EXECUTIONER_NAME = '盤界の執行者';
    const EXECUTIONER_IMAGE_SRC = 'assets/story/cpu/盤界の執行者.png';
    const THEORY_NAME = '理論の化身';
    const THEORY_IMAGE_SRC = 'assets/story/cpu/level7.png';
    const UDG_NAME = '究極破壊神';
    const UDG_IMAGE_SRC = 'assets/story/stones/ULTIMATE_DESTROY_GOD-white.png';
    const NIGEL_NAME = 'ニーゲル';
    const ESCAPE_WILL_NAME = '逃げる意志';
    const ESCAPE_WILL_IMAGE_SRC = 'assets/story/stones/ESCAPE_WILL-black.png';

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

    function normalizeChapterSteps(stepDefinitions) {
        const steps = [];
        const stepsById = {};
        for (const stepDefinition of stepDefinitions) {
            const normalized = deepFreeze(Object.assign({}, stepDefinition, {
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

    function createChapterRecord(definition) {
        const source = definition && typeof definition === 'object' ? definition : {};
        return deepFreeze(Object.assign({
            kind: 'story',
            progressionGroup: 'story',
            progressionId: source.id || null,
            unlocksChapterIds: []
        }, source));
    }

    function chapterStep(chapterLabel, backgroundSrc, definition) {
        const base = {
            chapterLabel: chapterLabel || ''
        };
        if (backgroundSrc) {
            base.sceneBackgroundSrc = backgroundSrc;
        }
        return Object.assign(base, definition);
    }

    function forestStep(definition) {
        return chapterStep(CHAPTER1_LABEL, FOREST_BG_SRC, definition);
    }

    function chapter2ForestStep(definition) {
        return chapterStep(CHAPTER2_LABEL, FOREST_BG_SRC, definition);
    }

    function chapter2VillageStep(definition) {
        return chapterStep(CHAPTER2_LABEL, HYPERACTIVE_VILLAGE_BG_SRC, definition);
    }

    function chapter2TheoryStep(definition) {
        return chapterStep(CHAPTER2_LABEL, THEORY_ROOM_BG_SRC, definition);
    }

    function chapter2LibraryStep(definition) {
        return chapterStep(CHAPTER2_LABEL, OLD_LIBRARY_BG_SRC, definition);
    }

    const chapter1StepDefinitions = [
        forestStep({
            id: 'CHAPTER1_STEP_001',
            type: 'dialogue',
            speaker: HERO_NAME,
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            emotion: 'normal',
            text: [
                'そういえば観測者、なんでお前は美しいオセロを取り戻すとか言いながらノリノリで教えてたんだ？'
            ],
            next: 'CHAPTER1_STEP_002'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_002',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                '気づいたか、では大事なことを話さねばならぬな。',
                'この世界のモンスターは元々は人間だったんだ。だがこのカードオセロの沼にハマるほど人間から見た目が遠ざかって変貌してしまうんだ。',
                'だからこの世界に人の形をした生命はいない。皮肉なことにこの私もだ。'
            ],
            next: 'CHAPTER1_STEP_003'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_003',
            type: 'dialogue',
            speaker: HERO_NAME,
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            emotion: 'surprised',
            text: [
                'じゃあ俺も変貌する可能性があるってことか？'
            ],
            next: 'CHAPTER1_STEP_004'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_004',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'smile',
            text: [
                '可能性はあるが、我は変貌しないと信じておる。お主は我が選んだ勇者だからな！ガハハハッ！',
                'ただ変貌を抑えるコツは、強い心、強い意志だ！己の意志を貫けば変貌にも抗える！'
            ],
            next: 'CHAPTER1_STEP_005'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_005',
            type: 'choice',
            prompt: 'どう返す？',
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            choices: [
                { id: 'tease_observer', label: 'じゃあお前は意志が弱かったんだな！' },
                { id: 'doubt_observer', label: '怪しいな...' },
                { id: 'thank_observer', label: '助言ありがとな' }
            ],
            responses: [
                { choiceId: 'tease_observer', speaker: OBSERVER_NAME, characterImageSrc: OBSERVER_IMAGE_SRC, characterImageAlt: OBSERVER_NAME, emotion: 'amused', text: '笑うな。あの頃の私は、今より未熟だっただけだ。' },
                { choiceId: 'doubt_observer', speaker: OBSERVER_NAME, characterImageSrc: OBSERVER_IMAGE_SRC, characterImageAlt: OBSERVER_NAME, emotion: 'serious', text: '疑うのは勝手だ。だが忠告だけは本物だ。' },
                { choiceId: 'thank_observer', speaker: OBSERVER_NAME, characterImageSrc: OBSERVER_IMAGE_SRC, characterImageAlt: OBSERVER_NAME, emotion: 'soft', text: 'うむ。その素直さは捨てるでないぞ。' }
            ],
            next: 'CHAPTER1_STEP_006'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_006',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                '気配を感じる、気をつけろ！'
            ],
            next: 'CHAPTER1_STEP_007'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_007',
            type: 'dialogue',
            speaker: GOBLIN_NAME,
            characterVisible: true,
            characterImageSrc: GOBLIN_IMAGE_SRC,
            characterImageAlt: GOBLIN_NAME,
            emotion: 'amused',
            text: [
                'へへへっ！見慣れない顔のやつがいるな！まるで人間みたいだ！ギャハハハ'
            ],
            next: 'CHAPTER1_STEP_008'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_008',
            type: 'dialogue',
            speaker: HERO_NAME,
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            emotion: 'normal',
            text: [
                '観測者、あいつは何なんだ？'
            ],
            next: 'CHAPTER1_STEP_009'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_009',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                'あいつは盤喰いの小鬼、我の観測データにある。カードオセロに浸かりすぎるとあんな感じで化け物みたいな姿になってしまうんぞよｗ'
            ],
            next: 'CHAPTER1_STEP_010'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_010',
            type: 'dialogue',
            speaker: GOBLIN_NAME,
            characterVisible: true,
            characterImageSrc: GOBLIN_IMAGE_SRC,
            characterImageAlt: GOBLIN_NAME,
            emotion: 'angry',
            text: [
                '誰が化け物だ！？俺を舐めてどうなるかわかってんだろうな？俺と勝負しろ！'
            ],
            next: 'CHAPTER1_STEP_011'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_011',
            type: 'choice',
            prompt: 'どうする？',
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            choices: [
                { id: 'fight_goblin', label: '戦う' },
                { id: 'run_away', label: '逃げる' }
            ],
            actionByChoice: {
                fight_goblin: 'start_goblin_encounter'
            },
            nextByChoice: {
                run_away: 'CHAPTER1_ESCAPE_001'
            }
        }),
        {
            id: 'CHAPTER1_ESCAPE_001',
            chapterLabel: '第一章 GAME OVER',
            type: 'dialogue',
            sceneTransition: 'fade_black',
            speaker: '',
            characterVisible: false,
            emotion: 'normal',
            text: [
                '逃げた先に崖があって落ちてしまった。',
                'ゲームオーバー'
            ],
            next: 'CHAPTER1_ESCAPE_002'
        },
        {
            id: 'CHAPTER1_ESCAPE_002',
            chapterLabel: '第一章 GAME OVER',
            type: 'game_over',
            speaker: '',
            characterVisible: false,
            text: []
        },
        forestStep({
            id: 'CHAPTER1_STEP_020',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'smile',
            text: [
                'よくやった勇者、前世でボードゲーム最強だっただけあって飲み込みが早いぞ！'
            ],
            next: 'CHAPTER1_STEP_021'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_021',
            type: 'choice',
            prompt: 'どう返す？',
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            choices: [
                { id: 'of_course', label: '当然よ' },
                { id: 'never_lose', label: 'あんなのに負けてたまるか' }
            ],
            responses: [
                { choiceId: 'of_course', speaker: OBSERVER_NAME, characterImageSrc: OBSERVER_IMAGE_SRC, characterImageAlt: OBSERVER_NAME, emotion: 'amused', text: 'ふふ、その自信は嫌いではない。' },
                { choiceId: 'never_lose', speaker: OBSERVER_NAME, characterImageSrc: OBSERVER_IMAGE_SRC, characterImageAlt: OBSERVER_NAME, emotion: 'smile', text: 'うむ、その意気だ。勝ちを奪い返す者の顔になってきたな。' }
            ],
            next: 'CHAPTER1_STEP_022'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_022',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                'また強い気配を感じる、気をつけろ！'
            ],
            next: 'CHAPTER1_STEP_023'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_023',
            type: 'dialogue',
            speaker: '？？？',
            characterVisible: true,
            characterImageSrc: EXECUTIONER_IMAGE_SRC,
            characterImageAlt: EXECUTIONER_NAME,
            emotion: 'serious',
            text: [
                '見つけたぞ、観測者。'
            ],
            next: 'CHAPTER1_STEP_024'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_024',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'surprised',
            text: [
                '貴様は何者だ！私の観測データにはないぞ！'
            ],
            next: 'CHAPTER1_STEP_025'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_025',
            type: 'dialogue',
            speaker: EXECUTIONER_NAME,
            characterVisible: true,
            characterImageSrc: EXECUTIONER_IMAGE_SRC,
            characterImageAlt: EXECUTIONER_NAME,
            supportVisible: true,
            supportImageSrc: UDG_IMAGE_SRC,
            supportImageAlt: UDG_NAME,
            supportStage: 'right',
            emotion: 'serious',
            text: [
                '私の名前は盤界の執行者、お前を断罪しに来た。観測した罪、命で償ってもらおう。',
                'いでよ、究極破壊神'
            ],
            next: 'CHAPTER1_STEP_026'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_026',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            supportVisible: true,
            supportImageSrc: UDG_IMAGE_SRC,
            supportImageAlt: UDG_NAME,
            supportStage: 'right',
            emotion: 'surprised',
            text: [
                'あれは、究極破壊神。',
                '置かれた瞬間と持ち主のターン開始時に周囲8マスの敵石を破壊する最悪の特殊石だ！',
                'やつの範囲内にいると破壊されてしまう！'
            ],
            next: 'CHAPTER1_STEP_027'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_027',
            type: 'choice',
            prompt: 'どう返す？',
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            supportVisible: true,
            supportImageSrc: UDG_IMAGE_SRC,
            supportImageAlt: UDG_NAME,
            supportStage: 'right',
            choices: [
                { id: 'fix_this_now', label: '説明はいいから何とかしろ！' },
                { id: 'just_win_again', label: '要するに勝てばいいんだろ？' }
            ],
            next: 'CHAPTER1_STEP_028'
        }),
        {
            id: 'CHAPTER1_STEP_028',
            chapterLabel: CHAPTER1_LABEL,
            type: 'dialogue',
            sceneTransition: 'fade_black',
            speaker: OBSERVER_NAME,
            characterVisible: false,
            emotion: 'serious',
            text: [
                'ここは引くぞ！近づけなければ対局することすら叶わないぞ'
            ],
            next: 'CHAPTER1_STEP_029'
        },
        {
            id: 'CHAPTER1_STEP_029',
            chapterLabel: CHAPTER1_LABEL,
            type: 'dialogue',
            speaker: 'ナレーション',
            characterVisible: false,
            emotion: 'normal',
            text: [
                '必死に逃げる勇者と観測者であったが、追いつかれそうになる',
                'どうなってしまうのか...'
            ],
            next: 'CHAPTER1_STEP_030'
        },
        {
            id: 'CHAPTER1_STEP_030',
            chapterLabel: CHAPTER1_LABEL,
            type: 'completed',
            result: {
                saveStoryChapterCleared: true,
                unlockStoryChapterIds: ['chapter2']
            }
        }
    ];

    const chapter1Steps = normalizeChapterSteps(chapter1StepDefinitions);
    const chapter2StepDefinitions = [
        chapter2ForestStep({
            id: 'CHAPTER2_STEP_001',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            supportVisible: true,
            supportImageSrc: UDG_IMAGE_SRC,
            supportImageAlt: UDG_NAME,
            supportStage: 'right',
            emotion: 'surprised',
            text: [
                'あれは、究極破壊神。',
                '置かれた瞬間と持ち主のターン開始時に周囲8マスの敵石を破壊する最悪の特殊石だ！',
                'やつの範囲内にいると破壊されてしまう！'
            ],
            next: 'CHAPTER2_STEP_002'
        }),
        chapter2ForestStep({
            id: 'CHAPTER2_STEP_002',
            type: 'choice',
            prompt: '前回のあらすじ',
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            supportVisible: true,
            supportImageSrc: UDG_IMAGE_SRC,
            supportImageAlt: UDG_NAME,
            supportStage: 'right',
            choices: [
                { id: 'fix_this_now', label: '説明はいいから何とかしろ！' },
                { id: 'just_win_again', label: '要するに勝てばいいんだろ？' }
            ],
            next: 'CHAPTER2_STEP_003'
        }),
        chapter2ForestStep({
            id: 'CHAPTER2_STEP_003',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                'ここは引くぞ！近づけなければ対局することすら叶わないぞ'
            ],
            next: 'CHAPTER2_STEP_004'
        }),
        chapter2ForestStep({
            id: 'CHAPTER2_STEP_004',
            type: 'dialogue',
            sceneTransition: 'fade_black',
            speaker: ESCAPE_WILL_NAME,
            characterVisible: true,
            characterImageSrc: ESCAPE_WILL_IMAGE_SRC,
            characterImageAlt: ESCAPE_WILL_NAME,
            emotion: 'normal',
            text: [
                '僕に乗ってください！観測者さんと連れの人！逃げましょう！'
            ],
            next: 'CHAPTER2_STEP_005'
        }),
        chapter2ForestStep({
            id: 'CHAPTER2_STEP_005',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'smile',
            text: [
                'おお！逃げる意志か、助かったぞ！勇者、お主も乗るぞ！'
            ],
            next: 'CHAPTER2_STEP_006'
        }),
        chapter2ForestStep({
            id: 'CHAPTER2_STEP_006',
            type: 'choice',
            prompt: 'どうする？',
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            choices: [
                { id: 'ride_with_nigel', label: 'わかった' },
                { id: 'reject_nigel', label: '誰がお前なんかに乗るか！' }
            ],
            nextByChoice: {
                ride_with_nigel: 'CHAPTER2_STEP_008',
                reject_nigel: 'CHAPTER2_GAMEOVER_001'
            }
        }),
        {
            id: 'CHAPTER2_GAMEOVER_001',
            chapterLabel: '第二章 GAME OVER',
            type: 'dialogue',
            sceneTransition: 'fade_black',
            speaker: 'ナレーション',
            characterVisible: false,
            emotion: 'normal',
            text: [
                '勇者だけ逃げ遅れて破壊されてしまった...',
                'ゲームオーバー'
            ],
            next: 'CHAPTER2_GAMEOVER_002'
        },
        {
            id: 'CHAPTER2_GAMEOVER_002',
            chapterLabel: '第二章 GAME OVER',
            type: 'game_over',
            speaker: '',
            characterVisible: false,
            text: []
        },
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_008',
            type: 'dialogue',
            sceneTransition: 'fade_black',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'soft',
            text: [
                'ふぅ、助かったぞ...逃げる意志よ'
            ],
            next: 'CHAPTER2_STEP_009'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_009',
            type: 'dialogue',
            speaker: HERO_NAME,
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            emotion: 'normal',
            text: [
                'こいつは何なんだ？'
            ],
            next: 'CHAPTER2_STEP_010'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_010',
            type: 'dialogue',
            speaker: NIGEL_NAME,
            characterVisible: true,
            characterImageSrc: ESCAPE_WILL_IMAGE_SRC,
            characterImageAlt: ESCAPE_WILL_NAME,
            emotion: 'smile',
            text: [
                '僕は逃げる意志のニーゲル！数日前盤理の観測者に空腹の僕に木の実を分けてくれたんです。その恩返しをしたいなと思っていたら偶然ピンチの観測者さんを見つけて救うことができました！'
            ],
            next: 'CHAPTER2_STEP_011'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_011',
            type: 'choice',
            prompt: 'どう返す？',
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            choices: [
                { id: 'observer_helped', label: 'お前そんなことまでしてたのかよｗ' },
                { id: 'observer_no_counter', label: '観測者強そうな見た目して対抗手段なかったんだなｗ' },
                { id: 'thank_nigel', label: '助かったよニーゲル！' }
            ],
            responses: [
                { choiceId: 'observer_helped', speaker: OBSERVER_NAME, characterImageSrc: OBSERVER_IMAGE_SRC, characterImageAlt: OBSERVER_NAME, emotion: 'amused', text: 'うむ、腹を空かせた者を放っておけなかっただけだ。' },
                { choiceId: 'observer_no_counter', speaker: OBSERVER_NAME, characterImageSrc: OBSERVER_IMAGE_SRC, characterImageAlt: OBSERVER_NAME, emotion: 'amused', text: '笑うでない。あれに正面から挑むのは無謀というものだ。' },
                { choiceId: 'thank_nigel', speaker: NIGEL_NAME, characterImageSrc: ESCAPE_WILL_IMAGE_SRC, characterImageAlt: ESCAPE_WILL_NAME, emotion: 'smile', text: 'えへへ、間に合って本当によかったです！' }
            ],
            next: 'CHAPTER2_STEP_012'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_012',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'soft',
            text: [
                '何はともあれ助かった、礼を言う！'
            ],
            next: 'CHAPTER2_STEP_013'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_013',
            type: 'dialogue',
            speaker: HERO_NAME,
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            emotion: 'normal',
            text: [
                '何でニーゲルはオセロの石みたいな見た目してるんだ？'
            ],
            next: 'CHAPTER2_STEP_014'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_014',
            type: 'dialogue',
            speaker: NIGEL_NAME,
            characterVisible: true,
            characterImageSrc: ESCAPE_WILL_IMAGE_SRC,
            characterImageAlt: ESCAPE_WILL_NAME,
            emotion: 'normal',
            text: [
                '僕たちは特殊石っていう種族で、主人に仕えるのが役目なんだ！でも僕は今主人がいないんだ'
            ],
            next: 'CHAPTER2_STEP_015'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_015',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'smile',
            text: [
                'なら我らについてくるといい。我らと共に世界を変えようではないか！'
            ],
            next: 'CHAPTER2_STEP_016'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_016',
            type: 'dialogue',
            speaker: NIGEL_NAME,
            characterVisible: true,
            characterImageSrc: ESCAPE_WILL_IMAGE_SRC,
            characterImageAlt: ESCAPE_WILL_NAME,
            emotion: 'smile',
            text: [
                'いいんですか！ありがとうございます！ついていきます！'
            ],
            next: 'CHAPTER2_STEP_017'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_017',
            type: 'dialogue',
            speaker: '',
            characterVisible: false,
            emotion: 'normal',
            text: [
                '【ニーゲルが仲間になった！】'
            ],
            next: 'CHAPTER2_STEP_018'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_018',
            type: 'dialogue',
            speaker: HERO_NAME,
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            emotion: 'smile',
            text: [
                '仲間は多いほど心強いな。それで、特殊石ってなんなんだ？'
            ],
            next: 'CHAPTER2_STEP_019'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_019',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                '特殊石とは、特殊な力が秘められている石。私が観測した書物にはこの世を去った未練の強い生命の魂が特殊石として再臨すると書いてあった',
                '特殊石はオセロに強く干渉できる特殊能力を1つ持っている。仕えた主人には忠実で良いパートナーになる。'
            ],
            next: 'CHAPTER2_STEP_020'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_020',
            type: 'dialogue',
            speaker: HERO_NAME,
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            emotion: 'normal',
            text: [
                'あの盤界の執行者が使ってた究極破壊神もそうなのか？'
            ],
            next: 'CHAPTER2_STEP_021'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_021',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                'そうだ。しかし奴が使っていた特殊石はかなり位が高い',
                '今の状況ではとても太刀打ちできぬ。だから我らも力をつけねばならぬ',
                '相手の特殊石を封じた状態ではないと対局はできぬ。対局さえできればお主の圧倒的力で薙ぎ倒すだけなのだがな！'
            ],
            next: 'CHAPTER2_STEP_022'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_022',
            type: 'choice',
            prompt: 'どう返す？',
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            choices: [
                { id: 'add_more_allies', label: 'つまり仲間を増やせばいいんだな？' },
                { id: 'leave_it_to_me', label: '任せとけって！' }
            ],
            next: 'CHAPTER2_STEP_023'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_023',
            type: 'dialogue',
            speaker: NIGEL_NAME,
            characterVisible: true,
            characterImageSrc: ESCAPE_WILL_IMAGE_SRC,
            characterImageAlt: ESCAPE_WILL_NAME,
            emotion: 'smile',
            text: [
                '折角僕の村に来てくれたんですから、今夜はご馳走を用意します！待っててくださいね！'
            ],
            next: 'CHAPTER2_STEP_024'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_024',
            type: 'dialogue',
            speaker: HERO_NAME,
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            emotion: 'smile',
            text: [
                'まじか！丁度腹減ってたんだ！ありがとな！'
            ],
            next: 'CHAPTER2_STEP_025'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_025',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                'あの盤界の執行者...何者なんだ？狙いは私..?なぜ私の観測から逃れていた？不可解な点が多い...',
                'まぁいい。今日はいっぱい食べて気持ち良く寝るぞよ！明日のことは明日考えるぞよ！'
            ],
            next: 'CHAPTER2_STEP_026'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_026',
            type: 'dialogue',
            speaker: 'ナレーション',
            characterVisible: false,
            emotion: 'normal',
            text: [
                '勇者と観測者はニーゲルの家でお腹いっぱい食べて寝てしまった。',
                '一方その頃...'
            ],
            next: 'CHAPTER2_STEP_027'
        }),
        chapter2TheoryStep({
            id: 'CHAPTER2_STEP_027',
            type: 'dialogue',
            sceneTransition: 'fade_black',
            speaker: THEORY_NAME,
            characterVisible: true,
            characterImageSrc: THEORY_IMAGE_SRC,
            characterImageAlt: THEORY_NAME,
            emotion: 'serious',
            text: [
                '盤理の観測者は仕留めたか？'
            ],
            next: 'CHAPTER2_STEP_028'
        }),
        chapter2TheoryStep({
            id: 'CHAPTER2_STEP_028',
            type: 'dialogue',
            speaker: EXECUTIONER_NAME,
            characterVisible: true,
            characterImageSrc: EXECUTIONER_IMAGE_SRC,
            characterImageAlt: EXECUTIONER_NAME,
            emotion: 'serious',
            text: [
                '申し訳ございません、逃してしまいました。逃げる意志の邪魔が入ってしまい。。'
            ],
            next: 'CHAPTER2_STEP_029'
        }),
        chapter2TheoryStep({
            id: 'CHAPTER2_STEP_029',
            type: 'dialogue',
            speaker: THEORY_NAME,
            characterVisible: true,
            characterImageSrc: THEORY_IMAGE_SRC,
            characterImageAlt: THEORY_NAME,
            emotion: 'serious',
            text: [
                '使えぬな。執行者の名前負けだ。まぁいい、収穫もあった。あのオセロの勇者とかいう小僧。どこから現れた？召喚か？'
            ],
            next: 'CHAPTER2_STEP_030'
        }),
        chapter2TheoryStep({
            id: 'CHAPTER2_STEP_030',
            type: 'dialogue',
            speaker: EXECUTIONER_NAME,
            characterVisible: true,
            characterImageSrc: EXECUTIONER_IMAGE_SRC,
            characterImageAlt: EXECUTIONER_NAME,
            emotion: 'serious',
            text: [
                'はい、人型を保っているということは最近召喚されたものだと思われます。'
            ],
            next: 'CHAPTER2_STEP_031'
        }),
        chapter2TheoryStep({
            id: 'CHAPTER2_STEP_031',
            type: 'dialogue',
            speaker: THEORY_NAME,
            characterVisible: true,
            characterImageSrc: THEORY_IMAGE_SRC,
            characterImageAlt: THEORY_NAME,
            emotion: 'serious',
            text: [
                '野放しにすると危険だな。観測者とかいう観測することしか取り柄のない小物は後回しで、勇者から先に執行していいぞ。'
            ],
            next: 'CHAPTER2_STEP_032'
        }),
        chapter2TheoryStep({
            id: 'CHAPTER2_STEP_032',
            type: 'dialogue',
            speaker: EXECUTIONER_NAME,
            characterVisible: true,
            characterImageSrc: EXECUTIONER_IMAGE_SRC,
            characterImageAlt: EXECUTIONER_NAME,
            emotion: 'serious',
            text: [
                '承知しました。'
            ],
            next: 'CHAPTER2_STEP_033'
        }),
        chapter2TheoryStep({
            id: 'CHAPTER2_STEP_033',
            type: 'dialogue',
            speaker: THEORY_NAME,
            characterVisible: true,
            characterImageSrc: THEORY_IMAGE_SRC,
            characterImageAlt: THEORY_NAME,
            emotion: 'serious',
            text: [
                'オセロとかいう不完全なゲームは絶対に許さない。このまま書き換えを続けてオセロの定義を破壊する。そして誰にでも平等な世界を、必ず'
            ],
            next: 'CHAPTER2_STEP_034'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_034',
            type: 'dialogue',
            sceneTransition: 'fade_black',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                'やはりこの村、見覚えがある。この村の図書館に確か私の観測データでは重要な書物があったはずなのだが...記憶が曖昧だ。',
                '手当たり次第探してみよう'
            ],
            next: 'CHAPTER2_STEP_035'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_035',
            type: 'dialogue',
            speaker: 'ナレーション',
            characterVisible: false,
            emotion: 'normal',
            text: [
                '観測者は徹夜で本探しに没頭してしまい、朝になることには寝てしまった。',
                '翌朝...'
            ],
            next: 'CHAPTER2_STEP_036'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_036',
            type: 'dialogue',
            speaker: HERO_NAME,
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            emotion: 'normal',
            text: [
                '見つけた！随分探したんだぞ！？観測者！',
                'こんなところでなに寝てんだよ！ｗ'
            ],
            next: 'CHAPTER2_STEP_037'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_037',
            type: 'dialogue',
            speaker: HERO_NAME,
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            emotion: 'amused',
            text: [
                '起きないなこりゃ、何か探し物でもしてたのか？'
            ],
            next: 'CHAPTER2_STEP_038'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_038',
            type: 'dialogue',
            speaker: NIGEL_NAME,
            characterVisible: true,
            characterImageSrc: ESCAPE_WILL_IMAGE_SRC,
            characterImageAlt: ESCAPE_WILL_NAME,
            emotion: 'smile',
            text: [
                'きっと書物を探していたのではないでしょうか！',
                'この図書館はこの世界でもっとも古いんです！貴重な書物がいっぱいありますよ！'
            ],
            next: 'CHAPTER2_STEP_039'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_039',
            type: 'dialogue',
            speaker: HERO_NAME,
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            emotion: 'amused',
            text: [
                'そんで探し回って寝てたのか、情けねえ観測者だぜ...'
            ],
            next: 'CHAPTER2_STEP_040'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_040',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'sleepy',
            text: [
                'ふにゃふにゃ...いま我になにかいったのか...？'
            ],
            next: 'CHAPTER2_STEP_041'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_041',
            type: 'dialogue',
            speaker: HERO_NAME,
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            emotion: 'normal',
            text: [
                'おはよー！観測者、何か探し物してたのか？'
            ],
            next: 'CHAPTER2_STEP_042'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_042',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                'ちょっと確認したい本があってだな、、意志狩りの王についての、、'
            ],
            next: 'CHAPTER2_STEP_043'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_043',
            type: 'choice',
            prompt: 'どう返す？',
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            choices: [
                { id: 'rely_on_me', label: 'なら最初から俺を頼ってくれよ！' },
                { id: 'overworked_observer', label: 'こんなになるまで探し回ってたなんてなｗ' },
                { id: 'help_search', label: '俺も手伝うぞ！' }
            ],
            responses: [
                { choiceId: 'rely_on_me', speaker: OBSERVER_NAME, characterImageSrc: OBSERVER_IMAGE_SRC, characterImageAlt: OBSERVER_NAME, emotion: 'soft', text: 'うむ、次からは遠慮なく頼らせてもらうぞ。' },
                { choiceId: 'overworked_observer', speaker: OBSERVER_NAME, characterImageSrc: OBSERVER_IMAGE_SRC, characterImageAlt: OBSERVER_NAME, emotion: 'amused', text: '笑うでない。観測のためなら徹夜もやむなしなのだ。' },
                { choiceId: 'help_search', speaker: OBSERVER_NAME, characterImageSrc: OBSERVER_IMAGE_SRC, characterImageAlt: OBSERVER_NAME, emotion: 'smile', text: '助かる。お主の目はこういう時こそ頼りになる。' }
            ],
            next: 'CHAPTER2_STEP_044'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_044',
            type: 'dialogue',
            speaker: HERO_NAME,
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            emotion: 'surprised',
            text: [
                'これのことか？意志狩り黙示録？'
            ],
            next: 'CHAPTER2_STEP_045'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_045',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'smile',
            text: [
                'それだそれだ！よくやったぞ我が勇者よ！',
                'この本に意志狩りの王の記録が残っているはず、、今も存在していれば仲間にしたいと考えておってなあ'
            ],
            next: 'CHAPTER2_STEP_046'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_046',
            type: 'dialogue',
            speaker: NIGEL_NAME,
            characterVisible: true,
            characterImageSrc: ESCAPE_WILL_IMAGE_SRC,
            characterImageAlt: ESCAPE_WILL_NAME,
            emotion: 'surprised',
            text: [
                'あの伝説の意志狩りの王！？無謀ですよ！観測者さん！'
            ],
            next: 'CHAPTER2_STEP_047'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_047',
            type: 'choice',
            prompt: 'どう返す？',
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            choices: [
                { id: 'is_it_that_strong', label: 'そんなに強いのか？' },
                { id: 'cant_wait_to_fight', label: '早く戦いたいぜ！' }
            ],
            responses: [
                { choiceId: 'is_it_that_strong', speaker: OBSERVER_NAME, characterImageSrc: OBSERVER_IMAGE_SRC, characterImageAlt: OBSERVER_NAME, emotion: 'serious', text: '伝説になるだけの力を持つ。軽く見る相手ではないぞ。' },
                { choiceId: 'cant_wait_to_fight', speaker: OBSERVER_NAME, characterImageSrc: OBSERVER_IMAGE_SRC, characterImageAlt: OBSERVER_NAME, emotion: 'amused', text: '気が早いな。だがその闘志は頼もしい。' }
            ],
            next: 'CHAPTER2_STEP_048'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_048',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                'リスクは承知の上だ。危険を冒さずして未来は切り開けぬ。'
            ],
            next: 'CHAPTER2_STEP_049'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_049',
            type: 'dialogue',
            speaker: NIGEL_NAME,
            characterVisible: true,
            characterImageSrc: ESCAPE_WILL_IMAGE_SRC,
            characterImageAlt: ESCAPE_WILL_NAME,
            emotion: 'soft',
            text: [
                '観測者さんが言うなら、、ついていくしかないですね！'
            ],
            next: 'CHAPTER2_STEP_050'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_050',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'normal',
            text: [
                '書物によるとこの地点から北東方向の位置に意志狩りの里があるらしい。そこが最後の目撃情報だ。'
            ],
            next: 'CHAPTER2_STEP_051'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_051',
            type: 'choice',
            prompt: 'どう返す？',
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            choices: [
                { id: 'have_to_go', label: '行ってみるしかないな！' },
                { id: 'only_forward', label: '前進のみだぜ' }
            ],
            next: 'CHAPTER2_STEP_052'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_052',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'smile',
            text: [
                'よし決まりだ！次の目的地点は意志狩りの里だ！'
            ],
            next: 'CHAPTER2_STEP_053'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_053',
            type: 'dialogue',
            speaker: 'ナレーション',
            characterVisible: false,
            emotion: 'normal',
            text: [
                'そして荷物をまとめて新たな目的地へ出発する勇者たちであった。旅の行方は...'
            ],
            next: 'CHAPTER2_STEP_054'
        }),
        chapter2LibraryStep({
            id: 'CHAPTER2_STEP_054',
            type: 'completed',
            result: {
                saveStoryChapterCleared: true,
                unlockStoryChapterIds: ['chapter3']
            }
        })
    ];

    const chapter2Steps = normalizeChapterSteps(chapter2StepDefinitions);
    const chapters = deepFreeze({
        [CHAPTER1_ID]: createChapterRecord({
            id: CHAPTER1_ID,
            title: '第一章',
            menuLabel: '第一章',
            menuDescription: '森で異変の兆しに遭遇し、盤喰いの小鬼との最初の戦いへ入る。',
            entryStepId: 'CHAPTER1_STEP_001',
            unlockRequirementTutorialId: 'chapter0',
            lockMessage: 'プレイするにはチュートリアルをクリアしてください。',
            unlocksChapterIds: ['chapter2'],
            steps: chapter1Steps.steps,
            stepsById: chapter1Steps.stepsById
        }),
        [CHAPTER2_ID]: createChapterRecord({
            id: CHAPTER2_ID,
            title: '第二章',
            menuLabel: '第二章',
            menuDescription: '逃げる意志のニーゲルと出会い、特殊石と次の目的地を知る章。',
            entryStepId: 'CHAPTER2_STEP_001',
            lockMessage: '第一章をクリアすると解放されます。',
            unlocksChapterIds: ['chapter3'],
            steps: chapter2Steps.steps,
            stepsById: chapter2Steps.stepsById
        })
    });

    function getChapter(chapterId) {
        return chapters[String(chapterId || '')] || null;
    }

    function getChapterStep(chapterId, stepId) {
        const chapter = getChapter(chapterId);
        if (!chapter || !stepId) return null;
        return chapter.stepsById[String(stepId)] || null;
    }

    function getChapterIds() {
        return Object.keys(chapters);
    }

    return {
        CHAPTER1_ID,
        CHAPTER2_ID,
        CHAPTER2_LABEL,
        FOREST_BG_SRC,
        HYPERACTIVE_VILLAGE_BG_SRC,
        THEORY_ROOM_BG_SRC,
        OLD_LIBRARY_BG_SRC,
        HERO_NAME,
        HERO_IMAGE_SRC,
        OBSERVER_NAME,
        OBSERVER_IMAGE_SRC,
        GOBLIN_NAME,
        GOBLIN_IMAGE_SRC,
        EXECUTIONER_NAME,
        EXECUTIONER_IMAGE_SRC,
        THEORY_NAME,
        THEORY_IMAGE_SRC,
        UDG_NAME,
        UDG_IMAGE_SRC,
        NIGEL_NAME,
        ESCAPE_WILL_NAME,
        ESCAPE_WILL_IMAGE_SRC,
        chapters,
        getChapter,
        getChapterStep,
        getChapterIds
    };
}));
