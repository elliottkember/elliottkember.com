export const TAU = Math.PI * 2;
export const fract = (x) => x - Math.floor(x);
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const hash = (x, y = 0, z = 0) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
export const css = (h, s, l, a = 1) => `hsl(${h} ${s}% ${l}% / ${a})`;
export const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
export const SANS = 'Inter, "Helvetica Neue", system-ui, sans-serif';

export function makeCanvas(w, h) {
  w = Math.max(1, w | 0); h = Math.max(1, h | 0);
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Every scene starts its frame from a clean context so scenes can't leak state into each other.
export function begin(ctx, W, H, color) {
  if (ctx.reset) ctx.reset();
  else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.setLineDash([]);
  }
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
}

export function spacing(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; }
