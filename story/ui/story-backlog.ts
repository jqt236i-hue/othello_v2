import type { StoryBacklogEntry } from '../core/story-state';
import { getStorySpeakerDisplayName, isStoryNarrationSpeaker } from '../core/story-speakers';

export class StoryBacklogView {
  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  render(entries: StoryBacklogEntry[]): void {
    this.root.innerHTML = '';
    entries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'story-backlog-entry';
      row.classList.toggle('is-narration', isStoryNarrationSpeaker(entry.speaker));

      const speaker = document.createElement('div');
      speaker.className = 'story-backlog-speaker';
      speaker.textContent = getStorySpeakerDisplayName(entry.speaker);

      const text = document.createElement('div');
      text.className = 'story-backlog-text';
      text.textContent = entry.text;

      row.append(speaker, text);
      this.root.append(row);
    });
  }
}
