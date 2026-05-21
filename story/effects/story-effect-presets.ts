import type { StoryEffectPreset, StoryEffectPresetValidationIssue } from './story-effect-schema';

export const storyEffectPresets = [
  {
    id: 'black_fade',
    title: '黒フェード',
    description: '場面転換や静かな暗転に使う基本演出。',
    authoringLabel: '演出：黒フェード',
    steps: [
      { id: 'fade_in_black', durationMs: 680, overlay: 'black', overlayOpacity: 0.9, vignetteOpacity: 0.72, zoom: 1.015 },
      { id: 'fade_hold_black', durationMs: 180, overlay: 'black', overlayOpacity: 0.92, vignetteOpacity: 0.78 },
      { id: 'fade_out_black', durationMs: 760, overlay: 'black', overlayOpacity: 0, vignetteOpacity: 0.16, zoom: 1 }
    ]
  },
  {
    id: 'white_flash',
    title: '白フラッシュ',
    description: '記憶の断片、衝撃、場面切り替えに使う一瞬の白発光。',
    authoringLabel: '演出：白フラッシュ',
    steps: [
      { id: 'flash_pre', durationMs: 80, overlay: 'white', overlayOpacity: 0.18, blurPx: 1 },
      { id: 'flash_peak', durationMs: 90, overlay: 'white', overlayOpacity: 1, flash: 'white', zoom: 1.025 },
      { id: 'flash_afterimage', durationMs: 220, overlay: 'white', overlayOpacity: 0.34, blurPx: 3 },
      { id: 'flash_decay', durationMs: 460, overlay: 'white', overlayOpacity: 0, blurPx: 0, zoom: 1 }
    ]
  },
  {
    id: 'screen_shake',
    title: '画面揺れ',
    description: '衝撃音、扉、攻撃、強い感情の直後に使う短い揺れ。',
    authoringLabel: '演出：画面揺れ',
    steps: [
      { id: 'shake_hit', durationMs: 90, overlay: 'white', overlayOpacity: 0.24, shake: 'hard', seId: 'impact', zoom: 1.018 },
      { id: 'shake_hard', durationMs: 360, overlay: 'none', overlayOpacity: 0, shake: 'hard', zoom: 1.012 },
      { id: 'shake_settle', durationMs: 280, overlay: 'black', overlayOpacity: 0.08, shake: 'soft', zoom: 1 }
    ]
  },
  {
    id: 'silent_blackout',
    title: '無音暗転',
    description: 'BGM と効果音を止め、真っ黒な画面へ落とす重い演出。',
    authoringLabel: '演出：無音暗転',
    steps: [
      { id: 'sound_cut', durationMs: 220, overlay: 'black', overlayOpacity: 0.4, vignetteOpacity: 0.8, bgmAction: 'stop' },
      { id: 'black_drop', durationMs: 480, overlay: 'black', overlayOpacity: 1, vignetteOpacity: 1, zoom: 1.02 },
      { id: 'black_hold', durationMs: 980, overlay: 'black', overlayOpacity: 1, vignetteOpacity: 1 }
    ]
  },
  {
    id: 'memory_noise',
    title: '回想ノイズ',
    description: '前世回想、記憶混線、観測の違和感に使うノイズ演出。',
    authoringLabel: '演出：回想ノイズ',
    steps: [
      { id: 'noise_start', durationMs: 260, overlay: 'noise', overlayOpacity: 0.54, blurPx: 2, scanlineOpacity: 0.6, tone: 'cold', seId: 'noise' },
      { id: 'memory_text', durationMs: 1250, overlay: 'noise', overlayOpacity: 0.3, blurPx: 1, scanlineOpacity: 0.48, text: '記憶が、ほどけていく。', textMotion: 'type', tone: 'cold' },
      { id: 'noise_flash', durationMs: 120, overlay: 'white', overlayOpacity: 0.38, flash: 'white', scanlineOpacity: 0.2 },
      { id: 'noise_end', durationMs: 420, overlay: 'white', overlayOpacity: 0, blurPx: 0, scanlineOpacity: 0 }
    ]
  },
  {
    id: 'wake_fade',
    title: '目覚めフェード',
    description: '黒からゆっくり視界が開ける、病室や意識回復向けの演出。',
    authoringLabel: '演出：目覚めフェード',
    steps: [
      { id: 'wake_black', durationMs: 720, overlay: 'black', overlayOpacity: 1, blurPx: 7, vignetteOpacity: 1, tone: 'warm' },
      { id: 'wake_light_leak', durationMs: 820, overlay: 'white', overlayOpacity: 0.24, blurPx: 5, vignetteOpacity: 0.62, zoom: 1.025, text: '……。', textMotion: 'fade', tone: 'warm' },
      { id: 'wake_focus', durationMs: 980, overlay: 'white', overlayOpacity: 0.08, blurPx: 2, vignetteOpacity: 0.34, zoom: 1.01, tone: 'warm' },
      { id: 'wake_clear', durationMs: 760, overlay: 'white', overlayOpacity: 0, blurPx: 0, vignetteOpacity: 0.08, zoom: 1 }
    ]
  },
  {
    id: 'ominous_dim',
    title: '不穏な暗転',
    description: '赤黒く沈ませて、観測者登場や危険な気配を出す演出。',
    authoringLabel: '演出：不穏な暗転',
    steps: [
      { id: 'ominous_sink', durationMs: 700, overlay: 'red', overlayOpacity: 0.3, blurPx: 1, vignetteOpacity: 0.68, tone: 'ominous' },
      { id: 'ominous_pressure', durationMs: 760, overlay: 'black', overlayOpacity: 0.46, shake: 'soft', scanlineOpacity: 0.18, pulse: 'soft', tone: 'ominous' },
      { id: 'ominous_release', durationMs: 620, overlay: 'black', overlayOpacity: 0.14, vignetteOpacity: 0.38, tone: 'normal' }
    ]
  },
  {
    id: 'heartbeat',
    title: '心音',
    description: '画面を暗く脈打たせる、緊張や病室の不安に使う演出。',
    authoringLabel: '演出：心音',
    steps: [
      { id: 'heartbeat_silence', durationMs: 260, overlay: 'black', overlayOpacity: 0.18, vignetteOpacity: 0.52 },
      { id: 'heartbeat_one', durationMs: 220, overlay: 'red', overlayOpacity: 0.32, blurPx: 1, zoom: 1.018, pulse: 'heartbeat', seId: 'heartbeat' },
      { id: 'heartbeat_rest', durationMs: 330, overlay: 'black', overlayOpacity: 0.18, vignetteOpacity: 0.44 },
      { id: 'heartbeat_two', durationMs: 220, overlay: 'red', overlayOpacity: 0.36, blurPx: 1, zoom: 1.02, pulse: 'heartbeat', seId: 'heartbeat' },
      { id: 'heartbeat_out', durationMs: 620, overlay: 'black', overlayOpacity: 0.04, vignetteOpacity: 0.12, zoom: 1 }
    ]
  },
  {
    id: 'blurred_vision',
    title: '視界ぼやけ',
    description: '一度ぼやけて戻る、気絶明けや記憶混濁に使う演出。',
    authoringLabel: '演出：視界ぼやけ',
    steps: [
      { id: 'blur_in', durationMs: 680, overlay: 'white', overlayOpacity: 0.14, blurPx: 8, zoom: 1.03, tone: 'warm' },
      { id: 'blur_drift', durationMs: 540, overlay: 'white', overlayOpacity: 0.1, blurPx: 5, shake: 'soft', zoom: 1.02 },
      { id: 'blur_focus', durationMs: 840, overlay: 'white', overlayOpacity: 0.04, blurPx: 2, zoom: 1.01 },
      { id: 'blur_out', durationMs: 540, overlay: 'white', overlayOpacity: 0, blurPx: 0, zoom: 1 }
    ]
  },
  {
    id: 'blink_black',
    title: 'まばたき暗転',
    description: '目を閉じて開くような短い暗転。目覚め、気絶、場面の間に使いやすい演出。',
    authoringLabel: '演出：まばたき暗転',
    steps: [
      { id: 'blink_close', durationMs: 130, overlay: 'black', overlayOpacity: 0.78, vignetteOpacity: 0.92, blurPx: 2 },
      { id: 'blink_dark', durationMs: 110, overlay: 'black', overlayOpacity: 1, vignetteOpacity: 1 },
      { id: 'blink_open', durationMs: 180, overlay: 'black', overlayOpacity: 0.2, vignetteOpacity: 0.44, blurPx: 1 },
      { id: 'blink_clear', durationMs: 260, overlay: 'black', overlayOpacity: 0, vignetteOpacity: 0.08, blurPx: 0 }
    ]
  },
  {
    id: 'red_alert',
    title: '赤い警告',
    description: '危険な異常、攻撃、警報に使う赤い点滅と強い圧迫感。',
    authoringLabel: '演出：赤い警告',
    steps: [
      { id: 'alert_flash_one', durationMs: 90, overlay: 'red', overlayOpacity: 0.66, flash: 'red', shake: 'hard', seId: 'alert', chromatic: true },
      { id: 'alert_gap_one', durationMs: 140, overlay: 'black', overlayOpacity: 0.24, vignetteOpacity: 0.7, scanlineOpacity: 0.24, chromatic: true },
      { id: 'alert_flash_two', durationMs: 110, overlay: 'red', overlayOpacity: 0.74, flash: 'red', shake: 'hard', zoom: 1.025, chromatic: true },
      { id: 'alert_pressure', durationMs: 520, overlay: 'red', overlayOpacity: 0.26, vignetteOpacity: 0.76, scanlineOpacity: 0.18, tone: 'ominous' },
      { id: 'alert_release', durationMs: 360, overlay: 'red', overlayOpacity: 0, vignetteOpacity: 0.18, zoom: 1 }
    ]
  },
  {
    id: 'memory_whiteout',
    title: '記憶白飛び',
    description: '前世の記憶や強い衝撃で視界が白く飛ぶ、回想導入向けの演出。',
    authoringLabel: '演出：記憶白飛び',
    steps: [
      { id: 'whiteout_rise', durationMs: 360, overlay: 'white', overlayOpacity: 0.42, blurPx: 3, zoom: 1.018, tone: 'warm' },
      { id: 'whiteout_peak', durationMs: 260, overlay: 'white', overlayOpacity: 1, blurPx: 8, flash: 'white', text: '思い出してしまった。', textMotion: 'fade' },
      { id: 'whiteout_after', durationMs: 760, overlay: 'white', overlayOpacity: 0.72, blurPx: 5, scanlineOpacity: 0.14, tone: 'cold' },
      { id: 'whiteout_return', durationMs: 820, overlay: 'white', overlayOpacity: 0, blurPx: 0, zoom: 1, scanlineOpacity: 0 }
    ]
  },
  {
    id: 'film_memory',
    title: '古い記録映像',
    description: '世界大会の映像、監視記録、前世の断片に使うフィルム風ノイズ。',
    authoringLabel: '演出：古い記録映像',
    steps: [
      { id: 'film_start', durationMs: 220, overlay: 'noise', overlayOpacity: 0.42, scanlineOpacity: 0.74, tone: 'cold', seId: 'film_noise' },
      { id: 'film_roll', durationMs: 980, overlay: 'noise', overlayOpacity: 0.28, scanlineOpacity: 0.86, blurPx: 1, chromatic: true },
      { id: 'film_jump', durationMs: 80, overlay: 'white', overlayOpacity: 0.32, flash: 'white', shake: 'soft' },
      { id: 'film_settle', durationMs: 520, overlay: 'noise', overlayOpacity: 0.12, scanlineOpacity: 0.38, blurPx: 0, chromatic: false }
    ]
  },
  {
    id: 'cracked_screen',
    title: '画面割れ',
    description: '精神的な破綻、観測失敗、敗北の衝撃を表すひび割れ演出。',
    authoringLabel: '演出：画面割れ',
    steps: [
      { id: 'crack_impact', durationMs: 120, overlay: 'white', overlayOpacity: 0.72, flash: 'white', shake: 'hard', crackOpacity: 0.92, seId: 'glass_break', zoom: 1.03 },
      { id: 'crack_hold', durationMs: 820, overlay: 'black', overlayOpacity: 0.28, vignetteOpacity: 0.78, crackOpacity: 1, chromatic: true },
      { id: 'crack_sink', durationMs: 680, overlay: 'black', overlayOpacity: 0.48, vignetteOpacity: 0.88, crackOpacity: 0.54, tone: 'ominous' },
      { id: 'crack_fade', durationMs: 460, overlay: 'black', overlayOpacity: 0.12, crackOpacity: 0, vignetteOpacity: 0.18 }
    ]
  },
  {
    id: 'cinematic_letterbox',
    title: '重要シーン黒帯',
    description: '会話を一段重く見せる黒帯。決意、対峙、章の山場に使う演出。',
    authoringLabel: '演出：重要シーン黒帯',
    steps: [
      { id: 'letterbox_in', durationMs: 420, overlay: 'black', overlayOpacity: 0.08, letterboxOpacity: 1, vignetteOpacity: 0.24, zoom: 1.01 },
      { id: 'letterbox_hold', durationMs: 1100, overlay: 'none', overlayOpacity: 0, letterboxOpacity: 1, vignetteOpacity: 0.32, text: 'ここから先は、戻れない。', textMotion: 'fade' },
      { id: 'letterbox_out', durationMs: 440, overlay: 'black', overlayOpacity: 0, letterboxOpacity: 0, vignetteOpacity: 0.04, zoom: 1 }
    ]
  },
  {
    id: 'forced_zoom',
    title: '強制ズーム',
    description: '発見、威圧、気づきの瞬間に画面へ強く寄る演出。',
    authoringLabel: '演出：強制ズーム',
    steps: [
      { id: 'zoom_snap', durationMs: 110, overlay: 'white', overlayOpacity: 0.2, zoom: 1.085, shake: 'soft', seId: 'zoom' },
      { id: 'zoom_pressure', durationMs: 640, overlay: 'black', overlayOpacity: 0.1, vignetteOpacity: 0.5, zoom: 1.075, blurPx: 1 },
      { id: 'zoom_focus', durationMs: 360, overlay: 'none', overlayOpacity: 0, vignetteOpacity: 0.22, zoom: 1.035, blurPx: 0 },
      { id: 'zoom_return', durationMs: 420, overlay: 'none', overlayOpacity: 0, vignetteOpacity: 0, zoom: 1 }
    ]
  },
  {
    id: 'slow_white_fade',
    title: '白フェード',
    description: '夢、回想終了、優しい場面転換に使うゆっくりした白フェード。',
    authoringLabel: '演出：白フェード',
    steps: [
      { id: 'white_fade_start', durationMs: 620, overlay: 'white', overlayOpacity: 0.18, blurPx: 1, tone: 'warm' },
      { id: 'white_fade_fill', durationMs: 980, overlay: 'white', overlayOpacity: 0.88, blurPx: 4, vignetteOpacity: 0, tone: 'warm' },
      { id: 'white_fade_hold', durationMs: 360, overlay: 'white', overlayOpacity: 0.94, blurPx: 5 },
      { id: 'white_fade_clear', durationMs: 760, overlay: 'white', overlayOpacity: 0, blurPx: 0, zoom: 1 }
    ]
  },
  {
    id: 'observation_glitch',
    title: '観測グリッチ',
    description: '観測者、盤理、世界の違和感を出すための色ズレとノイズ演出。',
    authoringLabel: '演出：観測グリッチ',
    steps: [
      { id: 'glitch_enter', durationMs: 160, overlay: 'noise', overlayOpacity: 0.62, scanlineOpacity: 0.8, chromatic: true, shake: 'hard', seId: 'glitch' },
      { id: 'glitch_cut_one', durationMs: 90, overlay: 'red', overlayOpacity: 0.26, flash: 'red', chromatic: true },
      { id: 'glitch_hold', durationMs: 680, overlay: 'noise', overlayOpacity: 0.34, scanlineOpacity: 0.66, blurPx: 1, chromatic: true, text: '観測が、ずれた。', textMotion: 'type', tone: 'cold' },
      { id: 'glitch_cut_two', durationMs: 80, overlay: 'white', overlayOpacity: 0.46, flash: 'white', shake: 'soft' },
      { id: 'glitch_exit', durationMs: 420, overlay: 'noise', overlayOpacity: 0, scanlineOpacity: 0, blurPx: 0, chromatic: false }
    ]
  },
  {
    id: 'battle_intro',
    title: '対局突入',
    description: '暗転から短いタイトル表示を挟み、ストーリー対局へ入る演出。',
    authoringLabel: '演出：対局突入',
    steps: [
      { id: 'battle_black', durationMs: 460, overlay: 'black', overlayOpacity: 0.92, vignetteOpacity: 0.82, bgmAction: 'fadeout' },
      { id: 'battle_title', durationMs: 1120, overlay: 'black', overlayOpacity: 1, text: '対局開始', textMotion: 'title', scanlineOpacity: 0.24, seId: 'decision' },
      { id: 'battle_flash', durationMs: 140, overlay: 'white', overlayOpacity: 0.94, flash: 'white', zoom: 1.035 },
      { id: 'battle_out', durationMs: 520, overlay: 'black', overlayOpacity: 0.12, vignetteOpacity: 0.24, zoom: 1 }
    ]
  }
] as const satisfies readonly StoryEffectPreset[];

export type StoryEffectPresetId = typeof storyEffectPresets[number]['id'];

export function getStoryEffectPreset(id: string): StoryEffectPreset | null {
  return storyEffectPresets.find((preset) => preset.id === id) ?? null;
}

export function validateStoryEffectPresets(presets: readonly StoryEffectPreset[] = storyEffectPresets): StoryEffectPresetValidationIssue[] {
  const issues: StoryEffectPresetValidationIssue[] = [];
  const seenIds = new Set<string>();
  for (const preset of presets) {
    if (!preset.id.trim()) {
      issues.push({ presetId: preset.id, message: 'preset id is empty.' });
    }
    if (seenIds.has(preset.id)) {
      issues.push({ presetId: preset.id, message: `duplicate preset id: ${preset.id}` });
    }
    seenIds.add(preset.id);
    if (!preset.title.trim()) {
      issues.push({ presetId: preset.id, message: 'preset title is empty.' });
    }
    if (!preset.authoringLabel.trim()) {
      issues.push({ presetId: preset.id, message: 'authoring label is empty.' });
    }
    if (preset.steps.length === 0) {
      issues.push({ presetId: preset.id, message: 'preset must contain at least one step.' });
    }
    const stepIds = new Set<string>();
    for (const step of preset.steps) {
      if (!step.id.trim()) {
        issues.push({ presetId: preset.id, stepId: step.id, message: 'step id is empty.' });
      }
      if (stepIds.has(step.id)) {
        issues.push({ presetId: preset.id, stepId: step.id, message: `duplicate step id: ${step.id}` });
      }
      stepIds.add(step.id);
      if (!Number.isFinite(step.durationMs) || step.durationMs <= 0) {
        issues.push({ presetId: preset.id, stepId: step.id, message: 'step duration must be a positive number.' });
      }
      if (step.overlayOpacity != null && (step.overlayOpacity < 0 || step.overlayOpacity > 1)) {
        issues.push({ presetId: preset.id, stepId: step.id, message: 'overlay opacity must be between 0 and 1.' });
      }
      if (step.vignetteOpacity != null && (step.vignetteOpacity < 0 || step.vignetteOpacity > 1)) {
        issues.push({ presetId: preset.id, stepId: step.id, message: 'vignette opacity must be between 0 and 1.' });
      }
      if (step.scanlineOpacity != null && (step.scanlineOpacity < 0 || step.scanlineOpacity > 1)) {
        issues.push({ presetId: preset.id, stepId: step.id, message: 'scanline opacity must be between 0 and 1.' });
      }
      if (step.crackOpacity != null && (step.crackOpacity < 0 || step.crackOpacity > 1)) {
        issues.push({ presetId: preset.id, stepId: step.id, message: 'crack opacity must be between 0 and 1.' });
      }
      if (step.letterboxOpacity != null && (step.letterboxOpacity < 0 || step.letterboxOpacity > 1)) {
        issues.push({ presetId: preset.id, stepId: step.id, message: 'letterbox opacity must be between 0 and 1.' });
      }
      if (step.zoom != null && (!Number.isFinite(step.zoom) || step.zoom <= 0)) {
        issues.push({ presetId: preset.id, stepId: step.id, message: 'zoom must be a positive number.' });
      }
    }
  }
  return issues;
}
