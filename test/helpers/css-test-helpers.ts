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
