import * as ts from 'typescript';

// Detects file-level `@ts-nocheck` the way TypeScript does: the pragma is only honoured in the
// single-line comments of the leading comment block (after an optional BOM and shebang), with no
// limit on how many comment lines precede it. A mention inside a string, a later comment, or a
// block comment is not a directive.

const SINGLE_LINE_PRAGMA = /^\/\/\/?\s*@([^\s:]+)/;

export type NoCheckDirectiveScan = {
  /** TypeScript disables checking for this file (`checkJsDirective.enabled === false`). */
  active: boolean;
  /** Number of `@ts-nocheck` pragmas in the leading comment block. */
  count: number;
};

export function scanNoCheckDirective(source: string, fileName = 'source.ts'): NoCheckDirectiveScan {
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const shebang = ts.getShebang(text);
  const ranges = ts.getLeadingCommentRanges(text, shebang ? shebang.length : 0) || [];
  let count = 0;
  for (const range of ranges) {
    if (range.kind !== ts.SyntaxKind.SingleLineCommentTrivia) continue;
    const match = SINGLE_LINE_PRAGMA.exec(text.slice(range.pos, range.end));
    if (match && match[1].toLowerCase() === 'ts-nocheck') count += 1;
  }
  if (count === 0) return { active: false, count: 0 };
  // Let the TypeScript parser decide the final state (a later @ts-check re-enables checking).
  const header = ts.createSourceFile(fileName, text.slice(0, ranges[ranges.length - 1].end), ts.ScriptTarget.Latest, false);
  const directive = (header as ts.SourceFile & { checkJsDirective?: { enabled: boolean } }).checkJsDirective;
  return { active: !!directive && directive.enabled === false, count };
}

export function hasActiveNoCheckDirective(source: string, fileName?: string): boolean {
  return scanNoCheckDirective(source, fileName).active;
}
