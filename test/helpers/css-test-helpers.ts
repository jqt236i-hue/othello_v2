import * as fs from 'fs';
import * as path from 'path';

export const LAYOUT_STYLE_FILES = [
  'styles-layout.css',
  'styles-layout-result.css',
  'styles-layout-characters.css',
  'styles-layout-info.css',
  'styles-layout-controls.css',
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

export function getExistingStyleFiles(fileNames: string[]): string[] {
  return fileNames.filter((fileName) => fs.existsSync(path.join(__dirname, '..', '..', fileName)));
}

export function readStyleSurface(fileNames: string[]): string {
  return getExistingStyleFiles(fileNames)
    .map((fileName) => readRepoTextFile(fileName))
    .join('\n');
}

export function readLayoutCssSurface(): string {
  return readStyleSurface(LAYOUT_STYLE_FILES);
}
