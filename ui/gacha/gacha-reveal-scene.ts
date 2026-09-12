/** A bounded, presentation-only star field. Never consumes the game's random source. */
function createObservationScene(canvas: HTMLCanvasElement, root: any): any {
  let context: CanvasRenderingContext2D | null = null;
  try { context = canvas.getContext('2d', { alpha: false }); } catch (_) { /* CSS scene remains available. */ }
  if (!context || typeof root?.requestAnimationFrame !== 'function') return null;
  const ctx = context;
  let frame = 0;
  let stopped = false;
  let phase = 'charge';
  let phaseStarted = 0;
  let started = -1;
  let previous = -100;
  let width = 0;
  let height = 0;
  let accent = '#c8d9ec';
  const colors: Record<string, string> = { N: '#c8d9ec', R: '#aeeac2', SR: '#72dfff', SSR: '#cd97ff', UR: '#ffd27a', EXR: '#c4beff' };
  const stars = Array.from({ length: 96 }, (_, i) => ({
    angle: i * 2.39996323,
    distance: 0.1 + ((i * 37) % 101) / 101,
    size: 0.5 + (i % 4) * 0.32,
    speed: 0.04 + (i % 7) * 0.009
  }));
  function stop(): void {
    stopped = true;
    if (frame) root.cancelAnimationFrame(frame);
    frame = 0;
  }
  function draw(now: number): void {
    if (stopped) return;
    frame = root.requestAnimationFrame(draw);
    if (now - previous < 32) return;
    previous = now;
    if (started < 0) started = now;
    const seconds = (now - started) / 1000;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    const ratio = Math.min(root.devicePixelRatio || 1, 1.5, 1800 / w);
    if (w !== width || h !== height) {
      width = w; height = h;
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    ctx.fillStyle = '#050912'; ctx.fillRect(0, 0, w, h);
    const cx = w * 0.5, cy = h * 0.47, radius = Math.hypot(w, h) * 0.6;
    const nebula = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.85);
    nebula.addColorStop(0, phase === 'charge' ? '#19374a' : '#25213d');
    nebula.addColorStop(0.42, '#101b30'); nebula.addColorStop(1, '#050912');
    ctx.fillStyle = nebula; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accent; ctx.fillStyle = accent;
    stars.forEach((star, i) => {
      const travel = phase === 'charge' ? seconds * star.speed : -seconds * star.speed * 0.12;
      const distance = ((star.distance - travel) % 1 + 1) % 1;
      const r = 32 + distance * radius;
      const angle = star.angle + seconds * 0.013;
      const x = cx + Math.cos(angle) * r, y = cy + Math.sin(angle) * r * 0.7;
      ctx.globalAlpha = Math.min(0.8, distance * 1.2) * (0.7 + Math.sin(seconds + i) * 0.2);
      if (phase === 'charge') {
        const trail = 5 + seconds * 9;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * trail, y + Math.sin(angle) * trail * 0.7);
        ctx.lineWidth = star.size * 0.45; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x, y, star.size, 0, Math.PI * 2); ctx.fill();
      if (i % 13 === 0) {
        ctx.fillRect(x - 5, y - 0.35, 10, 0.7); ctx.fillRect(x - 0.35, y - 5, 0.7, 10);
      }
    });
    const impactAge = (now - phaseStarted) / 1000;
    if (phase === 'reveal' && impactAge < 1.6) {
      ctx.globalAlpha = Math.max(0, (1 - impactAge / 1.6) * 0.65);
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.ellipse(cx, cy, 60 + impactAge * radius + i * 24, 30 + impactAge * radius * 0.62 + i * 12, -0.2, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // Leave a static backdrop when the player is reading the result.
    if (phase === 'settled' && impactAge > 1800 / 1000) stop();
  }
  return {
    start(rarity: string) { accent = colors[rarity] || colors.N; frame = root.requestAnimationFrame(draw); },
    setPhase(value: string) { phase = value; phaseStarted = root.performance?.now() || 0; },
    stop
  };
}

export = { createObservationScene };
