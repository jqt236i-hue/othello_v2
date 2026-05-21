export type StoryAssetRegistry = {
  bg: Record<string, string>;
  chars: Record<string, Record<string, string>>;
  bgm: Record<string, string>;
  se: Record<string, string>;
  cg: Record<string, string>;
};

// Placeholder registry. Scenarios reference only these IDs; real files can be added later.
export const storyAssets = {
  bg: {
    病室: 'assets/story/bg/病室.png',
    room_day: 'assets/story/bg/room_day.jpg',
    arena_evening: 'assets/story/bg/arena_evening.jpg'
  },
  chars: {
    protagonist: {
      normal: 'assets/story/chars/protagonist_normal.png',
      determined: 'assets/story/chars/protagonist_determined.png'
    },
    rival: {
      normal: 'assets/story/chars/rival_normal.png',
      confident: 'assets/story/chars/rival_confident.png'
    }
  },
  bgm: {
    calm: 'assets/story/bgm/TOT.mp3',
    TOT: 'assets/story/bgm/TOT.mp3'
  },
  se: {
    decision: 'assets/story/se/テキストクリック.wav',
    テキストクリック: 'assets/story/se/テキストクリック.wav'
  },
  cg: {}
} as const satisfies StoryAssetRegistry;
