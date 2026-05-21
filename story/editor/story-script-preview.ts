import type { StoryCharacterSlot, StoryCommand, StoryScenario } from '../core/story-schema';
import { getStorySpeakerDisplayName, isStoryNarrationSpeaker } from '../core/story-speakers';
import { formatStoryScriptNodeKey } from './story-script-parser';

export type StoryScriptPreviewOptions = {
  speakerCharacterMap?: Record<string, string>;
  stageTitleMap?: Record<string, string>;
};

export type StoryScriptPreviewSnapshot = {
  chapterLabel: string;
  sceneLabel: string;
  backgroundId: string | null;
  bgmId: string | null;
  speaker: string | null;
  text: string | null;
  visibleCharacters: Array<{ slot: StoryCharacterSlot; label: string }>;
  hasChoice: boolean;
  choiceLabels: string[];
  battleLabel: string | null;
  summaries: string[];
};

export class StoryScriptPreview {
  constructor(private readonly root: HTMLElement) {}

  render(
    scenario: StoryScenario | null,
    selectedNodeKey: string | null,
    options: StoryScriptPreviewOptions = {}
  ): StoryScriptPreviewSnapshot | null {
    this.root.innerHTML = '';
    if (!scenario || scenario.chapters.length === 0) {
      this.root.append(this.createEmpty('脚本を入力すると、ここに場面の見え方が出ます。'));
      return null;
    }

    const nodeRef = resolveNodeRef(scenario, selectedNodeKey);
    if (!nodeRef) {
      this.root.append(this.createEmpty('選べる場面がありません。'));
      return null;
    }

    const snapshot = createSnapshot(scenario, nodeRef.chapter.id, nodeRef.node.id, nodeRef.node.commands, options);

    const top = document.createElement('div');
    top.className = 'story-script-preview-stage';

    const background = document.createElement('div');
    background.className = 'story-script-preview-background';
    background.textContent = snapshot.backgroundId ? '背景が設定されています' : '背景なし';

    const status = document.createElement('div');
    status.className = 'story-script-preview-status';
    status.append(
      createPreviewChip('章', snapshot.chapterLabel),
      createPreviewChip('場面', snapshot.sceneLabel),
      createPreviewChip('BGM', snapshot.bgmId ? '設定あり' : 'なし')
    );

    const characters = document.createElement('div');
    characters.className = 'story-script-preview-characters';
    if (snapshot.visibleCharacters.length === 0) {
      characters.append(createPreviewChip('立ち絵', 'なし'));
    } else {
      snapshot.visibleCharacters.forEach((character) => {
        characters.append(createPreviewChip(slotLabel(character.slot), character.label));
      });
    }

    const dialogue = document.createElement('div');
    dialogue.className = 'story-script-preview-dialogue';
    const speaker = document.createElement('div');
    speaker.className = 'story-script-preview-speaker';
    speaker.textContent = snapshot.speaker ? getStorySpeakerDisplayName(snapshot.speaker) : '話者なし';
    speaker.classList.toggle('is-empty', !!snapshot.speaker && isStoryNarrationSpeaker(snapshot.speaker));
    const text = document.createElement('div');
    text.className = 'story-script-preview-text';
    text.textContent = snapshot.text ?? 'この場面にはまだセリフがありません。';
    dialogue.append(speaker, text);

    top.append(background, status, characters, dialogue);

    const notes = document.createElement('div');
    notes.className = 'story-script-preview-notes';
    if (snapshot.hasChoice) {
      notes.append(createNotice('選択肢', snapshot.choiceLabels.join(' / ')));
    }
    if (snapshot.battleLabel) {
      notes.append(createNotice('対局', snapshot.battleLabel));
    }
    if (!snapshot.hasChoice && !snapshot.battleLabel) {
      notes.append(createNotice('進行', 'この場面は通常進行です。'));
    }

    const summaryTitle = document.createElement('div');
    summaryTitle.className = 'story-script-preview-summary-title';
    summaryTitle.textContent = 'コマンド要約';

    const summaryList = document.createElement('ol');
    summaryList.className = 'story-script-preview-summary-list';
    snapshot.summaries.forEach((summary) => {
      const item = document.createElement('li');
      item.textContent = summary;
      summaryList.append(item);
    });

    this.root.append(top, notes, summaryTitle, summaryList);
    return snapshot;
  }

  private createEmpty(message: string): HTMLElement {
    const empty = document.createElement('div');
    empty.className = 'story-script-preview-empty';
    empty.textContent = message;
    return empty;
  }
}

function resolveNodeRef(
  scenario: StoryScenario,
  selectedNodeKey: string | null
): { chapter: StoryScenario['chapters'][number]; node: StoryScenario['chapters'][number]['nodes'][number] } | null {
  if (selectedNodeKey) {
    for (const chapter of scenario.chapters) {
      for (const node of chapter.nodes) {
        if (formatStoryScriptNodeKey(chapter.id, node.id) === selectedNodeKey) {
          return { chapter, node };
        }
      }
    }
  }

  const chapter = scenario.chapters[0];
  const node = chapter?.nodes[0];
  return chapter && node ? { chapter, node } : null;
}

function createSnapshot(
  scenario: StoryScenario,
  chapterId: string,
  nodeId: string,
  commands: StoryCommand[],
  options: StoryScriptPreviewOptions
): StoryScriptPreviewSnapshot {
  const visibleCharacters = new Map<StoryCharacterSlot, { label: string }>();
  let backgroundId: string | null = null;
  let bgmId: string | null = null;
  let speaker: string | null = null;
  let text: string | null = null;
  let hasChoice = false;
  let choiceLabels: string[] = [];
  let battleLabel: string | null = null;
  const reverseSpeakerMap = buildReverseSpeakerMap(options.speakerCharacterMap);
  const sceneRef = resolveSceneNumber(scenario, chapterId, nodeId);

  commands.forEach((command) => {
    if (command.type === 'bg') {
      backgroundId = command.id;
      return;
    }
    if (command.type === 'bgm') {
      bgmId = command.action === 'stop' ? null : command.id;
      return;
    }
    if (command.type === 'char') {
      visibleCharacters.set(command.slot, {
        label: describeCharacter(command.id, reverseSpeakerMap)
      });
      return;
    }
    if (command.type === 'hideChar') {
      visibleCharacters.delete(command.slot);
      return;
    }
    if (command.type === 'say') {
      speaker = command.speaker;
      text = command.text;
      return;
    }
    if (command.type === 'choice') {
      hasChoice = true;
      choiceLabels = command.choices.map((choice) => choice.label);
      return;
    }
    if (command.type === 'battle') {
      battleLabel = options.stageTitleMap?.[command.stageId] ?? '対局あり';
    }
  });

  return {
    chapterLabel: `章 ${sceneRef.chapterNumber}`,
    sceneLabel: `場面 ${sceneRef.sceneNumber}`,
    backgroundId,
    bgmId,
    speaker,
    text,
    visibleCharacters: Array.from(visibleCharacters.entries()).map(([slot, value]) => ({
      slot,
      label: value.label
    })),
    hasChoice,
    choiceLabels,
    battleLabel,
    summaries: commands.map(describeCommand)
  };
}

function describeCommand(command: StoryCommand): string {
  if (command.type === 'say') {
    const displaySpeaker = getStorySpeakerDisplayName(command.speaker);
    return displaySpeaker ? `${displaySpeaker}「${truncate(command.text, 34)}」` : truncate(command.text, 34);
  }
  if (command.type === 'bg') return '背景を変更';
  if (command.type === 'char') return `立ち絵: ${slotLabel(command.slot)}に表示`;
  if (command.type === 'hideChar') return `立ち絵を消す: ${slotLabel(command.slot)}`;
  if (command.type === 'bgm') return 'BGMを変更';
  if (command.type === 'se') return '効果音を再生';
  if (command.type === 'choice') return `選択肢: ${command.choices.map((choice) => choice.label).join(' / ')}`;
  if (command.type === 'jump') return '別の場面へ移動';
  if (command.type === 'setFlag') return '条件を記録';
  if (command.type === 'battle') return '対局へ進む';
  if (command.type === 'unlock') return '解放を追加';
  if (command.type === 'wait') return `待機: ${command.ms}ms`;
  return '演出を再生';
}

function createPreviewChip(label: string, value: string): HTMLElement {
  const chip = document.createElement('div');
  chip.className = 'story-script-preview-chip';
  const title = document.createElement('span');
  title.className = 'story-script-preview-chip-label';
  title.textContent = label;
  const body = document.createElement('strong');
  body.textContent = value;
  chip.append(title, body);
  return chip;
}

function createNotice(label: string, value: string): HTMLElement {
  const notice = document.createElement('div');
  notice.className = 'story-script-preview-notice';
  const title = document.createElement('span');
  title.textContent = label;
  const body = document.createElement('strong');
  body.textContent = value;
  notice.append(title, body);
  return notice;
}

function slotLabel(slot: StoryCharacterSlot): string {
  if (slot === 'left') return '左';
  if (slot === 'center') return '中央';
  return '右';
}

function buildReverseSpeakerMap(speakerCharacterMap: Record<string, string> | undefined): Record<string, string> {
  if (!speakerCharacterMap) return {};
  return Object.fromEntries(
    Object.entries(speakerCharacterMap).map(([speaker, characterId]) => [characterId, speaker])
  );
}

function describeCharacter(characterId: string, reverseSpeakerMap: Record<string, string>): string {
  return reverseSpeakerMap[characterId] ?? '立ち絵あり';
}

function resolveSceneNumber(
  scenario: StoryScenario,
  chapterId: string,
  nodeId: string
): { chapterNumber: number; sceneNumber: number } {
  let chapterNumber = 1;
  let sceneNumber = 1;
  for (const chapter of scenario.chapters) {
    if (chapter.id === chapterId) {
      for (const node of chapter.nodes) {
        if (node.id === nodeId) {
          return { chapterNumber, sceneNumber };
        }
        sceneNumber += 1;
      }
      return { chapterNumber, sceneNumber: Math.max(sceneNumber - 1, 1) };
    }
    chapterNumber += 1;
    sceneNumber += chapter.nodes.length;
  }
  return { chapterNumber: 1, sceneNumber: 1 };
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}
