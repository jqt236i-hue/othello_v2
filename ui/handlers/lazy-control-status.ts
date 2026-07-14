'use strict';

interface LazyControlStatus {
  begin: () => void;
  succeed: () => void;
  fail: () => void;
}

function createLazyControlStatus(control: HTMLElement | null, featureLabel: string): LazyControlStatus {
  const label = String(featureLabel || '機能').trim() || '機能';
  const originalTitle = control ? control.getAttribute('title') : null;
  const originalAriaLabel = control ? control.getAttribute('aria-label') : null;

  const restoreDescription = (): void => {
    if (!control) return;
    if (originalTitle === null) control.removeAttribute('title');
    else control.setAttribute('title', originalTitle);
    if (originalAriaLabel === null) control.removeAttribute('aria-label');
    else control.setAttribute('aria-label', originalAriaLabel);
  };

  return {
    begin(): void {
      if (!control) return;
      control.setAttribute('aria-busy', 'true');
      control.setAttribute('data-lazy-load-state', 'loading');
      control.setAttribute('title', `${label}を読み込んでいます`);
      control.setAttribute('aria-label', `${label}を読み込んでいます`);
    },
    succeed(): void {
      if (!control) return;
      control.removeAttribute('aria-busy');
      control.setAttribute('data-lazy-load-state', 'loaded');
      restoreDescription();
    },
    fail(): void {
      if (!control) return;
      control.removeAttribute('aria-busy');
      control.setAttribute('data-lazy-load-state', 'error');
      control.setAttribute('title', `${label}の読み込みに失敗しました。もう一度押すと再試行します`);
      control.setAttribute('aria-label', `${label}の読み込みに失敗しました。もう一度押すと再試行します`);
    }
  };
}

export = { createLazyControlStatus };
