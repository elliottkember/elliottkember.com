// Owns the canvas and swaps between per-project scenes with a circular reveal.
// Runs in the worker (OffscreenCanvas) or on the main thread as a fallback.
import { createLedScene } from './scenes/led.js?v=12';
import { createFunnelScene } from './scenes/funnel.js?v=12';
import { createSyncScene } from './scenes/sync.js?v=12';
import { createSiteScene } from './scenes/site.js?v=12';
import { createHomeScene } from './scenes/home.js?v=12';
import { TAU, makeCanvas } from './scenes/util.js?v=12';

const factories = {
  intro: createHomeScene,
  openspace: createSiteScene,
  'clearbit-x': createFunnelScene,
  soulmate: () => createLedScene('soulmate'),
  dropbox: createSyncScene,
  contact: () => createLedScene('contact'),
};
const REVEAL = 1.1; // seconds

export function createHost(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let W = 1, H = 1, dpr = 1, layer, layerCtx;
  const scenes = new Map();
  let cur = null, prev = null, mix = 1, origin = null; // origin of the reveal, in device px
  const pointer = { x: -1e4, y: -1e4, on: 0, target: 0, tx: 0, ty: 0 };

  function get(key) {
    let s = scenes.get(key);
    if (!s) { s = factories[key](); scenes.set(key, s); }
    if (s.size !== `${W}x${H}`) { s.resize(W, H, dpr); s.size = `${W}x${H}`; }
    return s;
  }

  return {
    resize(w, h, ratio) {
      dpr = ratio; W = canvas.width = Math.round(w * dpr); H = canvas.height = Math.round(h * dpr);
      layer = makeCanvas(W, H); layerCtx = layer.getContext('2d', { alpha: false });
      if (cur) get(cur.key);
    },
    // x, y (css px, optional): where the reveal circle grows from — e.g. where a finger left the screen
    setScene(key, hue, x, y) {
      if (cur?.key === key) return;
      origin = x != null && y != null ? [x * dpr, y * dpr] : null;
      prev = cur; cur = { key, hue, scene: get(key) };
      mix = prev ? 0 : 1;
    },
    pointer(x, y, on) { pointer.x = x * dpr; pointer.y = y * dpr; pointer.target = on ? 1 : 0; },
    tilt(x, y) { pointer.tx = x; pointer.ty = y; },
    // returns e.g. { navigate: 'soulmate' } when a scene wants to change page (home mosaic)
    click(x, y) { return cur?.scene.click?.(x * dpr, y * dpr) ?? null; },
    frame(t, dt) {
      if (!cur) return;
      pointer.on += (pointer.target - pointer.on) * (1 - Math.exp(-dt * 8));
      mix = Math.min(1, mix + dt / REVEAL);
      if (mix >= 1 || !prev) { cur.scene.draw(ctx, t, dt, pointer); return; }

      // outgoing scene keeps running underneath while the new one is revealed by a growing circle
      get(prev.key).draw(ctx, t, dt, pointer);
      get(cur.key).draw(layerCtx, t, dt, pointer);
      const e = mix < 0.5 ? 4 * mix ** 3 : 1 - (-2 * mix + 2) ** 3 / 2;
      const [cx, cy] = origin ?? [W * 0.06, H * 0.5];
      const reach = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)); // farthest corner
      const R = e * reach * 1.02;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
      ctx.strokeStyle = `hsl(${cur.hue} 100% 70% / ${1 - e})`;
      ctx.lineWidth = 3 * dpr;
      ctx.shadowColor = `hsl(${cur.hue} 100% 60%)`; ctx.shadowBlur = 24 * dpr;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;
    },
  };
}
