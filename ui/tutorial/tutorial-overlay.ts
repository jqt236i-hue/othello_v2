'use strict';

const SCENE_FADE_DURATION_MS = 520;
const SCENE_FADE_MIDPOINT_MS = 260;
const SCENE_FADE_FALLBACK_MS = 560;

const TEMPLATE = [
  '<img class="tutorial-scene-background" alt="" aria-hidden="true">',
  '<div class="tutorial-backdrop"></div>',
  '<div class="tutorial-scene-fade" aria-hidden="true"></div>',
  '<div class="tutorial-shell">',
  '  <div class="tutorial-support-stage" data-support-stage="right">',
  '    <img class="tutorial-support-image" alt="" aria-hidden="true">',
  '  </div>',
  '  <div class="tutorial-observer-stage" data-observer-stage="top">',
  '    <div class="tutorial-head-bubble" aria-live="polite"></div>',
  '    <img class="tutorial-observer-image" alt="盤理の観測者">',
  '  </div>',
  '  <button class="tutorial-exit-btn" type="button" aria-label="tutorial を終了する">終了</button>',
  '  <div class="tutorial-dialog-window" role="dialog" aria-modal="true" aria-label="tutorial dialogue">',
  '    <div class="tutorial-chapter-label"></div>',
  '    <div class="tutorial-speaker"></div>',
  '    <div class="tutorial-body"></div>',
  '    <div class="tutorial-body tutorial-body-measure" aria-hidden="true"></div>',
  '    <div class="tutorial-instruction"></div>',
  '    <div class="tutorial-advance-hint"></div>',
  '  </div>',
  '  <div class="tutorial-choice-panel" aria-live="polite"></div>',
  '</div>'
].join('');

function createTutorialOverlay(options?: any): any {
  const opts = options && typeof options === 'object' ? options : {};
  const overlayRoot = opts.overlay;
  if (!overlayRoot) {
    throw new Error('tutorial overlay root is required');
  }
  if (!overlayRoot.dataset.tutorialMounted) {
    overlayRoot.innerHTML = TEMPLATE;
    overlayRoot.dataset.tutorialMounted = '1';
  }

  const refs = {
    root: overlayRoot,
    sceneBackground: overlayRoot.querySelector('.tutorial-scene-background'),
    backdrop: overlayRoot.querySelector('.tutorial-backdrop'),
    sceneFade: overlayRoot.querySelector('.tutorial-scene-fade'),
    shell: overlayRoot.querySelector('.tutorial-shell'),
    supportStage: overlayRoot.querySelector('.tutorial-support-stage'),
    supportImage: overlayRoot.querySelector('.tutorial-support-image'),
    observerStage: overlayRoot.querySelector('.tutorial-observer-stage'),
    observerImage: overlayRoot.querySelector('.tutorial-observer-image'),
    headBubble: overlayRoot.querySelector('.tutorial-head-bubble'),
    exitButton: overlayRoot.querySelector('.tutorial-exit-btn'),
    dialogWindow: overlayRoot.querySelector('.tutorial-dialog-window'),
    chapterLabel: overlayRoot.querySelector('.tutorial-chapter-label'),
    speaker: overlayRoot.querySelector('.tutorial-speaker'),
    body: overlayRoot.querySelector('.tutorial-body'),
    bodyMeasure: overlayRoot.querySelector('.tutorial-body-measure'),
    instruction: overlayRoot.querySelector('.tutorial-instruction'),
    advanceHint: overlayRoot.querySelector('.tutorial-advance-hint'),
    choicePanel: overlayRoot.querySelector('.tutorial-choice-panel')
  };
  const doc = overlayRoot.ownerDocument || (typeof document !== 'undefined' ? document : null);

  function setOpen(open: boolean, passthrough?: boolean): void {
    const isOpen = open === true;
    const allowPassthrough = passthrough === true;
    overlayRoot.classList.toggle('is-open', isOpen);
    overlayRoot.classList.toggle('tutorial-modal', isOpen && !allowPassthrough);
    overlayRoot.classList.toggle('tutorial-passthrough', isOpen && allowPassthrough);
    overlayRoot.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    if (refs.exitButton) {
      (refs.exitButton as HTMLButtonElement).disabled = !isOpen;
    }
  }

  function setExitOnlyMode(active: boolean): void {
    const isExitOnly = active === true;
    overlayRoot.classList.toggle('tutorial-exit-only', isExitOnly);
    if (refs.sceneBackground) (refs.sceneBackground as HTMLElement).style.display = isExitOnly ? 'none' : '';
    if (refs.backdrop) (refs.backdrop as HTMLElement).style.display = isExitOnly ? 'none' : '';
    if (refs.supportStage) (refs.supportStage as HTMLElement).style.display = isExitOnly ? 'none' : '';
    if (refs.observerStage) (refs.observerStage as HTMLElement).style.display = isExitOnly ? 'none' : '';
    if (refs.dialogWindow) (refs.dialogWindow as HTMLElement).style.display = isExitOnly ? 'none' : '';
    if (refs.choicePanel) (refs.choicePanel as HTMLElement).style.display = isExitOnly ? 'none' : '';
  }

  function clearChoices(): void {
    if (!refs.choicePanel) return;
    refs.choicePanel.classList.remove('is-visible');
    refs.choicePanel.innerHTML = '';
  }

  function setSceneBackground(imageSrc?: string): void {
    if (!refs.sceneBackground) return;
    const value = imageSrc ? String(imageSrc) : '';
    (refs.sceneBackground as HTMLImageElement).src = value;
    (refs.sceneBackground as HTMLElement).style.display = value ? 'block' : 'none';
    overlayRoot.classList.toggle('tutorial-has-scene-background', !!value);
    overlayRoot.classList.toggle('tutorial-board-scene', !value);
  }

  function setText(el: Element | null, value?: any): void {
    if (!el) return;
    (el as HTMLElement).textContent = value ? String(value) : '';
  }

  function splitTextForPagination(text: string): string[] {
    const normalized = String(text || '').replace(/\r\n/g, '\n');
    const segments: string[] = [];
    let current = '';
    for (const char of normalized) {
      current += char;
      if (char === '\n' || /[。！？!?]/.test(char)) {
        segments.push(current);
        current = '';
      }
    }
    if (current) segments.push(current);
    return segments.length ? segments : [''];
  }

  function sanitizePageText(text: string): string {
    return String(text || '')
      .replace(/^\n+/, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\n+$/, '');
  }

  function getFallbackPages(text: string): string[] {
    const segments = splitTextForPagination(text);
    const pages: string[] = [];
    let current = '';
    const maxChars = 78;

    const pushChunk = (chunk: string) => {
      const value = sanitizePageText(chunk);
      if (value) pages.push(value);
    };

    for (const segment of segments) {
      const safeSegment = String(segment || '');
      const candidate = current ? current + safeSegment : safeSegment;
      if (candidate.length <= maxChars) {
        current = candidate;
        continue;
      }
      if (current) {
        pushChunk(current);
        current = '';
      }
      if (safeSegment.length <= maxChars) {
        current = safeSegment;
        continue;
      }
      let chunk = '';
      for (const char of safeSegment) {
        if ((chunk + char).length > maxChars) {
          pushChunk(chunk);
          chunk = '';
        }
        chunk += char;
      }
      current = chunk;
    }

    if (current) pushChunk(current);
    return pages.length ? pages : [''];
  }

  function measureFits(text: string): boolean | null {
    if (!refs.body || !refs.bodyMeasure) return null;
    const availableHeight = (refs.body as HTMLElement).clientHeight;
    const availableWidth = (refs.body as HTMLElement).clientWidth;
    if (availableHeight <= 0 || availableWidth <= 0) return null;

    (refs.bodyMeasure as HTMLElement).style.width = `${availableWidth}px`;
    (refs.bodyMeasure as HTMLElement).textContent = String(text || '');
    return (refs.bodyMeasure as HTMLElement).scrollHeight <= (availableHeight + 1);
  }

  function paginateBodyText(text: string): string[] {
    const segments = splitTextForPagination(text);
    const measuredPages: string[] = [];
    let current = '';

    const pushMeasuredPage = (chunk: string) => {
      const value = sanitizePageText(chunk);
      if (value) measuredPages.push(value);
    };

    for (const segment of segments) {
      const safeSegment = String(segment || '');
      const candidate = current ? current + safeSegment : safeSegment;
      const candidateFits = measureFits(candidate);

      if (candidateFits === null) {
        return getFallbackPages(text);
      }
      if (candidateFits) {
        current = candidate;
        continue;
      }
      if (current) {
        pushMeasuredPage(current);
        current = '';
      }

      const segmentFits = measureFits(safeSegment);
      if (segmentFits === null) {
        return getFallbackPages(text);
      }
      if (segmentFits) {
        current = safeSegment;
        continue;
      }

      let chunk = '';
      for (const char of safeSegment) {
        const nextChunk = chunk + char;
        const chunkFits = measureFits(nextChunk);
        if (chunkFits === null) {
          return getFallbackPages(text);
        }
        if (!chunkFits && chunk) {
          pushMeasuredPage(chunk);
          chunk = char;
          continue;
        }
        chunk = nextChunk;
      }
      current = chunk;
    }

    if (current) pushMeasuredPage(current);
    return measuredPages.length ? measuredPages : [''];
  }

  function setObserverVisible(visible: boolean, imageSrc?: string, stage?: string, imageAlt?: string): void {
    if (!refs.observerStage || !refs.observerImage) return;
    const show = visible !== false;
    (refs.observerStage as HTMLElement).style.display = show ? '' : 'none';
    (refs.observerStage as HTMLElement).dataset.observerStage = stage || 'top';
    if (imageSrc) (refs.observerImage as HTMLImageElement).src = String(imageSrc);
    (refs.observerImage as HTMLImageElement).alt = imageAlt ? String(imageAlt) : 'キャラクター';
  }

  function setSupportVisible(visible: boolean, imageSrc?: string, stage?: string, imageAlt?: string): void {
    if (!refs.supportStage || !refs.supportImage) return;
    const show = visible === true && !!imageSrc;
    (refs.supportStage as HTMLElement).style.display = show ? 'block' : 'none';
    (refs.supportStage as HTMLElement).dataset.supportStage = stage || 'right';
    (refs.supportImage as HTMLImageElement).src = show ? String(imageSrc) : '';
    (refs.supportImage as HTMLImageElement).alt = imageAlt ? String(imageAlt) : '';
    (refs.supportImage as HTMLImageElement).setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  function setHeadBubble(text?: string): void {
    if (!refs.headBubble) return;
    const value = text ? String(text) : '';
    (refs.headBubble as HTMLElement).textContent = value;
    refs.headBubble.classList.toggle('is-visible', !!value);
  }

  function renderFrame(payload?: any): void {
    const view = payload && typeof payload === 'object' ? payload : {};
    setText(refs.chapterLabel, view.chapterLabel || '');
    setText(refs.speaker, view.speaker || '');
    setText(refs.body, view.bodyText || '');
    setText(refs.instruction, view.instruction || '');
    setText(refs.advanceHint, view.advanceHint || '');
    setSceneBackground(view.sceneBackgroundSrc || '');
    setObserverVisible(view.observerVisible, view.observerImageSrc, view.observerStage, view.observerImageAlt);
    setSupportVisible(view.supportVisible, view.supportImageSrc, view.supportStage, view.supportImageAlt);
    setHeadBubble(view.headBubbleText || '');
    if (refs.observerImage) {
      (refs.observerImage as HTMLElement).dataset.emotion = view.emotion || 'normal';
    }
  }

  function setBodyText(text: string): void {
    setText(refs.body, text);
  }

  function setInstruction(text: string): void {
    setText(refs.instruction, text);
  }

  function setAdvanceHint(text: string): void {
    setText(refs.advanceHint, text);
  }

  function showChoices(prompt: string, choices: any[], onSelect?: (choice: any) => void): void {
    clearChoices();
    if (!refs.choicePanel || !Array.isArray(choices) || choices.length === 0 || !doc) return;
    const fragment = doc.createDocumentFragment();
    if (prompt) {
      const promptEl = doc.createElement('div');
      promptEl.className = 'tutorial-choice-prompt';
      promptEl.textContent = String(prompt);
      fragment.appendChild(promptEl);
    }
    for (const choice of choices) {
      if (!choice || !choice.id) continue;
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'tutorial-choice-btn';
      button.textContent = String(choice.label || choice.id);
      button.dataset.choiceId = String(choice.id);
      button.addEventListener('click', () => {
        if (typeof onSelect === 'function') onSelect(choice);
      });
      fragment.appendChild(button);
    }
    refs.choicePanel.appendChild(fragment);
    refs.choicePanel.classList.add('is-visible');
  }

  function playSceneTransition(kind: string, onMidpoint?: () => any): Promise<boolean> {
    if (!refs.sceneFade || kind !== 'fade_black') {
      return Promise.resolve(false);
    }
    (refs.sceneFade as HTMLElement).style.setProperty('--tutorial-scene-fade-duration', `${SCENE_FADE_DURATION_MS}ms`);
    refs.sceneFade.classList.remove('is-active');
    void (refs.sceneFade as HTMLElement).offsetWidth;
    refs.sceneFade.classList.add('is-active');
    return new Promise((resolve) => {
      let settled = false;
      let midpointTriggered = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        refs.sceneFade.classList.remove('is-active');
        resolve(true);
      };
      const triggerMidpoint = () => {
        if (midpointTriggered) return;
        midpointTriggered = true;
        if (typeof onMidpoint === 'function') {
          Promise.resolve(onMidpoint()).catch(() => {});
        }
      };
      setTimeout(triggerMidpoint, SCENE_FADE_MIDPOINT_MS);
      refs.sceneFade.addEventListener('animationend', finish, { once: true });
      setTimeout(finish, SCENE_FADE_FALLBACK_MS);
    });
  }

  function destroy(): void {
    clearChoices();
    setOpen(false, false);
    overlayRoot.innerHTML = '';
    delete overlayRoot.dataset.tutorialMounted;
  }

  clearChoices();
  setSceneBackground('');
  setExitOnlyMode(false);
  setOpen(false, false);

  return {
    refs,
    open: function () { setOpen(true, false); },
    close: function () { clearChoices(); setOpen(false, false); },
    setPassthrough: function (passthrough: boolean) { setOpen(true, passthrough === true); },
    setExitOnlyMode,
    renderFrame,
    setBodyText,
    setInstruction,
    setAdvanceHint,
    setHeadBubble,
    paginateBodyText,
    playSceneTransition,
    showChoices,
    clearChoices,
    destroy
  };
}

const TutorialOverlayModule = {
  createTutorialOverlay
};

export = TutorialOverlayModule;
