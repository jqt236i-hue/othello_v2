import type { ActivityContext, PlazaActivity } from './types';

/** 活動担当がこの factory を実装する。 */
export function createTagActivity(_ctx: ActivityContext): PlazaActivity {
  return { update(_dt) {}, dispose() {} };
}

