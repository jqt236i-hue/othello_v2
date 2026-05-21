export type StoryEffectOverlayKind = 'black' | 'white' | 'red' | 'noise' | 'none';

export type StoryEffectTextMotion = 'none' | 'fade' | 'fall' | 'type' | 'title';

export type StoryEffectStep = {
  id: string;
  durationMs: number;
  overlay?: StoryEffectOverlayKind;
  overlayOpacity?: number;
  shake?: 'none' | 'soft' | 'hard';
  flash?: 'none' | 'white' | 'red';
  blurPx?: number;
  zoom?: number;
  vignetteOpacity?: number;
  scanlineOpacity?: number;
  crackOpacity?: number;
  letterboxOpacity?: number;
  chromatic?: boolean;
  pulse?: 'none' | 'soft' | 'heartbeat';
  tone?: 'normal' | 'warm' | 'cold' | 'ominous';
  text?: string;
  textMotion?: StoryEffectTextMotion;
  bgmAction?: 'none' | 'stop' | 'fadeout';
  seId?: string;
};

export type StoryEffectPreset = {
  id: string;
  title: string;
  description: string;
  authoringLabel: string;
  steps: StoryEffectStep[];
};

export type StoryEffectPresetValidationIssue = {
  presetId: string;
  stepId?: string;
  message: string;
};
