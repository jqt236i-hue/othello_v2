import type {
  StoryBgmAction,
  StoryCharacterSlot,
  StoryCommand,
  StoryScenario,
  StoryTransition
} from '../core/story-schema';

export type StoryScriptError = {
  line: number;
  code: string;
  message: string;
  source: string;
};

export type StoryScriptWarning = StoryScriptError;

export type StoryScriptNodeDraft = {
  id: string;
  commands: StoryCommand[];
  lineStart: number;
  lineEnd: number;
};

export type StoryScriptChapterDraft = {
  id: string;
  nodes: StoryScriptNodeDraft[];
  lineStart: number;
  lineEnd: number;
};

export type StoryScriptParseResult = {
  commands: StoryCommand[];
  warnings: StoryScriptWarning[];
  errors: StoryScriptError[];
  metadata: {
    chapterId?: string;
    nodeId?: string;
  };
  chapters: StoryScriptChapterDraft[];
};

export type StoryScriptParserOptions = {
  defaultChapterId?: string;
  defaultNodeId?: string;
  defaultCharacterSlot?: StoryCharacterSlot;
  speakerCharacterMap?: Record<string, string>;
  availableCharacters?: Record<string, readonly string[]>;
  stageIds?: readonly string[];
};

export type StoryScriptScenarioOptions = {
  scenarioId?: string;
  title?: string;
};

type MutableNodeDraft = {
  id: string;
  commands: StoryCommand[];
  lineStart: number;
  lineEnd: number;
};

type MutableChapterDraft = {
  id: string;
  nodes: MutableNodeDraft[];
  lineStart: number;
  lineEnd: number;
};

const DEFAULT_CHAPTER_ID = 'prologue';
const DEFAULT_NODE_ID = 'start';
const DEFAULT_CHARACTER_SLOT: StoryCharacterSlot = 'center';

export function parseStoryScript(
  source: string,
  options: StoryScriptParserOptions = {}
): StoryScriptParseResult {
  const warnings: StoryScriptWarning[] = [];
  const errors: StoryScriptError[] = [];
  const chapters: MutableChapterDraft[] = [];
  const commands: StoryCommand[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const defaultChapterId = normalizeId(options.defaultChapterId) || DEFAULT_CHAPTER_ID;
  const defaultNodeId = normalizeId(options.defaultNodeId) || DEFAULT_NODE_ID;
  const defaultCharacterSlot = options.defaultCharacterSlot ?? DEFAULT_CHARACTER_SLOT;
  const stageIds = new Set(options.stageIds ?? []);
  let currentChapterId = defaultChapterId;
  let currentNodeId = defaultNodeId;

  const ensureChapter = (chapterId: string, lineNumber = 1): MutableChapterDraft => {
    let chapter = chapters.find((candidate) => candidate.id === chapterId);
    if (!chapter) {
      chapter = { id: chapterId, nodes: [], lineStart: lineNumber, lineEnd: lineNumber };
      chapters.push(chapter);
      return chapter;
    }
    chapter.lineEnd = Math.max(chapter.lineEnd, lineNumber);
    return chapter;
  };

  const ensureNode = (chapterId: string, nodeId: string, lineNumber = 1): MutableNodeDraft => {
    const chapter = ensureChapter(chapterId, lineNumber);
    let node = chapter.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      node = { id: nodeId, commands: [], lineStart: lineNumber, lineEnd: lineNumber };
      chapter.nodes.push(node);
      return node;
    }
    node.lineEnd = Math.max(node.lineEnd, lineNumber);
    return node;
  };

  const pushCommand = (command: StoryCommand, lineNumber: number): void => {
    ensureNode(currentChapterId, currentNodeId, lineNumber).commands.push(command);
    commands.push(command);
  };

  const pushError = (line: number, code: string, message: string, currentSource: string): void => {
    errors.push({ line, code, message, source: currentSource });
  };

  const pushWarning = (line: number, code: string, message: string, currentSource: string): void => {
    warnings.push({ line, code, message, source: currentSource });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const sourceLine = lines[index];
    const trimmed = sourceLine.trim();
    const lineNumber = index + 1;

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('# ')) {
      continue;
    }

    if (trimmed === '@choice') {
      const choices: Array<{ label: string; jump: string }> = [];
      let cursor = index + 1;
      while (cursor < lines.length) {
        const optionSource = lines[cursor];
        const optionTrimmed = optionSource.trim();
        if (!optionTrimmed) {
          if (choices.length > 0) break;
          cursor += 1;
          continue;
        }
        if (!optionTrimmed.startsWith('- ')) break;
        const parsed = parseChoiceLine(optionTrimmed);
        if (!parsed) {
          pushError(cursor + 1, 'CHOICE_OPTION_INVALID', 'choice option must be "- label -> nodeId".', optionSource);
        } else {
          choices.push(parsed);
        }
        cursor += 1;
      }
      if (choices.length < 2) {
        pushError(lineNumber, 'CHOICE_OPTIONS_MISSING', 'choice requires at least two options.', sourceLine);
      } else {
        pushCommand({
          type: 'choice',
          choices: choices.map((choice) => ({ label: choice.label, jump: choice.jump }))
        }, lineNumber);
      }
      index = Math.max(index, cursor - 1);
      continue;
    }

    if (matchesDirective(trimmed, '@chapter')) {
      const chapterId = normalizeId(trimmed.slice('@chapter'.length));
      if (!chapterId) {
        pushError(lineNumber, 'CHAPTER_ID_MISSING', 'chapter id is required.', sourceLine);
        continue;
      }
      currentChapterId = chapterId;
      currentNodeId = defaultNodeId;
      ensureChapter(currentChapterId, lineNumber);
      continue;
    }

    if (matchesDirective(trimmed, '@node')) {
      const nodeId = normalizeId(trimmed.slice('@node'.length));
      if (!nodeId) {
        pushError(lineNumber, 'NODE_ID_MISSING', 'node id is required.', sourceLine);
        continue;
      }
      currentNodeId = nodeId;
      ensureNode(currentChapterId, currentNodeId, lineNumber);
      continue;
    }

    if (matchesDirective(trimmed, '@bg')) {
      const parts = trimmed.split(/\s+/);
      const id = parts[1] ?? '';
      if (!id) {
        pushError(lineNumber, 'BG_ID_MISSING', 'bg id is required.', sourceLine);
        continue;
      }
      const transition = parts[2] ? asTransition(parts[2]) : 'cut';
      if (!transition) {
        pushError(lineNumber, 'BG_TRANSITION_INVALID', `unknown bg transition: ${parts[2]}`, sourceLine);
        continue;
      }
      pushCommand({ type: 'bg', id, transition }, lineNumber);
      continue;
    }

    if (matchesDirective(trimmed, '@bgm')) {
      const parts = trimmed.split(/\s+/);
      const id = parts[1] ?? '';
      if (!id) {
        pushError(lineNumber, 'BGM_ID_MISSING', 'bgm id is required.', sourceLine);
        continue;
      }
      const action = parts[2] ? asBgmAction(parts[2]) : 'play';
      if (!action) {
        pushError(lineNumber, 'BGM_ACTION_INVALID', `unknown bgm action: ${parts[2]}`, sourceLine);
        continue;
      }
      pushCommand({ type: 'bgm', id, action }, lineNumber);
      continue;
    }

    if (matchesDirective(trimmed, '@se')) {
      const parts = trimmed.split(/\s+/);
      const id = parts[1] ?? '';
      if (!id) {
        pushError(lineNumber, 'SE_ID_MISSING', 'se id is required.', sourceLine);
        continue;
      }
      pushCommand({ type: 'se', id }, lineNumber);
      continue;
    }

    if (matchesDirective(trimmed, '@battle')) {
      const parts = trimmed.split(/\s+/).filter(Boolean);
      const stageId = parts[1] ?? '';
      if (!stageId) {
        pushError(lineNumber, 'BATTLE_STAGE_MISSING', 'battle stageId is required.', sourceLine);
        continue;
      }
      const attrs = parseKeyValueTokens(parts.slice(2));
      const winJump = normalizeId(attrs.values.win ?? '');
      const loseJump = normalizeId(attrs.values.lose ?? '');
      const drawJump = normalizeId(attrs.values.draw ?? '');
      if (!winJump) {
        pushError(lineNumber, 'BATTLE_WIN_MISSING', 'battle win target is required.', sourceLine);
      }
      if (!loseJump) {
        pushError(lineNumber, 'BATTLE_LOSE_MISSING', 'battle lose target is required.', sourceLine);
      }
      attrs.unknownKeys.forEach((key) => {
        pushWarning(lineNumber, 'BATTLE_TOKEN_UNKNOWN', `unknown battle token: ${key}`, sourceLine);
      });
      if (!stageIds.has(stageId) && stageIds.size > 0) {
        pushWarning(lineNumber, 'BATTLE_STAGE_UNKNOWN', `unknown battle stage: ${stageId}`, sourceLine);
      }
      if (!winJump || !loseJump) {
        continue;
      }
      pushCommand({
        type: 'battle',
        stageId,
        winJump,
        loseJump,
        ...(drawJump ? { drawJump } : {})
      }, lineNumber);
      continue;
    }

    if (matchesDirective(trimmed, '@jump')) {
      const target = normalizeId(trimmed.slice('@jump'.length));
      if (!target) {
        pushError(lineNumber, 'JUMP_TARGET_MISSING', 'jump target is required.', sourceLine);
        continue;
      }
      pushCommand({ type: 'jump', target }, lineNumber);
      continue;
    }

    if (matchesDirective(trimmed, '@flag')) {
      const body = trimmed.slice('@flag'.length).trim();
      const equalIndex = body.indexOf('=');
      if (equalIndex <= 0) {
        pushError(lineNumber, 'FLAG_FORMAT_INVALID', 'flag must be "@flag key=value".', sourceLine);
        continue;
      }
      const key = body.slice(0, equalIndex).trim();
      const rawValue = body.slice(equalIndex + 1).trim();
      if (!key) {
        pushError(lineNumber, 'FLAG_KEY_MISSING', 'flag key is required.', sourceLine);
        continue;
      }
      if (!rawValue) {
        pushError(lineNumber, 'FLAG_VALUE_MISSING', 'flag value is required.', sourceLine);
        continue;
      }
      pushCommand({
        type: 'setFlag',
        key,
        value: parseFlagValue(rawValue)
      }, lineNumber);
      continue;
    }

    if (trimmed.startsWith('@')) {
      const commandName = trimmed.split(/\s+/)[0];
      pushError(lineNumber, 'COMMAND_UNKNOWN', `unknown command: ${commandName}`, sourceLine);
      continue;
    }

    const parsedDialogue = parseDialogueLine(sourceLine);
    if (parsedDialogue.errorCode) {
      pushError(lineNumber, parsedDialogue.errorCode, parsedDialogue.message, sourceLine);
      continue;
    }
    if (!parsedDialogue.speaker || !parsedDialogue.text) {
      pushError(lineNumber, 'LINE_UNRECOGNIZED', 'line is not a supported story script command.', sourceLine);
      continue;
    }

    if (parsedDialogue.pose) {
      const characterId = options.speakerCharacterMap?.[parsedDialogue.speaker];
      if (!characterId) {
        pushWarning(
          lineNumber,
          'CHARACTER_MAPPING_UNKNOWN',
          `speaker "${parsedDialogue.speaker}" is not mapped to a character id.`,
          sourceLine
        );
      } else {
        const poses = options.availableCharacters?.[characterId];
        if (!poses) {
          pushWarning(
            lineNumber,
            'CHARACTER_ID_UNKNOWN',
            `character id "${characterId}" is not available in the asset registry.`,
            sourceLine
          );
        } else if (!poses.includes(parsedDialogue.pose)) {
          pushWarning(
            lineNumber,
            'CHARACTER_POSE_UNKNOWN',
            `pose "${parsedDialogue.pose}" is not registered for "${characterId}".`,
            sourceLine
          );
        } else {
          pushCommand({
            type: 'char',
            id: characterId,
            pose: parsedDialogue.pose,
            slot: defaultCharacterSlot
          }, lineNumber);
        }
      }
    }

    pushCommand({
      type: 'say',
      speaker: parsedDialogue.speaker,
      text: parsedDialogue.text
    }, lineNumber);
  }

  const materializedChapters = (chapters.length > 0
    ? chapters
    : [{ id: defaultChapterId, nodes: [] as MutableNodeDraft[], lineStart: 1, lineEnd: 1 }]).map((chapter) => (
      chapter.nodes.length > 0
        ? chapter
        : {
            id: chapter.id,
            lineStart: chapter.lineStart,
            lineEnd: chapter.lineEnd,
            nodes: [{ id: defaultNodeId, commands: [] as StoryCommand[], lineStart: chapter.lineStart, lineEnd: chapter.lineEnd }]
          }
    ));

  const firstChapter = materializedChapters[0];
  const firstNode = firstChapter.nodes[0];

  return {
    commands,
    warnings,
    errors,
    metadata: {
      chapterId: firstChapter?.id ?? currentChapterId,
      nodeId: firstNode?.id ?? currentNodeId
    },
    chapters: materializedChapters.map((chapter) => ({
      id: chapter.id,
      lineStart: chapter.lineStart,
      lineEnd: chapter.lineEnd,
      nodes: chapter.nodes.map((node) => ({
        id: node.id,
        commands: [...node.commands],
        lineStart: node.lineStart,
        lineEnd: node.lineEnd
      }))
    }))
  };
}

export function buildStoryScenarioFromScript(
  result: StoryScriptParseResult,
  options: StoryScriptScenarioOptions = {}
): StoryScenario {
  const scenarioId = normalizeId(options.scenarioId) || 'draft_story';
  const title = options.title?.trim();
  const firstChapter = result.chapters[0];
  return {
    id: scenarioId,
    ...(title ? { title } : {}),
    initialChapterId: firstChapter?.id,
    chapters: result.chapters.map((chapter, chapterIndex) => ({
      id: chapter.id,
      initialNodeId: chapter.nodes[0]?.id ?? (chapterIndex === 0 ? result.metadata.nodeId : undefined),
      nodes: chapter.nodes.map((node) => ({
        id: node.id,
        commands: node.commands.map(cloneStoryCommand)
      }))
    }))
  };
}

export function formatStoryScriptNodeKey(chapterId: string, nodeId: string): string {
  return `${chapterId}/${nodeId}`;
}

function parseDialogueLine(line: string): {
  speaker?: string;
  pose?: string;
  text?: string;
  errorCode?: string;
  message: string;
} {
  const openQuote = line.indexOf('「');
  if (openQuote < 0) {
    return { errorCode: 'LINE_UNRECOGNIZED', message: 'line is not a supported story script command.' };
  }
  const closeQuote = line.lastIndexOf('」');
  if (closeQuote < openQuote) {
    return { errorCode: 'SAY_QUOTE_UNCLOSED', message: 'dialogue line is missing a closing quote.' };
  }
  const left = line.slice(0, openQuote);
  const text = line.slice(openQuote + 1, closeQuote).trim();
  if (!text) {
    return { errorCode: 'SAY_TEXT_EMPTY', message: 'dialogue text is empty.' };
  }
  if (left.trim().length === 0) {
    return {
      speaker: 'ナレーション',
      text,
      message: 'ok'
    };
  }
  const match = /^(?<speaker>.+?)(?:\[(?<pose>[^\]]+)\])?$/.exec(left.trim());
  if (!match?.groups?.speaker) {
    return { errorCode: 'SAY_SPEAKER_EMPTY', message: 'dialogue speaker is empty.' };
  }
  return {
    speaker: match.groups.speaker.trim(),
    pose: match.groups.pose?.trim() || undefined,
    text,
    message: 'ok'
  };
}

function parseChoiceLine(line: string): { label: string; jump: string } | null {
  const body = line.slice(2).trim();
  const arrowIndex = body.indexOf('->');
  if (arrowIndex <= 0) return null;
  const label = body.slice(0, arrowIndex).trim();
  const jump = body.slice(arrowIndex + 2).trim();
  if (!label || !jump) return null;
  return { label, jump };
}

function parseKeyValueTokens(tokens: string[]): {
  values: Record<string, string>;
  unknownKeys: string[];
} {
  const values: Record<string, string> = {};
  const unknownKeys: string[] = [];
  tokens.forEach((token) => {
    const separator = token.indexOf('=');
    if (separator <= 0) {
      unknownKeys.push(token);
      return;
    }
    const key = token.slice(0, separator).trim();
    const value = token.slice(separator + 1).trim();
    if (!key || !value) {
      unknownKeys.push(token);
      return;
    }
    values[key] = value;
  });
  return { values, unknownKeys };
}

function parseFlagValue(rawValue: string): boolean | number | string {
  if (rawValue === 'true') return true;
  if (rawValue === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(rawValue)) return Number(rawValue);
  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"'))
    || (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    return rawValue.slice(1, -1);
  }
  return rawValue;
}

function asTransition(value: string): StoryTransition | null {
  if (value === 'cut' || value === 'fade') return value;
  return null;
}

function asBgmAction(value: string): StoryBgmAction | null {
  if (value === 'play' || value === 'stop' || value === 'crossfade') return value;
  return null;
}

function normalizeId(value: string | undefined): string {
  return value?.trim() ?? '';
}

function matchesDirective(line: string, directive: string): boolean {
  return line === directive || line.startsWith(`${directive} `);
}

function cloneStoryCommand(command: StoryCommand): StoryCommand {
  return JSON.parse(JSON.stringify(command)) as StoryCommand;
}
