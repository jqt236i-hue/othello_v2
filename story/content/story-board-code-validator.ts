import type { StoryValidatorBoardCodeResult } from '../core/story-validator';
import { safeDecodeStoryBoardCode } from '../core/story-board-codec';

export function validateStoryBoardCode(boardCode: string): StoryValidatorBoardCodeResult {
  const result = safeDecodeStoryBoardCode(boardCode);
  if (result.ok && result.setup) {
    return {
      ok: true,
      boardSize: {
        rows: result.setup.rows,
        cols: result.setup.cols
      }
    };
  }
  const firstError = result.issues.find((issue) => issue.severity === 'error');
  return {
    ok: false,
    message: firstError ? firstError.message : 'story board code decode failed.'
  };
}
