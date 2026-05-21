import type {
  StoryBattleRequest,
  StoryBattleResult,
  StoryChapter,
  StoryChoiceOption,
  StoryCommand,
  StoryNode,
  StoryScenario
} from './story-schema';
import type { SerializedStoryState, StoryState } from './story-state';

export type StoryRunnerStatus = 'event' | 'choice' | 'battle' | 'complete';

export type StoryRunnerStep =
  | { status: 'event'; command: StoryCommand; state: StoryState }
  | { status: 'choice'; choices: StoryChoiceOption[]; state: StoryState }
  | { status: 'battle'; battle: StoryBattleRequest; state: StoryState }
  | { status: 'complete'; state: StoryState };

export class StoryRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryRunnerError';
  }
}

export class StoryRunner {
  private readonly scenario: StoryScenario;
  private readonly chaptersById: Map<string, StoryChapter>;
  private readonly nodesByChapterId: Map<string, Map<string, StoryNode>>;
  private state: StoryState;

  constructor(scenario: StoryScenario, initialState?: SerializedStoryState) {
    this.scenario = scenario;
    this.chaptersById = new Map(scenario.chapters.map((chapter) => [chapter.id, chapter]));
    this.nodesByChapterId = new Map(
      scenario.chapters.map((chapter) => [
        chapter.id,
        new Map(chapter.nodes.map((node) => [node.id, node]))
      ])
    );
    this.state = initialState ? cloneState(initialState) : this.createInitialState();
    this.assertCurrentLocation();
  }

  start(): StoryRunnerStep {
    this.state = this.createInitialState();
    return this.next();
  }

  next(): StoryRunnerStep {
    this.ensureNotWaitingForInput();

    for (;;) {
      const node = this.getCurrentNode();
      const command = node.commands[this.state.commandIndex];

      if (!command) {
        if (!node.next) {
          return this.step('complete');
        }
        this.jump(node.next);
        continue;
      }

      switch (command.type) {
        case 'jump':
          this.jump(command.target);
          continue;
        case 'setFlag':
          this.state.flags[command.key] = command.value;
          this.advanceCommand();
          continue;
        case 'unlock':
          if (!this.state.unlocked.includes(command.id)) {
            this.state.unlocked.push(command.id);
          }
          this.advanceCommand();
          continue;
        case 'choice':
          this.state.pendingChoice = { choices: command.choices };
          this.advanceCommand();
          return this.step('choice');
        case 'battle': {
          const battle = this.createBattleRequest(command);
          this.state.pendingBattle = battle;
          this.advanceCommand();
          return this.step('battle');
        }
        case 'say':
          if (command.lineId && !this.state.seenLines.includes(command.lineId)) {
            this.state.seenLines.push(command.lineId);
          }
          this.state.backlog.push({
            lineId: command.lineId,
            speaker: command.speaker,
            text: command.text
          });
          this.advanceCommand();
          return this.step('event', command);
        case 'bg':
        case 'char':
        case 'hideChar':
        case 'bgm':
        case 'se':
        case 'wait':
        case 'effect':
          this.advanceCommand();
          return this.step('event', command);
        default:
          return assertNever(command);
      }
    }
  }

  choose(index: number): StoryRunnerStep {
    const pendingChoice = this.state.pendingChoice;
    if (!pendingChoice) {
      throw new StoryRunnerError('Cannot choose because no story choice is pending.');
    }

    const choice = pendingChoice.choices[index];
    if (!choice) {
      throw new StoryRunnerError(`Choice index is out of range: ${index}`);
    }

    if (choice.setFlag) {
      this.state.flags[choice.setFlag] = true;
    }
    this.state.pendingChoice = null;
    this.jump(choice.jump);
    return this.next();
  }

  jump(target: string): void {
    const nodes = this.nodesByChapterId.get(this.state.chapterId);
    if (!nodes?.has(target)) {
      throw new StoryRunnerError(
        `Unknown story node "${target}" in chapter "${this.state.chapterId}".`
      );
    }
    this.state.nodeId = target;
    this.state.commandIndex = 0;
    this.state.pendingChoice = null;
    this.state.pendingBattle = null;
  }

  resumeFromBattle(result: StoryBattleResult): StoryRunnerStep {
    const pendingBattle = this.state.pendingBattle;
    if (!pendingBattle) {
      throw new StoryRunnerError('Cannot resume battle because no story battle is pending.');
    }
    if (pendingBattle.stageId !== result.stageId) {
      throw new StoryRunnerError(
        `Battle result stageId mismatch. expected="${pendingBattle.stageId}" actual="${result.stageId}".`
      );
    }

    const target = resolveBattleJump(pendingBattle, result);
    this.state.pendingBattle = null;
    this.jump(target);
    return this.next();
  }

  serialize(): SerializedStoryState {
    return cloneState(this.state);
  }

  restore(state: SerializedStoryState): void {
    this.state = cloneState(state);
    this.assertCurrentLocation();
  }

  getState(): StoryState {
    return cloneState(this.state);
  }

  private createInitialState(): StoryState {
    const chapter = this.getInitialChapter();
    const node = this.getInitialNode(chapter);

    return {
      scenarioId: this.scenario.id,
      chapterId: chapter.id,
      nodeId: node.id,
      commandIndex: 0,
      flags: {},
      unlocked: [],
      seenLines: [],
      backlog: [],
      pendingChoice: null,
      pendingBattle: null
    };
  }

  private getInitialChapter(): StoryChapter {
    const chapterId = this.scenario.initialChapterId ?? this.scenario.chapters[0]?.id;
    const chapter = chapterId ? this.chaptersById.get(chapterId) : undefined;
    if (!chapter) {
      throw new StoryRunnerError('Story scenario has no initial chapter.');
    }
    return chapter;
  }

  private getInitialNode(chapter: StoryChapter): StoryNode {
    const nodeId = chapter.initialNodeId ?? chapter.nodes[0]?.id;
    const node = nodeId ? this.nodesByChapterId.get(chapter.id)?.get(nodeId) : undefined;
    if (!node) {
      throw new StoryRunnerError(`Story chapter "${chapter.id}" has no initial node.`);
    }
    return node;
  }

  private getCurrentNode(): StoryNode {
    const node = this.nodesByChapterId.get(this.state.chapterId)?.get(this.state.nodeId);
    if (!node) {
      throw new StoryRunnerError(
        `Unknown current story node "${this.state.nodeId}" in chapter "${this.state.chapterId}".`
      );
    }
    return node;
  }

  private assertCurrentLocation(): void {
    if (this.state.scenarioId !== this.scenario.id) {
      throw new StoryRunnerError(
        `Story state scenarioId mismatch. expected="${this.scenario.id}" actual="${this.state.scenarioId}".`
      );
    }
    this.getCurrentNode();
  }

  private ensureNotWaitingForInput(): void {
    if (this.state.pendingChoice) {
      throw new StoryRunnerError('Cannot advance story while a choice is pending.');
    }
    if (this.state.pendingBattle) {
      throw new StoryRunnerError('Cannot advance story while a battle is pending.');
    }
  }

  private advanceCommand(): void {
    this.state.commandIndex += 1;
  }

  private createBattleRequest(command: Extract<StoryCommand, { type: 'battle' }>): StoryBattleRequest {
    return {
      scenarioId: this.state.scenarioId,
      chapterId: this.state.chapterId,
      nodeId: this.state.nodeId,
      commandIndex: this.state.commandIndex,
      stageId: command.stageId,
      winJump: command.winJump,
      loseJump: command.loseJump,
      drawJump: command.drawJump
    };
  }

  private step(status: 'complete'): StoryRunnerStep;
  private step(status: 'choice'): StoryRunnerStep;
  private step(status: 'battle'): StoryRunnerStep;
  private step(status: 'event', command: StoryCommand): StoryRunnerStep;
  private step(status: StoryRunnerStatus, command?: StoryCommand): StoryRunnerStep {
    const state = this.getState();
    if (status === 'event') {
      if (!command) {
        throw new StoryRunnerError('Story event step requires a command.');
      }
      return { status, command, state };
    }
    if (status === 'choice') {
      if (!state.pendingChoice) {
        throw new StoryRunnerError('Story choice step requires pendingChoice.');
      }
      return { status, choices: state.pendingChoice.choices, state };
    }
    if (status === 'battle') {
      if (!state.pendingBattle) {
        throw new StoryRunnerError('Story battle step requires pendingBattle.');
      }
      return { status, battle: state.pendingBattle, state };
    }
    return { status, state };
  }
}

function resolveBattleJump(battle: StoryBattleRequest, result: StoryBattleResult): string {
  if (result.outcome === 'win') {
    return battle.winJump;
  }
  if (result.outcome === 'lose') {
    if (!battle.loseJump) {
      throw new StoryRunnerError(`Battle "${battle.stageId}" has no loseJump.`);
    }
    return battle.loseJump;
  }
  if (!battle.drawJump) {
    throw new StoryRunnerError(`Battle "${battle.stageId}" has no drawJump.`);
  }
  return battle.drawJump;
}

function cloneState(state: SerializedStoryState): SerializedStoryState {
  return JSON.parse(JSON.stringify(state)) as SerializedStoryState;
}

function assertNever(value: never): never {
  throw new StoryRunnerError(`Unsupported story command: ${JSON.stringify(value)}`);
}
