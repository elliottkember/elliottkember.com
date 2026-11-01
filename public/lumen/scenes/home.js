// Home — a living mosaic of every project scene. The screen is split into drifting cells
// (a power diagram, so a cell can grow without the others jumping); each cell is a live window
// onto one project's scene. Hover a cell to widen it, tap it to go there.
import { createSiteScene } from './site.js';
import { createFunnelScene } from './funnel.js';
import { createLedScene } from './led.js';
import { createSyncScene } from './sync.js';
import { clamp, css, begin, spacing, makeCanvas, MONO } from './util.js';

const TILES = [
  { key: 'openspace', label: 'OpenSpace', hue: 195, make: () => createSiteScene({ centered: true }), focus: [0.5, 0.52], home: [0.3, 0.32] },
  { key: 'clearbit-x', label: 'Clearbit X', hue: 265, make: createFunnelScene, focus: [0.36, 0.52], portraitFocus: [0.3, 0.3], home: [0.72, 0.3] },
  { key: 'soulmate', label: 'Soulmate', hue: 330, make: () => createLedScene('soulmate'), focus: [0.5, 0.5], home: [0.28, 0.72] },
  { key: 'dropbox', label: 'Dropbox', hue: 216, make: createSyncScene, focus: [0.45, 0.5], home: [0.7, 0.7] },
];

// keep the side of n·p <= c
function clip(poly, nx, ny, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    const da = nx * ax + ny * ay - c, db = nx * bx + ny * by - c;
    if (da <= 0) out.push([ax, ay]);
    if ((da < 0) !== (db < 0)) { const k = da / (da - db); out.push([ax + (bx - ax) * k, ay + (by - ay) * k]); }
  }
  return out;
}

export function createHomeScene() {
  let W = 1, H = 1, dpr = 1, turn = 0, hover = -1;
  const tiles = TILES.map((t) => ({ ...t, scene: t.make(), layer: null, lctx: null, acc: 0, weight: 0, poly: [], seed: [0, 0] }));

  function resize(w, h, ratio) {
    W = w; H = h; dpr = ratio;
    for (const t of tiles) {
      t.layer = makeCanvas(W, H); t.lctx = t.layer.getContext('2d', { alpha: false });
      t.scene.resize(W, H, dpr);
      t.scene.draw(t.lctx, 0, 1 / 60, { x: -1e4, y: -1e4, on: 0, tx: 0, ty: 0 });
    }
  }

  function layout(t) {
    const portrait = H > W;
    tiles.forEach((tile, k) => {
      let [hx, hy] = tile.home;
      if (portrait) [hx, hy] = [[0.3, 0.2], [0.72, 0.28], [0.3, 0.5], [0.7, 0.58]][k]; // phone: cells above the card
      tile.seed = [(hx + 0.07 * Math.sin(t * 0.11 + k * 1.9)) * W, (hy + 0.06 * Math.cos(t * 0.09 + k * 2.6)) * H];
    });
    for (const a of tiles) {
      let poly = [[0, 0], [W, 0], [W, H], [0, H]];
      for (const b of tiles) {
        if (a === b) continue;
        // power-diagram bisector: |p-a|² - wa <= |p-b|² - wb
        const [ax, ay] = a.seed, [bx, by] = b.seed;
        poly = clip(poly, 2 * (bx - ax), 2 * (by - ay), bx * bx + by * by - ax * ax - ay * ay - b.weight + a.weight);
      }
      a.poly = poly;
    }
  }

  const cellAt = (x, y) => {
    let best = -1, bd = Infinity;
    tiles.forEach((t, k) => { const d = (x - t.seed[0]) ** 2 + (y - t.seed[1]) ** 2 - t.weight; if (d < bd) { bd = d; best = k; } });
    return best;
  };

  function click(x, y) { const k = cellAt(x, y); return k >= 0 ? { navigate: tiles[k].key } : null; }

  function draw(ctx, t, dt, pointer) {
    hover = pointer.on > 0.5 ? cellAt(pointer.x, pointer.y) : -1;
    const grow = (Math.min(W, H) * 0.34) ** 2;
    for (const [k, tile] of tiles.entries()) tile.weight += ((k === hover ? grow : 0) - tile.weight) * (1 - Math.exp(-dt * 4));
    layout(t);

    // advance two scenes per frame (each runs at ~30fps) — four full scenes every frame is too heavy on phones
    for (const tile of tiles) tile.acc += dt;
    for (let n = 0; n < 2; n++) {
      const k = (turn + n) % tiles.length, tile = tiles[k];
      const inside = k === hover;
      tile.scene.draw(tile.lctx, t, Math.min(tile.acc, 0.1), { x: pointer.x, y: pointer.y, on: inside ? pointer.on : 0, tx: pointer.tx, ty: pointer.ty });
      tile.acc = 0;
    }
    turn = (turn + 2) % tiles.length;

    begin(ctx, W, H, '#030305');
    for (const [k, tile] of tiles.entries()) {
      const p = tile.poly;
      if (p.length < 3) continue;
      const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const cx = xs.reduce((a, b) => a + b) / p.length, cy = ys.reduce((a, b) => a + b) / p.length;
      tile.centre = [cx, cy + Math.min(90 * dpr, (maxY - minY) * 0.3)]; // label sits below the cell's focal point, not on it
      // slide the scene so its focal point sits in the cell, without exposing the layer's edges
      const [fx, fy] = (H > W && tile.portraitFocus) || tile.focus;
      const ox = clamp(cx - fx * W, maxX - W, minX), oy = clamp(cy - fy * H, maxY - H, minY);
      ctx.save();
      ctx.beginPath(); p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      ctx.clip();
      ctx.drawImage(tile.layer, ox, oy);
      if (hover >= 0 && k !== hover) { ctx.fillStyle = 'rgba(3,3,5,.35)'; ctx.fillRect(minX, minY, maxX - minX, maxY - minY); }
      ctx.restore();
    }

    // seams: glowing edges between cells, tinted by each cell's project colour
    ctx.lineJoin = 'round';
    for (const tile of tiles) {
      const p = tile.poly;
      if (p.length < 3) continue;
      ctx.beginPath(); p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      ctx.shadowColor = css(tile.hue, 100, 60); ctx.shadowBlur = 18 * dpr;
      ctx.strokeStyle = css(tile.hue, 100, 75, 0.55); ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(3,3,5,.9)'; ctx.lineWidth = 3 * dpr;
    for (const tile of tiles) {
      const p = tile.poly;
      if (p.length < 3) continue;
      ctx.beginPath(); p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
    }

    // cell labels
    ctx.font = `500 ${10.5 * dpr}px ${MONO}`; spacing(ctx, 1.6 * dpr); ctx.textAlign = 'start'; ctx.textBaseline = 'middle';
    tiles.forEach((tile, k) => {
      if (!tile.centre) return;
      const text = `0${k + 1}  ${tile.label.toUpperCase()}`;
      const tw = ctx.measureText(text).width, ph = 26 * dpr, pw = tw + 34 * dpr;
      const [cx0, cy] = tile.centre, railGap = H > W ? 64 * dpr : 0; // keep clear of the phone rail
      const x = clamp(cx0 - pw / 2, 12 * dpr, W - pw - 12 * dpr - railGap), cx = x + pw / 2, y = cy - ph / 2;
      ctx.globalAlpha = hover < 0 || hover === k ? 1 : 0.6;
      ctx.fillStyle = 'rgba(3,3,5,.78)'; ctx.strokeStyle = css(tile.hue, 100, 70, 0.5); ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.roundRect(x, y, pw, ph, ph / 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = css(tile.hue, 100, 70); ctx.beginPath(); ctx.arc(x + 13 * dpr, cy, 3 * dpr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2f2f4'; ctx.fillText(text, x + 22 * dpr, cy + 0.5 * dpr);
      ctx.globalAlpha = 1;
    });
  }

  return { resize, draw, click };
}
