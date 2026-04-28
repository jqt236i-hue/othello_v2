#!/usr/bin/env node
declare function buildDefaultTeacherSolutionOutPath(inputPath: string): string;
declare function isHardcaseRecord(record: any): boolean;
declare function inferTeacherDecisionKind(record: any): string;
declare function toTeacherSolutionRecord(record: any, options: any): any;
declare function parseArgs(argv: string[]): {
    input: string;
    out: string;
    includeNonHardcase: boolean;
    limit: number;
    help: boolean;
};
declare function exportTeacherSolutions(args: any): Promise<{
    schemaVersion: string;
    method: string;
    inputPath: any;
    outPath: any;
    recordsRead: number;
    recordsWritten: number;
    parseErrors: number;
    skippedNonHardcase: number;
    byDecisionKind: {};
}>;
declare const _default: {
    TEACHER_SOLUTION_SCHEMA_VERSION: string;
    TEACHER_SOLUTION_METHOD: string;
    buildDefaultTeacherSolutionOutPath: typeof buildDefaultTeacherSolutionOutPath;
    isHardcaseRecord: typeof isHardcaseRecord;
    inferTeacherDecisionKind: typeof inferTeacherDecisionKind;
    toTeacherSolutionRecord: typeof toTeacherSolutionRecord;
    parseArgs: typeof parseArgs;
    exportTeacherSolutions: typeof exportTeacherSolutions;
};
export = _default;
//# sourceMappingURL=export-teacher-solutions.d.ts.map