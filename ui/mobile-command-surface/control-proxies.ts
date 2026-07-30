import {
  MOBILE_QUICK_CONTROLS,
} from './config';
import type {
  MobileQuickButtonDefinition,
  MobileQuickRangeDefinition,
  MobileQuickSelectDefinition,
} from './config';
import type {
  MobileCommandSurfaceView,
} from './view';

interface MobileControlProxyOptions {
  root: Window;
  document: Document;
  view: MobileCommandSurfaceView;
  confirmReset(message: string): boolean;
}

interface MobileControlProxyController {
  sync(): void;
  destroy(): void;
}

function createMobileControlProxyController(
  options: MobileControlProxyOptions,
): MobileControlProxyController {
  const {
    root,
    document,
    view,
    confirmReset,
  } = options;
  const cleanups: Array<() => void> = [];
  let syncQueued = false;
  let destroyed = false;

  const byId = <T extends HTMLElement>(id: string): T | null => (
    document.getElementById(id) as T | null
  );

  const listen = (
    target: EventTarget | null,
    type: string,
    listener: EventListener,
  ): void => {
    if (!target) return;
    target.addEventListener(type, listener);
    cleanups.push(() => target.removeEventListener(type, listener));
  };

  const buttonDefinitions = MOBILE_QUICK_CONTROLS.filter(
    (definition): definition is MobileQuickButtonDefinition => definition.kind === 'button',
  );
  const buttonDefinitionBySource = new Map<string, MobileQuickButtonDefinition>(
    buttonDefinitions.map((definition) => [definition.sourceId, definition]),
  );
  const selectDefinition = MOBILE_QUICK_CONTROLS.find(
    (definition): definition is MobileQuickSelectDefinition => definition.kind === 'select',
  );
  const rangeDefinition = MOBILE_QUICK_CONTROLS.find(
    (definition): definition is MobileQuickRangeDefinition => definition.kind === 'range',
  );
  const sourceSelect = selectDefinition
    ? byId<HTMLSelectElement>(selectDefinition.sourceId)
    : null;
  const sourceRange = rangeDefinition
    ? byId<HTMLInputElement>(rangeDefinition.sourceId)
    : null;

  const sync = (): void => {
    if (destroyed) return;
    syncQueued = false;
    view.quickButtonProxies.forEach((proxy) => {
      const sourceId = proxy.dataset.mobileProxy;
      const source = sourceId ? byId<HTMLButtonElement>(sourceId) : null;
      if (!source) {
        proxy.disabled = true;
        return;
      }
      const label = source.textContent?.trim() || source.getAttribute('aria-label') || '';
      if (label && proxy.textContent !== label) proxy.textContent = label;
      proxy.disabled = source.disabled;
      const pressed = source.getAttribute('aria-pressed');
      if (pressed === null) proxy.removeAttribute('aria-pressed');
      else proxy.setAttribute('aria-pressed', pressed);
      proxy.classList.toggle('is-active', source.classList.contains('btn-active') || pressed === 'true');
    });

    if (sourceSelect && view.quickSelect) {
      const signature = Array.from(sourceSelect.options)
        .map((option) => `${option.value}\u0000${option.textContent || ''}`)
        .join('\u0001');
      if (view.quickSelect.dataset.optionSignature !== signature) {
        view.quickSelect.dataset.optionSignature = signature;
        view.quickSelect.replaceChildren(...Array.from(sourceSelect.options).map((sourceOption) => {
          const option = document.createElement('option');
          option.value = sourceOption.value;
          option.textContent = sourceOption.textContent;
          option.disabled = sourceOption.disabled;
          return option;
        }));
      }
      if (document.activeElement !== view.quickSelect) {
        view.quickSelect.value = sourceSelect.value;
      }
    }

    if (sourceRange && view.quickRange && document.activeElement !== view.quickRange) {
      view.quickRange.value = sourceRange.value;
    }
  };

  const scheduleSync = (): void => {
    if (syncQueued || destroyed) return;
    syncQueued = true;
    if (typeof root.requestAnimationFrame === 'function') {
      root.requestAnimationFrame(() => sync());
    } else {
      root.setTimeout(sync, 0);
    }
  };

  view.quickButtonProxies.forEach((proxy) => {
    listen(proxy, 'click', (() => {
      const sourceId = proxy.dataset.mobileProxy;
      const source = sourceId ? byId<HTMLButtonElement>(sourceId) : null;
      const definition = sourceId ? buttonDefinitionBySource.get(sourceId) : null;
      if (!source || !definition) return;
      if (
        definition.confirm === 'local-reset'
        && source.dataset.rematchState !== 'network'
        && !confirmReset('現在の対局をリセットしますか？')
      ) {
        return;
      }
      source.click();
      scheduleSync();
    }) as EventListener);
  });

  if (sourceSelect && view.quickSelect) {
    listen(view.quickSelect, 'change', (() => {
      sourceSelect.value = view.quickSelect!.value;
      sourceSelect.dispatchEvent(new root.Event('change', { bubbles: true }));
      scheduleSync();
    }) as EventListener);
  }

  if (sourceRange && view.quickRange) {
    const forwardRangeEvent = (eventType: 'input' | 'change'): EventListener => (() => {
      sourceRange.value = view.quickRange!.value;
      sourceRange.dispatchEvent(new root.Event(eventType, { bubbles: true }));
      scheduleSync();
    }) as EventListener;
    listen(view.quickRange, 'input', forwardRangeEvent('input'));
    listen(view.quickRange, 'change', forwardRangeEvent('change'));
  }

  const observedSources = new Set<HTMLElement>();
  buttonDefinitions.forEach((definition) => {
    const source = byId(definition.sourceId);
    if (source) observedSources.add(source);
  });
  if (sourceSelect) observedSources.add(sourceSelect);
  if (sourceRange) observedSources.add(sourceRange);

  const observer = new root.MutationObserver(scheduleSync);
  observedSources.forEach((source) => {
    observer.observe(source, {
      attributes: true,
      attributeFilter: ['class', 'aria-pressed', 'disabled', 'data-rematch-state'],
      childList: true,
      subtree: true,
      characterData: true,
    });
    listen(source, 'click', scheduleSync as EventListener);
    listen(source, 'change', scheduleSync as EventListener);
    listen(source, 'input', scheduleSync as EventListener);
  });

  sync();

  return {
    sync,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
    },
  };
}

export {
  createMobileControlProxyController,
};

export type {
  MobileControlProxyController,
  MobileControlProxyOptions,
};
