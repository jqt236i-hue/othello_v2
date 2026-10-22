import type { ActivityContext, PlazaActivity } from './types';
import { createSleepActivity } from './sleep';
import { createFeedActivity } from './feed';
import { createBallActivity } from './ball';
import { createTagActivity } from './tag';
import { createPianoActivity } from './piano';
import { createChatActivity } from './chat';
export function createActivities(ctx: ActivityContext): PlazaActivity[] {
  return [createSleepActivity, createFeedActivity, createBallActivity, createTagActivity, createPianoActivity, createChatActivity].map(factory => factory(ctx));
}
