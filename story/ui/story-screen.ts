import { StoryRunner, type StoryRunnerStep } from '../core/story-runner';
import type { StoryBattleResult, StoryCommand, StoryScenario } from '../core/story-schema';
import type { StoryState } from '../core/story-state';
import type { StoryAssetRegistry } from '../content/story-assets';
import { StoryAudio } from './story-audio';
import { StoryBacklogView } from './story-backlog';
import { StoryRenderer } from './story-renderer';

export type StoryScreenOptions = {
  root: HTMLElement;
  scenario: StoryScenario;
  assets: StoryAssetRegistry;
  typewriterMs?: number;
  onBattle?: (step: Extract<StoryRunnerStep, { status: 'battle' }>) => void;
  onComplete?: () => void;
  onClose?: () => void;
  onError?: (error: unknown) => void;
  audio?: StoryAudio;
  autoDelayMs?: number;
  skipDelayMs?: number;
};

export class StoryScreen {
  private readonly runner: StoryRunner;
  private readonly renderer: StoryRenderer;
  private readonly audio: StoryAudio | null;
  private backlogView: StoryBacklogView | null = null;
  private backlogOpen = false;
  private auto = false;
  private skip = false;
  private playbackTimer: number | null = null;
  private readonly keydownHandler = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      if (this.backlogOpen) {
        this.toggleBacklog();
        return;
      }
      this.options.onClose?.();
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.advance();
    }
  };
  private readonly options: StoryScreenOptions;
  private started = false;

  constructor(options: StoryScreenOptions) {
    this.options = options;
    this.runner = new StoryRunner(options.scenario);
    this.audio = options.audio ?? null;
    this.renderer = new StoryRenderer(options.root, options.assets, {
      typewriterMs: options.typewriterMs,
      onAdvance: () => this.advance(),
      onChoose: (index) => this.choose(index),
      onTypewriterCharacter: (character) => this.audio?.playTextBlip(character)
    });
    this.renderer.onAutoClick(() => this.toggleAuto());
    this.renderer.onSkipClick(() => this.toggleSkip());
    this.renderer.onBacklogClick(() => this.toggleBacklog());
    this.renderer.onCloseClick(() => this.options.onClose?.());
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    window.addEventListener('keydown', this.keydownHandler);
    this.applyStep(this.runner.start());
  }

  advance(): void {
    if (!this.started) {
      this.start();
      return;
    }
    this.runSafely(() => this.applyStep(this.runner.next()));
  }

  choose(index: number): void {
    this.runSafely(() => this.applyStep(this.runner.choose(index)));
  }

  resumeFromBattle(result: StoryBattleResult): void {
    this.runSafely(() => this.applyStep(this.runner.resumeFromBattle(result)));
  }

  getState(): StoryState {
    return this.runner.getState();
  }

  destroy(): void {
    this.clearPlaybackTimer();
    window.removeEventListener('keydown', this.keydownHandler);
    this.audio?.dispose();
    this.renderer.destroy();
  }

  private applyStep(step: StoryRunnerStep): void {
    if (step.status === 'event') {
      this.applyAudioCommand(step.command);
      if (step.command.type === 'say') {
        this.audio?.beginTextLine();
      }
      this.renderer.renderCommand(step.command);
      this.schedulePlayback();
      return;
    }
    if (step.status === 'choice') {
      this.clearPlaybackTimer();
      this.renderer.renderChoices(step.choices);
      return;
    }
    if (step.status === 'battle') {
      this.clearPlaybackTimer();
      this.renderer.renderBattleRequest(step.battle);
      this.options.onBattle?.(step);
      return;
    }
    this.renderer.renderComplete();
    this.options.onComplete?.();
  }

  private toggleBacklog(): void {
    this.backlogOpen = !this.backlogOpen;
    const root = this.renderer.setBacklogVisible(this.backlogOpen);
    if (!this.backlogView) {
      this.backlogView = new StoryBacklogView(root);
    }
    this.backlogView.render(this.runner.getState().backlog);
  }

  private toggleAuto(): void {
    this.auto = !this.auto;
    if (this.auto) this.skip = false;
    this.renderer.setAutoActive(this.auto);
    this.renderer.setSkipActive(this.skip);
    this.schedulePlayback();
  }

  private toggleSkip(): void {
    this.skip = !this.skip;
    if (this.skip) this.auto = false;
    this.renderer.setSkipActive(this.skip);
    this.renderer.setAutoActive(this.auto);
    this.schedulePlayback();
  }

  private schedulePlayback(): void {
    this.clearPlaybackTimer();
    if (!this.auto && !this.skip) return;
    const delay = this.skip ? (this.options.skipDelayMs ?? 40) : (this.options.autoDelayMs ?? 1200);
    this.playbackTimer = window.setTimeout(() => this.advance(), Math.max(0, delay));
  }

  private clearPlaybackTimer(): void {
    if (this.playbackTimer !== null) {
      window.clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  private runSafely(callback: () => void): void {
    try {
      callback();
    } catch (error) {
      if (this.options.onError) {
        this.options.onError(error);
        return;
      }
      throw error;
    }
  }

  private applyAudioCommand(command: StoryCommand): void {
    if (!this.audio) return;
    if (command.type === 'bgm') {
      if (command.action === 'stop') {
        this.audio.stopBgm();
      } else if (command.action === 'crossfade') {
        this.audio.crossfadeBgm(command.id);
      } else {
        this.audio.playBgm(command.id);
      }
      return;
    }
    if (command.type === 'se') {
      this.audio.playSe(command.id);
    }
  }
}
