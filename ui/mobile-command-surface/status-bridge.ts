import type {
  MobileCommandSurfaceView,
} from './view';

interface MobileStatusBridgeOptions {
  root: Window;
  document: Document;
  view: MobileCommandSurfaceView;
}

interface MobileStatusBridgeController {
  setOpen(open: boolean): void;
  sync(): void;
  destroy(): void;
}

interface MobileStatusNodeHome {
  node: HTMLElement;
  parent: Node;
  nextSibling: Node | null;
}

const STATUS_PANEL_IDS = [
  'manifest-effect-panel',
  'stone-info-panel',
] as const;

const CPU_FACE_ASSET_PREFIX = 'assets/images/cpu/face/level';
const PHONE_PROFILE = 'layout-profile-phone-portrait';

function createMobileStatusBridge(
  options: MobileStatusBridgeOptions,
): MobileStatusBridgeController {
  const { root, document: documentRef, view } = options;
  const sourceImage = documentRef.getElementById('cpu-character-img') as HTMLImageElement | null;
  const sourceLabel = documentRef.getElementById('cpu-level-label') as HTMLElement | null;
  const avatarButton = view.opponentAvatarButton;
  const avatarImage = view.opponentAvatarImage;
  let statusNodeHomes: MobileStatusNodeHome[] = [];
  let battleStatusNodeHome: MobileStatusNodeHome | null = null;
  let statusOpen = false;
  let destroyed = false;

  const isPhonePortrait = (): boolean => {
    const html = documentRef.documentElement;
    return html.classList.contains(PHONE_PROFILE)
      || html.getAttribute('data-layout-profile') === PHONE_PROFILE;
  };

  const currentSourceImagePath = (): string => {
    if (!sourceImage) return '';
    return sourceImage.getAttribute('data-card-reversi-logical-src')
      || sourceImage.getAttribute('src')
      || sourceImage.currentSrc
      || sourceImage.src
      || '';
  };

  const currentCpuLevel = (): number | null => {
    const label = sourceLabel?.textContent || '';
    const match = label.match(/Lv\s*([1-9])(?:\D|$)/i);
    return match ? Number(match[1]) : null;
  };

  const currentAvatarSource = (): string => {
    const cpuLevel = currentCpuLevel();
    if (cpuLevel !== null) return `${CPU_FACE_ASSET_PREFIX}${cpuLevel}.png`;
    return currentSourceImagePath();
  };

  const isSourceActionDisabled = (): boolean => (
    !sourceLabel
    || sourceLabel.getAttribute('aria-disabled') === 'true'
    || (sourceLabel as HTMLButtonElement).disabled === true
  );

  const restoreStatusNodes = (): void => {
    statusNodeHomes.splice(0).reverse().forEach((home) => {
      const reference = home.nextSibling?.parentNode === home.parent
        ? home.nextSibling
        : null;
      home.parent.insertBefore(home.node, reference);
    });
  };

  const mountStatusNodes = (): void => {
    if (statusNodeHomes.length > 0) return;
    STATUS_PANEL_IDS.forEach((id) => {
      const node = documentRef.getElementById(id);
      if (!node || !node.parentNode) return;
      statusNodeHomes.push({
        node,
        parent: node.parentNode,
        nextSibling: node.nextSibling,
      });
      view.statusContent.appendChild(node);
    });
  };

  const restoreBattleStatusNode = (): void => {
    if (!battleStatusNodeHome) return;
    const home = battleStatusNodeHome;
    battleStatusNodeHome = null;
    const reference = home.nextSibling?.parentNode === home.parent
      ? home.nextSibling
      : null;
    home.parent.insertBefore(home.node, reference);
  };

  const syncBattleStatusNode = (): void => {
    const host = view.battleStatusHost;
    if (!isPhonePortrait() || !host) {
      restoreBattleStatusNode();
      return;
    }
    if (battleStatusNodeHome) return;
    const node = documentRef.getElementById('effect-live-panel');
    if (!node || !node.parentNode) return;
    battleStatusNodeHome = {
      node,
      parent: node.parentNode,
      nextSibling: node.nextSibling,
    };
    host.appendChild(node);
  };

  const syncAvatar = (): void => {
    if (!avatarButton || !avatarImage) return;
    const nextSource = currentAvatarSource();
    const labelText = sourceLabel?.textContent?.replace(/\s+/g, ' ').trim()
      || sourceImage?.alt?.trim()
      || '敵キャラクター';
    const disabled = isSourceActionDisabled();

    if (nextSource && avatarImage.getAttribute('src') !== nextSource) {
      avatarImage.setAttribute('src', nextSource);
    } else if (!nextSource) {
      avatarImage.removeAttribute('src');
    }
    avatarButton.hidden = !nextSource;
    avatarButton.disabled = disabled;
    avatarButton.setAttribute('aria-disabled', String(disabled));
    avatarButton.setAttribute(
      'aria-label',
      disabled ? labelText : `${labelText}。CPU・盤面・ルール設定を開く`,
    );
    avatarButton.title = labelText;
  };

  const handleAvatarClick = (event: MouseEvent): void => {
    event.stopPropagation();
    if (isSourceActionDisabled()) return;
    sourceLabel?.click();
  };

  const handleAvatarError = (): void => {
    if (!avatarButton || !avatarImage) return;
    const fallback = currentSourceImagePath();
    if (fallback && avatarImage.getAttribute('src') !== fallback) {
      avatarImage.setAttribute('src', fallback);
      return;
    }
    avatarButton.hidden = true;
  };

  avatarButton?.addEventListener('click', handleAvatarClick);
  avatarImage?.addEventListener('error', handleAvatarError);

  const observer = new root.MutationObserver(syncAvatar);
  if (sourceImage) {
    observer.observe(sourceImage, {
      attributes: true,
      attributeFilter: [
        'src',
        'alt',
        'class',
        'style',
        'data-card-reversi-logical-src',
      ],
    });
  }
  if (sourceLabel) {
    observer.observe(sourceLabel, {
      attributes: true,
      attributeFilter: ['aria-disabled', 'disabled'],
      childList: true,
      subtree: true,
    });
  }

  syncAvatar();

  return {
    setOpen(open: boolean): void {
      if (destroyed || statusOpen === open) return;
      statusOpen = open;
      if (open) mountStatusNodes();
      else restoreStatusNodes();
    },
    sync(): void {
      if (destroyed) return;
      syncAvatar();
      syncBattleStatusNode();
      if (statusOpen) mountStatusNodes();
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      statusOpen = false;
      observer.disconnect();
      avatarButton?.removeEventListener('click', handleAvatarClick);
      avatarImage?.removeEventListener('error', handleAvatarError);
      restoreStatusNodes();
      restoreBattleStatusNode();
    },
  };
}

export {
  createMobileStatusBridge,
};

export type {
  MobileStatusBridgeController,
};
