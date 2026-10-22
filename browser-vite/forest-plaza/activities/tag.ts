import type { PlazaCharacter } from '../characters';
import type { ActivityContext, PlazaActivity } from './types';
import { compactSocialPath, fleeCandidates, routeLength, socialDistance, TAG_SPEED, tagCatchDistance, tagShouldEnd, type TagPhase } from './socialRules';

export function createTagActivity(ctx: ActivityContext): PlazaActivity {
  interface Game { character: PlazaCharacter; phase: TagPhase; elapsed: number; idle: number; timer: number; repath: number; failures: number; playerCatches: number; characterCatches: number; lastPlayer: {x: number; z: number}; end(): void }
  let game: Game | null = null, disposed = false, cooldown = 0;
  const clearBubble = (c: PlazaCharacter) => ctx.sayText(c, '', 0);
  const setPhase = (g: Game, phase: TagPhase, timer = 0) => {
    g.phase = phase; g.timer = timer; g.repath = 0;
    g.character.stopPath(false); g.character.lookAt(null); g.character.setPose({posture: 'stand', bounce: phase === 'invite' || phase === 'satisfied'});
  };
  const satisfy = (g: Game) => {
    setPhase(g, 'satisfied', 2.8); clearBubble(g.character);
    ctx.say(g.character, 'play'); ctx.spawnHearts(g.character, 3); ctx.addAffection(g.character, 3);
  };
  const plan = (g: Game, chase: boolean): boolean => {
    const c = g.character, player = ctx.player.position;
    const distance = socialDistance(c.position, player);
    const stop = Math.max(0.8, c.radius + ctx.player.radius + 0.1);
    const direction = c.position.clone().sub(player).setY(0).normalize();
    const candidates = chase
      ? [0, 0.6, -0.6, 1.2, -1.2].map(angle => player.clone().add(direction.clone().applyAxisAngle(c.root.up, angle).multiplyScalar(stop)))
      : fleeCandidates(c.position, player).filter(p => socialDistance(p, player) > Math.min(distance + 0.5, 9));
    for (const target of candidates) {
      // おにごっこは散歩へ戻れる中央の広場に留める。
      if (target.x < -5.5 || target.x > 3.2 || target.z < -8.4 || target.z > 0.5) continue;
      const path = ctx.pathing.find(c.position, target, c);
      if (!path || routeLength(path) > 10 || routeLength(path) < 0.15) continue;
      g.repath = chase ? 0.65 : 1.5;
      g.failures = 0;
      c.walkPath(compactSocialPath(path), TAG_SPEED, arrived => { if (game !== g) return; g.repath = arrived ? 0 : 0.4; if (!arrived) g.failures++; });
      return true;
    }
    g.repath = 0.8; g.failures++; return false;
  };
  const unregister = ctx.director.register({
    id: 'tag', interval: [35, 60], probability: 0.65, participants: 1, maxConcurrent: 1,
    eligible: c => cooldown <= 0 && !ctx.hand.current && !ctx.player.isFixed && ctx.hearts(c) >= 1 && socialDistance(c.position, ctx.player.position) <= 8,
    start([character], finish) {
      if (disposed || game || ctx.hand.current || ctx.director.sleeping || ctx.player.isFixed) { finish(); return false; }
      let ended = false;
      const g: Game = { character, phase: 'approach', elapsed: 0, idle: 0, timer: 0, repath: 0, failures: 0, playerCatches: 0, characterCatches: 0, lastPlayer: {x: ctx.player.position.x, z: ctx.player.position.z},
        end() { if (ended) return; ended = true; if (game === g) game = null; cooldown = 45; character.stopPath(false); character.lookAt(null); character.setPose({}); clearBubble(character); finish(); } };
      game = g;
      if (!plan(g, true)) { g.end(); return false; }
      return true;
    },
  });
  return {
    update(dt) {
      cooldown = Math.max(0, cooldown - dt);
      const g = game; if (!g) return;
      const c = g.character, distance = socialDistance(c.position, ctx.player.position);
      if (!c.isBusy || !ctx.visitors.has(c.info.id) || ctx.director.sleeping || ctx.player.isFixed || ctx.hand.current) { g.end(); return; }
      if (g.phase === 'satisfied') { g.timer -= dt; if (g.timer <= 0) g.end(); return; }
      g.elapsed += dt; g.idle += dt;
      // 意図的に近づく/逃げる動きだけを反応とする（放置中の微小な揺れは数えない）。
      if (socialDistance(ctx.player.position, g.lastPlayer) > 0.3) {
        if (distance < 10) g.idle = 0;
        g.lastPlayer = {x: ctx.player.position.x, z: ctx.player.position.z};
      }
      if (tagShouldEnd(g.elapsed, g.idle, distance, g.playerCatches, g.characterCatches)) {
        if (distance >= 16 || g.idle >= 20 || g.phase === 'approach') g.end(); else satisfy(g);
        return;
      }
      if (g.failures >= 8) { g.end(); return; }
      if (g.phase === 'approach' && distance <= Math.max(2, c.radius + ctx.player.radius + 0.6)) {
        setPhase(g, 'invite', 2.8); c.lookAt(ctx.player.position); ctx.say(c, 'play'); return;
      }
      if (g.phase === 'invite' || g.phase === 'caught') {
        g.timer -= dt;
        if (g.timer <= 0) { clearBubble(c); setPhase(g, g.phase === 'invite' ? 'flee' : 'chase'); }
        return;
      }
      if (g.phase === 'chase' && distance <= tagCatchDistance(c.radius, ctx.player.radius, true)) {
        g.characterCatches++; g.idle = 0; ctx.spawnHearts(c, 1);
        if (g.characterCatches >= 2) satisfy(g);
        else { setPhase(g, 'invite', 1.5); c.lookAt(ctx.player.position); ctx.say(c, 'play'); }
        return;
      }
      g.repath -= dt;
      if (g.repath <= 0) plan(g, g.phase !== 'flee');
    },
    onCharacterTouched(c, kind) {
      const g = game; if (!g || g.character !== c) return;
      if (kind === 'tap' && g.phase === 'flee' && socialDistance(c.position, ctx.player.position) <= tagCatchDistance(c.radius, ctx.player.radius, false)) {
        g.playerCatches++; g.idle = 0; g.failures = 0;
        setPhase(g, 'caught', 1.4); c.lookAt(ctx.player.position); ctx.sayText(c, 'つかまえた！', 1400); ctx.spawnHearts(c, 2);
        if (g.playerCatches >= 2) satisfy(g);
        return true;
      }
      g.end();
    },
    onCharacterRemoved(c) { if (game?.character === c) game.end(); },
    dispose() { if (disposed) return; disposed = true; game?.end(); unregister(); },
  };
}
