import {
  MOBILE_COMMANDS,
  MOBILE_MENU_GROUP_LABELS,
  MOBILE_QUICK_CONTROLS,
} from './config';
import type {
  MobileCommandDefinition,
  MobileMenuGroupId,
  MobileQuickRangeDefinition,
  MobileQuickSelectDefinition,
} from './config';

interface MobileCommandSurfaceView {
  root: HTMLElement;
  menuTrigger: HTMLButtonElement;
  statusTrigger: HTMLButtonElement;
  quickTrigger: HTMLButtonElement;
  backdrop: HTMLElement;
  drawer: HTMLElement;
  drawerClose: HTMLButtonElement;
  menuButtons: readonly HTMLButtonElement[];
  statusPanel: HTMLElement;
  statusClose: HTMLButtonElement;
  statusContent: HTMLElement;
  quickSheet: HTMLElement;
  quickClose: HTMLButtonElement;
  quickButtonProxies: readonly HTMLButtonElement[];
  quickSelect: HTMLSelectElement | null;
  quickRange: HTMLInputElement | null;
  opponentAvatarButton: HTMLButtonElement | null;
  opponentAvatarImage: HTMLImageElement | null;
  destroy(): void;
}

function createMobileCommandSurfaceView(
  rootRef: Window,
  documentRef: Document,
): MobileCommandSurfaceView {
  const byId = <T extends HTMLElement>(id: string): T | null => (
    documentRef.getElementById(id) as T | null
  );

  const make = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
  ): HTMLElementTagNameMap[K] => {
    const element = documentRef.createElement(tag);
    if (className) element.className = className;
    return element;
  };

  const root = make('div', 'mobile-command-surface');
  root.id = 'mobile-command-surface';
  root.setAttribute('aria-label', 'スマホ用操作');

  const menuTrigger = make('button', 'mobile-command-trigger mobile-command-menu-trigger');
  menuTrigger.id = 'mobile-command-menu-trigger';
  menuTrigger.type = 'button';
  menuTrigger.setAttribute('aria-haspopup', 'dialog');
  menuTrigger.setAttribute('aria-controls', 'mobile-command-drawer');
  menuTrigger.setAttribute('aria-expanded', 'false');
  menuTrigger.setAttribute('aria-label', 'メニューを開く');
  menuTrigger.dataset.mobileTone = 'gold';
  const menuTriggerIcon = make('span', 'mobile-command-menu-trigger-icon');
  menuTriggerIcon.setAttribute('aria-hidden', 'true');
  const menuTriggerLabel = make('span', 'mobile-command-trigger-label');
  menuTriggerLabel.textContent = 'メニュー';
  menuTrigger.append(menuTriggerIcon, menuTriggerLabel);

  const statusTrigger = make('button', 'mobile-command-trigger mobile-command-status-trigger');
  statusTrigger.id = 'mobile-command-status-trigger';
  statusTrigger.type = 'button';
  statusTrigger.setAttribute('aria-haspopup', 'dialog');
  statusTrigger.setAttribute('aria-controls', 'mobile-command-status-panel');
  statusTrigger.setAttribute('aria-expanded', 'false');
  statusTrigger.setAttribute('aria-label', '戦況を開く');
  statusTrigger.dataset.mobileTone = 'emerald';
  statusTrigger.textContent = '戦況';

  const quickTrigger = make('button', 'mobile-command-trigger mobile-command-quick-trigger');
  quickTrigger.id = 'mobile-command-quick-trigger';
  quickTrigger.type = 'button';
  quickTrigger.setAttribute('aria-haspopup', 'dialog');
  quickTrigger.setAttribute('aria-controls', 'mobile-command-quick-sheet');
  quickTrigger.setAttribute('aria-expanded', 'false');
  quickTrigger.setAttribute('aria-label', '操作を開く');
  quickTrigger.dataset.mobileTone = 'violet';
  quickTrigger.textContent = '操作';

  const backdrop = make('div', 'mobile-command-backdrop');
  backdrop.id = 'mobile-command-backdrop';
  backdrop.hidden = true;
  backdrop.setAttribute('aria-hidden', 'true');

  const drawer = make('aside', 'mobile-command-drawer');
  drawer.id = 'mobile-command-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-labelledby', 'mobile-command-drawer-title');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.setAttribute('inert', '');

  const drawerHeader = make('div', 'mobile-command-layer-header');
  const drawerHeading = make('div');
  const drawerTitle = make('h2', 'mobile-command-layer-title');
  drawerTitle.id = 'mobile-command-drawer-title';
  drawerTitle.textContent = 'メニュー';
  const drawerSubtitle = make('p', 'mobile-command-layer-subtitle');
  drawerSubtitle.textContent = 'ゲームの入口を選択してください';
  drawerHeading.append(drawerTitle, drawerSubtitle);
  const drawerClose = make('button', 'mobile-command-layer-close');
  drawerClose.id = 'mobile-command-drawer-close';
  drawerClose.type = 'button';
  drawerClose.setAttribute('aria-label', 'メニューを閉じる');
  drawerClose.textContent = '×';
  drawerHeader.append(drawerHeading, drawerClose);

  const menuNav = make('nav', 'mobile-command-menu-nav');
  menuNav.setAttribute('aria-label', 'ゲームメニュー');
  const menuButtons: HTMLButtonElement[] = [];

  const copyMenuIcon = (source: HTMLElement): HTMLElement | null => {
    const sourceIcon = source.querySelector<HTMLElement>('.left-action-icon');
    if (!sourceIcon) return null;
    const icon = sourceIcon.cloneNode(true) as HTMLElement;
    icon.removeAttribute('id');
    icon.classList.add('mobile-command-menu-icon');
    try {
      const mask = rootRef.getComputedStyle(sourceIcon).getPropertyValue('--left-action-icon-mask');
      if (mask.trim()) icon.style.setProperty('--left-action-icon-mask', mask.trim());
    } catch (_error) {
      // The text label remains the accessible and visible fallback.
    }
    return icon;
  };

  const groupIds = Object.keys(MOBILE_MENU_GROUP_LABELS) as MobileMenuGroupId[];
  groupIds.forEach((groupId) => {
    const availableCommands = MOBILE_COMMANDS.filter((command) => (
      command.group === groupId && byId(command.triggerId)
    ));
    if (availableCommands.length === 0) return;

    const section = make('section', 'mobile-command-menu-group');
    const heading = make('h3', 'mobile-command-menu-group-title');
    heading.id = `mobile-command-group-${groupId}`;
    heading.textContent = MOBILE_MENU_GROUP_LABELS[groupId];
    section.setAttribute('aria-labelledby', heading.id);
    section.appendChild(heading);

    availableCommands.forEach((command: MobileCommandDefinition) => {
      const source = byId(command.triggerId);
      if (!source) return;
      const button = make('button', 'mobile-command-menu-item');
      button.id = `mobile-command-menu-${command.id}`;
      button.type = 'button';
      button.dataset.mobileCommand = command.id;
      button.dataset.mobileTone = command.tone;
      button.setAttribute('aria-label', command.label);

      const icon = copyMenuIcon(source);
      if (icon) button.appendChild(icon);
      const label = make('span', 'mobile-command-menu-label');
      label.textContent = command.label;
      const chevron = make('span', 'mobile-command-menu-chevron');
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '›';
      button.append(label, chevron);
      section.appendChild(button);
      menuButtons.push(button);
    });
    menuNav.appendChild(section);
  });
  drawer.append(drawerHeader, menuNav);

  const statusPanel = make('section', 'mobile-command-status-panel');
  statusPanel.id = 'mobile-command-status-panel';
  statusPanel.setAttribute('role', 'dialog');
  statusPanel.setAttribute('aria-modal', 'true');
  statusPanel.setAttribute('aria-labelledby', 'mobile-command-status-title');
  statusPanel.setAttribute('aria-hidden', 'true');
  statusPanel.setAttribute('inert', '');

  const statusHeader = make('div', 'mobile-command-layer-header');
  const statusHeading = make('div');
  const statusTitle = make('h2', 'mobile-command-layer-title');
  statusTitle.id = 'mobile-command-status-title';
  statusTitle.textContent = '戦況';
  const statusSubtitle = make('p', 'mobile-command-layer-subtitle');
  statusSubtitle.textContent = '使用カードと盤上の石';
  statusHeading.append(statusTitle, statusSubtitle);
  const statusClose = make('button', 'mobile-command-layer-close');
  statusClose.id = 'mobile-command-status-close';
  statusClose.type = 'button';
  statusClose.setAttribute('aria-label', '戦況を閉じる');
  statusClose.textContent = '×';
  statusHeader.append(statusHeading, statusClose);

  const statusContent = make('div', 'mobile-command-status-content');
  statusContent.id = 'mobile-command-status-content';
  statusPanel.append(statusHeader, statusContent);

  const quickSheet = make('section', 'mobile-command-quick-sheet');
  quickSheet.id = 'mobile-command-quick-sheet';
  quickSheet.setAttribute('role', 'dialog');
  quickSheet.setAttribute('aria-modal', 'true');
  quickSheet.setAttribute('aria-labelledby', 'mobile-command-quick-title');
  quickSheet.setAttribute('aria-hidden', 'true');
  quickSheet.setAttribute('inert', '');

  const quickHeader = make('div', 'mobile-command-layer-header');
  const quickHeading = make('div');
  const quickTitle = make('h2', 'mobile-command-layer-title');
  quickTitle.id = 'mobile-command-quick-title';
  quickTitle.textContent = '操作';
  const quickSubtitle = make('p', 'mobile-command-layer-subtitle');
  quickSubtitle.textContent = '対局中の操作と音量設定';
  quickHeading.append(quickTitle, quickSubtitle);
  const quickClose = make('button', 'mobile-command-layer-close');
  quickClose.id = 'mobile-command-quick-close';
  quickClose.type = 'button';
  quickClose.setAttribute('aria-label', '操作を閉じる');
  quickClose.textContent = '×';
  quickHeader.append(quickHeading, quickClose);

  const quickGrid = make('div', 'mobile-command-quick-grid');
  const quickButtonProxies: HTMLButtonElement[] = [];
  MOBILE_QUICK_CONTROLS.forEach((definition) => {
    if (definition.kind !== 'button') return;
    const source = byId<HTMLButtonElement>(definition.sourceId);
    if (!source) return;
    const button = make('button', 'mobile-command-quick-action');
    button.type = 'button';
    button.dataset.mobileProxy = definition.sourceId;
    button.dataset.mobileTone = definition.tone;
    button.textContent = source.textContent?.trim()
      || source.getAttribute('aria-label')
      || definition.sourceId;
    quickGrid.appendChild(button);
    quickButtonProxies.push(button);
  });

  const selectDefinition = MOBILE_QUICK_CONTROLS.find(
    (definition): definition is MobileQuickSelectDefinition => definition.kind === 'select',
  );
  const sourceSelect = selectDefinition
    ? byId<HTMLSelectElement>(selectDefinition.sourceId)
    : null;
  let quickSelect: HTMLSelectElement | null = null;
  if (sourceSelect && selectDefinition) {
    quickSelect = make('select', 'mobile-command-bgm-select');
    quickSelect.id = selectDefinition.proxyId;
    quickSelect.setAttribute('aria-label', selectDefinition.ariaLabel);
    quickGrid.appendChild(quickSelect);
  }

  const rangeDefinition = MOBILE_QUICK_CONTROLS.find(
    (definition): definition is MobileQuickRangeDefinition => definition.kind === 'range',
  );
  const sourceRange = rangeDefinition
    ? byId<HTMLInputElement>(rangeDefinition.sourceId)
    : null;
  let quickRange: HTMLInputElement | null = null;
  if (sourceRange && rangeDefinition) {
    const rangeLabel = make('label', 'mobile-command-volume');
    rangeLabel.htmlFor = rangeDefinition.proxyId;
    const label = make('span');
    label.textContent = rangeDefinition.label;
    quickRange = make('input');
    quickRange.id = rangeDefinition.proxyId;
    quickRange.type = 'range';
    quickRange.min = sourceRange.min;
    quickRange.max = sourceRange.max;
    quickRange.step = sourceRange.step;
    quickRange.value = sourceRange.value;
    rangeLabel.append(label, quickRange);
    quickGrid.appendChild(rangeLabel);
  }

  const quickNote = make('p', 'mobile-command-sheet-note');
  quickNote.textContent = '設定値はゲーム本体の操作と同期します。';
  quickSheet.append(quickHeader, quickGrid, quickNote);
  root.append(
    menuTrigger,
    statusTrigger,
    quickTrigger,
    backdrop,
    drawer,
    statusPanel,
    quickSheet,
  );
  documentRef.body.appendChild(root);

  const opponentArea = documentRef.querySelector<HTMLElement>('.player-area-top');
  const opponentSourceImage = byId<HTMLImageElement>('cpu-character-img');
  let opponentAvatarButton: HTMLButtonElement | null = null;
  let opponentAvatarImage: HTMLImageElement | null = null;
  if (opponentArea && opponentSourceImage) {
    opponentAvatarButton = make('button', 'mobile-command-opponent-avatar');
    opponentAvatarButton.id = 'mobile-command-opponent-avatar';
    opponentAvatarButton.type = 'button';
    opponentAvatarButton.setAttribute('aria-label', '敵キャラクター');
    opponentAvatarImage = make('img', 'mobile-command-opponent-avatar-image');
    opponentAvatarImage.id = 'mobile-command-opponent-avatar-image';
    opponentAvatarImage.alt = '';
    opponentAvatarImage.setAttribute('aria-hidden', 'true');
    opponentAvatarButton.appendChild(opponentAvatarImage);
    opponentArea.appendChild(opponentAvatarButton);
  }

  return {
    root,
    menuTrigger,
    statusTrigger,
    quickTrigger,
    backdrop,
    drawer,
    drawerClose,
    menuButtons,
    statusPanel,
    statusClose,
    statusContent,
    quickSheet,
    quickClose,
    quickButtonProxies,
    quickSelect,
    quickRange,
    opponentAvatarButton,
    opponentAvatarImage,
    destroy(): void {
      opponentAvatarButton?.remove();
      root.remove();
    },
  };
}

export {
  createMobileCommandSurfaceView,
};

export type {
  MobileCommandSurfaceView,
};
