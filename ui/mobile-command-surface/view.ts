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
  quickTrigger: HTMLButtonElement;
  backdrop: HTMLElement;
  drawer: HTMLElement;
  drawerClose: HTMLButtonElement;
  menuButtons: readonly HTMLButtonElement[];
  quickSheet: HTMLElement;
  quickClose: HTMLButtonElement;
  quickButtonProxies: readonly HTMLButtonElement[];
  quickSelect: HTMLSelectElement | null;
  quickRange: HTMLInputElement | null;
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
  const menuTriggerIcon = make('span', 'mobile-command-menu-trigger-icon');
  menuTriggerIcon.setAttribute('aria-hidden', 'true');
  const menuTriggerLabel = make('span', 'mobile-command-trigger-label');
  menuTriggerLabel.textContent = 'メニュー';
  menuTrigger.append(menuTriggerIcon, menuTriggerLabel);

  const quickTrigger = make('button', 'mobile-command-trigger mobile-command-quick-trigger');
  quickTrigger.id = 'mobile-command-quick-trigger';
  quickTrigger.type = 'button';
  quickTrigger.setAttribute('aria-haspopup', 'dialog');
  quickTrigger.setAttribute('aria-controls', 'mobile-command-quick-sheet');
  quickTrigger.setAttribute('aria-expanded', 'false');
  quickTrigger.setAttribute('aria-label', '操作を開く');
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
  root.append(menuTrigger, quickTrigger, backdrop, drawer, quickSheet);
  documentRef.body.appendChild(root);

  return {
    root,
    menuTrigger,
    quickTrigger,
    backdrop,
    drawer,
    drawerClose,
    menuButtons,
    quickSheet,
    quickClose,
    quickButtonProxies,
    quickSelect,
    quickRange,
    destroy(): void {
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
