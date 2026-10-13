// Board expansion direction hints: one definition of direction normalization, glyph, and the
// cell-local center (0..1) shared by the Pixi glyph and the transparent accessibility button, so the
// visible arrow and its hit area always coincide.

export interface BoardDirectionHintGeometry {
  readonly directionKey: string;
  readonly glyph: string;
  /** Cell-local center as a fraction of the cell width. */
  readonly x: number;
  /** Cell-local center as a fraction of the cell height. */
  readonly y: number;
}

const LOW = 0.2;
const CENTER = 0.5;
const HIGH = 0.8;

function geometry(directionKey: string, glyph: string, x: number, y: number): BoardDirectionHintGeometry {
  return Object.freeze({ directionKey, glyph, x, y });
}

const BOARD_DIRECTION_HINT_GEOMETRY: Readonly<Record<string, BoardDirectionHintGeometry>> = Object.freeze({
  up: geometry('up', '↑', CENTER, LOW),
  down: geometry('down', '↓', CENTER, HIGH),
  left: geometry('left', '←', LOW, CENTER),
  right: geometry('right', '→', HIGH, CENTER),
  'up-left': geometry('up-left', '↖', LOW, LOW),
  'up-right': geometry('up-right', '↗', HIGH, LOW),
  'down-left': geometry('down-left', '↙', LOW, HIGH),
  'down-right': geometry('down-right', '↘', HIGH, HIGH)
});

export const BOARD_DIRECTION_KEYS: readonly string[] = Object.freeze(Object.keys(BOARD_DIRECTION_HINT_GEOMETRY));

export function normalizeBoardDirectionKey(value: unknown): string {
  const normalized = String(value == null ? '' : value).trim().toLowerCase();
  if (normalized === 'top') return 'up';
  if (normalized === 'bottom') return 'down';
  return normalized;
}

export function getBoardDirectionHintGeometry(directionKey: unknown): BoardDirectionHintGeometry | null {
  return BOARD_DIRECTION_HINT_GEOMETRY[normalizeBoardDirectionKey(directionKey)] || null;
}
