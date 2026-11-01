// LED matrix scene (intro, Soulmate, contact).
// Technique: compute one colour per LED into a tiny bitmap, upscale it with smoothing off,
// then punch round LED holes with a 'destination-in' pattern. A blurred copy adds bloom.
import { noise3 } from '../../shared/noise.js';
import { TAU, fract, hash, makeCanvas, begin, smoothstep } from './util.js';

function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360 / 30;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)];
}

// An LED sparkle: snaps on in a few frames, then fades out over a second or so. Each LED has its own rhythm.
function sparkle(t, h) {
  const period = 3 + h * 6, age = (t + h * 97) % period, attack = 0.05;
  return age < attack ? age / attack : Math.exp(-(age - attack) * 1.8);
}

// Soulmate's metaballs: [x speed, y speed, phase, rgb]
const BALLS = [330, 280, 200, 170, 45, 300, 10].map((hue, k) => [0.23 + k * 0.061, 0.19 + k * 0.047, k * 2.17, hsl(hue, 1, 0.55)]);

// Each pattern returns [r, g, b] in 0..1 for an LED at (x, y) in aspect-correct space centred on 0.
const patterns = {
  intro(x, y, t, ax) {
    const n = noise3(x * 1.4, y * 1.4, t * 0.15);
    const v = Math.max(0, n * 1.6 + 0.15);
    return hsl(200 + n * 80, 0.7, 0.08 + v * 0.35);
  },
  // Soulmate — the classic: rainbow plasma
  // Soulmate — metaballs: glowing blobs that merge and split, hot rims, and LEDs that sparkle
  soulmate(x, y, t, ax, i, j) {
    t *= 0.6;
    let F = 0, r = 0, g = 0, b = 0;
    for (let k = 0; k < BALLS.length; k++) {
      const [sx, sy, ph, c] = BALLS[k];
      const bx = Math.sin(t * sx + ph) * ax * 0.78, by = Math.cos(t * sy + ph * 1.7) * 0.72;
      const rad = 0.17 + 0.05 * Math.sin(t * 0.8 + ph * 3);
      const dx = x - bx, dy = y - by, w = (rad * rad) / (dx * dx + dy * dy + 1e-4);
      F += w; r += c[0] * w; g += c[1] * w; b += c[2] * w;
    }
    r /= F; g /= F; b /= F;
    const body = smoothstep(0.85, 1.15, F);
    const rim = Math.exp(-(((F - 1) * 5) ** 2));
    const lum = body * 0.42 + rim * 0.95 + Math.min(F, 1) * 0.1;
    // sparkle: a few LEDs flash white, mostly inside the blobs and along their rims
    const h = hash(i, j);
    const tw = h > 0.75 ? sparkle(t, h) * 0.75 * (0.1 + body * 0.5 + rim * 0.7) : 0;
    const white = rim * 0.3 + tw;
    return [r * lum + white, g * lum + white, b * lum + white];
  },
  contact(x, y, t) {
    const r = Math.hypot(x, y);
    const beat = Math.pow(Math.max(0, Math.sin(t * 2.4)), 12);
    const v = Math.max(0, Math.cos((r - t * 0.25) * 18)) * Math.exp(-r * 1.2) * (0.3 + beat * 0.7);
    return hsl(330 + r * 60, 0.9, v * 0.5);
  },
};

export function createLedScene(name) {
  const pattern = patterns[name];
  let W = 1, H = 1, dpr = 1, pitch = 12, cols = 1, rows = 1;
  let pix, pixCtx, img, glow, glowCtx, layer, layerCtx, maskTile, offTile;
  const ripples = [];
  let flowX = 0, flowY = 0;

  function dotTile(alpha, radius) {
    const c = makeCanvas(pitch, pitch), g = c.getContext('2d');
    g.fillStyle = `rgba(255,255,255,${alpha})`;
    g.beginPath(); g.arc(pitch / 2, pitch / 2, pitch * radius, 0, TAU); g.fill();
    return c;
  }

  function resize(w, h, ratio) {
    W = w; H = h; dpr = ratio;
    pitch = Math.round((W / dpr < 700 ? 9 : 12) * dpr);
    cols = Math.ceil(W / pitch); rows = Math.ceil(H / pitch);
    pix = makeCanvas(cols, rows); pixCtx = pix.getContext('2d'); img = pixCtx.createImageData(cols, rows);
    glow = makeCanvas(cols * 2, rows * 2); glowCtx = glow.getContext('2d');
    layer = makeCanvas(cols * pitch, rows * pitch); layerCtx = layer.getContext('2d');
    maskTile = dotTile(1, 0.36);
    offTile = dotTile(0.045, 0.36);
  }

  function click(x, y) { ripples.push({ x, y, t: 0 }); }

  function draw(ctx, t, dt, pointer) {
    for (const r of ripples) r.t += dt;
    flowX += pointer.tx * dt * 0.35; flowY -= pointer.ty * dt * 0.35;
    while (ripples.length && ripples[0].t > 3) ripples.shift();

    const ax = cols / rows; // aspect
    const data = img.data;
    const scale = 2 / rows;
    for (let j = 0; j < rows; j++) {
      const y = (rows / 2 - j) * scale;
      for (let i = 0; i < cols; i++) {
        const x = (i - cols / 2) * scale;
        let [r, g, b] = pattern(x - flowX, y - flowY, t, ax, i, j);
        // pointer halo + click ripples, computed in pixel space
        const px = (i + 0.5) * pitch, py = (j + 0.5) * pitch;
        const dp = Math.hypot(px - pointer.x, py - pointer.y) / (pitch * 7);
        const halo = pointer.on * Math.exp(-dp * dp) * 0.6;
        let rip = 0;
        for (const rp of ripples) {
          const d = Math.hypot(px - rp.x, py - rp.y) / pitch - rp.t * 38;
          rip += Math.exp(-d * d * 0.3) * (1 - rp.t / 3);
        }
        const k = halo + rip * 0.8;
        const o = (j * cols + i) * 4;
        data[o] = Math.min(255, (r + k) * 255);
        data[o + 1] = Math.min(255, (g + k) * 255);
        data[o + 2] = Math.min(255, (b + k) * 255);
        data[o + 3] = 255;
      }
    }
    pixCtx.putImageData(img, 0, 0);

    begin(ctx, W, H, '#030305');

    // Unlit LEDs — the physical grid is always faintly visible
    ctx.fillStyle = ctx.createPattern(offTile, 'repeat'); ctx.fillRect(0, 0, W, H);

    // Bloom: blur a 2x copy with the canvas filter API, then add it back
    glowCtx.reset?.();
    glowCtx.filter = 'blur(3px)';
    glowCtx.imageSmoothingEnabled = true;
    glowCtx.clearRect(0, 0, glow.width, glow.height);
    glowCtx.drawImage(pix, 0, 0, glow.width, glow.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(glow, 0, 0, cols * pitch, rows * pitch);

    // Crisp LEDs: nearest-neighbour upscale, then mask to round dots
    layerCtx.globalCompositeOperation = 'copy';
    layerCtx.imageSmoothingEnabled = false;
    layerCtx.drawImage(pix, 0, 0, layer.width, layer.height);
    layerCtx.globalCompositeOperation = 'destination-in';
    layerCtx.fillStyle = layerCtx.createPattern(maskTile, 'repeat');
    layerCtx.fillRect(0, 0, layer.width, layer.height);
    ctx.globalAlpha = 1;
    ctx.drawImage(layer, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  return { resize, draw, click };
}
