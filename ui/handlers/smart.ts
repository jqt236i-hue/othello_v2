/**
 * @file smart.ts
 * @description AI level select handlers
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

declare const updateCpuCharacter: (() => void) | undefined;
declare const addLog: ((msg: string) => void) | undefined;
declare const CpuPolicy: {
  loadPolicyForLevel?: (level: number) => Promise<unknown>;
} | undefined;
declare let mccfrPolicy: unknown;

interface SmartOption {
  v: string;
  t: string;
}

const CpuOpponentProfiles = _require('../../shared/cpu-opponent-profiles');
const CpuOpponentStartupOptions = _require('../../shared/cpu-opponent-startup-options');
const SharedBoardUtils = _require('../../shared/shared-board-utils');
const CpuProfileSelection = _require('../cpu-profile-selection');
const localCpuLevels: Record<string, number> = { black: 1, white: 1 };
const localCpuProfileValues: Record<string, string> = { black: '1', white: '1' };
let boundCpuMenuSmartWhite: HTMLSelectElement | null = null;
const CPU_LEVEL_SHORTCUT_ID = 'cpu-level-label';
const CPU_LEVEL_MENU_ID = 'cpu-level-menu';
const CPU_LEVEL_MENU_BACKDROP_ID = 'cpu-level-menu-backdrop';
const CPU_MODE_BUTTON_ID = 'modeCpuBtn';
type CpuConfigTabName = 'cpu' | 'board';
type CpuDeckRule = 'default' | 'all-cards' | 'random-30';
const CPU_DECK_RULE_OPTIONS: ReadonlyArray<{ rule: CpuDeckRule; label: string; summary: string }> = [
  { rule: 'default', label: '通常（各自のデッキ）', summary: '' },
  { rule: 'all-cards', label: '両者全カードデッキ', summary: '両者全カード' },
  { rule: 'random-30', label: '両者ランダム30枚デッキ', summary: '両者ランダム30枚' }
];
const CPU_LEVEL_OPTIONS: SmartOption[] = CpuOpponentProfiles.getCpuOpponentMenuOptions()
  .map((opt: any) => ({ v: String(opt.value), t: String(opt.label) }));

function clampCpuLevel(value: unknown): number {
  return CpuOpponentProfiles.getCpuOpponentLevel(value);
}

function getCpuLevelShortcutButton(): HTMLButtonElement | null {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById(CPU_LEVEL_SHORTCUT_ID);
  const buttonCtor = (typeof window !== 'undefined' && window.HTMLButtonElement)
    ? window.HTMLButtonElement
    : null;
  return buttonCtor && el instanceof buttonCtor ? el : null;
}

function dispatchSelectChange(selectEl: HTMLSelectElement): void {
  const evt = new Event('change', { bubbles: true });
  selectEl.dispatchEvent(evt);
}

function getCpuLevelMenu(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById(CPU_LEVEL_MENU_ID);
  const divCtor = (typeof window !== 'undefined' && window.HTMLDivElement)
    ? window.HTMLDivElement
    : null;
  return divCtor && el instanceof divCtor ? el : null;
}

function setCpuLevelShortcutExpanded(expanded: boolean): void {
  const shortcut = getCpuLevelShortcutButton();
  if (!shortcut) return;
  shortcut.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function getCpuLevelMenuBackdrop(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(CPU_LEVEL_MENU_BACKDROP_ID);
}

function ensureCpuLevelMenuBackdrop(): HTMLElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  let backdrop = getCpuLevelMenuBackdrop();
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = CPU_LEVEL_MENU_BACKDROP_ID;
    backdrop.hidden = true;
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);
  }
  return backdrop;
}

function hideCpuLevelMenu(): void {
  const menu = getCpuLevelMenu();
  const backdrop = getCpuLevelMenuBackdrop();
  if (backdrop) backdrop.hidden = true;
  if (!menu) {
    setCpuLevelShortcutExpanded(false);
    return;
  }
  menu.hidden = true;
  setCpuLevelShortcutExpanded(false);
}

function syncCpuLevelMenuSelection(menu: HTMLDivElement, selectedValue: unknown): void {
  const selectedProfile = CpuOpponentProfiles.getCpuOpponentProfileId(selectedValue);
  menu.querySelectorAll<HTMLButtonElement>('.cpu-level-menu-item').forEach((item) => {
    const itemValue = String(item.dataset.cpuLevel || '');
    const selected = itemValue === selectedProfile;
    item.classList.toggle('is-selected', selected);
    item.setAttribute('aria-checked', selected ? 'true' : 'false');
  });
}

function resolveCpuBoardConfigController(): any {
  const root = resolveSmartRuntimeRoot();
  const directController = root && root.DeckBuilderController;
  if (directController
    && typeof directController.getLocalBoardConfig === 'function'
    && typeof directController.setLocalBoardConfig === 'function') {
    return directController;
  }
  try {
    const globals = root && root.UIBootstrap && typeof root.UIBootstrap.getUIGlobals === 'function'
      ? root.UIBootstrap.getUIGlobals()
      : null;
    const controller = globals && globals.DeckBuilderController;
    if (controller
      && typeof controller.getLocalBoardConfig === 'function'
      && typeof controller.setLocalBoardConfig === 'function') {
      return controller;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function readCpuMenuBoardConfig(): any {
  const controller = resolveCpuBoardConfigController();
  try {
    if (controller) return SharedBoardUtils.normalizeBoardConfig(controller.getLocalBoardConfig());
  } catch (e) { /* ignore */ }
  return SharedBoardUtils.buildBoardConfig();
}

function writeCpuMenuBoardConfig(nextBoardConfig: any): any {
  const normalized = SharedBoardUtils.normalizeBoardConfig(nextBoardConfig);
  const controller = resolveCpuBoardConfigController();
  if (controller) controller.setLocalBoardConfig(normalized);
  return normalized;
}

function normalizeCpuDeckRule(value: unknown): CpuDeckRule {
  return value === 'all-cards' || value === 'random-30' ? value : 'default';
}

function readCpuMenuDeckRule(): CpuDeckRule {
  const controller = resolveCpuBoardConfigController();
  try {
    if (controller && typeof controller.getLocalCpuDeckRule === 'function') {
      return normalizeCpuDeckRule(controller.getLocalCpuDeckRule());
    }
  } catch (e) { /* ignore */ }
  return 'default';
}

function writeCpuMenuDeckRule(rule: CpuDeckRule): void {
  const controller = resolveCpuBoardConfigController();
  if (controller && typeof controller.setLocalCpuDeckRule === 'function') controller.setLocalCpuDeckRule(rule);
}

function readCpuMenuStoneSupplyEnabled(): boolean {
  const controller = resolveCpuBoardConfigController();
  try {
    if (controller && typeof controller.getLocalStoneSupplyEnabled === 'function') {
      return controller.getLocalStoneSupplyEnabled() !== false;
    }
  } catch (e) { /* ignore */ }
  return true;
}

function writeCpuMenuStoneSupplyEnabled(enabled: boolean): void {
  const controller = resolveCpuBoardConfigController();
  if (controller && typeof controller.setLocalStoneSupplyEnabled === 'function') {
    controller.setLocalStoneSupplyEnabled(enabled);
  }
}

function formatCpuMenuBoardConfig(boardConfig: any): string {
  const normalized = SharedBoardUtils.normalizeBoardConfig(boardConfig);
  const shapeLabel = normalized.shape === 'circle' ? '円形' : '通常';
  return `${shapeLabel} ${normalized.rows}×${normalized.cols}`;
}

function formatCpuMenuRuleSummary(): string {
  const parts: string[] = [];
  const deckRule = readCpuMenuDeckRule();
  const deckOption = CPU_DECK_RULE_OPTIONS.find((opt) => opt.rule === deckRule);
  if (deckOption && deckOption.summary) parts.push(deckOption.summary);
  if (!readCpuMenuStoneSupplyEnabled()) parts.push('持ち石なし');
  return parts.map((part) => ` / ${part}`).join('');
}

function formatCpuMenuProfileLevel(selectedValue: unknown): string {
  const profile = CpuOpponentProfiles.getCpuOpponentProfile(selectedValue);
  const level = Number(profile && profile.level);
  return Number.isFinite(level) ? `Lv${Math.max(1, Math.floor(level))}` : 'CPU';
}

function syncCpuConfigMenuSummary(menu: HTMLDivElement, selectedValue: unknown, boardConfig?: any): void {
  const summary = menu.querySelector<HTMLElement>('.cpu-config-summary-value');
  if (!summary) return;
  const config = boardConfig || readCpuMenuBoardConfig();
  summary.textContent = `${formatCpuMenuProfileLevel(selectedValue)} / ${formatCpuMenuBoardConfig(config)}${formatCpuMenuRuleSummary()}`;
}

function readCpuBoardWheelDelta(event: WheelEvent): number {
  const deltaX = Number(event && event.deltaX) || 0;
  const deltaY = Number(event && event.deltaY) || 0;
  return Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
}

function resetGameFromCpuBoardMenu(): void {
  const resetButton = typeof document !== 'undefined'
    ? document.getElementById('resetBtn') as HTMLButtonElement | null
    : null;
  if (resetButton && !resetButton.disabled) {
    resetButton.click();
    return;
  }
  const root = resolveSmartRuntimeRoot();
  const resetFn = root && typeof root.resetGame === 'function'
    ? root.resetGame
    : ((typeof globalThis !== 'undefined' && typeof (globalThis as any).resetGame === 'function')
      ? (globalThis as any).resetGame
      : null);
  if (typeof resetFn === 'function') resetFn();
}

function syncCpuBoardConfigControls(menu: HTMLDivElement, selectedValue: unknown, boardConfig?: any): void {
  const config = SharedBoardUtils.normalizeBoardConfig(boardConfig || readCpuMenuBoardConfig());
  const circle = config.shape === 'circle';
  menu.querySelectorAll<HTMLButtonElement>('[data-cpu-board-shape]').forEach((button) => {
    const selected = String(button.dataset.cpuBoardShape || '') === config.shape;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
  menu.querySelectorAll<HTMLButtonElement>('[data-cpu-circle-size]').forEach((button) => {
    const selected = circle && Number(button.dataset.cpuCircleSize) === config.rows;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
  const circleControls = menu.querySelector<HTMLElement>('.cpu-board-circle-controls');
  const rectangleControls = menu.querySelector<HTMLElement>('.cpu-board-rectangle-controls');
  if (circleControls) circleControls.hidden = !circle;
  if (rectangleControls) rectangleControls.hidden = circle;
  const rowsSelect = menu.querySelector<HTMLSelectElement>('[data-cpu-board-rows]');
  const colsSelect = menu.querySelector<HTMLSelectElement>('[data-cpu-board-cols]');
  if (rowsSelect) rowsSelect.value = String(config.rows);
  if (colsSelect) colsSelect.value = String(config.cols);
  const deckRule = readCpuMenuDeckRule();
  menu.querySelectorAll<HTMLButtonElement>('[data-cpu-deck-rule]').forEach((button) => {
    const selected = button.dataset.cpuDeckRule === deckRule;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
  const stoneSupplyValue = readCpuMenuStoneSupplyEnabled() ? 'on' : 'off';
  menu.querySelectorAll<HTMLButtonElement>('[data-cpu-stone-supply]').forEach((button) => {
    const selected = button.dataset.cpuStoneSupply === stoneSupplyValue;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
  syncCpuConfigMenuSummary(menu, selectedValue, config);
}

function setCpuConfigMenuTab(menu: HTMLDivElement, tabName: CpuConfigTabName): void {
  menu.querySelectorAll<HTMLButtonElement>('[data-cpu-config-tab]').forEach((button) => {
    const selected = button.dataset.cpuConfigTab === tabName;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
    button.tabIndex = selected ? 0 : -1;
  });
  menu.querySelectorAll<HTMLElement>('[data-cpu-config-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.cpuConfigPanel !== tabName;
  });
}

function createCpuConfigTab(menu: HTMLDivElement, label: string, tabName: CpuConfigTabName): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cpu-config-tab';
  button.dataset.cpuConfigTab = tabName;
  button.textContent = label;
  button.setAttribute('role', 'tab');
  button.addEventListener('click', () => {
    setCpuConfigMenuTab(menu, tabName);
  });
  return button;
}

function createCpuBoardControlGroup(labelText: string, extraClassName: string): HTMLDivElement {
  const group = document.createElement('div');
  group.className = `cpu-board-control-group ${extraClassName}`;
  const label = document.createElement('div');
  label.className = 'cpu-board-control-label';
  label.textContent = labelText;
  group.appendChild(label);
  return group;
}

function createCpuRuleChoiceButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cpu-board-choice-button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function appendCpuRuleControls(panel: HTMLDivElement, menu: HTMLDivElement, smartWhite: HTMLSelectElement): void {
  const deckGroup = createCpuBoardControlGroup('デッキ', 'cpu-board-deck-controls');
  const deckChoices = document.createElement('div');
  deckChoices.className = 'cpu-board-deck-choices';
  CPU_DECK_RULE_OPTIONS.forEach((opt) => {
    const button = createCpuRuleChoiceButton(opt.label, () => {
      writeCpuMenuDeckRule(opt.rule);
      syncCpuBoardConfigControls(menu, smartWhite.value);
    });
    button.dataset.cpuDeckRule = opt.rule;
    deckChoices.appendChild(button);
  });
  deckGroup.appendChild(deckChoices);
  panel.appendChild(deckGroup);

  const stoneGroup = createCpuBoardControlGroup('持ち石', 'cpu-board-stone-supply-controls');
  const stoneChoices = document.createElement('div');
  stoneChoices.className = 'cpu-board-shape-choices';
  const stoneOptions: Array<[string, boolean]> = [['持ち石あり', true], ['持ち石なし', false]];
  stoneOptions.forEach(([label, enabled]) => {
    const button = createCpuRuleChoiceButton(label, () => {
      writeCpuMenuStoneSupplyEnabled(enabled);
      syncCpuBoardConfigControls(menu, smartWhite.value);
    });
    button.dataset.cpuStoneSupply = enabled ? 'on' : 'off';
    stoneChoices.appendChild(button);
  });
  stoneGroup.appendChild(stoneChoices);
  panel.appendChild(stoneGroup);
}

function createCpuBoardShapeButton(
  menu: HTMLDivElement,
  smartWhite: HTMLSelectElement,
  label: string,
  shape: 'rectangle' | 'circle'
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cpu-board-choice-button';
  button.dataset.cpuBoardShape = shape;
  button.textContent = label;
  button.addEventListener('click', () => {
    const current = readCpuMenuBoardConfig();
    const next = shape === 'circle'
      ? SharedBoardUtils.buildBoardConfig(
        SharedBoardUtils.normalizeCircleBoardSize(current.rows),
        SharedBoardUtils.normalizeCircleBoardSize(current.rows),
        'circle'
      )
      : SharedBoardUtils.buildBoardConfig(current.rows, current.cols, 'rectangle');
    syncCpuBoardConfigControls(menu, smartWhite.value, writeCpuMenuBoardConfig(next));
  });
  return button;
}

function createCpuBoardPanel(menu: HTMLDivElement, smartWhite: HTMLSelectElement): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'cpu-config-panel cpu-board-config-panel';
  panel.dataset.cpuConfigPanel = 'board';
  panel.setAttribute('role', 'tabpanel');

  const shapeGroup = document.createElement('div');
  shapeGroup.className = 'cpu-board-control-group';
  const shapeLabel = document.createElement('div');
  shapeLabel.className = 'cpu-board-control-label';
  shapeLabel.textContent = '盤面形状';
  const shapeChoices = document.createElement('div');
  shapeChoices.className = 'cpu-board-shape-choices';
  shapeChoices.appendChild(createCpuBoardShapeButton(menu, smartWhite, '通常', 'rectangle'));
  shapeChoices.appendChild(createCpuBoardShapeButton(menu, smartWhite, '円形', 'circle'));
  shapeGroup.appendChild(shapeLabel);
  shapeGroup.appendChild(shapeChoices);
  panel.appendChild(shapeGroup);

  const circleControls = document.createElement('div');
  circleControls.className = 'cpu-board-control-group cpu-board-circle-controls';
  const circleLabel = document.createElement('div');
  circleLabel.className = 'cpu-board-control-label';
  circleLabel.textContent = '盤面サイズ';
  const circleNote = document.createElement('span');
  circleNote.className = 'cpu-board-control-note';
  circleNote.textContent = '偶数・正方形固定';
  circleLabel.appendChild(circleNote);
  const sizeChoices = document.createElement('div');
  sizeChoices.className = 'cpu-board-size-choices';
  for (let size = SharedBoardUtils.MIN_CIRCLE_BOARD_SIZE; size <= SharedBoardUtils.MAX_CIRCLE_BOARD_SIZE; size += SharedBoardUtils.CIRCLE_BOARD_SIZE_STEP) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cpu-board-choice-button';
    button.dataset.cpuCircleSize = String(size);
    button.textContent = `${size}×${size}`;
    button.addEventListener('click', () => {
      const next = SharedBoardUtils.buildBoardConfig(size, size, 'circle');
      syncCpuBoardConfigControls(menu, smartWhite.value, writeCpuMenuBoardConfig(next));
    });
    button.addEventListener('wheel', (event) => {
      const delta = readCpuBoardWheelDelta(event);
      if (!delta) return;
      const current = readCpuMenuBoardConfig();
      const direction = delta < 0 ? 1 : -1;
      const nextSize = SharedBoardUtils.normalizeCircleBoardSize(
        current.rows + direction * SharedBoardUtils.CIRCLE_BOARD_SIZE_STEP,
        current.rows
      );
      event.preventDefault();
      syncCpuBoardConfigControls(
        menu,
        smartWhite.value,
        writeCpuMenuBoardConfig(SharedBoardUtils.buildBoardConfig(nextSize, nextSize, 'circle'))
      );
    }, { passive: false });
    sizeChoices.appendChild(button);
  }
  circleControls.appendChild(circleLabel);
  circleControls.appendChild(sizeChoices);
  panel.appendChild(circleControls);

  const rectangleControls = document.createElement('div');
  rectangleControls.className = 'cpu-board-control-group cpu-board-rectangle-controls';
  const rectangleLabel = document.createElement('div');
  rectangleLabel.className = 'cpu-board-control-label';
  rectangleLabel.textContent = '盤面サイズ';
  const dimensionFields = document.createElement('div');
  dimensionFields.className = 'cpu-board-dimension-fields';
  const buildDimensionField = (labelText: string, axis: 'rows' | 'cols') => {
    const label = document.createElement('label');
    label.className = 'cpu-board-dimension-field';
    label.textContent = labelText;
    const select = document.createElement('select');
    select.dataset[axis === 'rows' ? 'cpuBoardRows' : 'cpuBoardCols'] = '1';
    const bounds = SharedBoardUtils.getBoardDimensionBounds(axis === 'rows' ? 'row' : 'col');
    for (let size = bounds.min; size <= bounds.max; size += 1) {
      const option = document.createElement('option');
      option.value = String(size);
      option.textContent = String(size);
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      const current = readCpuMenuBoardConfig();
      const rowsSelect = menu.querySelector<HTMLSelectElement>('[data-cpu-board-rows]');
      const colsSelect = menu.querySelector<HTMLSelectElement>('[data-cpu-board-cols]');
      const next = SharedBoardUtils.buildBoardConfig(
        rowsSelect ? rowsSelect.value : current.rows,
        colsSelect ? colsSelect.value : current.cols,
        'rectangle'
      );
      syncCpuBoardConfigControls(menu, smartWhite.value, writeCpuMenuBoardConfig(next));
    });
    select.addEventListener('wheel', (event) => {
      const delta = readCpuBoardWheelDelta(event);
      if (!delta) return;
      const current = readCpuMenuBoardConfig();
      const fallbackValue = axis === 'rows' ? current.rows : current.cols;
      select.value = String(SharedBoardUtils.stepBoardDimensionValue(
        select.value,
        delta < 0 ? 1 : -1,
        fallbackValue,
        axis === 'rows' ? 'row' : 'col'
      ));
      event.preventDefault();
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }, { passive: false });
    label.appendChild(select);
    return label;
  };
  dimensionFields.appendChild(buildDimensionField('縦', 'rows'));
  dimensionFields.appendChild(buildDimensionField('横', 'cols'));
  rectangleControls.appendChild(rectangleLabel);
  rectangleControls.appendChild(dimensionFields);
  panel.appendChild(rectangleControls);

  appendCpuRuleControls(panel, menu, smartWhite);

  const footer = document.createElement('div');
  footer.className = 'cpu-board-panel-footer';
  const applyNote = document.createElement('div');
  applyNote.className = 'cpu-board-apply-note';
  applyNote.textContent = '盤面・ルールの変更は次のリセット / 新規対局で反映';
  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'cpu-board-reset-button';
  resetButton.textContent = 'リセット';
  resetButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideCpuLevelMenu();
    resetGameFromCpuBoardMenu();
  });
  footer.appendChild(applyNote);
  footer.appendChild(resetButton);
  panel.appendChild(footer);
  return panel;
}

function clearCpuLevelMenuChildren(menu: HTMLDivElement): void {
  while (menu.firstChild) {
    menu.removeChild(menu.firstChild);
  }
}

function getCpuLevelMenuItemClasses(profileValue: unknown): string[] {
  const profile = CpuOpponentProfiles.getCpuOpponentProfile(profileValue);
  const level = Number(profile && profile.level);
  const classes = ['cpu-level-menu-item'];
  if (Number.isFinite(level)) classes.push(`cpu-level-tier-${Math.max(1, Math.min(10, Math.floor(level)))}`);
  if (profile && profile.id === '7-board-executor') classes.push('cpu-level-profile-board-executor');
  if (profile && profile.id === '8-theory-incarnation') classes.push('cpu-level-profile-theory');
  if (profile && profile.id === '9-ending-ash') classes.push('cpu-level-profile-ending-ash');
  return classes;
}

// ポップアップは CSS で画面中央に固定する。以前の表示位置（ラベル基準）の inline 指定が残らないよう消す。
function centerCpuLevelMenu(menu: HTMLDivElement): void {
  menu.style.top = '';
  menu.style.right = '';
  menu.style.left = '';
  menu.style.maxHeight = '';
  menu.style.overflowY = '';
}

function ensureCpuLevelMenu(smartWhite: HTMLSelectElement): HTMLDivElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  let menu = getCpuLevelMenu();
  if (!menu) {
    menu = document.createElement('div');
    menu.id = CPU_LEVEL_MENU_ID;
    menu.hidden = true;
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-modal', 'true');
    menu.setAttribute('aria-label', 'CPU・盤面・ルール設定');
    menu.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    document.body.appendChild(menu);
  }

  clearCpuLevelMenuChildren(menu);
  const tabs = document.createElement('div');
  tabs.className = 'cpu-config-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'CPU・盤面・ルール設定');
  tabs.appendChild(createCpuConfigTab(menu, 'CPU選択', 'cpu'));
  tabs.appendChild(createCpuConfigTab(menu, '盤面・ルール設定', 'board'));
  menu.appendChild(tabs);

  const cpuPanel = document.createElement('div');
  cpuPanel.className = 'cpu-config-panel cpu-level-list-panel';
  cpuPanel.dataset.cpuConfigPanel = 'cpu';
  cpuPanel.setAttribute('role', 'tabpanel');
  CPU_LEVEL_OPTIONS.forEach((opt) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = getCpuLevelMenuItemClasses(opt.v).join(' ');
    item.dataset.cpuLevel = opt.v;
    item.textContent = opt.t;
    item.setAttribute('role', 'menuitemradio');
    item.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      smartWhite.value = opt.v;
      dispatchSelectChange(smartWhite);
    });
    cpuPanel.appendChild(item);
  });
  menu.appendChild(cpuPanel);
  menu.appendChild(createCpuBoardPanel(menu, smartWhite));

  const summary = document.createElement('div');
  summary.className = 'cpu-config-summary';
  const summaryLabel = document.createElement('span');
  summaryLabel.className = 'cpu-config-summary-label';
  summaryLabel.textContent = '選択中';
  const summaryValue = document.createElement('strong');
  summaryValue.className = 'cpu-config-summary-value';
  summary.appendChild(summaryLabel);
  summary.appendChild(summaryValue);
  menu.appendChild(summary);

  syncCpuLevelMenuSelection(menu, smartWhite.value || localCpuLevels.white);
  syncCpuBoardConfigControls(menu, smartWhite.value || localCpuLevels.white);
  return menu;
}

function bindCpuLevelDismissHandlers(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const root = window as Window & { __cpuLevelMenuDismissBound?: boolean };
  if (root.__cpuLevelMenuDismissBound) return;

  document.addEventListener('click', (event) => {
    const menu = getCpuLevelMenu();
    const shortcut = getCpuLevelShortcutButton();
    if (!menu || menu.hidden) return;
    const target = event.target;
    const nodeCtor = (typeof window !== 'undefined' && window.Node) ? window.Node : null;
    if (nodeCtor && target instanceof nodeCtor) {
      if (menu.contains(target)) return;
      if (shortcut && shortcut.contains(target)) return;
      const cpuModeButton = document.getElementById(CPU_MODE_BUTTON_ID);
      if (cpuModeButton && cpuModeButton.contains(target)) return;
    }
    hideCpuLevelMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideCpuLevelMenu();
    }
  });

  root.__cpuLevelMenuDismissBound = true;
}

function observeCpuLevelShortcutState(): void {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;
  const shortcut = getCpuLevelShortcutButton();
  if (!shortcut || shortcut.dataset.cpuLevelObserverBound === '1') return;

  const observer = new MutationObserver(() => {
    if (shortcut.disabled || shortcut.getAttribute('aria-disabled') === 'true') {
      hideCpuLevelMenu();
    }
  });
  observer.observe(shortcut, {
    attributes: true,
    attributeFilter: ['disabled', 'aria-disabled']
  });
  shortcut.dataset.cpuLevelObserverBound = '1';
}

function bindCpuLevelShortcut(smartWhite: HTMLSelectElement | null): void {
  const shortcut = getCpuLevelShortcutButton();
  if (smartWhite) boundCpuMenuSmartWhite = smartWhite;
  if (!shortcut || !smartWhite || shortcut.dataset.cpuLevelShortcutBound === '1') return;
  shortcut.setAttribute('aria-haspopup', 'dialog');
  shortcut.setAttribute('aria-expanded', 'false');
  bindCpuLevelDismissHandlers();
  observeCpuLevelShortcutState();
  shortcut.addEventListener('click', () => {
    if (shortcut.disabled) {
      hideCpuLevelMenu();
      return;
    }

    toggleCpuConfigMenu('cpu');
  });
  shortcut.addEventListener('wheel', (event) => {
    if (shortcut.disabled || shortcut.getAttribute('aria-disabled') === 'true'
      || smartWhite.disabled || event.ctrlKey || !event.deltaY) return;

    // 一覧と同じプロフィール順で増減し、固有名を持つLv7以降も通常の変更経路に渡す。
    const currentIndex = CPU_LEVEL_OPTIONS.findIndex((option) => option.v === smartWhite.value);
    if (currentIndex < 0) return;
    const nextIndex = Math.max(0, Math.min(
      CPU_LEVEL_OPTIONS.length - 1,
      currentIndex + (event.deltaY < 0 ? 1 : -1)
    ));
    event.preventDefault();
    if (nextIndex === currentIndex) return;
    smartWhite.value = CPU_LEVEL_OPTIONS[nextIndex].v;
    dispatchSelectChange(smartWhite);
  }, { passive: false });
  shortcut.dataset.cpuLevelShortcutBound = '1';
}

function showCpuConfigMenu(tabName: CpuConfigTabName): boolean {
  const smartWhite = boundCpuMenuSmartWhite;
  const shortcut = getCpuLevelShortcutButton();
  if (!smartWhite || (shortcut && shortcut.disabled)) return false;
  bindCpuLevelDismissHandlers();
  const menu = ensureCpuLevelMenu(smartWhite);
  if (!menu) return false;
  const backdrop = ensureCpuLevelMenuBackdrop();
  setCpuConfigMenuTab(menu, tabName);
  centerCpuLevelMenu(menu);
  if (backdrop) backdrop.hidden = false;
  menu.hidden = false;
  setCpuLevelShortcutExpanded(true);
  return true;
}

// CPU名ラベル、または CPU 対戦中の CPU ボタンから開く。開いている時は閉じる。
function toggleCpuConfigMenu(tabName: CpuConfigTabName): boolean {
  const existingMenu = getCpuLevelMenu();
  if (existingMenu && !existingMenu.hidden) {
    hideCpuLevelMenu();
    return false;
  }
  return showCpuConfigMenu(tabName);
}

function syncRuntimeCpuLevel(playerKey: 'black' | 'white', level: number): void {
  try {
    if (typeof globalThis === 'undefined') return;
    const root = globalThis as typeof globalThis & { cpuSmartness?: Record<string, number> };
    if (!root.cpuSmartness || typeof root.cpuSmartness !== 'object') {
      root.cpuSmartness = { black: 1, white: 1 };
    }
    root.cpuSmartness[playerKey] = clampCpuLevel(level);
  } catch (e) {
    // UI select remains the source of truth; legacy global sync is best-effort.
  }
}

function resolveSmartRuntimeRoot(): any {
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined') return globalThis;
  return null;
}

function readCurrentMatchModeForSmartReset(root: any): string {
  try {
    if (root && typeof root.getCurrentMatchMode === 'function') {
      return String(root.getCurrentMatchMode() || '').trim();
    }
  } catch (e) { /* ignore */ }
  try {
    return String((root && (root.MATCH_MODE || root.__MATCH_MODE)) || '').trim();
  } catch (e) { /* ignore */ }
  return 'cpu';
}

function readOpeningTurnNumberForSmartReset(root: any): number | null {
  try {
    const gameStateRef = root && root.gameState && typeof root.gameState === 'object'
      ? root.gameState
      : ((typeof globalThis !== 'undefined' && (globalThis as any).gameState && typeof (globalThis as any).gameState === 'object')
        ? (globalThis as any).gameState
        : null);
    const turnNumber = Number(gameStateRef && gameStateRef.turnNumber);
    return Number.isFinite(turnNumber) ? Math.max(0, Math.floor(turnNumber)) : null;
  } catch (e) { /* ignore */ }
  return null;
}

function maybeResetOpeningCpuGameForProfileChange(playerKey: 'black' | 'white', profileValue: unknown): void {
  const root = resolveSmartRuntimeRoot();
  const previousProfileValue = localCpuProfileValues[playerKey];
  localCpuProfileValues[playerKey] = String(profileValue || '');
  if (!root) return;
  const matchMode = readCurrentMatchModeForSmartReset(root);
  const turnNumber = readOpeningTurnNumberForSmartReset(root);
  if (!CpuOpponentStartupOptions
    || typeof CpuOpponentStartupOptions.shouldResetOpeningCpuProfileChange !== 'function'
    || !CpuOpponentStartupOptions.shouldResetOpeningCpuProfileChange({
      matchMode,
      turnNumber,
      previousProfileValue,
      nextProfileValue: profileValue
    })) {
    return;
  }

  const resetFn = typeof root.resetGame === 'function'
    ? root.resetGame
    : ((typeof globalThis !== 'undefined' && typeof (globalThis as any).resetGame === 'function')
      ? (globalThis as any).resetGame
      : null);
  if (typeof resetFn !== 'function') return;
  resetFn({ source: 'cpu_profile_change', skipNetworkPublish: true });
}

function setupSmartSelects(smartBlack: HTMLSelectElement | null, smartWhite: HTMLSelectElement | null): void {
  const storedProfiles=CpuProfileSelection.readStoredCpuProfiles();
  if (smartBlack) {
    CPU_LEVEL_OPTIONS.forEach(opt => {
      const el = document.createElement('option');
      el.value = opt.v;
      el.textContent = opt.t;
      smartBlack.appendChild(el);
    });
    localCpuLevels.black = clampCpuLevel(storedProfiles.black || localCpuLevels.black || 1);
    syncRuntimeCpuLevel('black', localCpuLevels.black);
    smartBlack.value = storedProfiles.black || String(localCpuLevels.black);
    localCpuProfileValues.black = smartBlack.value;
    smartBlack.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      const selectedValue = target.value;
      const newLevel = clampCpuLevel(selectedValue);
      localCpuLevels.black = newLevel;
      syncRuntimeCpuLevel('black', newLevel);
      target.value = selectedValue || String(newLevel);
      CpuProfileSelection.writeStoredCpuProfile('black',target.value);
      console.log(`[CPU Level] Black changed to level ${localCpuLevels.black}`);
      if (typeof updateCpuCharacter === 'function') {
        updateCpuCharacter();
      }
      maybeResetOpeningCpuGameForProfileChange('black', selectedValue);
      // Reload policy if MCCFR is available
      if (newLevel !== 10 && typeof CpuPolicy !== 'undefined' && CpuPolicy && CpuPolicy.loadPolicyForLevel) {
        try {
          mccfrPolicy = await CpuPolicy.loadPolicyForLevel(localCpuLevels.black);
          if (typeof addLog === 'function') {
            addLog(`黒レベル ${localCpuLevels.black} のポリシーを読み込みました`);
          }
        } catch (err) {
          console.warn('Policy reload failed:', err);
        }
      }
    });
  }

  if (smartWhite) {
    CPU_LEVEL_OPTIONS.forEach(opt => {
      const el = document.createElement('option');
      el.value = opt.v;
      el.textContent = opt.t;
      smartWhite.appendChild(el);
    });
    localCpuLevels.white = clampCpuLevel(storedProfiles.white || localCpuLevels.white || 1);
    syncRuntimeCpuLevel('white', localCpuLevels.white);
    smartWhite.value = storedProfiles.white || String(localCpuLevels.white);
    localCpuProfileValues.white = smartWhite.value;
    bindCpuLevelShortcut(smartWhite);
    smartWhite.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      const selectedValue = target.value;
      const newLevel = clampCpuLevel(selectedValue);
      localCpuLevels.white = newLevel;
      syncRuntimeCpuLevel('white', newLevel);
      target.value = selectedValue || String(newLevel);
      CpuProfileSelection.writeStoredCpuProfile('white',target.value);
      const menu = getCpuLevelMenu();
      if (menu) {
        syncCpuLevelMenuSelection(menu, target.value || newLevel);
        syncCpuConfigMenuSummary(menu, target.value || newLevel);
      }
      console.log(`[CPU Level] White changed to level ${localCpuLevels.white}`);
      if (typeof updateCpuCharacter === 'function') {
        updateCpuCharacter();
      }
      maybeResetOpeningCpuGameForProfileChange('white', selectedValue);
      // Reload policy for new level
      if (newLevel !== 10 && typeof CpuPolicy !== 'undefined' && CpuPolicy && CpuPolicy.loadPolicyForLevel) {
        try {
          mccfrPolicy = await CpuPolicy.loadPolicyForLevel(localCpuLevels.white);
          if (typeof addLog === 'function') {
            addLog(`レベル ${localCpuLevels.white} のポリシーを読み込みました`);
          }
        } catch (err) {
          console.warn('Policy reload failed:', err);
        }
      }
    });
  }
}

if (typeof window !== 'undefined') {
  (window as Window & { setupSmartSelects?: typeof setupSmartSelects }).setupSmartSelects = setupSmartSelects;
  (window as Window & { toggleCpuConfigMenu?: typeof toggleCpuConfigMenu }).toggleCpuConfigMenu = toggleCpuConfigMenu;
}

export = {
  setupSmartSelects,
  toggleCpuConfigMenu
};
