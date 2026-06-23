'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const PlayerProfile = _require('./player-profile');
const AvatarOptions = _require('./player-profile-avatar-options');
const PlayerIdentity = _require('./player-identity');

function asText(value: unknown): string {
  return String(value || '');
}

function setStatus(el: HTMLElement | null, message: string, isError = false): void {
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('is-error', isError);
}

function setDisabled(el: HTMLElement | null, disabled: boolean): void {
  if (!el) return;
  try {
    (el as HTMLButtonElement).disabled = disabled;
  } catch (e) { /* ignore */ }
}

function getClipboard(root: any): { writeText?: (value: string) => Promise<void> } | null {
  try {
    return root && root.navigator && root.navigator.clipboard ? root.navigator.clipboard : null;
  } catch (e) {
    return null;
  }
}

function setupPlayerProfilePanel(opts?: any): any {
  const root = opts && opts.root ? opts.root : (typeof window !== 'undefined' ? window : null);
  const doc = root && root.document ? root.document : (typeof document !== 'undefined' ? document : null);
  if (!doc) return { ok: false, reason: 'DOCUMENT_UNAVAILABLE' };

  const refs = {
    openBtn: doc.getElementById('profileOpenBtn') as HTMLElement | null,
    overlay: doc.getElementById('profileOverlay') as HTMLElement | null,
    modal: doc.getElementById('profileModal') as HTMLElement | null,
    closeBtn: doc.getElementById('profileCloseBtn') as HTMLElement | null,
    tabProfile: doc.getElementById('profileTabProfile') as HTMLElement | null,
    tabIdentity: doc.getElementById('profileTabIdentity') as HTMLElement | null,
    editSection: doc.getElementById('profileEditSection') as HTMLElement | null,
    identitySection: doc.getElementById('profileIdentitySection') as HTMLElement | null,
    avatarPreview: doc.getElementById('profileAvatarPreview') as HTMLElement | null,
    nameInput: doc.getElementById('profileNameInput') as HTMLInputElement | null,
    avatarOptions: doc.getElementById('profileAvatarOptions') as HTMLElement | null,
    bioInput: doc.getElementById('profileBioInput') as HTMLTextAreaElement | null,
    saveBtn: doc.getElementById('profileSaveBtn') as HTMLElement | null,
    playerIdText: doc.getElementById('profilePlayerIdText') as HTMLElement | null,
    ensureIdentityBtn: doc.getElementById('profileEnsureIdentityBtn') as HTMLElement | null,
    recoveryOutput: doc.getElementById('profileRecoveryCodeOutput') as HTMLInputElement | null,
    revealRecoveryBtn: doc.getElementById('profileRevealRecoveryBtn') as HTMLElement | null,
    copyRecoveryBtn: doc.getElementById('profileCopyRecoveryBtn') as HTMLElement | null,
    regenerateRecoveryBtn: doc.getElementById('profileRegenerateRecoveryBtn') as HTMLElement | null,
    recoveryInput: doc.getElementById('profileRecoveryCodeInput') as HTMLInputElement | null,
    recoverIdentityBtn: doc.getElementById('profileRecoverIdentityBtn') as HTMLElement | null,
    status: doc.getElementById('profileIdentityStatus') as HTMLElement | null,
    leaderboardNameInput: doc.getElementById('leaderboardNameInput') as HTMLInputElement | null,
    networkPlayerNameInput: doc.getElementById('networkPlayerNameInput') as HTMLInputElement | null
  };

  let activeAvatarStoneType = 'REGEN';

  function setOpen(open: boolean): void {
    if (!refs.overlay) return;
    refs.overlay.classList.toggle('is-open', open);
    refs.overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (refs.openBtn) refs.openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      syncFromProfile();
      try { if (refs.nameInput) refs.nameInput.focus(); } catch (e) { /* ignore */ }
    }
  }

  function setActiveTab(tab: 'profile' | 'identity'): void {
    const identity = tab === 'identity';
    if (refs.tabProfile) {
      refs.tabProfile.classList.toggle('is-active', !identity);
      refs.tabProfile.setAttribute('aria-selected', identity ? 'false' : 'true');
    }
    if (refs.tabIdentity) {
      refs.tabIdentity.classList.toggle('is-active', identity);
      refs.tabIdentity.setAttribute('aria-selected', identity ? 'true' : 'false');
    }
    if (refs.editSection) {
      refs.editSection.classList.toggle('is-active', !identity);
      refs.editSection.hidden = identity;
    }
    if (refs.identitySection) {
      refs.identitySection.classList.toggle('is-active', identity);
      refs.identitySection.hidden = !identity;
    }
  }

  function getActiveAvatarOption(stoneType: string): any {
    if (AvatarOptions && typeof AvatarOptions.getProfileAvatarOption === 'function') {
      return AvatarOptions.getProfileAvatarOption(stoneType);
    }
    return null;
  }

  function applyAvatarPreview(stoneType: string): void {
    activeAvatarStoneType = AvatarOptions && typeof AvatarOptions.normalizeProfileAvatarStoneType === 'function'
      ? AvatarOptions.normalizeProfileAvatarStoneType(stoneType)
      : String(stoneType || 'REGEN').toUpperCase();
    const option = getActiveAvatarOption(activeAvatarStoneType);
    if (refs.avatarPreview) {
      refs.avatarPreview.style.backgroundImage = option && option.imagePath ? `url("${option.imagePath}")` : '';
      refs.avatarPreview.setAttribute('aria-label', option && option.label ? option.label : activeAvatarStoneType);
    }
    if (refs.avatarOptions) {
      Array.from(refs.avatarOptions.querySelectorAll('.profile-avatar-option')).forEach((button: any) => {
        const active = button.dataset && button.dataset.avatarStoneType === activeAvatarStoneType;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-checked', active ? 'true' : 'false');
      });
    }
  }

  function renderAvatarOptions(): void {
    if (!refs.avatarOptions || refs.avatarOptions.childElementCount > 0) return;
    const options = AvatarOptions && typeof AvatarOptions.getProfileAvatarOptions === 'function'
      ? AvatarOptions.getProfileAvatarOptions()
      : [];
    options.forEach((option: any) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'profile-avatar-option';
      button.dataset.avatarStoneType = option.stoneType;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-label', option.label);
      button.setAttribute('aria-checked', 'false');
      const thumb = doc.createElement('span');
      thumb.className = 'profile-avatar-option-thumb';
      if (option.imagePath) thumb.style.backgroundImage = `url("${option.imagePath}")`;
      const label = doc.createElement('span');
      label.className = 'profile-avatar-option-label';
      label.textContent = option.label;
      button.appendChild(thumb);
      button.appendChild(label);
      button.addEventListener('click', () => applyAvatarPreview(option.stoneType));
      refs.avatarOptions!.appendChild(button);
    });
  }

  function syncIdentityDisplay(showRecovery: boolean): void {
    const playerId = PlayerIdentity && typeof PlayerIdentity.getPlayerId === 'function'
      ? PlayerIdentity.getPlayerId()
      : null;
    if (refs.playerIdText) refs.playerIdText.textContent = playerId || '未作成';
    if (refs.recoveryOutput) {
      refs.recoveryOutput.value = showRecovery && PlayerIdentity && typeof PlayerIdentity.getRecoveryCode === 'function'
        ? asText(PlayerIdentity.getRecoveryCode())
        : '';
    }
  }

  function syncFromProfile(): void {
    renderAvatarOptions();
    const profile = PlayerProfile && typeof PlayerProfile.readPlayerProfile === 'function'
      ? PlayerProfile.readPlayerProfile()
      : { displayName: '', avatarStoneType: 'REGEN', bio: '' };
    if (refs.nameInput) refs.nameInput.value = asText(profile.displayName);
    if (refs.bioInput) refs.bioInput.value = asText(profile.bio);
    applyAvatarPreview(profile.avatarStoneType || 'REGEN');
    syncIdentityDisplay(false);
  }

  function saveProfile(): void {
    const saved = PlayerProfile.savePlayerProfile({
      displayName: refs.nameInput ? refs.nameInput.value : '',
      avatarStoneType: activeAvatarStoneType,
      bio: refs.bioInput ? refs.bioInput.value : ''
    });
    if (refs.nameInput) refs.nameInput.value = saved.displayName;
    if (refs.bioInput) refs.bioInput.value = saved.bio;
    if (refs.leaderboardNameInput) refs.leaderboardNameInput.value = saved.displayName;
    if (refs.networkPlayerNameInput) {
      refs.networkPlayerNameInput.value = saved.displayName;
    }
    try {
      const leaderboard = root && root.LeaderboardClient;
      if (leaderboard && typeof leaderboard.setPlayerName === 'function') {
        leaderboard.setPlayerName(saved.displayName);
      }
    } catch (e) { /* ignore */ }
    setStatus(refs.status, 'プロフィールを保存しました');
  }

  async function ensureIdentity(): Promise<void> {
    setDisabled(refs.ensureIdentityBtn, true);
    try {
      await PlayerIdentity.ensurePlayerIdentity();
      syncIdentityDisplay(false);
      setStatus(refs.status, 'プレイヤーIDを確認しました');
    } catch (e) {
      setStatus(refs.status, 'プレイヤーIDを確認できませんでした', true);
    } finally {
      setDisabled(refs.ensureIdentityBtn, false);
    }
  }

  async function revealRecovery(): Promise<void> {
    setDisabled(refs.revealRecoveryBtn, true);
    try {
      await PlayerIdentity.ensurePlayerIdentity();
      syncIdentityDisplay(true);
      setStatus(refs.status, '復元コードを表示しました');
    } catch (e) {
      setStatus(refs.status, '復元コードを表示できませんでした', true);
    } finally {
      setDisabled(refs.revealRecoveryBtn, false);
    }
  }

  async function copyRecovery(): Promise<void> {
    const value = refs.recoveryOutput ? refs.recoveryOutput.value.trim() : '';
    if (!value) {
      setStatus(refs.status, '先に復元コードを表示してください', true);
      return;
    }
    const clipboard = getClipboard(root);
    if (!clipboard || typeof clipboard.writeText !== 'function') {
      setStatus(refs.status, 'コピーできませんでした', true);
      return;
    }
    try {
      await clipboard.writeText(value);
      setStatus(refs.status, '復元コードをコピーしました');
    } catch (e) {
      setStatus(refs.status, 'コピーできませんでした', true);
    }
  }

  async function regenerateRecovery(): Promise<void> {
    setDisabled(refs.regenerateRecoveryBtn, true);
    try {
      await PlayerIdentity.regenerateRecoveryCode();
      syncIdentityDisplay(true);
      setStatus(refs.status, '復元コードを再発行しました。古いコードは無効です');
    } catch (e) {
      setStatus(refs.status, '復元コードを再発行できませんでした', true);
    } finally {
      setDisabled(refs.regenerateRecoveryBtn, false);
    }
  }

  async function recoverIdentity(): Promise<void> {
    const code = refs.recoveryInput ? refs.recoveryInput.value : '';
    setDisabled(refs.recoverIdentityBtn, true);
    try {
      await PlayerIdentity.recoverPlayerIdentity(code);
      if (refs.recoveryInput) refs.recoveryInput.value = '';
      syncIdentityDisplay(true);
      setStatus(refs.status, 'プレイヤーIDを復元しました');
    } catch (e) {
      setStatus(refs.status, '復元コードを読み込めませんでした', true);
    } finally {
      setDisabled(refs.recoverIdentityBtn, false);
    }
  }

  if (refs.openBtn) refs.openBtn.addEventListener('click', () => setOpen(true));
  if (refs.closeBtn) refs.closeBtn.addEventListener('click', () => setOpen(false));
  if (refs.overlay) {
    refs.overlay.addEventListener('click', (event: any) => {
      if (event && event.target === refs.overlay) setOpen(false);
    });
  }
  if (refs.tabProfile) refs.tabProfile.addEventListener('click', () => setActiveTab('profile'));
  if (refs.tabIdentity) refs.tabIdentity.addEventListener('click', () => setActiveTab('identity'));
  if (refs.saveBtn) refs.saveBtn.addEventListener('click', saveProfile);
  if (refs.ensureIdentityBtn) refs.ensureIdentityBtn.addEventListener('click', () => void ensureIdentity());
  if (refs.revealRecoveryBtn) refs.revealRecoveryBtn.addEventListener('click', () => void revealRecovery());
  if (refs.copyRecoveryBtn) refs.copyRecoveryBtn.addEventListener('click', () => void copyRecovery());
  if (refs.regenerateRecoveryBtn) refs.regenerateRecoveryBtn.addEventListener('click', () => void regenerateRecovery());
  if (refs.recoverIdentityBtn) refs.recoverIdentityBtn.addEventListener('click', () => void recoverIdentity());

  renderAvatarOptions();
  setActiveTab('profile');
  syncFromProfile();
  setOpen(false);
  return { ok: true, setOpen, syncFromProfile, setActiveTab };
}

const PlayerProfilePanel = { setupPlayerProfilePanel };

try {
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).setupPlayerProfilePanel = setupPlayerProfilePanel;
    (globalThis as any).PlayerProfilePanel = PlayerProfilePanel;
  }
} catch (e) { /* ignore */ }

export = PlayerProfilePanel;
