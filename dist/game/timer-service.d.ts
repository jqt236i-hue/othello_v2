/**
 * @file timer-service.js
 * Timer abstraction for game/ layer to avoid direct browser API dependency.
 */
export class TimerService {
    constructor(mode?: string);
    mode: string;
    setTimeout(callback: any, delay: any): NodeJS.Timeout | {
        _immediate: boolean;
    };
    clearTimeout(id: any): void;
    setInterval(callback: any, delay: any): NodeJS.Timeout | {
        _immediate: boolean;
    };
    clearInterval(id: any): void;
}
export function createTimerService(mode: any): TimerService;
//# sourceMappingURL=timer-service.d.ts.map