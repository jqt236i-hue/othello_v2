import type { StoryBattleRequest, StoryChoiceOption, StoryCommand } from '../core/story-schema';
import { getStorySpeakerDisplayName, isStoryNarrationSpeaker } from '../core/story-speakers';
import type { StoryAssetRegistry } from '../content/story-assets';

export type StoryRendererOptions = {
  typewriterMs?: number;
  onAdvance?: () => void;
  onChoose?: (index: number) => void;
  onTypewriterCharacter?: (character: string, visibleText: string, fullText: string) => void;
};

type CharacterSlotState = {
  id: string;
  pose: string;
  url: string;
};

export class StoryRenderer {
  private readonly root: HTMLElement;
  private readonly assets: StoryAssetRegistry;
  private readonly options: StoryRendererOptions;
  private readonly elements: {
    stage: HTMLDivElement;
    background: HTMLDivElement;
    characters: Record<string, HTMLDivElement>;
    dialogue: HTMLDivElement;
    speaker: HTMLDivElement;
    text: HTMLDivElement;
    choices: HTMLDivElement;
    status: HTMLDivElement;
    backlog: HTMLDivElement;
    backlogBody: HTMLDivElement;
    toolbar: HTMLDivElement;
    autoButton: HTMLButtonElement;
    skipButton: HTMLButtonElement;
    backlogButton: HTMLButtonElement;
    backlogCloseButton: HTMLButtonElement;
    closeButton: HTMLButtonElement;
  };
  private typewriterHandle: number | null = null;
  private fullText = '';
  private visibleText = '';
  private slots: Record<string, CharacterSlotState | null> = {
    left: null,
    center: null,
    right: null
  };

  constructor(root: HTMLElement, assets: StoryAssetRegistry, options: StoryRendererOptions = {}) {
    this.root = root;
    this.assets = assets;
    this.options = options;
    this.root.classList.add('story-root');
    this.root.innerHTML = '';

    const stage = document.createElement('div');
    stage.className = 'story-stage';

    const background = document.createElement('div');
    background.className = 'story-background';

    const characterLayer = document.createElement('div');
    characterLayer.className = 'story-character-layer';

    const characters = {
      left: createCharacterSlot('left'),
      center: createCharacterSlot('center'),
      right: createCharacterSlot('right')
    };
    characterLayer.append(characters.left, characters.center, characters.right);

    const dialogue = document.createElement('div');
    dialogue.className = 'story-dialogue';

    const speaker = document.createElement('div');
    speaker.className = 'story-speaker';

    const text = document.createElement('div');
    text.className = 'story-text';

    const choices = document.createElement('div');
    choices.className = 'story-choices';

    const status = document.createElement('div');
    status.className = 'story-status';

    const toolbar = document.createElement('div');
    toolbar.className = 'story-toolbar';

    const autoButton = createToolbarButton('AUTO');
    const skipButton = createToolbarButton('SKIP');
    const backlogButton = createToolbarButton('LOG');
    const closeButton = createToolbarButton('CLOSE');
    toolbar.append(autoButton, skipButton, backlogButton, closeButton);

    const backlog = document.createElement('div');
    backlog.className = 'story-backlog';
    backlog.hidden = true;
    const backlogHeader = document.createElement('div');
    backlogHeader.className = 'story-backlog-header';
    const backlogTitle = document.createElement('div');
    backlogTitle.className = 'story-backlog-title';
    backlogTitle.textContent = 'ログ';
    const backlogCloseButton = createToolbarButton('戻る');
    backlogCloseButton.classList.add('story-backlog-close');
    backlogHeader.append(backlogTitle, backlogCloseButton);
    const backlogBody = document.createElement('div');
    backlogBody.className = 'story-backlog-body';
    backlog.append(backlogHeader, backlogBody);

    dialogue.append(toolbar, speaker, text, choices, status);
    stage.append(background, characterLayer, dialogue, backlog);
    this.root.append(stage);

    stage.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('.story-choice-button')) return;
      if ((event.target as HTMLElement).closest('.story-toolbar-button')) return;
      if ((event.target as HTMLElement).closest('.story-backlog')) return;
      if (this.completeTypewriter()) return;
      this.options.onAdvance?.();
    });

    this.elements = {
      stage,
      background,
      characters,
      dialogue,
      speaker,
      text,
      choices,
      status,
      backlog,
      backlogBody,
      toolbar,
      autoButton,
      skipButton,
      backlogButton,
      backlogCloseButton,
      closeButton
    };
  }

  renderCommand(command: StoryCommand): void {
    this.clearStatus();
    this.clearChoices();

    switch (command.type) {
      case 'bg':
        this.setBackground(command.id);
        return;
      case 'char':
        this.setCharacter(command.slot, command.id, command.pose);
        return;
      case 'hideChar':
        this.clearCharacter(command.slot);
        return;
      case 'say':
        this.setDialogue(command.speaker, command.text);
        return;
      case 'bgm':
        this.setStatus(command.action === 'stop' ? 'BGM stop' : `BGM ${command.id}`);
        return;
      case 'se':
        this.setStatus(`SE ${command.id}`);
        return;
      case 'wait':
        this.setStatus(`wait ${command.ms}ms`);
        return;
      case 'effect':
        this.setStatus(`effect ${command.id}`);
        return;
      case 'choice':
      case 'jump':
      case 'setFlag':
      case 'battle':
      case 'unlock':
        return;
      default:
        assertNever(command);
    }
  }

  renderChoices(choices: StoryChoiceOption[]): void {
    this.clearTypewriter();
    this.clearStatus();
    this.clearChoices();
    choices.forEach((choice, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'story-choice-button';
      button.textContent = choice.label;
      button.addEventListener('click', () => this.options.onChoose?.(index));
      this.elements.choices.append(button);
    });
  }

  renderBattleRequest(battle: StoryBattleRequest): void {
    this.clearTypewriter();
    this.clearChoices();
    this.setStatus(`Battle: ${battle.stageId}`);
  }

  renderComplete(): void {
    this.clearTypewriter();
    this.clearChoices();
    this.setStatus('Story complete');
  }

  setBacklogVisible(visible: boolean): HTMLElement {
    this.elements.backlog.hidden = !visible;
    return this.elements.backlogBody;
  }

  setAutoActive(active: boolean): void {
    this.elements.autoButton.classList.toggle('is-active', active);
  }

  setSkipActive(active: boolean): void {
    this.elements.skipButton.classList.toggle('is-active', active);
  }

  onAutoClick(callback: () => void): void {
    this.elements.autoButton.addEventListener('click', callback);
  }

  onSkipClick(callback: () => void): void {
    this.elements.skipButton.addEventListener('click', callback);
  }

  onBacklogClick(callback: () => void): void {
    this.elements.backlogButton.addEventListener('click', callback);
    this.elements.backlogCloseButton.addEventListener('click', callback);
  }

  onCloseClick(callback: () => void): void {
    this.elements.closeButton.addEventListener('click', callback);
  }

  destroy(): void {
    this.clearTypewriter();
    this.root.innerHTML = '';
    this.root.classList.remove('story-root');
  }

  private setBackground(id: string): void {
    const url = this.assets.bg[id];
    this.elements.background.style.backgroundImage = url ? `url("${url}")` : '';
    this.elements.background.dataset.bgId = id;
  }

  private setCharacter(slot: string, id: string, pose: string): void {
    const slotElement = this.elements.characters[slot];
    if (!slotElement) return;
    const url = this.assets.chars[id]?.[pose] ?? '';
    this.slots[slot] = { id, pose, url };
    slotElement.style.backgroundImage = url ? `url("${url}")` : '';
    slotElement.dataset.charId = id;
    slotElement.dataset.pose = pose;
    slotElement.classList.add('is-visible');
  }

  private clearCharacter(slot: string): void {
    const slotElement = this.elements.characters[slot];
    if (!slotElement) return;
    this.slots[slot] = null;
    slotElement.style.backgroundImage = '';
    delete slotElement.dataset.charId;
    delete slotElement.dataset.pose;
    slotElement.classList.remove('is-visible');
  }

  private setDialogue(speaker: string, text: string): void {
    this.clearTypewriter();
    const displaySpeaker = getStorySpeakerDisplayName(speaker);
    this.elements.speaker.textContent = displaySpeaker;
    this.elements.speaker.classList.toggle('is-empty', isStoryNarrationSpeaker(speaker) || !displaySpeaker.trim());
    this.fullText = text;
    this.visibleText = '';
    this.elements.text.textContent = '';

    const delay = Math.max(0, Number(this.options.typewriterMs ?? 18));
    if (delay === 0) {
      this.completeTypewriter();
      return;
    }
    this.tickTypewriter(delay);
  }

  private tickTypewriter(delay: number): void {
    if (this.visibleText.length >= this.fullText.length) {
      this.typewriterHandle = null;
      return;
    }
    const nextLength = this.visibleText.length + 1;
    const nextCharacter = this.fullText.slice(nextLength - 1, nextLength);
    this.visibleText = this.fullText.slice(0, nextLength);
    this.elements.text.textContent = this.visibleText;
    if (nextCharacter) {
      this.options.onTypewriterCharacter?.(nextCharacter, this.visibleText, this.fullText);
    }
    this.typewriterHandle = window.setTimeout(() => this.tickTypewriter(delay), delay);
  }

  private completeTypewriter(): boolean {
    if (!this.fullText || this.visibleText === this.fullText) return false;
    this.clearTypewriter();
    this.visibleText = this.fullText;
    this.elements.text.textContent = this.fullText;
    return true;
  }

  private clearTypewriter(): void {
    if (this.typewriterHandle !== null) {
      window.clearTimeout(this.typewriterHandle);
      this.typewriterHandle = null;
    }
  }

  private clearChoices(): void {
    this.elements.choices.innerHTML = '';
  }

  private clearStatus(): void {
    this.elements.status.textContent = '';
  }

  private setStatus(text: string): void {
    this.elements.status.textContent = text;
  }
}

function createCharacterSlot(slot: string): HTMLDivElement {
  const element = document.createElement('div');
  element.className = `story-character story-character-${slot}`;
  element.dataset.slot = slot;
  return element;
}

function createToolbarButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'story-toolbar-button';
  button.textContent = label;
  return button;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported story render command: ${JSON.stringify(value)}`);
}
