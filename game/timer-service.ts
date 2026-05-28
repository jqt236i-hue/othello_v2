/**
 * @file timer-service.js
 * Timer abstraction for game/ layer. Real timing must be supplied by the UI boundary.
 */

function hasInjectedTimers(timers: any): boolean {
  return !!(
    timers
    && typeof timers.waitMs === 'function'
    && (typeof timers.hasTimerImpl !== 'function' || timers.hasTimerImpl() === true)
  );
}

class TimerService {
  timers: any;

  constructor(_mode: any = 'browser', timers: any = null) {
    this.timers = timers || null;
  }

  setTimeout(callback: any, delay: any): any {
    const handle: any = { cancelled: false, unref: () => handle };
    const timers = this.timers;
    if (hasInjectedTimers(timers)) {
      try {
        Promise.resolve(timers.waitMs(delay)).then(() => {
          if (!handle.cancelled) callback();
        });
        return handle;
      } catch (e) { /* fall through */ }
    }
    return handle;
  }

  clearTimeout(id: any): void {
    if (id && typeof id === 'object') id.cancelled = true;
  }

  setInterval(callback: any, delay: any): any {
    const handle: any = { cancelled: false, unref: () => handle };
    const timers = this.timers;
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
