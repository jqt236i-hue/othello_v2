declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file timer-service.js
 * Timer abstraction for game/ layer. Real timing is supplied by game/timers,
 * which is injected by the UI boundary.
 */

let TimersModule: any = null;
try {
  TimersModule = _require('./timers');
} catch (e) {
  TimersModule = null;
}

function hasInjectedTimers(timers: any): boolean {
  return !!(
    timers
    && typeof timers.waitMs === 'function'
    && (typeof timers.hasTimerImpl !== 'function' || timers.hasTimerImpl() === true)
  );
}

function runSoon(callback: any): void {
  if (typeof process !== 'undefined' && typeof process.nextTick === 'function') {
    process.nextTick(callback);
    return;
  }
  try { callback(); } catch (e) { /* ignore */ }
}

class TimerService {
  mode: any;
  timers: any;

  constructor(mode: any = 'browser', timers: any = TimersModule) {
    this.mode = mode;
    this.timers = timers || null;
  }

  setTimeout(callback: any, delay: any): any {
    const handle: any = { cancelled: false };
    const timers = this.timers || TimersModule;
    if (hasInjectedTimers(timers)) {
      try {
        Promise.resolve(timers.waitMs(delay)).then(() => {
          if (!handle.cancelled) callback();
        });
        return handle;
      } catch (e) { /* fall through */ }
    }

    if (this.mode !== 'browser') {
      runSoon(() => {
        if (!handle.cancelled) callback();
      });
    }
    return handle;
  }

  clearTimeout(id: any): void {
    if (id && typeof id === 'object') id.cancelled = true;
  }

  setInterval(callback: any, delay: any): any {
    const handle: any = { cancelled: false };
    const timers = this.timers || TimersModule;
    const tick = () => {
      if (handle.cancelled) return;
      callback();
      if (handle.cancelled || !hasInjectedTimers(timers)) return;
      Promise.resolve(timers.waitMs(delay)).then(tick);
    };

    if (hasInjectedTimers(timers)) {
      try {
        Promise.resolve(timers.waitMs(delay)).then(tick);
        return handle;
      } catch (e) { /* fall through */ }
    }

    if (this.mode !== 'browser') {
      runSoon(tick);
    }
    return handle;
  }

  clearInterval(id: any): void {
    if (id && typeof id === 'object') id.cancelled = true;
  }
}

function createTimerService(mode: any, timers?: any): TimerService {
  return new TimerService(mode, timers);
}

module.exports = { TimerService, createTimerService };

export {};
