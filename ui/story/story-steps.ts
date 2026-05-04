import type { CardState, GameState, PlayerKey } from '../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

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
    const TARDU_WILL_NAME = '多動の意志';
    const TARDU_NAME = 'タードゥ';
    const TARDU_IMAGE_SRC = 'assets/story/stones/HYPERACTIVE_WILL-black.png';
    const TADOON_NAME = 'タドゥーン';
    const TADOON_IMAGE_SRC = 'assets/story/stones/ULTIMATE_HYPERACTIVE_GOD-black.png';
    const NIGEL_NAME = 'ニーゲル';
    const ESCAPE_WILL_NAME = '逃げる意志';
    const ESCAPE_WILL_IMAGE_SRC = 'assets/story/stones/ESCAPE_WILL-black.png';

    function deepFreeze(value: any): any {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.freeze(value);
        for (const key of Object.keys(value)) {
            deepFreeze(value[key]);
        }
        return value;
    }

    function buildChoiceResponseMap(step: any): any {
        if (!step || !Array.isArray(step.responses)) return {};
        const out: any = {};
        for (const response of step.responses) {
            if (!response || !response.choiceId) continue;
            out[String(response.choiceId)] = response;
        }
        return out;
    }

    function normalizeChapterSteps(stepDefinitions: any): any {
        const steps: any[] = [];
        const stepsById: any = {};
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

    function createChapterRecord(definition: any): any {
        const source = definition && typeof definition === 'object' ? definition : {};
        return deepFreeze(Object.assign({
            kind: 'story',
            progressionGroup: 'story',
            progressionId: source.id || null,
            unlocksChapterIds: []
        }, source));
    }

    function chapterStep(chapterLabel: any, backgroundSrc: any, definition: any): any {
        const base: any = {
            chapterLabel: chapterLabel || ''
        };
        if (backgroundSrc) {
            base.sceneBackgroundSrc = backgroundSrc;
        }
        return Object.assign(base, definition);
    }

    function forestStep(definition: any): any {
        return chapterStep(CHAPTER1_LABEL, FOREST_BG_SRC, definition);
    }

    function chapter2ForestStep(definition: any): any {
        return chapterStep(CHAPTER2_LABEL, FOREST_BG_SRC, definition);
    }

    function chapter2VillageStep(definition: any): any {
        return chapterStep(CHAPTER2_LABEL, HYPERACTIVE_VILLAGE_BG_SRC, definition);
    }

    function chapter2TheoryStep(definition: any): any {
        return chapterStep(CHAPTER2_LABEL, THEORY_ROOM_BG_SRC, definition);
    }

    function chapter2LibraryStep(definition: any): any {
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
                'この世界のモンスターは元々は人間だったんだ。だがこのカードオセロの沼にハマるほど人の見た目が遠ざかって変貌してしまうんだ。',
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
                'ただ変貌を抑えるコツは、強い意志を持つことだ！己の意志を貫けば変貌にも抗える！'
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
                '奴は盤喰いの小鬼、我の観測データにある。カードオセロに浸かりすぎるとあんな感じで化け物みたいな姿になってしまうんぞよw'
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
                'よくやった勇者、前世でボードゲーム最強なだけあって飲み込みが早いぞ！'
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
                '強い気配を感じる、気をつけろ！'
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
                '私の名は盤界の執行者、お前を断罪しに来た。観測した罪、命で償ってもらおう。',
                'いでよ、究極破壊神'
            ],
            next: 'CHAPTER1_STEP_026'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_026',
            type: 'dialogue',
            speaker: UDG_NAME,
            characterVisible: false,
            supportVisible: true,
            supportImageSrc: UDG_IMAGE_SRC,
            supportImageAlt: UDG_NAME,
            supportStage: 'right',
            emotion: 'serious',
            text: [
                '破壊を開始する。'
            ],
            next: 'CHAPTER1_STEP_027'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_027',
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
                'やつの範囲内にいると破壊されてしまう！',
                'あれほど強力な特殊石を使役させる者がいたとは…'
            ],
            next: 'CHAPTER1_STEP_028'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_028',
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
            next: 'CHAPTER1_STEP_029'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_029',
            type: 'dialogue',
            sceneTransition: 'fade_black',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                'ここは引くぞ！近づけなければ対局することすら叶わぬ'
            ],
            next: 'CHAPTER1_STEP_029A'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_029A',
            type: 'dialogue',
            speaker: HERO_NAME,
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            emotion: 'surprised',
            text: [
                '対抗手段はないのか！？'
            ],
            next: 'CHAPTER1_STEP_029B'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_029B',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'serious',
            text: [
                '今の我には力が残っておらぬ。お主を召喚するために使い果たしてしまったのでな！'
            ],
            next: 'CHAPTER1_STEP_029C'
        }),
        forestStep({
            id: 'CHAPTER1_STEP_029C',
            type: 'choice',
            prompt: 'どう返す？',
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            choices: [
                { id: 'understand_ambush', label: 'その隙を狙われたってわけか' },
                { id: 'forced_to_flee', label: '逃げるしかないようだな…' }
            ],
            next: 'CHAPTER1_STEP_029D'
        }),
        {
            id: 'CHAPTER1_STEP_029D',
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
                'やつの範囲内にいると破壊されてしまう！',
                'あれほど強力な特殊石を使役させる者がいたとは…'
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
                'ここは引くぞ！近づけなければ対局することすら叶わぬ'
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
                '私に乗ってください！観測者さんとお連れの方、逃げましょう！'
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
                '私は逃げる意志のニーゲル！先日観測者さんに空腹で倒れていた私に果物を分けてくれたんです！',
                'その恩返しをしたいなと思って跡をつけていたんです！'
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
                { id: 'observer_kind', label: '意外と優しいんだな！観測者' },
                { id: 'thank_nigel', label: '助かったよニーゲル！' }
            ],
            responses: [
                { choiceId: 'observer_kind', speaker: OBSERVER_NAME, characterImageSrc: OBSERVER_IMAGE_SRC, characterImageAlt: OBSERVER_NAME, emotion: 'smile', text: '当然のことをしたまでぞよ' },
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
                '私たちは特殊石といって、主人に仕えるのが役目なの！でも今の私には主人がいないの...'
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
                '特殊石はオセロに強く干渉できる特殊能力を持っていて、カードとして使うことができる。仕えた主人には忠実で良いパートナーになるぞよ'
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
                'そうだ。しかも奴が使っていた特殊石はかなり手強い。よく使役できたものだ',
                '今の状況ではとても太刀打ちできぬ。我らも力をつけねばならぬぞよ',
                '相手の特殊石を封じた状態ではないと対局はできぬ。対局さえできればお主の圧倒的パワーで薙ぎ倒すだけなのだがな！'
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
                'せっかく私たちの村に来てくれたんですから、今夜は村でご馳走を用意します！'
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
                '丁度腹減ってたんだ！ありがとな！'
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
                'まぁいい。今日はいっぱい食べて気持ち良くなろうではないか'
            ],
            next: 'CHAPTER2_STEP_026'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_026',
            type: 'dialogue',
            speaker: TARDU_WILL_NAME,
            characterVisible: true,
            characterImageSrc: TARDU_IMAGE_SRC,
            characterImageAlt: TARDU_WILL_NAME,
            emotion: 'smile',
            text: [
                'あんたらがニーゲルを助けてくれた恩人か！今日は食べてけよっ！'
            ],
            next: 'CHAPTER2_STEP_027'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_027',
            type: 'dialogue',
            speaker: TARDU_NAME,
            characterVisible: true,
            characterImageSrc: TARDU_IMAGE_SRC,
            characterImageAlt: TARDU_WILL_NAME,
            supportVisible: true,
            supportImageSrc: TADOON_IMAGE_SRC,
            supportImageAlt: TADOON_NAME,
            supportStage: 'right',
            emotion: 'smile',
            text: [
                '俺は多動の意志のタードゥ、ニーゲルのお兄ちゃんだ、よろしくな！',
                'そしてこのお方が村の長、究極多動神のタドゥーン様だ！'
            ],
            next: 'CHAPTER2_STEP_028'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_028',
            type: 'dialogue',
            speaker: TADOON_NAME,
            characterVisible: true,
            characterImageSrc: TADOON_IMAGE_SRC,
            characterImageAlt: TADOON_NAME,
            emotion: 'soft',
            text: [
                '多動村へようこそ。恩人達よ'
            ],
            next: 'CHAPTER2_STEP_029'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_029',
            type: 'dialogue',
            speaker: HERO_NAME,
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            emotion: 'smile',
            text: [
                'まぁ俺らも助けてくれたんだけどな！ニーゲルに！'
            ],
            next: 'CHAPTER2_STEP_030'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_030',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'soft',
            text: [
                '本当に危ない状況だった、我らも彼女に救われたんぞよ'
            ],
            next: 'CHAPTER2_STEP_031'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_031',
            type: 'dialogue',
            speaker: TADOON_NAME,
            characterVisible: true,
            characterImageSrc: TADOON_IMAGE_SRC,
            characterImageAlt: TADOON_NAME,
            emotion: 'serious',
            text: [
                'なにがあったか話してくれぬか？'
            ],
            next: 'CHAPTER2_STEP_032'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_032',
            type: 'dialogue',
            sceneTransition: 'fade_black',
            speaker: 'ナレーション',
            characterVisible: false,
            emotion: 'normal',
            text: [
                '（観測者達はあった出来事をそのまま話した）'
            ],
            next: 'CHAPTER2_STEP_033'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_033',
            type: 'dialogue',
            speaker: TADOON_NAME,
            characterVisible: true,
            characterImageSrc: TADOON_IMAGE_SRC,
            characterImageAlt: TADOON_NAME,
            emotion: 'soft',
            text: [
                'それは大変であったな、では我らも黒幕退治に手を貸そう'
            ],
            next: 'CHAPTER2_STEP_034'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_034',
            type: 'choice',
            prompt: 'どう返す？',
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            choices: [
                { id: 'really_sure', label: '本当にいいのか！' },
                { id: 'reliable_allies', label: 'それは頼もしいぜ' }
            ],
            next: 'CHAPTER2_STEP_035'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_035',
            type: 'dialogue',
            speaker: TADOON_NAME,
            characterVisible: true,
            characterImageSrc: TADOON_IMAGE_SRC,
            characterImageAlt: TADOON_NAME,
            emotion: 'serious',
            text: [
                '旅についていくことはできんが、我らをカードとしてお主らに授ける、対局に役立ててくれ'
            ],
            next: 'CHAPTER2_STEP_036'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_036',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'smile',
            text: [
                'これほどまでに強力なカードを…感謝する！'
            ],
            next: 'CHAPTER2_STEP_037'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_037',
            type: 'dialogue',
            speaker: '',
            characterVisible: false,
            emotion: 'normal',
            text: [
                '【多動の意志、瞬間多動、多動の継承、究極多動神のカードをゲットした！】'
            ],
            next: 'CHAPTER2_STEP_038'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_038',
            type: 'dialogue',
            speaker: NIGEL_NAME,
            characterVisible: true,
            characterImageSrc: ESCAPE_WILL_IMAGE_SRC,
            characterImageAlt: ESCAPE_WILL_NAME,
            emotion: 'serious',
            text: [
                '私は旅についていきたいです！いいでしょう？タドゥーン様！'
            ],
            next: 'CHAPTER2_STEP_039'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_039',
            type: 'dialogue',
            speaker: TADOON_NAME,
            characterVisible: true,
            characterImageSrc: TADOON_IMAGE_SRC,
            characterImageAlt: TADOON_NAME,
            emotion: 'serious',
            text: [
                'しかしお前にはまだ早いのではないか？前も空腹で倒れかけてたではないか？'
            ],
            next: 'CHAPTER2_STEP_040'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_040',
            type: 'dialogue',
            speaker: NIGEL_NAME,
            characterVisible: true,
            characterImageSrc: ESCAPE_WILL_IMAGE_SRC,
            characterImageAlt: ESCAPE_WILL_NAME,
            emotion: 'serious',
            text: [
                'いつまでも子供扱いしないでください！あのような失敗はもうしませんから！'
            ],
            next: 'CHAPTER2_STEP_041'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_041',
            type: 'dialogue',
            speaker: OBSERVER_NAME,
            characterVisible: true,
            characterImageSrc: OBSERVER_IMAGE_SRC,
            characterImageAlt: OBSERVER_NAME,
            emotion: 'smile',
            text: [
                '本人もそう言ってるぞよ、食べ物ならいくらでも取ってくるぞよ！'
            ],
            next: 'CHAPTER2_STEP_042'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_042',
            type: 'choice',
            prompt: 'どう返す？',
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            choices: [
                { id: 'never_lose_again', label: '俺がいればここから負けなしだぜ' },
                { id: 'just_keep_winning', label: '要するに勝てばいいんだろ？' }
            ],
            next: 'CHAPTER2_STEP_043'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_043',
            type: 'dialogue',
            speaker: TADOON_NAME,
            characterVisible: true,
            characterImageSrc: TADOON_IMAGE_SRC,
            characterImageAlt: TADOON_NAME,
            emotion: 'serious',
            text: [
                '...そこまで言うなら認めざるを得ないな'
            ],
            next: 'CHAPTER2_STEP_044'
        }),
        chapter2VillageStep({
            id: 'CHAPTER2_STEP_044',
            type: 'dialogue',
            speaker: HERO_NAME,
            characterVisible: true,
            characterImageSrc: HERO_IMAGE_SRC,
            characterImageAlt: HERO_NAME,
            emotion: 'smile',
            text: [
                '決まりだな！'
            ],
            next: 'CHAPTER2_STEP_045'
        }),
        chapter2TheoryStep({
            id: 'CHAPTER2_STEP_045',
            type: 'dialogue',
            sceneTransition: 'fade_black',
            speaker: THEORY_NAME,
            characterVisible: true,
            characterImageSrc: THEORY_IMAGE_SRC,
            characterImageAlt: THEORY_NAME,
            emotion: 'serious',
            text: [
                '盤理の観測者は仕留め損ねたようだな'
            ],
            next: 'CHAPTER2_STEP_046'
        }),
        chapter2TheoryStep({
            id: 'CHAPTER2_STEP_046',
            type: 'dialogue',
            speaker: EXECUTIONER_NAME,
            characterVisible: true,
            characterImageSrc: EXECUTIONER_IMAGE_SRC,
            characterImageAlt: EXECUTIONER_NAME,
            emotion: 'serious',
            text: [
                '申し訳ございません、逃してしまいました。逃げる意志の邪魔が入ってしまい...'
            ],
            next: 'CHAPTER2_STEP_047'
        }),
        chapter2TheoryStep({
            id: 'CHAPTER2_STEP_047',
            type: 'dialogue',
            speaker: THEORY_NAME,
            characterVisible: true,
            characterImageSrc: THEORY_IMAGE_SRC,
            characterImageAlt: THEORY_NAME,
            emotion: 'serious',
            text: [
                '使えぬな。執行者の名前負けだぞ。まぁいい、収穫もあった。あのオセロの勇者とかいう小僧。どこから現れた？召喚か？'
            ],
            next: 'CHAPTER2_STEP_048'
        }),
        chapter2TheoryStep({
            id: 'CHAPTER2_STEP_048',
            type: 'dialogue',
            speaker: EXECUTIONER_NAME,
            characterVisible: true,
            characterImageSrc: EXECUTIONER_IMAGE_SRC,
            characterImageAlt: EXECUTIONER_NAME,
            emotion: 'serious',
            text: [
                'はい、人型を保っていることから最近召喚されたものだと思われます。'
            ],
            next: 'CHAPTER2_STEP_049'
        }),
        chapter2TheoryStep({
            id: 'CHAPTER2_STEP_049',
            type: 'dialogue',
            speaker: THEORY_NAME,
            characterVisible: true,
            characterImageSrc: THEORY_IMAGE_SRC,
            characterImageAlt: THEORY_NAME,
            emotion: 'serious',
            text: [
                '野放しにすると危険だな。観測者とかいう観測することしか取り柄のない小物は後回しで、勇者から先に執行しろ'
            ],
            next: 'CHAPTER2_STEP_050'
        }),
        chapter2TheoryStep({
            id: 'CHAPTER2_STEP_050',
            type: 'dialogue',
            speaker: EXECUTIONER_NAME,
            characterVisible: true,
            characterImageSrc: EXECUTIONER_IMAGE_SRC,
            characterImageAlt: EXECUTIONER_NAME,
            emotion: 'serious',
            text: [
                '承知しました。'
            ],
            next: 'CHAPTER2_STEP_051'
        }),
        chapter2TheoryStep({
            id: 'CHAPTER2_STEP_051',
            type: 'dialogue',
            speaker: THEORY_NAME,
            characterVisible: true,
            characterImageSrc: THEORY_IMAGE_SRC,
            characterImageAlt: THEORY_NAME,
            emotion: 'serious',
            text: [
                'オセロとかいう不完全なゲームは絶対に許さない。このまま書き換えを続けてオセロの定義を完全に破壊する。そして平等な世界を、必ず...'
            ],
            next: 'CHAPTER2_STEP_054'
        }),
        chapter2TheoryStep({
            id: 'CHAPTER2_STEP_054',
            type: 'completed',
            result: {
                saveStoryChapterCleared: true
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
            menuDescription: '逃げる意志のニーゲルと多動の村の支援を得て、黒幕側の狙いが勇者へ向く章。',
            entryStepId: 'CHAPTER2_STEP_001',
            lockMessage: '第一章をクリアすると解放されます。',
            unlocksChapterIds: [],
            steps: chapter2Steps.steps,
            stepsById: chapter2Steps.stepsById
        })
    });

    function getChapter(chapterId: any): any {
        return chapters[String(chapterId || '')] || null;
    }

    function getChapterStep(chapterId: any, stepId: any): any {
        const chapter = getChapter(chapterId);
        if (!chapter || !stepId) return null;
        return chapter.stepsById[String(stepId)] || null;
    }

    function getChapterIds() {
        return Object.keys(chapters);
    }

    const StorySteps = {
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
        TARDU_WILL_NAME,
        TARDU_NAME,
        TARDU_IMAGE_SRC,
        TADOON_NAME,
        TADOON_IMAGE_SRC,
        NIGEL_NAME,
        ESCAPE_WILL_NAME,
        ESCAPE_WILL_IMAGE_SRC,
        chapters,
        getChapter,
        getChapterStep,
        getChapterIds
    };
export = StorySteps;