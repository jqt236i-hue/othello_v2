type MobileCommandLayer = 'drawer' | 'status' | 'quick';

type MobileMenuGroupId = 'game' | 'collection' | 'information' | 'settings';

type MobileCommandTone =
  | 'emerald'
  | 'azure'
  | 'gold'
  | 'ember'
  | 'violet'
  | 'rose'
  | 'sage'
  | 'danger';

interface MobileActionCommandSpec {
  kind: 'action';
  id: string;
  label: string;
  group: MobileMenuGroupId;
  triggerId: string;
  tone: MobileCommandTone;
}

interface MobileExistingHeaderChromeSpec {
  kind: 'existing';
  headerElementId: string;
}

interface MobileInjectedHeaderChromeSpec {
  kind: 'inject';
  headerElementId: string;
  containerElementId: string;
}

interface MobilePanelCommandSpec {
  kind: 'panel';
  id: string;
  label: string;
  panelLabel: string;
  group: MobileMenuGroupId;
  triggerId: string;
  panelElementId: string;
  closeButtonId: string;
  chrome: MobileExistingHeaderChromeSpec | MobileInjectedHeaderChromeSpec;
  tone: MobileCommandTone;
}

type MobileCommandSpec = MobileActionCommandSpec | MobilePanelCommandSpec;

const MOBILE_MENU_GROUP_LABELS: Readonly<Record<MobileMenuGroupId, string>> = {
  game: 'ゲーム',
  collection: 'コレクション',
  information: '情報',
  settings: '設定',
};

const MOBILE_COMMANDS = [
  {
    kind: 'action',
    id: 'cpu',
    label: 'CPU',
    group: 'game',
    triggerId: 'modeCpuBtn',
    tone: 'emerald',
  },
  {
    kind: 'panel',
    id: 'network',
    label: 'ネット対戦',
    panelLabel: 'ネット対戦',
    group: 'game',
    triggerId: 'modeNetworkBtn',
    panelElementId: 'networkOverlay',
    closeButtonId: 'networkCloseBtn',
    chrome: { kind: 'existing', headerElementId: 'networkModalHeader' },
    tone: 'azure',
  },
  {
    kind: 'action',
    id: 'action',
    label: '並行世界を観測',
    group: 'game',
    triggerId: 'parallelWorldsOpenBtn',
    tone: 'ember',
  },
  {
    kind: 'action',
    id: 'forestPlaza',
    label: '森の広場',
    group: 'game',
    triggerId: 'forestPlazaOpenBtn',
    tone: 'sage',
  },
  {
    kind: 'panel',
    id: 'deck',
    label: 'デッキ',
    panelLabel: 'デッキ構築',
    group: 'collection',
    triggerId: 'deckBuilderOpenBtn',
    panelElementId: 'deckBuilderOverlay',
    closeButtonId: 'deckBuilderCloseBtn',
    chrome: { kind: 'existing', headerElementId: 'deckBuilderModalHeader' },
    tone: 'azure',
  },
  {
    kind: 'panel',
    id: 'gacha',
    label: 'ガチャ',
    panelLabel: 'ガチャ',
    group: 'collection',
    triggerId: 'gachaOpenBtn',
    panelElementId: 'gachaOverlay',
    closeButtonId: 'gachaCloseBtn',
    chrome: { kind: 'existing', headerElementId: 'gachaModalHeader' },
    tone: 'ember',
  },
  {
    kind: 'panel',
    id: 'appearance',
    label: '見た目設定',
    panelLabel: '見た目設定',
    group: 'collection',
    triggerId: 'handSkinBtn',
    panelElementId: 'handSkinPanel',
    closeButtonId: 'handSkinCloseBtn',
    chrome: { kind: 'existing', headerElementId: 'handSkinPanelHeader' },
    tone: 'violet',
  },
  {
    kind: 'panel',
    id: 'ranking',
    label: 'ランキング',
    panelLabel: 'ランキング',
    group: 'information',
    triggerId: 'leaderboardOpenBtn',
    panelElementId: 'leaderboardOverlay',
    closeButtonId: 'leaderboardCloseBtn',
    chrome: { kind: 'existing', headerElementId: 'leaderboardModalHeader' },
    tone: 'gold',
  },
  {
    kind: 'panel',
    id: 'profile',
    label: 'プロフィール',
    panelLabel: 'プロフィール',
    group: 'information',
    triggerId: 'profileOpenBtn',
    panelElementId: 'profileOverlay',
    closeButtonId: 'profileCloseBtn',
    chrome: { kind: 'existing', headerElementId: 'profileModalHeader' },
    tone: 'rose',
  },
  {
    kind: 'panel',
    id: 'help',
    label: 'ヘルプ',
    panelLabel: 'ヘルプ',
    group: 'information',
    triggerId: 'rulesHelpBtn',
    panelElementId: 'rules-help-panel',
    closeButtonId: 'rules-help-close-btn',
    chrome: { kind: 'existing', headerElementId: 'rules-help-title-row' },
    tone: 'sage',
  },
  {
    kind: 'panel',
    id: 'settings',
    label: '設定',
    panelLabel: '設定',
    group: 'settings',
    triggerId: 'sidePanelToggleBtn',
    panelElementId: 'side-panel',
    closeButtonId: 'sidePanelToggleBtn',
    chrome: {
      kind: 'inject',
      headerElementId: 'mobile-command-settings-header',
      containerElementId: 'control-panel',
    },
    tone: 'sage',
  },
] as const satisfies readonly MobileCommandSpec[];

type MobileCommandDefinition = (typeof MOBILE_COMMANDS)[number];
type MobilePanelCommandDefinition = Extract<MobileCommandDefinition, { kind: 'panel' }>;
type MobileNativePanelId = MobilePanelCommandDefinition['id'];

const MOBILE_PANEL_COMMANDS = MOBILE_COMMANDS.filter(
  (command): command is MobilePanelCommandDefinition => command.kind === 'panel',
);

const MOBILE_COMMAND_BY_ID = new Map<string, MobileCommandDefinition>(
  MOBILE_COMMANDS.map((command) => [command.id, command]),
);

const MOBILE_PANEL_COMMAND_BY_ID = new Map<MobileNativePanelId, MobilePanelCommandDefinition>(
  MOBILE_PANEL_COMMANDS.map((command) => [command.id, command]),
);

function getMobileCommand(id: string): MobileCommandDefinition | null {
  return MOBILE_COMMAND_BY_ID.get(id) || null;
}

function getMobilePanelCommand(panelId: MobileNativePanelId): MobilePanelCommandDefinition {
  const command = MOBILE_PANEL_COMMAND_BY_ID.get(panelId);
  if (!command) throw new Error(`Unknown mobile panel: ${panelId}`);
  return command;
}

interface MobileQuickButtonSpec {
  kind: 'button';
  sourceId: string;
  confirm: 'local-reset' | null;
  tone: MobileCommandTone;
}

interface MobileQuickSelectSpec {
  kind: 'select';
  sourceId: string;
  proxyId: string;
  ariaLabel: string;
}

interface MobileQuickRangeSpec {
  kind: 'range';
  sourceId: string;
  proxyId: string;
  label: string;
}

type MobileQuickControlSpec =
  | MobileQuickButtonSpec
  | MobileQuickSelectSpec
  | MobileQuickRangeSpec;

const MOBILE_QUICK_CONTROLS = [
  { kind: 'button', sourceId: 'resetBtn', confirm: 'local-reset', tone: 'danger' },
  { kind: 'button', sourceId: 'quickBgmToggleBtn', confirm: null, tone: 'azure' },
  { kind: 'button', sourceId: 'autoToggleBtn', confirm: null, tone: 'gold' },
  { kind: 'button', sourceId: 'muteBtn', confirm: null, tone: 'azure' },
  {
    kind: 'select',
    sourceId: 'bgmTrackSelect',
    proxyId: 'mobile-command-bgm-select',
    ariaLabel: 'BGM選択',
  },
  {
    kind: 'range',
    sourceId: 'seVolSlider',
    proxyId: 'mobile-command-volume-slider',
    label: '全体音量',
  },
] as const satisfies readonly MobileQuickControlSpec[];

type MobileQuickControlDefinition = (typeof MOBILE_QUICK_CONTROLS)[number];
type MobileQuickButtonDefinition = Extract<MobileQuickControlDefinition, { kind: 'button' }>;
type MobileQuickSelectDefinition = Extract<MobileQuickControlDefinition, { kind: 'select' }>;
type MobileQuickRangeDefinition = Extract<MobileQuickControlDefinition, { kind: 'range' }>;

export {
  MOBILE_COMMANDS,
  MOBILE_MENU_GROUP_LABELS,
  MOBILE_PANEL_COMMANDS,
  MOBILE_QUICK_CONTROLS,
  getMobileCommand,
  getMobilePanelCommand,
};

export type {
  MobileCommandDefinition,
  MobileCommandLayer,
  MobileCommandTone,
  MobileMenuGroupId,
  MobileNativePanelId,
  MobilePanelCommandDefinition,
  MobileQuickButtonDefinition,
  MobileQuickControlDefinition,
  MobileQuickRangeDefinition,
  MobileQuickSelectDefinition,
};
