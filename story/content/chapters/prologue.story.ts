import type { StoryScenario } from '../../core/story-schema';

export const prologueStory = {
  id: 'prologue',
  title: 'プロローグ',
  initialChapterId: 'prologue',
  chapters: [
    {
      id: 'prologue',
      title: 'はじまり',
      initialNodeId: 'start',
      nodes: [
        {
          id: 'start',
          commands: [
            { type: 'bg', id: '病室', transition: 'cut' },
            { type: 'bgm', id: 'calm', action: 'play' },
            { type: 'char', id: 'protagonist', pose: 'normal', slot: 'center', enter: 'cut' },
            {
              type: 'say',
              speaker: '主人公',
              text: 'ここからカードオセロの物語が始まる。',
              lineId: 'prologue_001'
            },
            { type: 'char', id: 'rival', pose: 'confident', slot: 'right', enter: 'fade' },
            {
              type: 'say',
              speaker: 'ライバル',
              text: '短い勝負で腕試しをしよう。',
              lineId: 'prologue_002'
            },
            {
              type: 'choice',
              choices: [
                { label: '受けて立つ', jump: 'short_battle', setFlag: 'accepted_trial' },
                { label: 'まず様子を見る', jump: 'standard_battle' }
              ]
            }
          ]
        },
        {
          id: 'short_battle',
          commands: [
            { type: 'se', id: 'decision' },
            {
              type: 'battle',
              stageId: 'prologue_short_battle',
              winJump: 'after_win',
              loseJump: 'after_lose',
              drawJump: 'after_draw'
            }
          ]
        },
        {
          id: 'standard_battle',
          commands: [
            {
              type: 'battle',
              stageId: 'prologue_standard_battle',
              winJump: 'after_win',
              loseJump: 'after_lose',
              drawJump: 'after_draw'
            }
          ]
        },
        {
          id: 'after_win',
          commands: [
            { type: 'unlock', id: 'chapter_1' },
            {
              type: 'say',
              speaker: 'ライバル',
              text: 'やるね。次の章へ進もう。',
              lineId: 'prologue_win_001'
            }
          ]
        },
        {
          id: 'after_lose',
          commands: [
            {
              type: 'say',
              speaker: '主人公',
              text: '次は負けない。',
              lineId: 'prologue_lose_001'
            }
          ]
        },
        {
          id: 'after_draw',
          commands: [
            {
              type: 'say',
              speaker: 'ライバル',
              text: '引き分けか。続きは本番で決めよう。',
              lineId: 'prologue_draw_001'
            }
          ]
        }
      ]
    }
  ]
} as const satisfies StoryScenario;
