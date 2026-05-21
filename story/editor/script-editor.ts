import { validateStoryScenario } from '../core/story-validator';
import type { StoryScenario } from '../core/story-schema';
import { STORY_NARRATION_SPEAKERS } from '../core/story-speakers';
import { storyAssets } from '../content/story-assets';
import { storyBattleStages } from '../content/story-battle-stages';
import { storyDeckPresets } from '../content/story-deck-presets';
import { buildStoryScenarioFromScript, parseStoryScript } from './story-script-parser';

const TEXT_KEY = 'card-othello:story-editor:text:v2';
const TITLE_KEY = 'card-othello:story-editor:title:v2';
const TEXT_BACKUPS_KEY = 'card-othello:story-editor:text-backups:v1';
const SPEAKER_MAP_KEY = 'card-othello:story-editor:speaker-map:v2';
const ACTIVE_SPEAKER_KEY = 'card-othello:story-editor:active-speaker:v2';
const RECENT_SPEAKERS_KEY = 'card-othello:story-editor:recent-speakers:v1';
const CUSTOM_SPEAKERS_KEY = 'card-othello:story-editor:custom-speakers:v1';

const DEFAULT_TITLE = '下書き1';
const DEFAULT_SPEAKER = '主人公';
const BLANK_SPEAKER = '　　';
const BLANK_SPEAKER_LABEL = '名前なし';
const DEFAULT_CUSTOM_SPEAKERS = [BLANK_SPEAKER, ...STORY_NARRATION_SPEAKERS];
const DEFAULT_SPEAKER_MAP: Record<string, string> = {
  主人公: 'protagonist',
  ライバル: 'rival',
  観測者: 'observer'
};

export type StoryEditorAssetChoice = {
  id: string;
  label: string;
  path: string;
};

export type StoryEditorCharacterChoice = {
  characterId: string;
  poseId: string;
  label: string;
  path: string;
};

export type StoryEditorAssetCatalog = {
  backgrounds: StoryEditorAssetChoice[];
  bgm: StoryEditorAssetChoice[];
  se: StoryEditorAssetChoice[];
  characters: StoryEditorCharacterChoice[];
  posesByCharacter: Record<string, string[]>;
};

export type StoryEditorSpeakerMapParseResult = {
  map: Record<string, string>;
  warnings: Array<{ line: number; message: string }>;
};

export type StoryEditorSceneRef = {
  chapterId: string;
  nodeId: string;
  title: string;
  line: number;
};

export type StoryEditorCompileWarning = {
  line: number;
  message: string;
};

export type StoryEditorCompileResult = {
  displayScript: string;
  internalScript: string;
  sceneRefs: StoryEditorSceneRef[];
  warnings: StoryEditorCompileWarning[];
  internalLineToDisplayLine: number[];
};

type StoryEditorIssue = {
  severity: 'error' | 'warning';
  message: string;
  line?: number;
};

type StoryEditorComputation = {
  compiled: StoryEditorCompileResult;
  scenario: StoryScenario | null;
  issues: StoryEditorIssue[];
  storyOutput: string;
  promptOutput: string;
};

type StoryEditorTextBackup = {
  savedAt: string;
  title: string;
  text: string;
};

type StoryEditorTextSnapshot = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

export function initStoryScriptEditor(doc: Document = document): void {
  const titleInput = requireElement<HTMLInputElement>(doc, 'storyEditorTitle');
  const textArea = requireElement<HTMLTextAreaElement>(doc, 'storyEditorText');
  const statusRoot = requireElement<HTMLElement>(doc, 'storyEditorStatus');
  const diagnosticsRoot = requireElement<HTMLElement>(doc, 'storyEditorDiagnostics');
  const sceneListRoot = requireElement<HTMLElement>(doc, 'storyEditorSceneList');
  const speakerButtonsRoot = requireElement<HTMLElement>(doc, 'storyEditorSpeakerButtons');
  const activeSpeakerRoot = requireElement<HTMLElement>(doc, 'storyEditorActiveSpeaker');
  const speakerManageListRoot = requireElement<HTMLElement>(doc, 'storyEditorSpeakerManageList');
  const poseDetails = requireElement<HTMLDetailsElement>(doc, 'storyEditorPoseDetails');
  const poseSummary = requireElement<HTMLElement>(doc, 'storyEditorPoseSummary');
  const poseSelect = requireElement<HTMLSelectElement>(doc, 'storyEditorPoseSelect');
  const customSpeakerInput = requireElement<HTMLInputElement>(doc, 'storyEditorCustomSpeakerInput');
  const registerSpeakerButton = requireElement<HTMLButtonElement>(doc, 'storyEditorRegisterSpeakerBtn');
  const chapterTitleInput = requireElement<HTMLInputElement>(doc, 'storyEditorChapterTitle');
  const insertChapterButton = requireElement<HTMLButtonElement>(doc, 'storyEditorInsertChapterBtn');
  const sceneTitleInput = requireElement<HTMLInputElement>(doc, 'storyEditorSceneTitle');
  const insertSceneButton = requireElement<HTMLButtonElement>(doc, 'storyEditorInsertSceneBtn');
  const backgroundSelect = requireElement<HTMLSelectElement>(doc, 'storyEditorBackgroundSelect');
  const insertBackgroundButton = requireElement<HTMLButtonElement>(doc, 'storyEditorInsertBackgroundBtn');
  const bgmSelect = requireElement<HTMLSelectElement>(doc, 'storyEditorBgmSelect');
  const insertBgmButton = requireElement<HTMLButtonElement>(doc, 'storyEditorInsertBgmBtn');
  const seSelect = requireElement<HTMLSelectElement>(doc, 'storyEditorSeSelect');
  const insertSeButton = requireElement<HTMLButtonElement>(doc, 'storyEditorInsertSeBtn');
  const battleStageSelect = requireElement<HTMLSelectElement>(doc, 'storyEditorBattleStageSelect');
  const battleWinInput = requireElement<HTMLInputElement>(doc, 'storyEditorBattleWinTitle');
  const battleLoseInput = requireElement<HTMLInputElement>(doc, 'storyEditorBattleLoseTitle');
  const battleDrawInput = requireElement<HTMLInputElement>(doc, 'storyEditorBattleDrawTitle');
  const insertBattleButton = requireElement<HTMLButtonElement>(doc, 'storyEditorInsertBattleBtn');
  const choiceOneInput = requireElement<HTMLInputElement>(doc, 'storyEditorChoiceLabelOne');
  const choiceOneTargetInput = requireElement<HTMLInputElement>(doc, 'storyEditorChoiceTargetOne');
  const choiceTwoInput = requireElement<HTMLInputElement>(doc, 'storyEditorChoiceLabelTwo');
  const choiceTwoTargetInput = requireElement<HTMLInputElement>(doc, 'storyEditorChoiceTargetTwo');
  const insertChoiceButton = requireElement<HTMLButtonElement>(doc, 'storyEditorInsertChoiceBtn');
  const jumpTargetInput = requireElement<HTMLInputElement>(doc, 'storyEditorJumpTargetTitle');
  const insertJumpButton = requireElement<HTMLButtonElement>(doc, 'storyEditorInsertJumpBtn');
  const flagKeyInput = requireElement<HTMLInputElement>(doc, 'storyEditorFlagKey');
  const flagValueInput = requireElement<HTMLInputElement>(doc, 'storyEditorFlagValue');
  const insertFlagButton = requireElement<HTMLButtonElement>(doc, 'storyEditorInsertFlagBtn');
  const speakerMapInput = requireElement<HTMLTextAreaElement>(doc, 'storyEditorSpeakerMap');
  const saveButton = requireElement<HTMLButtonElement>(doc, 'storyEditorSaveDraftBtn');
  const loadButton = requireElement<HTMLButtonElement>(doc, 'storyEditorLoadDraftBtn');
  const restoreBackupButton = requireElement<HTMLButtonElement>(doc, 'storyEditorRestoreBackupBtn');
  const saveTextFileButton = requireElement<HTMLButtonElement>(doc, 'storyEditorSaveTextFileBtn');
  const loadTextFileButton = requireElement<HTMLButtonElement>(doc, 'storyEditorLoadTextFileBtn');
  const textFileInput = requireElement<HTMLInputElement>(doc, 'storyEditorTextFileInput');
  const clearButton = requireElement<HTMLButtonElement>(doc, 'storyEditorClearDraftBtn');
  const resetButton = requireElement<HTMLButtonElement>(doc, 'storyEditorResetSampleBtn');
  const internalScriptOutput = requireElement<HTMLTextAreaElement>(doc, 'storyEditorInternalScript');
  const storyOutput = requireElement<HTMLTextAreaElement>(doc, 'storyEditorStoryOutput');
  const promptOutput = requireElement<HTMLTextAreaElement>(doc, 'storyEditorPromptOutput');
  const copyInternalButton = requireElement<HTMLButtonElement>(doc, 'storyEditorCopyInternalBtn');
  const copyStoryButton = requireElement<HTMLButtonElement>(doc, 'storyEditorCopyStoryBtn');
  const copyPromptButton = requireElement<HTMLButtonElement>(doc, 'storyEditorCopyPromptBtn');

  const storage = resolveStorage(doc);
  const stageTitleById = Object.fromEntries(
    (Object.values(storyBattleStages) as Array<{ id: string; title?: string }>).map((stage) => [stage.id, stage.title ?? stage.id])
  );
  const state = {
    activeSpeaker: loadStoredValue(storage, ACTIVE_SPEAKER_KEY) ?? DEFAULT_SPEAKER,
    recentSpeakers: loadStoredSpeakerList(storage, RECENT_SPEAKERS_KEY),
    customSpeakers: loadStoredTextList(storage, CUSTOM_SPEAKERS_KEY, DEFAULT_CUSTOM_SPEAKERS),
    catalog: createEmptyStoryEditorAssetCatalog()
  };

  titleInput.value = loadStoredText(storage, TITLE_KEY) ?? DEFAULT_TITLE;
  textArea.value = loadStoredText(storage, TEXT_KEY) ?? createSampleAuthorText();
  speakerMapInput.value = loadStoredText(storage, SPEAKER_MAP_KEY) ?? formatSpeakerCharacterMap(DEFAULT_SPEAKER_MAP);
  const textHistory = createStoryEditorTextHistory(textArea);

  const renderAll = (): void => {
    const speakerMap = parseSpeakerCharacterMap(speakerMapInput.value);
    const computation = computeEditorState(textArea.value, titleInput.value, speakerMap.map, state.catalog, stageTitleById);

    renderStatus(statusRoot, computation.issues);
    renderSpeakerButtons(speakerButtonsRoot, activeSpeakerRoot, state.customSpeakers, state.activeSpeaker, state.recentSpeakers, speakerMap.map, (speaker) => {
      state.activeSpeaker = speaker;
      state.recentSpeakers = bumpRecentSpeakers(state.recentSpeakers, speaker);
      renderAll();
    });
    renderSpeakerManageList(
      speakerManageListRoot,
      state.customSpeakers,
      state.recentSpeakers,
      state.activeSpeaker,
      speakerMap.map,
      (speaker) => {
        const pose = speaker === state.activeSpeaker ? poseSelect.value : '';
        state.activeSpeaker = speaker;
        state.recentSpeakers = bumpRecentSpeakers(state.recentSpeakers, speaker);
        textHistory.captureBeforeChange();
        insertSpeakerLine(textArea, speaker, pose);
        textHistory.resetBaseline();
        renderAll();
      },
      (speaker, renamed) => {
        const nextName = normalizeSpeakerName(renamed);
        if (!nextName || nextName === speaker) return;
        textHistory.captureBeforeChange();
        textArea.value = renameSpeakerInAuthorText(textArea.value, speaker, nextName);
        textHistory.resetBaseline();
        speakerMapInput.value = renameSpeakerMappingLine(speakerMapInput.value, speaker, nextName);
        state.customSpeakers = renameSpeakerName(state.customSpeakers, speaker, nextName);
        state.recentSpeakers = renameSpeakerName(state.recentSpeakers, speaker, nextName);
        if (state.activeSpeaker === speaker) state.activeSpeaker = nextName;
        renderAll();
        statusRoot.textContent = `話者名を「${nextName}」に変更しました。`;
      },
      (speaker) => {
        state.customSpeakers = removeSpeakerName(state.customSpeakers, speaker);
        state.recentSpeakers = removeSpeakerName(state.recentSpeakers, speaker);
        speakerMapInput.value = removeSpeakerMappingLine(speakerMapInput.value, speaker);
        if (state.activeSpeaker === speaker) {
          state.activeSpeaker = collectSpeakerNames(state.customSpeakers, state.recentSpeakers, '', parseSpeakerCharacterMap(speakerMapInput.value).map)[0] ?? '';
        }
        renderAll();
      }
    );
    renderPoseOptions(poseDetails, poseSummary, poseSelect, state.activeSpeaker, speakerMap.map, state.catalog);
    renderBackgroundOptions(backgroundSelect, state.catalog.backgrounds);
    renderAssetOptions(bgmSelect, state.catalog.bgm);
    renderAssetOptions(seSelect, state.catalog.se);
    renderBattleOptions(battleStageSelect, stageTitleById);
    renderSceneList(sceneListRoot, computation.compiled.sceneRefs, (line, title) => {
      focusTextLine(textArea, line);
      sceneTitleInput.value = title;
      battleWinInput.value = title;
      battleLoseInput.value = title;
      battleDrawInput.value = title;
      jumpTargetInput.value = title;
    });
    renderDiagnostics(diagnosticsRoot, computation.issues, (line) => focusTextLine(textArea, line));
    internalScriptOutput.value = computation.compiled.internalScript;
    storyOutput.value = computation.storyOutput;
    promptOutput.value = computation.promptOutput;

    trySaveText(storage, TITLE_KEY, titleInput.value);
    trySaveText(storage, TEXT_KEY, textArea.value);
    trySaveTextBackup(storage, titleInput.value, textArea.value);
    trySaveText(storage, SPEAKER_MAP_KEY, speakerMapInput.value);
    trySaveRawText(storage, ACTIVE_SPEAKER_KEY, state.activeSpeaker);
    trySaveStoredSpeakerList(storage, RECENT_SPEAKERS_KEY, state.recentSpeakers);
    trySaveStoredSpeakerList(storage, CUSTOM_SPEAKERS_KEY, state.customSpeakers);
  };

  titleInput.addEventListener('input', renderAll);
  textArea.addEventListener('input', () => {
    textHistory.recordInput();
    renderAll();
  });
  speakerMapInput.addEventListener('input', renderAll);
  textArea.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    const commandKey = event.ctrlKey || event.metaKey;
    if (!event.isComposing && commandKey && !event.altKey && key === 'z') {
      event.preventDefault();
      const changed = event.shiftKey ? textHistory.redo() : textHistory.undo();
      if (changed) renderAll();
      return;
    }
    if (!event.isComposing && commandKey && !event.altKey && key === 'y') {
      event.preventDefault();
      if (textHistory.redo()) renderAll();
      return;
    }
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Tab') {
      event.preventDefault();
      state.recentSpeakers = bumpRecentSpeakers(state.recentSpeakers, state.activeSpeaker);
      textHistory.captureBeforeChange();
      insertSpeakerLine(textArea, state.activeSpeaker, poseSelect.value);
      textHistory.resetBaseline();
      renderAll();
      return;
    }
    if (event.key === 'Enter' && event.shiftKey) {
      const assist = deriveSpeakerTemplateFromCurrentLine(
        textArea.value,
        textArea.selectionStart ?? textArea.value.length,
        textArea.selectionEnd ?? textArea.value.length
      );
      if (!assist) return;
      event.preventDefault();
      state.activeSpeaker = assist.speaker;
      state.recentSpeakers = bumpRecentSpeakers(state.recentSpeakers, assist.speaker);
      textHistory.captureBeforeChange();
      insertSpeakerLineAt(textArea, assist.lineEnd, assist.speaker, assist.pose);
      textHistory.resetBaseline();
      renderAll();
      return;
    }
    if (event.key !== 'Enter') return;
    const assist = deriveRepeatSpeakerFromCurrentLine(
      textArea.value,
      textArea.selectionStart ?? textArea.value.length,
      textArea.selectionEnd ?? textArea.value.length
    );
    if (!assist) return;
    event.preventDefault();
    state.activeSpeaker = assist.speaker;
    state.recentSpeakers = bumpRecentSpeakers(state.recentSpeakers, assist.speaker);
    textHistory.captureBeforeChange();
    insertSpeakerLine(textArea, assist.speaker, assist.pose);
    textHistory.resetBaseline();
    renderAll();
  });

  registerSpeakerButton.addEventListener('click', () => {
    const speaker = normalizeSpeakerName(customSpeakerInput.value);
    if (!speaker) return;
    state.activeSpeaker = speaker;
    state.customSpeakers = upsertSpeakerName(state.customSpeakers, speaker);
    state.recentSpeakers = bumpRecentSpeakers(state.recentSpeakers, speaker);
    customSpeakerInput.value = '';
    renderAll();
  });
  insertChapterButton.addEventListener('click', () => {
    textHistory.captureBeforeChange();
    insertTextBlock(textArea, `■章：${chapterTitleInput.value.trim() || suggestNextChapterTitle(textArea.value)}`);
    textHistory.resetBaseline();
    renderAll();
  });
  insertSceneButton.addEventListener('click', () => {
    textHistory.captureBeforeChange();
    insertTextBlock(textArea, `■場面：${sceneTitleInput.value.trim() || suggestNextSceneTitle(textArea.value)}`);
    textHistory.resetBaseline();
    renderAll();
  });
  insertBackgroundButton.addEventListener('click', () => {
    if (!backgroundSelect.value) return;
    textHistory.captureBeforeChange();
    insertTextBlock(textArea, `背景：${backgroundSelect.value}`);
    textHistory.resetBaseline();
    renderAll();
  });
  insertBgmButton.addEventListener('click', () => {
    if (!bgmSelect.value) return;
    textHistory.captureBeforeChange();
    insertTextBlock(textArea, `音楽：${bgmSelect.value}`);
    textHistory.resetBaseline();
    renderAll();
  });
  insertSeButton.addEventListener('click', () => {
    if (!seSelect.value) return;
    textHistory.captureBeforeChange();
    insertTextBlock(textArea, `効果音：${seSelect.value}`);
    textHistory.resetBaseline();
    renderAll();
  });
  insertBattleButton.addEventListener('click', () => {
    if (!battleStageSelect.value) return;
    const stageLabel = stageTitleById[battleStageSelect.value] ?? battleStageSelect.value;
    const win = battleWinInput.value.trim();
    const lose = battleLoseInput.value.trim();
    const draw = battleDrawInput.value.trim();
    const drawText = draw ? ` 引き分け=${draw}` : '';
    textHistory.captureBeforeChange();
    insertTextBlock(textArea, `対局：${stageLabel} 勝ち=${win} 負け=${lose}${drawText}`);
    textHistory.resetBaseline();
    renderAll();
  });
  insertChoiceButton.addEventListener('click', () => {
    const labelOne = choiceOneInput.value.trim() || '選択肢1';
    const labelTwo = choiceTwoInput.value.trim() || '選択肢2';
    const targetOne = choiceOneTargetInput.value.trim() || '次の場面';
    const targetTwo = choiceTwoTargetInput.value.trim() || '別の場面';
    textHistory.captureBeforeChange();
    insertTextBlock(textArea, `選択肢：\n- ${labelOne} -> ${targetOne}\n- ${labelTwo} -> ${targetTwo}`);
    textHistory.resetBaseline();
    renderAll();
  });
  insertJumpButton.addEventListener('click', () => {
    const target = jumpTargetInput.value.trim();
    if (!target) return;
    textHistory.captureBeforeChange();
    insertTextBlock(textArea, `移動：${target}`);
    textHistory.resetBaseline();
    renderAll();
  });
  insertFlagButton.addEventListener('click', () => {
    const key = flagKeyInput.value.trim();
    const value = flagValueInput.value.trim();
    if (!key || !value) return;
    textHistory.captureBeforeChange();
    insertTextBlock(textArea, `条件：${key}=${value}`);
    textHistory.resetBaseline();
    renderAll();
  });

  saveButton.addEventListener('click', () => {
    trySaveText(storage, TITLE_KEY, titleInput.value);
    trySaveText(storage, TEXT_KEY, textArea.value);
    trySaveTextBackup(storage, titleInput.value, textArea.value);
    statusRoot.textContent = 'ブラウザ保存しました。';
  });
  loadButton.addEventListener('click', () => {
    textHistory.captureBeforeChange();
    titleInput.value = loadStoredText(storage, TITLE_KEY) ?? DEFAULT_TITLE;
    textArea.value = loadStoredText(storage, TEXT_KEY) ?? createSampleAuthorText();
    textHistory.resetBaseline();
    speakerMapInput.value = loadStoredText(storage, SPEAKER_MAP_KEY) ?? formatSpeakerCharacterMap(DEFAULT_SPEAKER_MAP);
    state.activeSpeaker = loadStoredValue(storage, ACTIVE_SPEAKER_KEY) ?? DEFAULT_SPEAKER;
    state.recentSpeakers = loadStoredSpeakerList(storage, RECENT_SPEAKERS_KEY);
    state.customSpeakers = loadStoredTextList(storage, CUSTOM_SPEAKERS_KEY, DEFAULT_CUSTOM_SPEAKERS);
    renderAll();
    statusRoot.textContent = 'ブラウザ保存から読み込みました。';
  });
  restoreBackupButton.addEventListener('click', () => {
    const backup = loadLatestTextBackup(storage);
    if (!backup) {
      statusRoot.textContent = '復元できる自動バックアップがありません。';
      return;
    }
    textHistory.captureBeforeChange();
    titleInput.value = backup.title || titleInput.value || DEFAULT_TITLE;
    textArea.value = backup.text;
    textHistory.resetBaseline();
    renderAll();
    statusRoot.textContent = `自動バックアップを復元しました。`;
  });
  saveTextFileButton.addEventListener('click', () => {
    const ok = downloadStoryEditorTextFile(doc, buildStoryEditorTextFileName(titleInput.value), textArea.value);
    statusRoot.textContent = ok ? 'テキストファイルとして保存しました。' : 'テキスト保存に失敗しました。';
  });
  loadTextFileButton.addEventListener('click', () => {
    textFileInput.click();
  });
  textFileInput.addEventListener('change', async () => {
    const file = textFileInput.files?.[0];
    textFileInput.value = '';
    if (!file) return;
    try {
      textHistory.captureBeforeChange();
      textArea.value = await file.text();
      textHistory.resetBaseline();
      const titleFromFile = extractStoryEditorTitleFromFileName(file.name);
      if (titleFromFile) {
        titleInput.value = titleFromFile;
      }
      renderAll();
      statusRoot.textContent = `テキストファイルを読み込みました。`;
    } catch {
      statusRoot.textContent = 'テキスト読込に失敗しました。';
    }
  });
  clearButton.addEventListener('click', () => {
    if (!storage) return;
    [TEXT_KEY, TITLE_KEY, SPEAKER_MAP_KEY, ACTIVE_SPEAKER_KEY, RECENT_SPEAKERS_KEY, CUSTOM_SPEAKERS_KEY].forEach((key) => storage.removeItem(key));
    statusRoot.textContent = 'ブラウザ保存を削除しました。';
  });
  resetButton.addEventListener('click', () => {
    textHistory.captureBeforeChange();
    titleInput.value = DEFAULT_TITLE;
    textArea.value = createSampleAuthorText();
    textHistory.resetBaseline();
    state.activeSpeaker = DEFAULT_SPEAKER;
    state.recentSpeakers = [DEFAULT_SPEAKER];
    state.customSpeakers = [...DEFAULT_CUSTOM_SPEAKERS];
    speakerMapInput.value = formatSpeakerCharacterMap(DEFAULT_SPEAKER_MAP);
    renderAll();
    statusRoot.textContent = 'サンプル文面に戻しました。';
  });

  copyInternalButton.addEventListener('click', async () => {
    await copyText(internalScriptOutput.value, internalScriptOutput, statusRoot, '内部変換結果をコピーしました。');
  });
  copyStoryButton.addEventListener('click', async () => {
    await copyText(storyOutput.value, storyOutput, statusRoot, '実装用出力をコピーしました。');
  });
  copyPromptButton.addEventListener('click', async () => {
    await copyText(promptOutput.value, promptOutput, statusRoot, '依頼文をコピーしました。');
  });

  void loadStoryAssetCatalog(doc).then((catalog) => {
    state.catalog = catalog;
    renderAll();
  });

  renderAll();
}

function computeEditorState(
  displayScript: string,
  title: string,
  speakerCharacterMap: Record<string, string>,
  catalog: StoryEditorAssetCatalog,
  stageTitleById: Record<string, string>
): StoryEditorComputation {
  const compiled = compileAuthorTextToInternalScript(displayScript, { stageTitleById });
  const parseResult = parseStoryScript(compiled.internalScript, {
    defaultChapterId: compiled.sceneRefs[0]?.chapterId ?? 'chapter_001',
    defaultNodeId: compiled.sceneRefs[0]?.nodeId ?? 'scene_001',
    speakerCharacterMap,
    availableCharacters: catalog.posesByCharacter,
    stageIds: Object.keys(storyBattleStages)
  });

  const issues: StoryEditorIssue[] = compiled.warnings.map((warning) => ({
    severity: 'warning',
    message: warning.message,
    line: warning.line
  }));

  parseResult.errors.forEach((issue) => {
    issues.push({
      severity: 'error',
      line: compiled.internalLineToDisplayLine[issue.line - 1],
      message: toJapaneseParserIssue(issue.code, issue.message)
    });
  });
  parseResult.warnings.forEach((issue) => {
    issues.push({
      severity: 'warning',
      line: compiled.internalLineToDisplayLine[issue.line - 1],
      message: toJapaneseParserIssue(issue.code, issue.message)
    });
  });

  const scenario = parseResult.errors.length > 0
    ? null
    : buildStoryScenarioFromScript(parseResult, { scenarioId: 'draft_story', title: title.trim() || DEFAULT_TITLE });

  if (scenario) {
    validateStoryScenario(scenario, {
      assets: storyAssets,
      battleStages: storyBattleStages,
      deckPresets: storyDeckPresets
    }).forEach((issue) => {
      issues.push({
        severity: issue.severity === 'error' ? 'error' : 'warning',
        message: `整形後の確認: ${issue.message}`
      });
    });
  }

  return {
    compiled,
    scenario,
    issues,
    storyOutput: scenario ? formatStoryTsOutput(scenario) : '',
    promptOutput: scenario ? formatPromptOutput(displayScript, scenario) : ''
  };
}

export function compileAuthorTextToInternalScript(
  source: string,
  options: { stageTitleById?: Record<string, string> } = {}
): StoryEditorCompileResult {
  const lines = source.replace(/\r\n?/g, '\n').split('\n').map((text, index) => ({ text, line: index + 1 }));
  const warnings: StoryEditorCompileWarning[] = [];
  const stageTitleById = options.stageTitleById ?? {};
  const stageIdByTitle = Object.fromEntries(Object.entries(stageTitleById).map(([id, title]) => [title, id]));
  const scenes: StoryEditorSceneRef[] = [];
  const internal: string[] = [];
  const lineMap: number[] = [];

  let chapterIndex = 1;
  let sceneIndex = 0;
  let currentChapterId = `chapter_${String(chapterIndex).padStart(3, '0')}`;
  let chapterMarkersSeen = 0;
  const sceneIdByTitle = new Map<string, string>();

  for (const line of lines) {
    const chapterTitle = parseMarkerValue(line.text, '章');
    if (chapterTitle) {
      chapterMarkersSeen += 1;
      chapterIndex = chapterMarkersSeen;
      currentChapterId = `chapter_${String(chapterIndex).padStart(3, '0')}`;
      continue;
    }
    const sceneTitle = parseMarkerValue(line.text, '場面');
    if (!sceneTitle) continue;
    sceneIndex += 1;
    const sceneId = `scene_${String(sceneIndex).padStart(3, '0')}`;
    scenes.push({ chapterId: currentChapterId, nodeId: sceneId, title: sceneTitle, line: line.line });
    if (!sceneIdByTitle.has(sceneTitle)) {
      sceneIdByTitle.set(sceneTitle, sceneId);
    }
  }

  chapterIndex = 1;
  currentChapterId = `chapter_${String(chapterIndex).padStart(3, '0')}`;
  let currentSceneId = '';
  chapterMarkersSeen = 0;

  const emit = (text: string, sourceLine: number): void => {
    internal.push(text);
    lineMap.push(sourceLine);
  };

  const ensureScene = (sourceLine: number): void => {
    if (currentSceneId) return;
    const fallbackIndex = scenes.length + 1;
    currentSceneId = `scene_${String(fallbackIndex).padStart(3, '0')}`;
    emit(`@node ${currentSceneId}`, sourceLine);
  };

  for (const line of lines) {
    const trimmed = line.text.trim();
    const chapterTitle = parseMarkerValue(trimmed, '章');
    if (chapterTitle) {
      chapterMarkersSeen += 1;
      chapterIndex = chapterMarkersSeen;
      currentChapterId = `chapter_${String(chapterIndex).padStart(3, '0')}`;
      currentSceneId = '';
      emit(`@chapter ${currentChapterId}`, line.line);
      continue;
    }
    const sceneTitle = parseMarkerValue(trimmed, '場面');
    if (sceneTitle) {
      currentSceneId = sceneIdByTitle.get(sceneTitle) ?? currentSceneId;
      emit(`@node ${currentSceneId}`, line.line);
      continue;
    }
    if (!trimmed) {
      emit('', line.line);
      continue;
    }

    ensureScene(line.line);

    const bg = parseDirectiveBody(trimmed, '背景');
    if (bg) {
      const bgParts = bg.split(/\s+/).filter(Boolean);
      emit(`@bg ${bgParts.length >= 2 ? bg : `${bg} fade`}`, line.line);
      continue;
    }
    const bgm = parseDirectiveBody(trimmed, '音楽');
    if (bgm) {
      const bgmParts = bgm.split(/\s+/).filter(Boolean);
      emit(`@bgm ${bgmParts.length >= 2 ? bgm : `${bgm} play`}`, line.line);
      continue;
    }
    const se = parseDirectiveBody(trimmed, '効果音');
    if (se) {
      emit(`@se ${se.split(/\s+/)[0]}`, line.line);
      continue;
    }
    const jump = parseDirectiveBody(trimmed, '移動');
    if (jump) {
      emit(`@jump ${resolveSceneTarget(jump, sceneIdByTitle, warnings, line.line)}`, line.line);
      continue;
    }
    const flag = parseDirectiveBody(trimmed, '条件');
    if (flag) {
      emit(`@flag ${flag}`, line.line);
      continue;
    }
    const battle = parseDirectiveBody(trimmed, '対局');
    if (battle) {
      const tokens = battle.split(/\s+/).filter(Boolean);
      const label = tokens.shift() ?? '';
      const stageId = stageIdByTitle[label] ?? label;
      const attrs = tokens.map((token) => {
        if (token.startsWith('勝ち=')) return `win=${resolveSceneTarget(token.slice(3), sceneIdByTitle, warnings, line.line)}`;
        if (token.startsWith('負け=')) return `lose=${resolveSceneTarget(token.slice(3), sceneIdByTitle, warnings, line.line)}`;
        if (token.startsWith('引き分け=')) return `draw=${resolveSceneTarget(token.slice(5), sceneIdByTitle, warnings, line.line)}`;
        return token;
      });
      emit(`@battle ${stageId}${attrs.length > 0 ? ` ${attrs.join(' ')}` : ''}`, line.line);
      continue;
    }
    if (/^選択肢\s*[：:]?$/.test(trimmed)) {
      emit('@choice', line.line);
      continue;
    }
    if (trimmed.startsWith('- ') && trimmed.includes('->')) {
      const arrow = trimmed.indexOf('->');
      const label = trimmed.slice(2, arrow).trim();
      const target = trimmed.slice(arrow + 2).trim();
      emit(`- ${label} -> ${resolveSceneTarget(target, sceneIdByTitle, warnings, line.line)}`, line.line);
      continue;
    }
    emit(line.text, line.line);
  }

  if (scenes.length === 0) {
    scenes.push({ chapterId: currentChapterId, nodeId: 'scene_001', title: '場面 1', line: 1 });
    internal.unshift(`@node scene_001`);
    lineMap.unshift(1);
  }

  if (!internal.some((line) => line.startsWith('@chapter '))) {
    internal.unshift(`@chapter ${currentChapterId}`);
    lineMap.unshift(1);
  }

  return {
    displayScript: source.replace(/\r\n?/g, '\n'),
    internalScript: `${internal.join('\n').trimEnd()}\n`,
    sceneRefs: scenes,
    warnings,
    internalLineToDisplayLine: lineMap
  };
}

export function buildStoryEditorAssetCatalogFromPaths(paths: string[]): StoryEditorAssetCatalog {
  const backgrounds = collectSimpleAssetChoices(paths, /^assets\/story\/bg\/([^/]+)\.[^/.]+$/i);
  const bgm = collectSimpleAssetChoices(paths, /^assets\/story\/bgm\/([^/]+)\.[^/.]+$/i);
  const se = collectSimpleAssetChoices(paths, /^assets\/story\/se\/([^/]+)\.[^/.]+$/i);
  const characters: StoryEditorCharacterChoice[] = [];
  const posesByCharacter: Record<string, string[]> = {};

  for (const path of paths) {
    const normalized = path.replace(/\\/g, '/');
    const match = /^assets\/story\/chars\/([^/]+)\.[^/.]+$/i.exec(normalized);
    if (!match) continue;
    const base = match[1];
    const splitIndex = base.lastIndexOf('_');
    const characterId = splitIndex > 0 ? base.slice(0, splitIndex) : base;
    const poseId = splitIndex > 0 ? base.slice(splitIndex + 1) : 'normal';
    posesByCharacter[characterId] ??= [];
    if (!posesByCharacter[characterId].includes(poseId)) posesByCharacter[characterId].push(poseId);
    characters.push({
      characterId,
      poseId,
      label: `${toJapaneseHint(characterId)} / ${toJapaneseHint(poseId)}`,
      path: normalized
    });
  }

  return {
    backgrounds,
    bgm,
    se,
    characters: uniqueCharacterChoices(characters),
    posesByCharacter
  };
}

export function parseSpeakerCharacterMap(raw: string): StoryEditorSpeakerMapParseResult {
  const map: Record<string, string> = {};
  const warnings: Array<{ line: number; message: string }> = [];
  raw.replace(/\r\n?/g, '\n').split('\n').forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;
    const separator = trimmed.includes('=') ? '=' : trimmed.includes('->') ? '->' : '';
    if (!separator) {
      warnings.push({ line: index + 1, message: '話者の対応は「話者名=立ち絵名」で書いてください。' });
      return;
    }
    const [speaker, characterId] = trimmed.split(separator).map((part) => part.trim());
    if (!speaker || !characterId) {
      warnings.push({ line: index + 1, message: '話者名と立ち絵名の両方が必要です。' });
      return;
    }
    map[speaker] = characterId;
  });
  return { map, warnings };
}

export function formatSpeakerCharacterMap(map: Record<string, string>): string {
  return `${Object.entries(map).map(([speaker, characterId]) => `${speaker}=${characterId}`).join('\n')}\n`;
}

export function bumpRecentSpeakers(recentSpeakers: string[], speaker: string, maxSize = 6): string[] {
  const normalized = normalizeSpeakerName(speaker);
  if (!normalized) return [...recentSpeakers];
  return [normalized, ...recentSpeakers.filter((entry) => normalizeSpeakerName(entry) !== normalized)].slice(0, maxSize);
}

export function upsertSpeakerName(speakers: string[], speaker: string, maxSize = 20): string[] {
  const normalized = normalizeSpeakerName(speaker);
  if (!normalized) return [...speakers];
  return [normalized, ...speakers.filter((entry) => normalizeSpeakerName(entry) !== normalized)].slice(0, maxSize);
}

export function removeSpeakerName(speakers: string[], speaker: string): string[] {
  const normalized = normalizeSpeakerName(speaker);
  if (!normalized) return [...speakers];
  return speakers.filter((entry) => normalizeSpeakerName(entry) !== normalized);
}

export function renameSpeakerName(speakers: string[], speaker: string, renamed: string): string[] {
  const before = normalizeSpeakerName(speaker);
  const after = normalizeSpeakerName(renamed);
  if (!before || !after) return [...speakers];
  return Array.from(new Set(
    speakers.map((entry) => (normalizeSpeakerName(entry) === before ? after : normalizeSpeakerName(entry))).filter(Boolean)
  ));
}

export function collectSpeakerNames(
  customSpeakers: string[],
  recentSpeakers: string[],
  activeSpeaker: string,
  speakerMap: Record<string, string>
): string[] {
  return Array.from(new Set([...customSpeakers, ...recentSpeakers, activeSpeaker, ...Object.keys(speakerMap)].map(normalizeSpeakerName).filter(Boolean)));
}

export function removeSpeakerMappingLine(raw: string, speaker: string): string {
  const normalizedSpeaker = normalizeSpeakerName(speaker);
  if (!normalizedSpeaker) return raw;
  const kept = raw.replace(/\r\n?/g, '\n').split('\n').filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) return true;
    const separator = trimmed.includes('=') ? '=' : trimmed.includes('->') ? '->' : '';
    if (!separator) return true;
    const [name] = trimmed.split(separator).map((part) => part.trim());
    return name !== normalizedSpeaker;
  });
  return kept.length > 0 ? `${kept.join('\n')}\n` : '';
}

export function renameSpeakerMappingLine(raw: string, speaker: string, renamed: string): string {
  const before = normalizeSpeakerName(speaker);
  const after = normalizeSpeakerName(renamed);
  if (!before || !after) return raw;
  const hadTrailingNewline = /\n$/.test(raw.replace(/\r\n?/g, '\n'));
  const lines = raw.replace(/\r\n?/g, '\n').split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return line;
    const separator = trimmed.includes('=') ? '=' : trimmed.includes('->') ? '->' : '';
    if (!separator) return line;
    const [name, value] = trimmed.split(separator).map((part) => part.trim());
    if (name !== before || !value) return line;
    return `${after}${separator}${value}`;
  });
  const kept = lines.filter((line, index, all) => line.length > 0 || index < all.length - 1).join('\n');
  return hadTrailingNewline && kept ? `${kept}\n` : kept;
}

export function renameSpeakerInAuthorText(raw: string, speaker: string, renamed: string): string {
  const before = normalizeSpeakerName(speaker);
  const after = normalizeSpeakerName(renamed);
  if (!before || !after || before === after) return raw;
  const pattern = new RegExp(`^(\\s*)${escapeRegex(before)}(?=(?:\\[[^\\]]+\\])?「)`);
  return raw.replace(/\r\n?/g, '\n').split('\n').map((line) => line.replace(pattern, `$1${after}`)).join('\n');
}

export function deriveRepeatSpeakerFromCurrentLine(
  value: string,
  selectionStart: number,
  selectionEnd: number
): { speaker: string; pose: string } | null {
  const assist = deriveSpeakerTemplateFromCurrentLine(value, selectionStart, selectionEnd);
  if (!assist || selectionStart < assist.lineEnd) return null;
  return {
    speaker: assist.speaker,
    pose: assist.pose
  };
}

export function deriveSpeakerTemplateFromCurrentLine(
  value: string,
  selectionStart: number,
  selectionEnd: number
): { speaker: string; pose: string; lineEnd: number } | null {
  if (selectionStart !== selectionEnd) return null;
  const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
  const lineEndIndex = value.indexOf('\n', selectionStart);
  const lineEnd = lineEndIndex >= 0 ? lineEndIndex : value.length;
  const line = value.slice(lineStart, lineEnd);
  const match = /^(?<speaker>.*?)(?:\[(?<pose>[^\]]+)\])?「.*」$/.exec(line);
  if (!match?.groups || !hasSpeakerName(match.groups.speaker)) return null;
  return {
    speaker: normalizeSpeakerName(match.groups.speaker) || BLANK_SPEAKER,
    pose: match.groups.pose?.trim() ?? '',
    lineEnd
  };
}

export function normalizeSpeakerName(speaker: string): string {
  const raw = String(speaker ?? '');
  if (raw.length > 0 && raw.trim().length === 0) return raw;
  return raw.trim();
}

export function hasSpeakerName(speaker: string): boolean {
  return normalizeSpeakerName(speaker).length > 0;
}

function formatSpeakerNameForEditor(speaker: string): string {
  return normalizeSpeakerName(speaker).trim().length === 0 ? BLANK_SPEAKER_LABEL : normalizeSpeakerName(speaker);
}

export function buildStoryEditorTextFileName(title: string): string {
  const normalized = String(title || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/[. ]+$/g, '');
  return `${normalized || DEFAULT_TITLE}.txt`;
}

export function extractStoryEditorTitleFromFileName(fileName: string): string {
  const trimmed = String(fileName || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\.[^.]+$/, '').trim();
}

async function loadStoryAssetCatalog(doc: Document): Promise<StoryEditorAssetCatalog> {
  const emptyCatalog = createEmptyStoryEditorAssetCatalog();
  const fetchFn = doc.defaultView?.fetch?.bind(doc.defaultView);
  if (!fetchFn) return emptyCatalog;
  const [manifestCatalog, directoryCatalog] = await Promise.all([
    loadCatalogFromAssetManifest(fetchFn),
    loadCatalogFromStoryDirectories(fetchFn)
  ]);
  return mergeStoryEditorAssetCatalogs(manifestCatalog, directoryCatalog);
}

async function loadCatalogFromAssetManifest(fetchFn: typeof fetch): Promise<StoryEditorAssetCatalog | null> {
  try {
    const response = await fetchFn('../../assets/asset-manifest.json', { cache: 'no-store' });
    if (!response.ok) return null;
    const manifest = await response.json() as { files?: Array<{ path?: string }> };
    if (!manifest || !Array.isArray(manifest.files)) return null;
    const paths = manifest.files
      .map((file) => String(file?.path || '').replace(/\\/g, '/').trim())
      .filter((path) => path.startsWith('assets/story/'));
    return buildStoryEditorAssetCatalogFromPaths(paths);
  } catch {
    return null;
  }
}

async function loadCatalogFromStoryDirectories(fetchFn: typeof fetch): Promise<StoryEditorAssetCatalog | null> {
  const directories = ['../../assets/story/bg/', '../../assets/story/bgm/', '../../assets/story/se/', '../../assets/story/chars/'] as const;
  const paths: string[] = [];
  let touched = false;
  for (const directory of directories) {
    try {
      const response = await fetchFn(directory, { cache: 'no-store' });
      if (!response.ok) continue;
      const html = await response.text();
      paths.push(...extractDirectoryFiles(html, directory));
      touched = true;
    } catch {
      // Use fallback data.
    }
  }
  return touched ? buildStoryEditorAssetCatalogFromPaths(paths) : null;
}

function createEmptyStoryEditorAssetCatalog(): StoryEditorAssetCatalog {
  return {
    backgrounds: [],
    bgm: [],
    se: [],
    characters: [],
    posesByCharacter: {}
  };
}

function mergeStoryEditorAssetCatalogs(
  ...catalogs: Array<StoryEditorAssetCatalog | null | undefined>
): StoryEditorAssetCatalog {
  const paths = new Set<string>();
  catalogs.forEach((catalog) => {
    if (!catalog) return;
    catalog.backgrounds.forEach((asset) => paths.add(asset.path));
    catalog.bgm.forEach((asset) => paths.add(asset.path));
    catalog.se.forEach((asset) => paths.add(asset.path));
    catalog.characters.forEach((asset) => paths.add(asset.path));
  });
  if (paths.size === 0) return createEmptyStoryEditorAssetCatalog();
  return buildStoryEditorAssetCatalogFromPaths(Array.from(paths));
}

function renderStatus(root: HTMLElement, issues: StoryEditorIssue[]): void {
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  if (errorCount > 0) {
    root.textContent = `修正点があります。エラー ${errorCount} 件、注意 ${warningCount} 件です。`;
    return;
  }
  if (warningCount > 0) {
    root.textContent = `大きな問題はありません。注意が ${warningCount} 件あります。`;
    return;
  }
  root.textContent = '入力内容は問題なく整形できます。';
}

function renderSpeakerButtons(
  root: HTMLElement,
  activeRoot: HTMLElement,
  customSpeakers: string[],
  activeSpeaker: string,
  recentSpeakers: string[],
  speakerMap: Record<string, string>,
  onSelect: (speaker: string) => void
): void {
  root.innerHTML = '';
  const speakers = Array.from(new Set([
    BLANK_SPEAKER,
    ...collectSpeakerNames(customSpeakers, recentSpeakers, activeSpeaker, speakerMap)
  ]));
  for (const speaker of speakers) {
    const button = root.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = speaker === activeSpeaker ? 'story-editor-speaker-btn is-active' : 'story-editor-speaker-btn';
    button.textContent = formatSpeakerNameForEditor(speaker);
    button.addEventListener('click', () => onSelect(speaker));
    root.append(button);
  }
  activeRoot.textContent = activeSpeaker
    ? `今の話者: ${formatSpeakerNameForEditor(activeSpeaker)} / Tab で追加 / Enter で次の同話者 / Shift+Enter で今の行の次へ`
    : '今の話者: なし / 下で話者名を追加できます';
}

function renderSpeakerManageList(
  root: HTMLElement,
  customSpeakers: string[],
  recentSpeakers: string[],
  activeSpeaker: string,
  speakerMap: Record<string, string>,
  onInsert: (speaker: string) => void,
  onRename: (speaker: string, renamed: string) => void,
  onRemove: (speaker: string) => void
): void {
  root.innerHTML = '';
  const speakers = collectSpeakerNames(customSpeakers, recentSpeakers, activeSpeaker, speakerMap);
  if (speakers.length === 0) {
    root.textContent = '話者はまだありません。';
    return;
  }
  for (const speaker of speakers) {
    const row = root.ownerDocument.createElement('div');
    row.className = 'story-editor-speaker-manage-item';
    const name = root.ownerDocument.createElement('div');
    name.className = 'story-editor-speaker-manage-name';
    name.textContent = formatSpeakerNameForEditor(speaker);
    const actions = root.ownerDocument.createElement('div');
    actions.className = 'story-editor-speaker-manage-actions';
    const insert = root.ownerDocument.createElement('button');
    insert.type = 'button';
    insert.className = 'story-editor-speaker-manage-insert';
    insert.textContent = '追加';
    insert.addEventListener('click', () => onInsert(speaker));
    const rename = root.ownerDocument.createElement('button');
    rename.type = 'button';
    rename.className = 'story-editor-speaker-manage-rename';
    rename.textContent = '変更';
    rename.addEventListener('click', () => {
      const renamed = root.ownerDocument.defaultView?.prompt('新しい話者名', speaker);
      if (renamed == null) return;
      onRename(speaker, renamed);
    });
    const remove = root.ownerDocument.createElement('button');
    remove.type = 'button';
    remove.className = 'story-editor-speaker-manage-remove';
    remove.textContent = '削除';
    remove.addEventListener('click', () => onRemove(speaker));
    actions.append(insert, rename, remove);
    row.append(name, actions);
    root.append(row);
  }
}

function renderPoseOptions(
  details: HTMLDetailsElement,
  summary: HTMLElement,
  select: HTMLSelectElement,
  activeSpeaker: string,
  speakerMap: Record<string, string>,
  catalog: StoryEditorAssetCatalog
): void {
  const characterId = speakerMap[activeSpeaker];
  const poses = characterId ? catalog.posesByCharacter[characterId] ?? [] : [];
  const previous = select.value;
  select.innerHTML = '';
  select.append(createOption(select.ownerDocument, '', '表情なし'));
  poses.forEach((pose) => select.append(createOption(select.ownerDocument, pose, toJapaneseHint(pose))));
  select.value = poses.includes(previous) ? previous : '';
  if (!characterId || poses.length === 0) {
    details.hidden = true;
    details.open = false;
    summary.textContent = '表情を付ける';
    return;
  }
  details.hidden = false;
  summary.textContent = `${activeSpeaker}の表情を付ける`;
}

function renderBackgroundOptions(select: HTMLSelectElement, assets: StoryEditorAssetChoice[]): void {
  renderAssetOptions(select, assets);
}

function renderAssetOptions(select: HTMLSelectElement, assets: StoryEditorAssetChoice[]): void {
  const previous = select.value;
  select.innerHTML = '';
  if (assets.length === 0) {
    select.disabled = true;
    select.append(createOption(select.ownerDocument, '', 'まだありません'));
    return;
  }
  select.disabled = false;
  assets.forEach((asset) => select.append(createOption(select.ownerDocument, asset.id, asset.label)));
  select.value = assets.some((asset) => asset.id === previous) ? previous : assets[0].id;
}

function renderBattleOptions(select: HTMLSelectElement, stageTitleById: Record<string, string>): void {
  const previous = select.value;
  select.innerHTML = '';
  Object.entries(stageTitleById).forEach(([id, title]) => {
    select.append(createOption(select.ownerDocument, id, title));
  });
  select.value = Object.keys(stageTitleById).includes(previous) ? previous : Object.keys(stageTitleById)[0] ?? '';
}

function renderSceneList(root: HTMLElement, scenes: StoryEditorSceneRef[], onJump: (line: number, title: string) => void): void {
  root.innerHTML = '';
  if (scenes.length === 0) {
    root.textContent = '場面はまだありません。';
    return;
  }
  scenes.forEach((scene, index) => {
    const button = root.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = 'story-editor-scene-item';
    button.textContent = `場面 ${index + 1} | ${scene.title}`;
    button.addEventListener('click', () => onJump(scene.line, scene.title));
    root.append(button);
  });
}

function renderDiagnostics(root: HTMLElement, issues: StoryEditorIssue[], onJump: (line: number) => void): void {
  root.innerHTML = '';
  if (issues.length === 0) {
    root.textContent = '修正点はありません。';
    return;
  }
  issues.forEach((issue) => {
    const button = root.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = issue.severity === 'error' ? 'story-editor-diagnostic is-error' : 'story-editor-diagnostic is-warning';
    button.textContent = issue.line ? `行 ${issue.line}: ${issue.message}` : issue.message;
    if (issue.line) button.addEventListener('click', () => onJump(issue.line!));
    root.append(button);
  });
}

function createStoryEditorTextHistory(textArea: HTMLTextAreaElement, maxSize = 100): {
  captureBeforeChange: () => void;
  recordInput: () => void;
  resetBaseline: () => void;
  undo: () => boolean;
  redo: () => boolean;
} {
  const undoStack: StoryEditorTextSnapshot[] = [];
  const redoStack: StoryEditorTextSnapshot[] = [];
  let baseline = getTextSnapshot(textArea);
  let applying = false;

  const pushUndo = (snapshot: StoryEditorTextSnapshot): void => {
    if (sameTextSnapshot(undoStack[undoStack.length - 1], snapshot)) return;
    undoStack.push(snapshot);
    if (undoStack.length > maxSize) undoStack.shift();
  };

  const applySnapshot = (snapshot: StoryEditorTextSnapshot): void => {
    applying = true;
    textArea.value = snapshot.value;
    textArea.focus();
    textArea.setSelectionRange(
      Math.min(snapshot.selectionStart, textArea.value.length),
      Math.min(snapshot.selectionEnd, textArea.value.length)
    );
    baseline = getTextSnapshot(textArea);
    applying = false;
  };

  return {
    captureBeforeChange: () => {
      if (applying) return;
      const current = getTextSnapshot(textArea);
      if (sameTextSnapshot(current, baseline)) {
        pushUndo(current);
      } else {
        pushUndo(baseline);
        baseline = current;
      }
      redoStack.length = 0;
    },
    recordInput: () => {
      if (applying) return;
      const current = getTextSnapshot(textArea);
      if (sameTextSnapshot(current, baseline)) return;
      pushUndo(baseline);
      redoStack.length = 0;
      baseline = current;
    },
    resetBaseline: () => {
      baseline = getTextSnapshot(textArea);
    },
    undo: () => {
      if (undoStack.length === 0) return false;
      const current = getTextSnapshot(textArea);
      const previous = undoStack.pop();
      if (!previous) return false;
      redoStack.push(current);
      applySnapshot(previous);
      return true;
    },
    redo: () => {
      if (redoStack.length === 0) return false;
      const current = getTextSnapshot(textArea);
      const next = redoStack.pop();
      if (!next) return false;
      pushUndo(current);
      applySnapshot(next);
      return true;
    }
  };
}

function getTextSnapshot(textArea: HTMLTextAreaElement): StoryEditorTextSnapshot {
  return {
    value: textArea.value,
    selectionStart: textArea.selectionStart ?? textArea.value.length,
    selectionEnd: textArea.selectionEnd ?? textArea.value.length
  };
}

function sameTextSnapshot(left: StoryEditorTextSnapshot | undefined, right: StoryEditorTextSnapshot | undefined): boolean {
  return !!left
    && !!right
    && left.value === right.value
    && left.selectionStart === right.selectionStart
    && left.selectionEnd === right.selectionEnd;
}

function insertSpeakerLine(textArea: HTMLTextAreaElement, speaker: string, pose: string): void {
  const poseText = pose ? `[${pose}]` : '';
  insertTextBlock(textArea, `${speaker}${poseText}「」`, true);
}

function insertSpeakerLineAt(textArea: HTMLTextAreaElement, position: number, speaker: string, pose: string): void {
  textArea.focus();
  textArea.setSelectionRange(position, position);
  insertSpeakerLine(textArea, speaker, pose);
}

function insertTextBlock(textArea: HTMLTextAreaElement, block: string, quoteMode = false): void {
  const rawStart = textArea.selectionStart ?? textArea.value.length;
  const rawEnd = textArea.selectionEnd ?? rawStart;
  const adjusted = adjustInsertionPointAroundClosingQuote(textArea.value, rawStart, rawEnd);
  const start = adjusted.start;
  const end = adjusted.end;
  const before = textArea.value.slice(0, start);
  const after = textArea.value.slice(end);
  const prefix = before && !before.endsWith('\n') ? '\n' : '';
  const suffix = after && !after.startsWith('\n') ? '\n' : '';
  const nextValue = `${before}${prefix}${block}${suffix}${after}`;
  const anchor = before.length + prefix.length;
  textArea.value = nextValue;
  textArea.focus();
  if (quoteMode) {
    const caret = anchor + block.indexOf('「') + 1;
    textArea.setSelectionRange(caret, caret);
  } else {
    const caret = anchor + block.length;
    textArea.setSelectionRange(caret, caret);
  }
}

function adjustInsertionPointAroundClosingQuote(
  value: string,
  start: number,
  end: number
): { start: number; end: number } {
  if (start !== end) return { start, end };
  if (value[start] !== '」') return { start, end };
  return { start: start + 1, end: end + 1 };
}

function focusTextLine(textArea: HTMLTextAreaElement, line: number): void {
  const lines = textArea.value.replace(/\r\n?/g, '\n').split('\n');
  const target = Math.max(1, Math.min(line, lines.length));
  let start = 0;
  for (let index = 0; index < target - 1; index += 1) start += lines[index].length + 1;
  const end = start + (lines[target - 1]?.length ?? 0);
  textArea.focus();
  textArea.setSelectionRange(start, end);
}

function resolveSceneTarget(rawTarget: string, sceneIdByTitle: Map<string, string>, warnings: StoryEditorCompileWarning[], line: number): string {
  const trimmed = rawTarget.trim();
  if (!trimmed) return 'scene_missing';
  const direct = sceneIdByTitle.get(trimmed);
  if (direct) return direct;
  warnings.push({ line, message: `進み先「${trimmed}」に対応する場面がまだありません。` });
  return sanitizeIdentifier(trimmed) || 'scene_missing';
}

function formatStoryTsOutput(scenario: StoryScenario): string {
  const exportName = toCamelCase(scenario.id) || 'draftStory';
  return `import type { StoryScenario } from '../../core/story-schema';\n\nexport const ${exportName} = ${JSON.stringify(scenario, null, 2)} as const satisfies StoryScenario;\n`;
}

function formatPromptOutput(displayScript: string, scenario: StoryScenario): string {
  const chapterId = scenario.chapters[0]?.id ?? 'chapter_001';
  const nodeId = scenario.chapters[0]?.nodes[0]?.id ?? 'scene_001';
  return [
    `以下の下書きを story/content/chapters/${chapterId}.story.ts の ${nodeId} に反映してください。`,
    '既存の StoryCommand 型と StoryScenario 型に合わせて整形し、validateStoryScenario が通るようにしてください。',
    'story/core, story/content 以外の既存ゲーム本体には触らないでください。',
    '',
    '作者が書いた下書き:',
    displayScript.trim(),
    '',
    '想定する StoryScenario:',
    JSON.stringify(scenario, null, 2)
  ].join('\n');
}

function parseMarkerValue(line: string, kind: '章' | '場面'): string | null {
  const match = new RegExp(`^■?${kind}\\s*[：:]\\s*(.+)$`).exec(line.trim());
  return match?.[1]?.trim() || null;
}

function parseDirectiveBody(line: string, label: string): string | null {
  const match = new RegExp(`^${label}\\s*[：:]\\s*(.+)$`).exec(line);
  return match?.[1]?.trim() || null;
}

function createSampleAuthorText(): string {
  return [
    '■章：第一章　観測の罪',
    '■場面：導入',
    '主人公「観測にも代償がある、そうなんだろ？」',
    'ライバル「まずはこの文を自分の話に書き換えていこう」',
    '移動：勝負の前',
    '',
    '■場面：勝負の前',
    '背景：病室',
    '主人公「短い対局なら、今ここで決められる」'
  ].join('\n');
}

function suggestNextSceneTitle(text: string): string {
  const count = text.split('\n').filter((line) => parseMarkerValue(line, '場面')).length;
  return `場面 ${count + 1}`;
}

function suggestNextChapterTitle(text: string): string {
  const count = text.split('\n').filter((line) => parseMarkerValue(line, '章')).length;
  const next = count + 1;
  return `${toJapaneseChapterNumber(next)}　章タイトル`;
}

function toJapaneseChapterNumber(index: number): string {
  const labels = ['第一章', '第二章', '第三章', '第四章', '第五章', '第六章', '第七章', '第八章', '第九章', '第十章'];
  if (Number.isInteger(index) && index >= 1 && index <= labels.length) {
    return labels[index - 1];
  }
  return `第${index}章`;
}

function renderAssetLabel(id: string): string {
  return `${toJapaneseHint(id)} (${id})`;
}

function collectSimpleAssetChoices(paths: string[], pattern: RegExp): StoryEditorAssetChoice[] {
  const unique = new Map<string, StoryEditorAssetChoice>();
  paths.forEach((path) => {
    const normalized = path.replace(/\\/g, '/');
    const match = pattern.exec(normalized);
    if (!match) return;
    const id = match[1];
    if (unique.has(id)) return;
    unique.set(id, { id, label: renderAssetLabel(id), path: normalized });
  });
  return Array.from(unique.values()).sort((a, b) => a.id.localeCompare(b.id, 'ja'));
}

function extractDirectoryFiles(html: string, directory: string): string[] {
  const results: string[] = [];
  const hrefPattern = /href="([^"]+)"/gi;
  let match: RegExpExecArray | null = null;
  while ((match = hrefPattern.exec(html)) !== null) {
    const href = match[1];
    if (!href || href === '../' || href.endsWith('/')) continue;
    const normalizedDirectory = directory.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');
    const rawFileName = href.split('?')[0].split('#')[0];
    let decodedFileName = rawFileName;
    try {
      decodedFileName = decodeURIComponent(rawFileName);
    } catch {
      decodedFileName = rawFileName;
    }
    results.push(`${normalizedDirectory}${decodedFileName}`.replace(/\\/g, '/'));
  }
  return results;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueCharacterChoices(choices: StoryEditorCharacterChoice[]): StoryEditorCharacterChoice[] {
  const unique = new Map<string, StoryEditorCharacterChoice>();
  choices.forEach((choice) => unique.set(`${choice.characterId}:${choice.poseId}`, choice));
  return Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label, 'ja'));
}

function renderBattleLabel(id: string): string {
  return toJapaneseHint(id);
}

function toJapaneseParserIssue(code: string, fallback: string): string {
  const table: Record<string, string> = {
    SAY_QUOTE_UNCLOSED: 'セリフの閉じカギカッコが足りません。',
    SAY_SPEAKER_EMPTY: '話者名が空です。',
    SAY_TEXT_EMPTY: 'セリフ本文が空です。',
    BG_ID_MISSING: '背景名が空です。',
    BGM_ID_MISSING: '音楽名が空です。',
    SE_ID_MISSING: '効果音名が空です。',
    BATTLE_STAGE_MISSING: '対局名が空です。',
    BATTLE_WIN_MISSING: '対局の勝ち先が必要です。',
    BATTLE_LOSE_MISSING: '対局の負け先が必要です。',
    CHOICE_OPTIONS_MISSING: '選択肢は二つ以上必要です。',
    CHARACTER_MAPPING_UNKNOWN: 'この話者に対応する立ち絵がまだ決まっていません。'
  };
  return table[code] ?? fallback;
}

function createOption(doc: Document, value: string, label: string): HTMLOptionElement {
  const option = doc.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function toJapaneseHint(value: string): string {
  const tokenMap: Record<string, string> = {
    arena: '対局場',
    battle: '対局',
    calm: '穏やか',
    confident: '自信',
    day: '昼',
    decision: '決意',
    determined: '真剣',
    evening: '夕方',
    normal: '通常',
    observer: '観測者',
    protagonist: '主人公',
    rival: 'ライバル',
    room: '部屋'
  };
  return value.split(/[_\-.]+/).filter(Boolean).map((part) => tokenMap[part.toLowerCase()] ?? part).join(' ');
}

function sanitizeIdentifier(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '_');
}

function toCamelCase(value: string): string {
  const normalized = sanitizeIdentifier(value);
  if (!normalized) return '';
  return normalized.split(/[_-]+/).filter(Boolean).map((part, index) => {
    const lower = part.toLowerCase();
    return index === 0 ? lower : `${lower[0]?.toUpperCase() ?? ''}${lower.slice(1)}`;
  }).join('');
}

function loadStoredText(storage: Storage | null, key: string): string | null {
  if (!storage) return null;
  const value = storage.getItem(key);
  return value && value.trim() ? value : null;
}

function loadStoredValue(storage: Storage | null, key: string): string | null {
  if (!storage) return null;
  return storage.getItem(key);
}

function trySaveText(storage: Storage | null, key: string, value: string): void {
  if (!storage) return;
  storage.setItem(key, value);
}

function trySaveRawText(storage: Storage | null, key: string, value: string): void {
  if (!storage) return;
  storage.setItem(key, value);
}

function loadTextBackups(storage: Storage | null): StoryEditorTextBackup[] {
  if (!storage) return [];
  const raw = storage.getItem(TEXT_BACKUPS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is StoryEditorTextBackup => (
      entry
      && typeof entry.savedAt === 'string'
      && typeof entry.title === 'string'
      && typeof entry.text === 'string'
      && entry.text.trim().length > 0
    ));
  } catch {
    return [];
  }
}

function trySaveTextBackup(storage: Storage | null, title: string, text: string): void {
  if (!storage || !text.trim()) return;
  const backups = loadTextBackups(storage);
  if (backups[0]?.text === text) return;
  const next = [{
    savedAt: new Date().toISOString(),
    title: title.trim() || DEFAULT_TITLE,
    text
  }, ...backups].slice(0, 20);
  storage.setItem(TEXT_BACKUPS_KEY, JSON.stringify(next));
}

function loadLatestTextBackup(storage: Storage | null): StoryEditorTextBackup | null {
  return loadTextBackups(storage)[0] ?? null;
}

function loadStoredSpeakerList(storage: Storage | null, key: string): string[] {
  if (!storage) return [DEFAULT_SPEAKER];
  const raw = storage.getItem(key);
  if (!raw) return [DEFAULT_SPEAKER];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [DEFAULT_SPEAKER];
    return parsed.filter((entry): entry is string => typeof entry === 'string' && hasSpeakerName(entry));
  } catch {
    return [DEFAULT_SPEAKER];
  }
}

function loadStoredTextList(storage: Storage | null, key: string, fallback: string[] = []): string[] {
  if (!storage) return [...fallback];
  const raw = storage.getItem(key);
  if (!raw) return [...fallback];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...fallback];
    const values = parsed.filter((entry): entry is string => typeof entry === 'string' && hasSpeakerName(entry));
    return values.length > 0 ? values : [...fallback];
  } catch {
    return [...fallback];
  }
}

function trySaveStoredSpeakerList(storage: Storage | null, key: string, speakers: string[]): void {
  if (!storage) return;
  storage.setItem(key, JSON.stringify(speakers));
}

function downloadStoryEditorTextFile(doc: Document, fileName: string, text: string): boolean {
  const view = doc.defaultView;
  if (!view?.Blob || !view.URL?.createObjectURL) return false;
  const blob = new view.Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = view.URL.createObjectURL(blob);
  try {
    const link = doc.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    doc.body.append(link);
    link.click();
    link.remove();
    return true;
  } catch {
    return false;
  } finally {
    view.setTimeout(() => view.URL.revokeObjectURL(url), 0);
  }
}

function resolveStorage(doc: Document): Storage | null {
  try {
    return doc.defaultView?.localStorage ?? null;
  } catch {
    return null;
  }
}

async function copyText(text: string, textarea: HTMLTextAreaElement, statusRoot: HTMLElement, successMessage: string): Promise<void> {
  try {
    const clipboard = textarea.ownerDocument.defaultView?.navigator.clipboard;
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      statusRoot.textContent = successMessage;
      return;
    }
    throw new Error('Clipboard unavailable');
  } catch {
    textarea.focus();
    textarea.select();
    const copied = textarea.ownerDocument.execCommand?.('copy');
    statusRoot.textContent = copied ? successMessage : 'コピーできませんでした。';
  }
}

function requireElement<T extends HTMLElement>(doc: Document, id: string): T {
  const element = doc.getElementById(id);
  if (!element) throw new Error(`Missing story editor element: ${id}`);
  return element as T;
}
