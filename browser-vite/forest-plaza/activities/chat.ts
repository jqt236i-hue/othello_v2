import type { PlazaCharacter } from '../characters';
import { pickLine } from '../lines';
import type { ActivityContext, PlazaActivity } from './types';
import { chatAxisSign, chatPairAllowed, routeLength, socialDistance } from './socialRules';

export function createChatActivity(ctx: ActivityContext): PlazaActivity {
  let now = 0, disposed = false;
  const cooldown = new Map<string, number>();
  interface Conversation { chars: PlazaCharacter[]; end(): void; age: number; speaking: boolean; ready: number; timer: number; nod: number; turn: number; turns: number }
  const runs = new Set<Conversation>();
  const unregister = ctx.director.register({
    id: 'chat', interval: [18, 30], probability: 0.75, participants: 2, maxConcurrent: 2,
    eligible: c => (cooldown.get(c.info.id) ?? 0) <= now,
    start(chars, finish) {
      const [a, b] = chars;
      if (disposed || !chatPairAllowed(a.position, b.position, cooldown.get(a.info.id) ?? 0, cooldown.get(b.info.id) ?? 0, now)) { finish(); return false; }
      // 近くの敷石で、視線に対し左右に並ぶ。家具へ迂回する長い経路は採用しない。
      const separation = a.radius + b.radius + 0.5;
      const middle = a.position.clone().add(b.position).multiplyScalar(0.5);
      const nearPlayer = socialDistance(middle, ctx.player.position) < 10;
      const axis = nearPlayer ? ctx.camera.position.clone().sub(middle).setY(0).normalize() : b.position.clone().sub(a.position).normalize();
      if (nearPlayer) axis.set(-axis.z, 0, axis.x);
      if (axis.lengthSq() < 0.01) axis.set(1, 0, 0);
      // 左右の順番は保つ。すれ違いを要求すると相手の現在位置が経路を塞ぐ。
      axis.multiplyScalar(chatAxisSign(axis, a.position, b.position));
      let routes: ReturnType<typeof ctx.pathing.find>[] | null = null;
      for (const center of [middle, ...Array.from({length: 5}, () => { const p = ctx.walkArea.randomPoint(); return middle.clone().set(p.x, 0, p.y); })]) {
        const goals = [center.clone().addScaledVector(axis, -separation / 2), center.clone().addScaledVector(axis, separation / 2)];
        if (goals.some(p => p.x < -4.6 || p.x > 3.2 || p.z < -8.4 || p.z > -0.2)) continue;
        const candidate = chars.map((c, i) => ctx.pathing.find(c.position, goals[i], c));
        if (candidate.every(p => p && routeLength(p) <= 5)) { routes = candidate; break; }
      }
      if (!routes) { finish(); return false; }
      let ended = false;
      const run: Conversation = { chars, age: 0, speaking: false, ready: 0, timer: 0, nod: 0, turn: 0, turns: (2 + Math.floor(Math.random() * 3)) * 2,
        end() {
          if (ended) return; ended = true; runs.delete(run);
          for (const c of chars) { cooldown.set(c.info.id, now + 40); c.stopPath(false); c.lookAt(null); c.setPose({}); ctx.sayText(c, '', 0); }
          finish();
        } };
      runs.add(run);
      chars.forEach((c, i) => {
        if (ended) return;
        c.walkPath(routes![i]!, 1.15, arrived => { if (ended) return; if (!arrived) { run.end(); return; } run.ready++; });
      });
      return true;
    },
  });
  return {
    update(dt) {
      now += dt;
      for (const run of [...runs]) {
        run.age += dt;
        if (ctx.director.sleeping || run.chars.some(c => !c.isBusy || !ctx.visitors.has(c.info.id)) || (!run.speaking && run.age > 9)) { run.end(); continue; }
        if (run.ready < 2) continue;
        run.speaking = true;
        const [a, b] = run.chars; a.lookAt(b.position); b.lookAt(a.position);
        run.nod = Math.max(0, run.nod - dt);
        for (const c of run.chars) c.setPose({posture: 'stand', rhythm: 0.5, offsetY: Math.sin(run.nod / 0.4 * Math.PI) * Math.min(0.04, c.height * 0.04)});
        run.timer -= dt;
        if (run.timer > 0) continue;
        if (run.turn >= run.turns) { run.end(); continue; }
        const speaker = run.chars[run.turn % 2], listener = run.chars[(run.turn + 1) % 2];
        // 相手の吹き出しを先に消すので、身長差/投影位置によらず二体分が重ならない。
        ctx.sayText(listener, '', 0);
        run.timer = 2.4 + Math.random() * 0.8; run.nod = 0.4;
        ctx.sayText(speaker, pickLine(speaker.info.id, run.turn % 2 ? 'chatReply' : 'chatOpen', 0, {partner: listener.info.label}), run.timer * 1000);
        speaker.setPose({posture: 'stand', rhythm: 0.7}); listener.setPose({posture: 'stand', breathing: true, rhythm: 0.4});
        if (Math.random() < 0.35) ctx.spawnHearts(listener, 1);
        run.turn++;
      }
    },
    onCharacterTouched(c) { for (const run of [...runs]) if (run.chars.includes(c)) run.end(); },
    onCharacterRemoved(c) { cooldown.delete(c.info.id); for (const run of [...runs]) if (run.chars.includes(c)) run.end(); cooldown.delete(c.info.id); },
    dispose() { if (disposed) return; disposed = true; for (const run of [...runs]) run.end(); unregister(); cooldown.clear(); },
  };
}
