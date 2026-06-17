import * as fs from 'fs';
import * as path from 'path';

export const LAYOUT_STYLE_FILES = [
  'styles-layout.css',
  'styles-charge-hud.css',
  'styles-layout-controls.css',
  'styles-layout-info.css',
  'styles-layout-result.css',
  'styles-layout-characters.css',
];

export const CORE_UI_STYLE_FILES = [
  'styles-base.css',
  ...LAYOUT_STYLE_FILES,
  'styles-board.css',
  'styles-cards.css',
  'styles-responsive.css',
  'styles-animations.css',
];

export function readRepoTextFile(fileName: string): string {
  return fs.readFileSync(path.join(__dirname, '..', '..', fileName), 'utf8');
}

export function requireExistingStyleFiles(fileNames: string[]): string[] {
  const missingFiles = fileNames.filter((fileName) => !fs.existsSync(path.join(__dirname, '..', '..', fileName)));
  if (missingFiles.length > 0) {
    throw new Error(`Missing style files: ${missingFiles.join(', ')}`);
  }
  return fileNames;
}

export function readStyleSurface(fileNames: string[]): string {
  return requireExistingStyleFiles(fileNames)
    .map((fileName) => readRepoTextFile(fileName))
    .join('\n');
}

export function readLayoutCssSurface(): string {
  return readStyleSurface(LAYOUT_STYLE_FILES);
}

export function escapeCssSelectorForRegExp(selector: string): string {
  return selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function readCssBlock(css: string, selector: string): string {
  const escapedSelector = escapeCssSelectorForRegExp(selector);
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`));
  if (!match) {
    throw new Error(`Missing CSS block for selector: ${selector}`);
  }
  return match[0];
}

export function expectCssBlockToContain(css: string, selector: string, pattern: RegExp): void {
  expect(readCssBlock(css, selector)).toEqual(expect.stringMatching(pattern));
}

export function expectCssBlockNotToContain(css: string, selector: string, pattern: RegExp): void {
  expect(readCssBlock(css, selector)).not.toEqual(expect.stringMatching(pattern));
}
