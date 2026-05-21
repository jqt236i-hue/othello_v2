export const STORY_NARRATION_SPEAKERS = Object.freeze(['ナレーション'] as const);

const STORY_NARRATION_SPEAKER_SET = new Set<string>([
  ...STORY_NARRATION_SPEAKERS,
  '地の文'
]);

export function isStoryNarrationSpeaker(speaker: string): boolean {
  const normalized = String(speaker || '').trim();
  return normalized.length > 0 && STORY_NARRATION_SPEAKER_SET.has(normalized);
}

export function getStorySpeakerDisplayName(speaker: string): string {
  return isStoryNarrationSpeaker(speaker) ? '' : String(speaker || '');
}
