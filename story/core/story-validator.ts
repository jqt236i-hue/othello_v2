import type {
  StoryBattleDeckSource,
  StoryBattleStage,
  StoryChapter,
  StoryCommand,
  StoryDeckPreset,
  StoryNode,
  StoryScenario
} from './story-schema';

export type StoryValidatorSeverity = 'error' | 'warning';

export type StoryValidationIssue = {
  severity: StoryValidatorSeverity;
  code: string;
  message: string;
  path: string;
};

export type StoryValidatorAssets = {
  bg?: Record<string, string>;
  chars?: Record<string, Record<string, string>>;
  bgm?: Record<string, string>;
  se?: Record<string, string>;
  cg?: Record<string, string>;
};

export type StoryValidatorDeckCodeResult = {
  ok: boolean;
  message?: string;
};

export type StoryValidatorBoardCodeResult = {
  ok: boolean;
  message?: string;
  boardSize?: { rows: 6 | 8; cols: 6 | 8 };
};

export type StoryValidatorOptions = {
  assets?: StoryValidatorAssets;
  battleStages?: Record<string, StoryBattleStage>;
  deckPresets?: Record<string, StoryDeckPreset>;
  validateDeckCode?: (deckCode: string) => StoryValidatorDeckCodeResult;
  validateBoardCode?: (boardCode: string) => StoryValidatorBoardCodeResult;
};

export function validateStoryScenario(
  scenario: StoryScenario,
  options: StoryValidatorOptions = {}
): StoryValidationIssue[] {
  const issues: StoryValidationIssue[] = [];
  const chapterIds = new Set<string>();

  if (!scenario.id.trim()) {
    pushIssue(issues, 'error', 'SCENARIO_ID_EMPTY', 'scenario id is empty.', 'scenario.id');
  }

  scenario.chapters.forEach((chapter, chapterIndex) => {
    const chapterPath = `chapters[${chapterIndex}]`;
    if (!chapter.id.trim()) {
      pushIssue(issues, 'error', 'CHAPTER_ID_EMPTY', 'chapter id is empty.', `${chapterPath}.id`);
    } else if (chapterIds.has(chapter.id)) {
      pushIssue(
        issues,
        'error',
        'CHAPTER_ID_DUPLICATE',
        `duplicate chapter id: ${chapter.id}`,
        `${chapterPath}.id`
      );
    }
    chapterIds.add(chapter.id);
    validateChapter(chapter, chapterPath, options, issues);
  });

  if (scenario.initialChapterId && !chapterIds.has(scenario.initialChapterId)) {
    pushIssue(
      issues,
      'error',
      'INITIAL_CHAPTER_UNKNOWN',
      `unknown initialChapterId: ${scenario.initialChapterId}`,
      'scenario.initialChapterId'
    );
  }

  return issues;
}

function validateChapter(
  chapter: StoryChapter,
  chapterPath: string,
  options: StoryValidatorOptions,
  issues: StoryValidationIssue[]
): void {
  const nodesById = new Map<string, { node: StoryNode; path: string }>();
  const duplicateNodeIds = new Set<string>();
  const lineIds = new Map<string, string>();

  chapter.nodes.forEach((node, nodeIndex) => {
    const nodePath = `${chapterPath}.nodes[${nodeIndex}]`;
    if (!node.id.trim()) {
      pushIssue(issues, 'error', 'NODE_ID_EMPTY', 'node id is empty.', `${nodePath}.id`);
    } else if (nodesById.has(node.id)) {
      duplicateNodeIds.add(node.id);
      pushIssue(issues, 'error', 'NODE_ID_DUPLICATE', `duplicate node id: ${node.id}`, `${nodePath}.id`);
    } else {
      nodesById.set(node.id, { node, path: nodePath });
    }
  });

  if (chapter.initialNodeId && !nodesById.has(chapter.initialNodeId)) {
    pushIssue(
      issues,
      'error',
      'INITIAL_NODE_UNKNOWN',
      `unknown initialNodeId: ${chapter.initialNodeId}`,
      `${chapterPath}.initialNodeId`
    );
  }

  chapter.nodes.forEach((node, nodeIndex) => {
    const nodePath = `${chapterPath}.nodes[${nodeIndex}]`;
    validateNode(node, nodePath, nodesById, duplicateNodeIds, lineIds, options, issues);
  });

  validateReachability(chapter, chapterPath, nodesById, issues);
}

function validateNode(
  node: StoryNode,
  nodePath: string,
  nodesById: Map<string, { node: StoryNode; path: string }>,
  duplicateNodeIds: Set<string>,
  lineIds: Map<string, string>,
  options: StoryValidatorOptions,
  issues: StoryValidationIssue[]
): void {
  node.commands.forEach((command, commandIndex) => {
    const commandPath = `${nodePath}.commands[${commandIndex}]`;
    validateNoDirectFilePaths(command, commandPath, issues);

    switch (command.type) {
      case 'say':
        if (!command.speaker.trim()) {
          pushIssue(issues, 'error', 'SAY_SPEAKER_EMPTY', 'say speaker is empty.', `${commandPath}.speaker`);
        }
        if (!command.text.trim()) {
          pushIssue(issues, 'error', 'SAY_TEXT_EMPTY', 'say text is empty.', `${commandPath}.text`);
        }
        if (command.lineId) {
          const firstPath = lineIds.get(command.lineId);
          if (firstPath) {
            pushIssue(
              issues,
              'error',
              'LINE_ID_DUPLICATE',
              `duplicate lineId: ${command.lineId}`,
              `${commandPath}.lineId; first=${firstPath}`
            );
          } else {
            lineIds.set(command.lineId, `${commandPath}.lineId`);
          }
        }
        break;
      case 'bg':
        if (!options.assets?.bg?.[command.id]) {
          pushIssue(issues, 'error', 'BG_ID_UNKNOWN', `unknown bg id: ${command.id}`, `${commandPath}.id`);
        }
        break;
      case 'char': {
        const poses = options.assets?.chars?.[command.id];
        if (!poses) {
          pushIssue(issues, 'error', 'CHAR_ID_UNKNOWN', `unknown char id: ${command.id}`, `${commandPath}.id`);
        } else if (!poses[command.pose]) {
          pushIssue(
            issues,
            'error',
            'CHAR_POSE_UNKNOWN',
            `unknown char pose: ${command.id}.${command.pose}`,
            `${commandPath}.pose`
          );
        }
        break;
      }
      case 'bgm':
        if (!options.assets?.bgm?.[command.id]) {
          pushIssue(issues, 'error', 'BGM_ID_UNKNOWN', `unknown bgm id: ${command.id}`, `${commandPath}.id`);
        }
        break;
      case 'se':
        if (!options.assets?.se?.[command.id]) {
          pushIssue(issues, 'error', 'SE_ID_UNKNOWN', `unknown se id: ${command.id}`, `${commandPath}.id`);
        }
        break;
      case 'choice':
        if (command.choices.length === 0) {
          pushIssue(issues, 'error', 'CHOICE_EMPTY', 'choice has no options.', `${commandPath}.choices`);
        }
        command.choices.forEach((choice, choiceIndex) => {
          const choicePath = `${commandPath}.choices[${choiceIndex}]`;
          if (!choice.label.trim()) {
            pushIssue(issues, 'error', 'CHOICE_LABEL_EMPTY', 'choice label is empty.', `${choicePath}.label`);
          }
          validateJumpTarget(choice.jump, `${choicePath}.jump`, nodesById, duplicateNodeIds, issues);
        });
        break;
      case 'jump':
        validateJumpTarget(command.target, `${commandPath}.target`, nodesById, duplicateNodeIds, issues);
        break;
      case 'battle':
        validateBattleCommand(command, commandPath, nodesById, duplicateNodeIds, options, issues);
        break;
      case 'hideChar':
      case 'setFlag':
      case 'unlock':
      case 'wait':
      case 'effect':
        break;
      default:
        assertNever(command);
    }
  });

  if (node.next) {
    validateJumpTarget(node.next, `${nodePath}.next`, nodesById, duplicateNodeIds, issues);
  }
}

function validateBattleCommand(
  command: Extract<StoryCommand, { type: 'battle' }>,
  commandPath: string,
  nodesById: Map<string, { node: StoryNode; path: string }>,
  duplicateNodeIds: Set<string>,
  options: StoryValidatorOptions,
  issues: StoryValidationIssue[]
): void {
  validateJumpTarget(command.winJump, `${commandPath}.winJump`, nodesById, duplicateNodeIds, issues);
  if (command.loseJump) {
    validateJumpTarget(command.loseJump, `${commandPath}.loseJump`, nodesById, duplicateNodeIds, issues);
  }
  if (command.drawJump) {
    validateJumpTarget(command.drawJump, `${commandPath}.drawJump`, nodesById, duplicateNodeIds, issues);
  }

  const stage = options.battleStages?.[command.stageId];
  if (!stage) {
    pushIssue(
      issues,
      'error',
      'BATTLE_STAGE_UNKNOWN',
      `unknown battle stage id: ${command.stageId}`,
      `${commandPath}.stageId`
    );
    return;
  }

  validateBattleStageInto(stage, `battleStages.${command.stageId}`, options, issues);
}

export function validateBattleStage(
  stage: StoryBattleStage,
  path: string,
  options: StoryValidatorOptions = {}
): StoryValidationIssue[] {
  const issues: StoryValidationIssue[] = [];
  validateBattleStageInto(stage, path, options, issues);
  return issues;
}

function validateBattleStageInto(
  stage: StoryBattleStage,
  path: string,
  options: StoryValidatorOptions,
  issues: StoryValidationIssue[]
): void {
  const rows = Number(stage.boardSize?.rows);
  const cols = Number(stage.boardSize?.cols);
  if (!((rows === 6 && cols === 6) || (rows === 8 && cols === 8))) {
    pushIssue(
      issues,
      'error',
      'BATTLE_BOARD_SIZE_UNSUPPORTED',
      `unsupported story battle boardSize: ${rows}x${cols}`,
      `${path}.boardSize`
    );
  }

  if (stage.protagonistSide && stage.enemySide && stage.protagonistSide === stage.enemySide) {
    pushIssue(
      issues,
      'error',
      'BATTLE_SIDE_CONFLICT',
      'protagonistSide and enemySide must be different.',
      path
    );
  }

  validateDeckSource(stage.protagonistDeck, `${path}.protagonistDeck`, options, issues);
  validateDeckSource(stage.enemyDeck, `${path}.enemyDeck`, options, issues);
  validateBoardCodeForStage(stage.initialBoardCode, `${path}.initialBoardCode`, stage, options, issues);
}

function validateDeckSource(
  deck: StoryBattleDeckSource | undefined,
  path: string,
  options: StoryValidatorOptions,
  issues: StoryValidationIssue[]
): void {
  if (!deck) return;

  switch (deck.type) {
    case 'default':
    case 'currentPlayerDeck':
      return;
    case 'deckPreset': {
      const preset = options.deckPresets?.[deck.presetId];
      if (!preset) {
        pushIssue(issues, 'error', 'DECK_PRESET_UNKNOWN', `unknown deck preset: ${deck.presetId}`, path);
        return;
      }
      validateDeckCode(preset.deckCode, `${path}.preset(${deck.presetId}).deckCode`, options, issues);
      return;
    }
    case 'deckCode':
      validateDeckCode(deck.deckCode, `${path}.deckCode`, options, issues);
      return;
    default:
      assertNever(deck);
  }
}

function validateDeckCode(
  deckCode: string,
  path: string,
  options: StoryValidatorOptions,
  issues: StoryValidationIssue[]
): void {
  if (!deckCode.trim()) {
    pushIssue(issues, 'error', 'DECK_CODE_EMPTY', 'deckCode is empty.', path);
    return;
  }

  const result = options.validateDeckCode?.(deckCode);
  if (result && !result.ok) {
    pushIssue(
      issues,
      'error',
      'DECK_CODE_INVALID',
      result.message ? `invalid deckCode: ${result.message}` : 'invalid deckCode.',
      path
    );
  }
}

function validateBoardCodeForStage(
  boardCode: string | undefined,
  path: string,
  stage: StoryBattleStage,
  options: StoryValidatorOptions,
  issues: StoryValidationIssue[]
): void {
  if (!boardCode) return;
  if (!boardCode.trim()) {
    pushIssue(issues, 'error', 'BOARD_CODE_EMPTY', 'initialBoardCode is empty.', path);
    return;
  }
  const result = options.validateBoardCode?.(boardCode);
  if (result && !result.ok) {
    pushIssue(
      issues,
      'error',
      'BOARD_CODE_INVALID',
      result.message ? `invalid initialBoardCode: ${result.message}` : 'invalid initialBoardCode.',
      path
    );
    return;
  }
  if (
    result?.boardSize
    && (result.boardSize.rows !== stage.boardSize.rows || result.boardSize.cols !== stage.boardSize.cols)
  ) {
    pushIssue(
      issues,
      'error',
      'BOARD_CODE_SIZE_MISMATCH',
      `initialBoardCode board size ${result.boardSize.rows}x${result.boardSize.cols} does not match stage boardSize ${stage.boardSize.rows}x${stage.boardSize.cols}.`,
      path
    );
  }
}

function validateJumpTarget(
  target: string,
  path: string,
  nodesById: Map<string, { node: StoryNode; path: string }>,
  duplicateNodeIds: Set<string>,
  issues: StoryValidationIssue[]
): void {
  if (!nodesById.has(target) || duplicateNodeIds.has(target)) {
    pushIssue(issues, 'error', 'JUMP_TARGET_UNKNOWN', `unknown jump target: ${target}`, path);
  }
}

function validateReachability(
  chapter: StoryChapter,
  chapterPath: string,
  nodesById: Map<string, { node: StoryNode; path: string }>,
  issues: StoryValidationIssue[]
): void {
  const initialNodeId = chapter.initialNodeId ?? chapter.nodes[0]?.id;
  if (!initialNodeId || !nodesById.has(initialNodeId)) return;

  const reachable = new Set<string>();
  const stack = [initialNodeId];
  while (stack.length > 0) {
    const nodeId = stack.pop();
    if (!nodeId || reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    const node = nodesById.get(nodeId)?.node;
    if (!node) continue;
    collectNodeEdges(node).forEach((target) => {
      if (nodesById.has(target) && !reachable.has(target)) {
        stack.push(target);
      }
    });
  }

  nodesById.forEach(({ path }, nodeId) => {
    if (!reachable.has(nodeId)) {
      pushIssue(issues, 'warning', 'NODE_UNREACHABLE', `unreachable node: ${nodeId}`, `${path}.id`);
    }
  });

  if (reachable.size === 0) {
    pushIssue(issues, 'error', 'CHAPTER_UNREACHABLE_EMPTY', 'chapter has no reachable nodes.', chapterPath);
  }
}

function collectNodeEdges(node: StoryNode): string[] {
  const edges: string[] = [];
  if (node.next) edges.push(node.next);
  node.commands.forEach((command) => {
    if (command.type === 'jump') edges.push(command.target);
    if (command.type === 'choice') {
      command.choices.forEach((choice) => edges.push(choice.jump));
    }
    if (command.type === 'battle') {
      edges.push(command.winJump);
      if (command.loseJump) edges.push(command.loseJump);
      if (command.drawJump) edges.push(command.drawJump);
    }
  });
  return edges;
}

function validateNoDirectFilePaths(
  command: StoryCommand,
  commandPath: string,
  issues: StoryValidationIssue[]
): void {
  collectCommandStrings(command).forEach(({ value, path }) => {
    if (looksLikeDirectAssetPath(value)) {
      pushIssue(
        issues,
        'error',
        'DIRECT_FILE_PATH',
        `scenario command must use an asset id, not a file path: ${value}`,
        `${commandPath}.${path}`
      );
    }
  });
}

function collectCommandStrings(command: StoryCommand): Array<{ value: string; path: string }> {
  switch (command.type) {
    case 'say':
      return command.lineId ? [{ value: command.lineId, path: 'lineId' }] : [];
    case 'bg':
    case 'bgm':
    case 'se':
      return [{ value: command.id, path: 'id' }];
    case 'char':
      return [
        { value: command.id, path: 'id' },
        { value: command.pose, path: 'pose' }
      ];
    case 'choice':
      return command.choices.map((choice, index) => ({ value: choice.jump, path: `choices[${index}].jump` }));
    case 'jump':
      return [{ value: command.target, path: 'target' }];
    case 'battle':
      return [{ value: command.stageId, path: 'stageId' }];
    case 'hideChar':
    case 'setFlag':
    case 'unlock':
    case 'wait':
    case 'effect':
      return [];
    default:
      assertNever(command);
  }
}

function looksLikeDirectAssetPath(value: string): boolean {
  return /(^|[/\\])assets[/\\]|[/\\]|\.((png)|(jpe?g)|(webp)|(gif)|(mp3)|(ogg)|(wav)|(m4a))$/i.test(value);
}

function pushIssue(
  issues: StoryValidationIssue[],
  severity: StoryValidatorSeverity,
  code: string,
  message: string,
  path: string
): void {
  issues.push({ severity, code, message, path });
}

function assertNever(value: never): never {
  throw new Error(`Unsupported story validator value: ${JSON.stringify(value)}`);
}
