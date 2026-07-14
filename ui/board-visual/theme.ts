import type { BoardVisualThemeDescriptor } from './types';

const DEFAULT_BOARD_VISUAL_THEME: BoardVisualThemeDescriptor = Object.freeze({
  revision: 0,
  surfaceColor: '#0a6b55',
  gridColor: '#142c25',
  outerBoundaryColor: '#091d18',
  holeBoundaryColor: '#6b2020',
  markerColor: '#f3e8bd',
  hintColor: '#f5d76e',
  timerColor: '#ffffff',
  fontFamily: 'sans-serif',
  gridLineWidth: 1
});

function isSafeCssColor(value: unknown): boolean {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 128
    && !/[;{}]/.test(value);
}

export function createBoardVisualThemeDescriptor(
  source: Partial<BoardVisualThemeDescriptor> = {}
): BoardVisualThemeDescriptor {
  const next = { ...DEFAULT_BOARD_VISUAL_THEME, ...source };
  for (const key of [
    'surfaceColor',
    'gridColor',
    'outerBoundaryColor',
    'holeBoundaryColor',
    'markerColor',
    'hintColor',
    'timerColor'
  ] as const) {
    if (!isSafeCssColor(next[key])) throw new Error(`Invalid board theme color: ${key}`);
  }
  if (typeof next.fontFamily !== 'string' || !next.fontFamily.trim() || /[;{}]/.test(next.fontFamily)) {
    throw new Error('Invalid board theme fontFamily');
  }
  const gridLineWidth = Number(next.gridLineWidth);
  if (!Number.isFinite(gridLineWidth) || gridLineWidth < 0 || gridLineWidth > 16) {
    throw new Error('Invalid board theme gridLineWidth');
  }
  return Object.freeze({
    ...next,
    revision: Math.max(0, Math.trunc(Number(next.revision) || 0)),
    gridLineWidth
  });
}

function readThemeToken(style: CSSStyleDeclaration | null, property: string, fallback: string): string {
  if (!style || typeof style.getPropertyValue !== 'function') return fallback;
  const value = String(style.getPropertyValue(property) || '').trim();
  return value || fallback;
}

export function resolveBoardVisualThemeDescriptor(
  host: HTMLElement | null,
  revision = 0
): BoardVisualThemeDescriptor {
  let style: CSSStyleDeclaration | null = null;
  try {
    const view = host && host.ownerDocument && host.ownerDocument.defaultView;
    if (host && view && typeof view.getComputedStyle === 'function') style = view.getComputedStyle(host);
  } catch (e) { /* use validated defaults */ }
  return createBoardVisualThemeDescriptor({
    revision,
    surfaceColor: readThemeToken(style, '--board-surface-base-color', DEFAULT_BOARD_VISUAL_THEME.surfaceColor),
    markerColor: readThemeToken(style, '--board-bonus-number-color', DEFAULT_BOARD_VISUAL_THEME.markerColor),
    hintColor: readThemeToken(style, '--board-legal-ring-color', DEFAULT_BOARD_VISUAL_THEME.hintColor),
    fontFamily: readThemeToken(style, '--board-bonus-number-font-family', DEFAULT_BOARD_VISUAL_THEME.fontFamily)
  });
}

export { DEFAULT_BOARD_VISUAL_THEME };
