import type {
  BoardVisualGlowDescriptor,
  BoardVisualHintStyleDescriptor,
  BoardVisualShadowDescriptor,
  BoardVisualTextStyleDescriptor,
  BoardVisualThemeDescriptor
} from './types';

type TextStyleInput = Omit<Partial<BoardVisualTextStyleDescriptor>, 'shadows' | 'glow'> & {
  shadows?: readonly Partial<BoardVisualShadowDescriptor>[];
  glow?: Partial<BoardVisualGlowDescriptor> | null;
};

export type BoardVisualThemeInput = Omit<Partial<BoardVisualThemeDescriptor>,
  'boardBonus' | 'timer' | 'directionHint' | 'legalHint'> & {
  boardBonus?: TextStyleInput;
  timer?: TextStyleInput;
  directionHint?: TextStyleInput;
  legalHint?: Partial<BoardVisualHintStyleDescriptor>;
};

const COLOR_KEYWORDS = new Set([
  'black', 'white', 'transparent', 'red', 'green', 'blue', 'yellow',
  'gray', 'grey', 'silver', 'maroon', 'purple', 'fuchsia', 'lime', 'olive', 'navy',
  'teal', 'aqua', 'orange'
]);

const DEFAULT_FONT_FAMILY = 'sans-serif';

function freezeShadow(value: BoardVisualShadowDescriptor): BoardVisualShadowDescriptor {
  return Object.freeze(value);
}

function freezeGlow(value: BoardVisualGlowDescriptor | null): BoardVisualGlowDescriptor | null {
  return value ? Object.freeze(value) : null;
}

const DEFAULT_BONUS_STYLE: BoardVisualTextStyleDescriptor = Object.freeze({
  fontFamily: DEFAULT_FONT_FAMILY,
  fontWeight: 500,
  fontSizeRatio: 0.375,
  doubleDigitScale: 0.88,
  lineHeight: 1,
  color: 'rgba(206, 235, 214, 0.60)',
  shadows: Object.freeze([
    freezeShadow({ offsetXRatio: 0, offsetYRatio: -0.016, blurRatio: 0, color: 'rgba(238, 255, 236, 0.24)' }),
    freezeShadow({ offsetXRatio: 0, offsetYRatio: 0.016, blurRatio: 0.032, color: 'rgba(0, 0, 0, 0.74)' })
  ]),
  glow: freezeGlow({ blurRatio: 0.08, color: 'rgba(112, 212, 184, 0.24)' })
});

const DEFAULT_TIMER_STYLE: BoardVisualTextStyleDescriptor = Object.freeze({
  fontFamily: DEFAULT_FONT_FAMILY,
  fontWeight: 700,
  fontSizeRatio: 0.2,
  doubleDigitScale: 0.9,
  lineHeight: 1,
  color: '#ffffff',
  shadows: Object.freeze([
    freezeShadow({ offsetXRatio: 0, offsetYRatio: 0.016, blurRatio: 0.032, color: 'rgba(0, 0, 0, 0.72)' })
  ]),
  glow: freezeGlow({ blurRatio: 0.064, color: 'rgba(0, 0, 0, 0.55)' })
});

const DEFAULT_DIRECTION_HINT_STYLE: BoardVisualTextStyleDescriptor = Object.freeze({
  fontFamily: '"DotGothic16", "MS Gothic", "Osaka-Mono", monospace',
  fontWeight: 700,
  fontSizeRatio: 0.27,
  doubleDigitScale: 1,
  lineHeight: 1,
  color: '#f7fffc',
  shadows: Object.freeze([]),
  glow: freezeGlow({ blurRatio: 0.05, color: 'rgba(255, 255, 255, 0.28)' })
});

const DEFAULT_LEGAL_HINT_STYLE: BoardVisualHintStyleDescriptor = Object.freeze({
  ringColor: 'rgba(159, 255, 232, 0.40)',
  highlightColor: 'rgba(230, 255, 249, 0.20)',
  glowColor: 'rgba(105, 255, 222, 0.10)',
  lineWidthRatio: 0.024,
  glowBlurRatio: 0.08
});

const DEFAULT_BOARD_VISUAL_THEME: BoardVisualThemeDescriptor = Object.freeze({
  revision: 0,
  fontReadyEpoch: 0,
  surfaceColor: '#0a6b55',
  gridColor: '#142c25',
  outerBoundaryColor: '#091d18',
  holeBoundaryColor: '#6b2020',
  markerColor: DEFAULT_BONUS_STYLE.color,
  hintColor: DEFAULT_LEGAL_HINT_STYLE.ringColor,
  timerColor: DEFAULT_TIMER_STYLE.color,
  fontFamily: DEFAULT_BONUS_STYLE.fontFamily,
  gridLineWidth: 1,
  boardBonus: DEFAULT_BONUS_STYLE,
  timer: DEFAULT_TIMER_STYLE,
  directionHint: DEFAULT_DIRECTION_HINT_STYLE,
  legalHint: DEFAULT_LEGAL_HINT_STYLE
});

function isSafeCssColor(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 128 || /[;{}<>]/.test(normalized)) return false;
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(normalized)) return true;
  if (/^(?:rgb|rgba|hsl|hsla)\(\s*[-+.\d%deg,\s/]+\)$/i.test(normalized)) return true;
  return COLOR_KEYWORDS.has(normalized);
}

function isSafeFontFamily(value: unknown): value is string {
  return typeof value === 'string'
    && value.trim().length > 0
    && value.length <= 256
    && !/[;{}<>\r\n]/.test(value)
    && !/(?:url|var)\s*\(/i.test(value);
}

function validatedColor(value: unknown, key: string): string {
  if (!isSafeCssColor(value)) throw new Error(`Invalid board theme color: ${key}`);
  return value.trim();
}

function validatedNumber(value: unknown, key: string, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    throw new Error(`Invalid board theme number: ${key}`);
  }
  return numeric;
}

function createShadowDescriptor(
  source: Partial<BoardVisualShadowDescriptor>,
  key: string
): BoardVisualShadowDescriptor {
  return freezeShadow({
    offsetXRatio: validatedNumber(source.offsetXRatio, `${key}.offsetXRatio`, -4, 4),
    offsetYRatio: validatedNumber(source.offsetYRatio, `${key}.offsetYRatio`, -4, 4),
    blurRatio: validatedNumber(source.blurRatio, `${key}.blurRatio`, 0, 4),
    color: validatedColor(source.color, `${key}.color`)
  });
}

function createGlowDescriptor(
  source: Partial<BoardVisualGlowDescriptor> | null,
  key: string
): BoardVisualGlowDescriptor | null {
  if (source === null) return null;
  return freezeGlow({
    blurRatio: validatedNumber(source.blurRatio, `${key}.blurRatio`, 0, 4),
    color: validatedColor(source.color, `${key}.color`)
  });
}

function createTextStyleDescriptor(
  defaults: BoardVisualTextStyleDescriptor,
  source: TextStyleInput | undefined,
  key: string,
  inheritedFontFamily?: string,
  inheritedColor?: string
): BoardVisualTextStyleDescriptor {
  const merged = source || {};
  const fontFamily = merged.fontFamily ?? inheritedFontFamily ?? defaults.fontFamily;
  if (!isSafeFontFamily(fontFamily)) throw new Error(`Invalid board theme fontFamily: ${key}`);
  const shadowSources = merged.shadows === undefined ? defaults.shadows : merged.shadows;
  const glowSource = merged.glow === undefined ? defaults.glow : merged.glow;
  return Object.freeze({
    fontFamily: fontFamily.trim(),
    fontWeight: validatedNumber(merged.fontWeight ?? defaults.fontWeight, `${key}.fontWeight`, 1, 1000),
    fontSizeRatio: validatedNumber(merged.fontSizeRatio ?? defaults.fontSizeRatio, `${key}.fontSizeRatio`, 0.01, 4),
    doubleDigitScale: validatedNumber(merged.doubleDigitScale ?? defaults.doubleDigitScale, `${key}.doubleDigitScale`, 0.1, 1),
    lineHeight: validatedNumber(merged.lineHeight ?? defaults.lineHeight, `${key}.lineHeight`, 0.1, 4),
    color: validatedColor(merged.color ?? inheritedColor ?? defaults.color, `${key}.color`),
    shadows: Object.freeze(shadowSources.map((shadow, index) => createShadowDescriptor(shadow, `${key}.shadows[${index}]`))),
    glow: createGlowDescriptor(glowSource, `${key}.glow`)
  });
}

function createHintStyleDescriptor(
  defaults: BoardVisualHintStyleDescriptor,
  source: Partial<BoardVisualHintStyleDescriptor> | undefined,
  inheritedRingColor?: string
): BoardVisualHintStyleDescriptor {
  const merged = source || {};
  return Object.freeze({
    ringColor: validatedColor(merged.ringColor ?? inheritedRingColor ?? defaults.ringColor, 'legalHint.ringColor'),
    highlightColor: validatedColor(merged.highlightColor ?? defaults.highlightColor, 'legalHint.highlightColor'),
    glowColor: validatedColor(merged.glowColor ?? defaults.glowColor, 'legalHint.glowColor'),
    lineWidthRatio: validatedNumber(merged.lineWidthRatio ?? defaults.lineWidthRatio, 'legalHint.lineWidthRatio', 0, 1),
    glowBlurRatio: validatedNumber(merged.glowBlurRatio ?? defaults.glowBlurRatio, 'legalHint.glowBlurRatio', 0, 4)
  });
}

export function createBoardVisualThemeDescriptor(
  source: BoardVisualThemeInput = {}
): BoardVisualThemeDescriptor {
  const legacyFontFamily = source.fontFamily ?? DEFAULT_BOARD_VISUAL_THEME.fontFamily;
  if (!isSafeFontFamily(legacyFontFamily)) throw new Error('Invalid board theme fontFamily');
  const boardBonus = createTextStyleDescriptor(
    DEFAULT_BONUS_STYLE,
    source.boardBonus,
    'boardBonus',
    legacyFontFamily,
    source.markerColor
  );
  const timer = createTextStyleDescriptor(
    DEFAULT_TIMER_STYLE,
    source.timer,
    'timer',
    legacyFontFamily,
    source.timerColor
  );
  const directionHint = createTextStyleDescriptor(
    DEFAULT_DIRECTION_HINT_STYLE,
    source.directionHint,
    'directionHint'
  );
  const legalHint = createHintStyleDescriptor(DEFAULT_LEGAL_HINT_STYLE, source.legalHint, source.hintColor);
  const gridLineWidth = validatedNumber(
    source.gridLineWidth ?? DEFAULT_BOARD_VISUAL_THEME.gridLineWidth,
    'gridLineWidth',
    0,
    16
  );
  const revision = Math.max(0, Math.trunc(validatedNumber(source.revision ?? 0, 'revision', 0, Number.MAX_SAFE_INTEGER)));
  const fontReadyEpoch = Math.max(0, Math.trunc(validatedNumber(
    source.fontReadyEpoch ?? 0,
    'fontReadyEpoch',
    0,
    Number.MAX_SAFE_INTEGER
  )));
  return Object.freeze({
    revision,
    fontReadyEpoch,
    surfaceColor: validatedColor(source.surfaceColor ?? DEFAULT_BOARD_VISUAL_THEME.surfaceColor, 'surfaceColor'),
    gridColor: validatedColor(source.gridColor ?? DEFAULT_BOARD_VISUAL_THEME.gridColor, 'gridColor'),
    outerBoundaryColor: validatedColor(
      source.outerBoundaryColor ?? DEFAULT_BOARD_VISUAL_THEME.outerBoundaryColor,
      'outerBoundaryColor'
    ),
    holeBoundaryColor: validatedColor(
      source.holeBoundaryColor ?? DEFAULT_BOARD_VISUAL_THEME.holeBoundaryColor,
      'holeBoundaryColor'
    ),
    markerColor: boardBonus.color,
    hintColor: legalHint.ringColor,
    timerColor: timer.color,
    fontFamily: boardBonus.fontFamily,
    gridLineWidth,
    boardBonus,
    timer,
    directionHint,
    legalHint
  });
}

function readThemeToken(style: CSSStyleDeclaration | null, property: string): string {
  if (!style || typeof style.getPropertyValue !== 'function') return '';
  return String(style.getPropertyValue(property) || '').trim();
}

function readColorToken(style: CSSStyleDeclaration | null, property: string, fallback: string): string {
  const value = readThemeToken(style, property);
  return isSafeCssColor(value) ? value : fallback;
}

function readFontToken(
  style: CSSStyleDeclaration | null,
  property: string,
  fallback: string,
  aliases: readonly string[] = []
): string {
  for (const key of [property, ...aliases]) {
    const value = readThemeToken(style, key);
    if (isSafeFontFamily(value)) return value;
  }
  return fallback;
}

function readNumberToken(
  style: CSSStyleDeclaration | null,
  property: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = readThemeToken(style, property);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

type FontReadyState = {
  epoch: number;
  observedReady: PromiseLike<unknown> | null;
  listeners: Set<() => void>;
};

const FONT_READY_STATES = new WeakMap<Document, FontReadyState>();

function resolveThemeDocument(target: HTMLElement | Document | null): Document | null {
  if (!target) return null;
  if ((target as Document).nodeType === 9) return target as Document;
  return (target as HTMLElement).ownerDocument || null;
}

function getFontReadyState(doc: Document): FontReadyState {
  let state = FONT_READY_STATES.get(doc);
  if (!state) {
    state = { epoch: 0, observedReady: null, listeners: new Set() };
    FONT_READY_STATES.set(doc, state);
  }
  return state;
}

function advanceFontReadyEpoch(doc: Document, expectedReady?: PromiseLike<unknown>) {
  const state = getFontReadyState(doc);
  if (expectedReady && state.observedReady !== expectedReady) return;
  state.epoch = Math.min(Number.MAX_SAFE_INTEGER, state.epoch + 1);
  for (const listener of Array.from(state.listeners)) listener();
}

export function observeBoardVisualThemeFonts(
  target: HTMLElement | Document | null,
  onReady?: () => void
): () => void {
  const doc = resolveThemeDocument(target);
  if (!doc) return () => {};
  const state = getFontReadyState(doc);
  if (onReady) state.listeners.add(onReady);
  const fontSet = (doc as Document & { fonts?: { ready?: PromiseLike<unknown> } }).fonts;
  const ready = fontSet && fontSet.ready;
  if (ready && typeof ready.then === 'function' && state.observedReady !== ready) {
    state.observedReady = ready;
    Promise.resolve(ready).then(
      () => advanceFontReadyEpoch(doc, ready),
      () => { /* A failed font load keeps the last validated descriptor. */ }
    );
  }
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (onReady) state.listeners.delete(onReady);
  };
}

export function markBoardVisualThemeFontsReady(target: HTMLElement | Document | null): number {
  const doc = resolveThemeDocument(target);
  if (!doc) return 0;
  advanceFontReadyEpoch(doc);
  return getFontReadyState(doc).epoch;
}

export function getBoardVisualThemeFontReadyEpoch(target: HTMLElement | Document | null): number {
  const doc = resolveThemeDocument(target);
  return doc ? getFontReadyState(doc).epoch : 0;
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
  observeBoardVisualThemeFonts(host);
  const fontFamily = readFontToken(
    style,
    '--board-bonus-number-font-family',
    DEFAULT_BOARD_VISUAL_THEME.fontFamily,
    ['--selected-app-font-accent-family', '--selected-app-font-family']
  );
  const markerColor = readColorToken(style, '--board-bonus-number-color', DEFAULT_BOARD_VISUAL_THEME.markerColor);
  const hintColor = readColorToken(style, '--board-legal-ring-color', DEFAULT_BOARD_VISUAL_THEME.hintColor);
  const timerColor = readColorToken(style, '--board-timer-color', DEFAULT_BOARD_VISUAL_THEME.timerColor);
  return createBoardVisualThemeDescriptor({
    revision,
    fontReadyEpoch: getBoardVisualThemeFontReadyEpoch(host),
    surfaceColor: readColorToken(style, '--board-surface-base-color', DEFAULT_BOARD_VISUAL_THEME.surfaceColor),
    gridColor: readColorToken(style, '--board-grid-color', DEFAULT_BOARD_VISUAL_THEME.gridColor),
    outerBoundaryColor: readColorToken(
      style,
      '--board-outer-boundary-color',
      DEFAULT_BOARD_VISUAL_THEME.outerBoundaryColor
    ),
    holeBoundaryColor: readColorToken(
      style,
      '--board-hole-boundary-color',
      DEFAULT_BOARD_VISUAL_THEME.holeBoundaryColor
    ),
    markerColor,
    hintColor,
    timerColor,
    fontFamily,
    gridLineWidth: readNumberToken(style, '--board-grid-line-width', DEFAULT_BOARD_VISUAL_THEME.gridLineWidth, 0, 16),
    boardBonus: {
      fontFamily,
      fontWeight: readNumberToken(style, '--board-bonus-font-weight', DEFAULT_BONUS_STYLE.fontWeight, 1, 1000),
      fontSizeRatio: readNumberToken(
        style,
        '--board-bonus-font-size-ratio',
        DEFAULT_BONUS_STYLE.fontSizeRatio,
        0.01,
        4
      ),
      doubleDigitScale: readNumberToken(
        style,
        '--board-bonus-double-digit-scale',
        DEFAULT_BONUS_STYLE.doubleDigitScale,
        0.1,
        1
      ),
      color: markerColor,
      shadows: DEFAULT_BONUS_STYLE.shadows,
      glow: {
        blurRatio: readNumberToken(
          style,
          '--board-bonus-glow-blur-ratio',
          DEFAULT_BONUS_STYLE.glow?.blurRatio || 0,
          0,
          4
        ),
        color: readColorToken(
          style,
          '--board-bonus-number-glow',
          DEFAULT_BONUS_STYLE.glow?.color || 'transparent'
        )
      }
    },
    timer: {
      fontFamily: readFontToken(style, '--board-timer-font-family', fontFamily, ['--selected-app-font-accent-family']),
      fontWeight: readNumberToken(style, '--board-timer-font-weight', DEFAULT_TIMER_STYLE.fontWeight, 1, 1000),
      fontSizeRatio: readNumberToken(style, '--board-timer-font-size-ratio', DEFAULT_TIMER_STYLE.fontSizeRatio, 0.01, 4),
      doubleDigitScale: readNumberToken(
        style,
        '--board-timer-double-digit-scale',
        DEFAULT_TIMER_STYLE.doubleDigitScale,
        0.1,
        1
      ),
      color: timerColor,
      shadows: DEFAULT_TIMER_STYLE.shadows,
      glow: DEFAULT_TIMER_STYLE.glow
    },
    directionHint: {
      fontFamily: readFontToken(
        style,
        '--board-direction-hint-font-family',
        DEFAULT_DIRECTION_HINT_STYLE.fontFamily,
        ['--selected-app-font-accent-family']
      ),
      fontWeight: readNumberToken(
        style,
        '--board-direction-hint-font-weight',
        DEFAULT_DIRECTION_HINT_STYLE.fontWeight,
        1,
        1000
      ),
      fontSizeRatio: readNumberToken(
        style,
        '--board-direction-hint-font-size-ratio',
        DEFAULT_DIRECTION_HINT_STYLE.fontSizeRatio,
        0.01,
        4
      ),
      doubleDigitScale: 1,
      color: readColorToken(style, '--board-direction-hint-color', DEFAULT_DIRECTION_HINT_STYLE.color),
      shadows: DEFAULT_DIRECTION_HINT_STYLE.shadows,
      glow: {
        blurRatio: readNumberToken(
          style,
          '--board-direction-hint-glow-blur-ratio',
          DEFAULT_DIRECTION_HINT_STYLE.glow?.blurRatio || 0,
          0,
          4
        ),
        color: readColorToken(
          style,
          '--board-direction-hint-glow-color',
          DEFAULT_DIRECTION_HINT_STYLE.glow?.color || 'transparent'
        )
      }
    },
    legalHint: {
      ringColor: hintColor,
      highlightColor: readColorToken(
        style,
        '--board-legal-ring-highlight',
        DEFAULT_LEGAL_HINT_STYLE.highlightColor
      ),
      glowColor: readColorToken(style, '--board-legal-ring-glow', DEFAULT_LEGAL_HINT_STYLE.glowColor),
      lineWidthRatio: readNumberToken(
        style,
        '--board-legal-ring-line-width-ratio',
        DEFAULT_LEGAL_HINT_STYLE.lineWidthRatio,
        0,
        1
      ),
      glowBlurRatio: readNumberToken(
        style,
        '--board-legal-ring-glow-blur-ratio',
        DEFAULT_LEGAL_HINT_STYLE.glowBlurRatio,
        0,
        4
      )
    }
  });
}

export {
  DEFAULT_BOARD_VISUAL_THEME,
  isSafeCssColor,
  isSafeFontFamily
};
