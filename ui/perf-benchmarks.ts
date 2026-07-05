/**
 * @file perf-benchmarks.ts
 * @description Debug-only performance benchmark helpers (PR1 instrumentation).
 *
 * Activated ONLY when one of the following is set at module load:
 *   - window.__DEV_PERF__ === true
 *   - URL query string contains `?perf=1`
 *
 * Normal play path: every function early-returns after the boolean check,
 * so OFF has zero performance API calls (and zero string formatting cost).
 *
 * API:
 *   - isPerfBenchEnabled() => boolean
 *   - perfStart(name)       Mark `othello:<name>:start`
 *   - perfEnd(name)         Mark `othello:<name>:end`, measure `othello:<name>:measure`,
 *                           then clearMarks for both start/end (measure is kept).
 *
 * NOTE: Initialization reads __DEV_PERF__ / ?perf=1 once at module load.
 *       Reload the page after toggling window.__DEV_PERF__. PR1 is reload-scoped.
 */

const PERF_BENCH_ENABLED = ((): boolean => {
    if (typeof window === 'undefined') return false;
    if ((window as any).__DEV_PERF__ === true) return true;
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('perf') === '1';
    } catch (e: any) {
        return false;
    }
})();

const PERF_NAMESPACE = 'othello';

function _safeMark(name: string, detail?: any): void {
    if (!PERF_BENCH_ENABLED) return;
    if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return;
    try {
        const opts = (detail !== undefined && detail !== null) ? { detail } : undefined;
        performance.mark(name, opts);
    } catch (e: any) { /* ignore */ }
}

function _safeMeasure(measureName: string, startMark: string, endMark: string): void {
    if (!PERF_BENCH_ENABLED) return;
    if (typeof performance === 'undefined' || typeof performance.measure !== 'function') return;
    try {
        performance.measure(measureName, startMark, endMark);
    } catch (e: any) { /* mark missing */ }
}

function _safeClearMarks(...markNames: string[]): void {
    if (!PERF_BENCH_ENABLED) return;
    if (typeof performance === 'undefined' || typeof performance.clearMarks !== 'function') return;
    try {
        for (const m of markNames) {
            performance.clearMarks(m);
        }
    } catch (e: any) { /* ignore */ }
}

function isPerfBenchEnabled(): boolean {
    return PERF_BENCH_ENABLED;
}

function perfStart(name: string): void {
    // OFF path: early-return BEFORE any template-string allocation.
    if (!PERF_BENCH_ENABLED) return;
    const full = `${PERF_NAMESPACE}:${name}`;
    _safeMark(`${full}:start`);
}

function perfEnd(name: string): void {
    if (!PERF_BENCH_ENABLED) return;
    const full = `${PERF_NAMESPACE}:${name}`;
    _safeMark(`${full}:end`);
    _safeMeasure(`${full}:measure`, `${full}:start`, `${full}:end`);
    // Measure is kept. The underlying start/end marks are cleared to avoid
    // unbounded accumulation across many renderBoard / renderBoardDiff calls.
    _safeClearMarks(`${full}:start`, `${full}:end`);
}

function perfMarkOnly(name: string, detail?: any): void {
    if (!PERF_BENCH_ENABLED) return;
    const full = `${PERF_NAMESPACE}:${name}`;
    _safeMark(full, detail);
}

const PerfBenchmarks = {
    isPerfBenchEnabled,
    perfStart,
    perfEnd,
    perfMarkOnly
};

export = PerfBenchmarks;
