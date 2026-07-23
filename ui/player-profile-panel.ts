'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const PlayerProfile = _require('./player-profile');
const AvatarOptions = _require('./player-profile-avatar-options');
const PlayerIdentity = _require('./player-identity');
const LazyFeatureSurface = _require('./assets/lazy-feature-surface');

const PROFILE_SURFACE_ID = 'profile';
const PROFILE_INNER_HTML = `
  <div id="profileModalHeader">
    <div id="profileModalTitle" class="profile-title">プロフィール</div>
    <button id="profileCloseBtn" class="btn-small" type="button" aria-label="プロフィールを閉じる">×</button>
  </div>
  <div id="profileModalBody">
    <div class="profile-tabs" role="tablist" aria-label="プロフィール設定">
      <button id="profileTabProfile" class="profile-tab is-active" type="button" role="tab" aria-controls="profileEditSection" aria-selected="true">プロフィール</button>
      <button id="profileTabIdentity" class="profile-tab" type="button" role="tab" aria-controls="profileIdentitySection" aria-selected="false">ID・復元</button>
    </div>
    <section id="profileEditSection" class="profile-section is-active" role="tabpanel" aria-labelledby="profileTabProfile">
      <div class="profile-main-row">
        <div id="profileAvatarPreview" class="profile-avatar-preview" role="img" aria-label="プロフィール画像"></div>
        <label class="profile-field">
          <span>名前</span>
          <span class="profile-name-control-row">
            <input id="profileNameInput" type="text" maxlength="7" autocomplete="off" spellcheck="false">
            <button id="profileSaveBtn" class="btn-small" type="button">保存</button>
          </span>
        </label>
      </div>
      <div class="profile-field">
        <span>プロフィール画像</span>
        <div id="profileAvatarOptions" class="profile-avatar-options" role="radiogroup" aria-label="プロフィール画像"></div>
      </div>
      <label class="profile-field" for="profileBioInput">
        <span>自己紹介</span>
        <textarea id="profileBioInput" maxlength="120" rows="4" spellcheck="false"></textarea>
      </label>
    </section>
    <section id="profileIdentitySection" class="profile-section" role="tabpanel" aria-labelledby="profileTabIdentity" hidden>
      <div class="profile-identity-row">
        <span>プレイヤーID</span>
        <code id="profilePlayerIdText">未作成</code>
        <button id="profileEnsureIdentityBtn" class="btn-small" type="button">ID確認</button>
      </div>
      <div class="profile-identity-row profile-identity-row-code">
        <label for="profileRecoveryCodeOutput">復元コード</label>
        <input id="profileRecoveryCodeOutput" type="text" readonly value="" aria-label="復元コード">
        <button id="profileRevealRecoveryBtn" class="btn-small" type="button">表示</button>
        <button id="profileCopyRecoveryBtn" class="btn-small" type="button">コピー</button>
        <button id="profileRegenerateRecoveryBtn" class="btn-small" type="button">再発行</button>
      </div>
      <div class="profile-identity-row profile-identity-row-code">
        <label for="profileRecoveryCodeInput">復元コード読み込み</label>
        <input id="profileRecoveryCodeInput" type="text" autocomplete="off" spellcheck="false" aria-label="復元コード読み込み">
        <button id="profileRecoverIdentityBtn" class="btn-small" type="button">読み込み</button>
      </div>
      <div id="profileIdentityStatus" aria-live="polite"></div>
    </section>
  </div>
`;

interface PlayerProfileSurface {
  setOpen(open: boolean, returnFocus?: HTMLElement | null): void;
  syncFromProfile(): void;
  setActiveTab(tab: 'profile' | 'identity'): void;
}

interface PlayerProfilePanelController {
  ok: true;
  ensureReady(): Promise<PlayerProfileSurface>;
  setOpen(open: boolean): void;
  syncFromProfile(): void;
  setActiveTab(tab: 'profile' | 'identity'): void;
}

const documentControllers = new WeakMap<Document, PlayerProfilePanelController>();

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

function createProfileSurface(context: any): PlayerProfileSurface {
  const doc = context.document as Document;
  const root = doc.defaultView || (typeof window !== 'undefined' ? window : null);
  const overlay = doc.getElementById('profileOverlay') as HTMLElement | null;
  const modal = doc.getElementById('profileModal') as HTMLElement | null;
  if (!overlay || !modal) throw new Error('profile stable shell is unavailable');
  const overlayElement = overlay;
  const modalElement = modal;

  const template = doc.createElement('template');
  template.innerHTML = PROFILE_INNER_HTML.trim();
  modalElement.replaceChildren(template.content.cloneNode(true));
  context.recordDomCreated();
  context.addCleanup(() => {
    modalElement.replaceChildren();
    overlayElement.classList.remove('is-open');
    overlayElement.setAttribute('aria-hidden', 'true');
  });

  const refs = {
    openBtn: doc.getElementById('profileOpenBtn') as HTMLElement | null,
    closeBtn: modalElement.querySelector('#profileCloseBtn') as HTMLElement | null,
    tabProfile: modalElement.querySelector('#profileTabProfile') as HTMLElement | null,
    tabIdentity: modalElement.querySelector('#profileTabIdentity') as HTMLElement | null,
    editSection: modalElement.querySelector('#profileEditSection') as HTMLElement | null,
    identitySection: modalElement.querySelector('#profileIdentitySection') as HTMLElement | null,
    avatarPreview: modalElement.querySelector('#profileAvatarPreview') as HTMLElement | null,
    nameInput: modalElement.querySelector('#profileNameInput') as HTMLInputElement | null,
    avatarOptions: modalElement.querySelector('#profileAvatarOptions') as HTMLElement | null,
    bioInput: modalElement.querySelector('#profileBioInput') as HTMLTextAreaElement | null,
    saveBtn: modalElement.querySelector('#profileSaveBtn') as HTMLElement | null,
    playerIdText: modalElement.querySelector('#profilePlayerIdText') as HTMLElement | null,
    ensureIdentityBtn: modalElement.querySelector('#profileEnsureIdentityBtn') as HTMLElement | null,
    recoveryOutput: modalElement.querySelector('#profileRecoveryCodeOutput') as HTMLInputElement | null,
    revealRecoveryBtn: modalElement.querySelector('#profileRevealRecoveryBtn') as HTMLElement | null,
    copyRecoveryBtn: modalElement.querySelector('#profileCopyRecoveryBtn') as HTMLElement | null,
    regenerateRecoveryBtn: modalElement.querySelector('#profileRegenerateRecoveryBtn') as HTMLElement | null,
    recoveryInput: modalElement.querySelector('#profileRecoveryCodeInput') as HTMLInputElement | null,
    recoverIdentityBtn: modalElement.querySelector('#profileRecoverIdentityBtn') as HTMLElement | null,
    status: modalElement.querySelector('#profileIdentityStatus') as HTMLElement | null,
    leaderboardNameInput: doc.getElementById('leaderboardNameInput') as HTMLInputElement | null,
    networkPlayerNameInput: doc.getElementById('networkPlayerNameInput') as HTMLInputElement | null
  };

  let activeAvatarStoneType = 'REGEN';
  let isOpen = false;
  let returnFocus: HTMLElement | null = null;

  function bind(
    target: EventTarget | null,
    type: string,
    listener: EventListener
  ): void {
    if (!target) return;
    target.addEventListener(type, listener);
    context.recordListenerBinding();
    context.addCleanup(() => target.removeEventListener(type, listener));
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
      bind(button, 'click', () => applyAvatarPreview(option.stoneType));
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
    if (refs.networkPlayerNameInput) refs.networkPlayerNameInput.value = saved.displayName;
    try {
      const leaderboard = root && (root as any).LeaderboardClient;
      if (leaderboard && typeof leaderboard.setPlayerName === 'function') {
        leaderboard.setPlayerName(saved.displayName);
      }
      if (leaderboard && typeof leaderboard.updatePublicProfile === 'function') {
        void Promise.resolve(leaderboard.updatePublicProfile()).catch(() => undefined);
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

  function restoreOpenButtonFocus(): void {
    const target = returnFocus && returnFocus.isConnected ? returnFocus : refs.openBtn;
    returnFocus = null;
    try { target?.focus(); } catch (e) { /* ignore */ }
  }

  function setOpen(open: boolean, focusTarget?: HTMLElement | null): void {
    isOpen = open;
    overlayElement.classList.toggle('is-open', open);
    overlayElement.setAttribute('aria-hidden', open ? 'false' : 'true');
    refs.openBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      returnFocus = focusTarget || refs.openBtn;
      syncFromProfile();
      try { refs.nameInput?.focus(); } catch (e) { /* ignore */ }
    } else {
      restoreOpenButtonFocus();
    }
  }

  function getFocusableElements(): HTMLElement[] {
    return Array.from(modalElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => !element.closest('[hidden]') && element.getAttribute('aria-hidden') !== 'true');
  }

  bind(refs.closeBtn, 'click', () => setOpen(false));
  bind(overlayElement, 'click', (event: Event) => {
    if (event.target === overlayElement) setOpen(false);
  });
  bind(refs.tabProfile, 'click', () => setActiveTab('profile'));
  bind(refs.tabIdentity, 'click', () => setActiveTab('identity'));
  bind(refs.saveBtn, 'click', saveProfile);
  bind(refs.ensureIdentityBtn, 'click', () => void ensureIdentity());
  bind(refs.revealRecoveryBtn, 'click', () => void revealRecovery());
  bind(refs.copyRecoveryBtn, 'click', () => void copyRecovery());
  bind(refs.regenerateRecoveryBtn, 'click', () => void regenerateRecovery());
  bind(refs.recoverIdentityBtn, 'click', () => void recoverIdentity());
  bind(doc, 'keydown', (event: Event) => {
    const keyboardEvent = event as KeyboardEvent;
    if (!isOpen) return;
    if (keyboardEvent.key === 'Escape') {
      keyboardEvent.preventDefault();
      setOpen(false);
      return;
    }
    if (keyboardEvent.key !== 'Tab') return;
    const focusable = getFocusableElements();
    if (focusable.length === 0) {
      keyboardEvent.preventDefault();
      modalElement.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = doc.activeElement;
    if (keyboardEvent.shiftKey && (active === first || !modalElement.contains(active))) {
      keyboardEvent.preventDefault();
      last.focus();
    } else if (!keyboardEvent.shiftKey && (active === last || !modalElement.contains(active))) {
      keyboardEvent.preventDefault();
      first.focus();
    }
  });

  renderAvatarOptions();
  setActiveTab('profile');
  syncFromProfile();
  return { setOpen, syncFromProfile, setActiveTab };
}

const ProfileSurfaceRegistration = Object.freeze({
  id: PROFILE_SURFACE_ID,
  stylesheetGroup: 'profile',
  ensureDom: createProfileSurface
});

if (LazyFeatureSurface && typeof LazyFeatureSurface.registerLazyFeatureSurface === 'function') {
  LazyFeatureSurface.registerLazyFeatureSurface(ProfileSurfaceRegistration);
}

function setupPlayerProfilePanel(opts?: any): any {
  const root = opts && opts.root ? opts.root : (typeof window !== 'undefined' ? window : null);
  const doc = root && root.document ? root.document : (typeof document !== 'undefined' ? document : null);
  if (!doc) return { ok: false, reason: 'DOCUMENT_UNAVAILABLE' };
  const existing = documentControllers.get(doc);
  if (existing) return existing;

  const openBtn = doc.getElementById('profileOpenBtn') as HTMLElement | null;
  const overlay = doc.getElementById('profileOverlay') as HTMLElement | null;
  const modal = doc.getElementById('profileModal') as HTMLElement | null;
  if (!openBtn || !overlay || !modal) {
    return { ok: false, reason: 'PROFILE_SHELL_UNAVAILABLE' };
  }
  const openButton = openBtn;
  const overlayElement = overlay;
  const modalElement = modal;

  let readySurface: PlayerProfileSurface | null = null;
  let pending: Promise<PlayerProfileSurface> | null = null;
  let failureCleanup: (() => void) | null = null;

  function clearFailure(restoreFocus = false): void {
    if (failureCleanup) failureCleanup();
    failureCleanup = null;
    overlayElement.classList.remove('profile-surface-failure');
    overlayElement.classList.remove('is-open');
    overlayElement.setAttribute('aria-hidden', 'true');
    modalElement.replaceChildren();
    openButton.setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      try { openButton.focus(); } catch (e) { /* ignore */ }
    }
  }

  function showFailure(): void {
    clearFailure(false);
    overlayElement.classList.add('profile-surface-failure', 'is-open');
    overlayElement.setAttribute('aria-hidden', 'false');
    openButton.setAttribute('aria-expanded', 'true');
    const title = doc.createElement('div');
    title.id = 'profileModalTitle';
    title.className = 'profile-surface-failure-title';
    title.textContent = 'プロフィールを読み込めませんでした';
    const message = doc.createElement('p');
    message.className = 'profile-surface-failure-message';
    message.textContent = '閉じてプロフィールボタンをもう一度押すと再試行します。';
    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-small';
    closeBtn.textContent = '閉じる';
    modalElement.replaceChildren(title, message, closeBtn);

    const close = () => clearFailure(true);
    const onBackdrop = (event: Event) => {
      if (event.target === overlayElement) close();
    };
    const onKeydown = (event: Event) => {
      if ((event as KeyboardEvent).key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    closeBtn.addEventListener('click', close);
    overlayElement.addEventListener('click', onBackdrop);
    doc.addEventListener('keydown', onKeydown);
    failureCleanup = () => {
      closeBtn.removeEventListener('click', close);
      overlayElement.removeEventListener('click', onBackdrop);
      doc.removeEventListener('keydown', onKeydown);
    };
    try { closeBtn.focus(); } catch (e) { /* ignore */ }
  }

  function ensureReady(): Promise<PlayerProfileSurface> {
    if (readySurface) return Promise.resolve(readySurface);
    if (pending) return pending;
    clearFailure(false);
    openButton.setAttribute('aria-busy', 'true');
    pending = Promise.resolve(
      LazyFeatureSurface.ensureLazyFeatureSurface(PROFILE_SURFACE_ID, doc)
    ).then((surface: any) => {
      readySurface = surface.dom as PlayerProfileSurface;
      return readySurface;
    }).catch((error: unknown) => {
      showFailure();
      throw error;
    }).finally(() => {
      openButton.removeAttribute('aria-busy');
      pending = null;
    });
    return pending;
  }

  async function open(): Promise<void> {
    try {
      const surface = await ensureReady();
      surface.setOpen(true, openButton);
    } catch (_error) {
      // showFailure() keeps the retry path visible and operable.
    }
  }

  const controller: PlayerProfilePanelController = {
    ok: true,
    ensureReady,
    setOpen(openValue: boolean) {
      if (openValue) void open();
      else if (readySurface) readySurface.setOpen(false);
      else clearFailure(true);
    },
    syncFromProfile() {
      readySurface?.syncFromProfile();
    },
    setActiveTab(tab: 'profile' | 'identity') {
      readySurface?.setActiveTab(tab);
    }
  };

  openButton.addEventListener('click', () => void open());
  documentControllers.set(doc, controller);
  return controller;
}

const PlayerProfilePanel = {
  setupPlayerProfilePanel,
  PROFILE_SURFACE_ID
};

try {
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).setupPlayerProfilePanel = setupPlayerProfilePanel;
    (globalThis as any).PlayerProfilePanel = PlayerProfilePanel;
  }
} catch (e) { /* ignore */ }

export = PlayerProfilePanel;
