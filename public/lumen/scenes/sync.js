// Dropbox — a desktop full of files that sync themselves. Waves of changes ripple across
// the icon grid: each file spins its sync badge, fills a progress bar, sends packets up to
// the cloud and lands on a green check. Click anywhere to drop in new files.
import { TAU, clamp, hash, css, begin, spacing, MONO, SANS } from './util.js';

const BLUE = 216;
const FILES = [
  ['Mailbox', 'folder'], ['Q3 Roadmap.key', 'doc'], ['IMG_2041.jpg', 'img'], ['taxes-2015.pdf', 'pdf'],
  ['Camera Uploads', 'folder'], ['demo-final.mov', 'video'], ['notes.txt', 'doc'], ['Snooze.sketch', 'img'],
  ['budget.xlsx', 'sheet'], ['Wedding', 'folder'], ['IMG_2042.jpg', 'img'], ['contract.pdf', 'pdf'],
  ['Projects', 'folder'], ['swipe.mov', 'video'], ['inbox-zero.key', 'doc'], ['metrics.xlsx', 'sheet'],
  ['Screenshots', 'folder'], ['beach.jpg', 'img'], ['README.md', 'doc'], ['Shared', 'folder'],
];

export function createSyncScene() {
  let W = 1, H = 1, dpr = 1, pitch = 120, icon = 44;
  let waves = [], nextWave = 0, scroll = 0, panX = 0, waveId = 0;
  const SPEED = 520; // px/s (css) that a wave travels

  function resize(w, h, ratio) {
    W = w; H = h; dpr = ratio;
    pitch = (W / dpr < 700 ? 96 : 124) * dpr;
    icon = pitch * 0.36;
  }

  function addWave(x, y, t, user = false) {
    waves.push({ x: x - panX, y: y + scroll, t, id: waveId++, user });
    if (waves.length > 8) waves.shift();
  }
  let now = 0;
  function click(x, y) { addWave(x, y, now, true); }

  // Tile state is analytic (a function of time and the waves), so scrolling costs nothing.
  function stateOf(col, row, cx, cy) {
    let best = null;
    for (const w of waves) {
      if (hash(col, row, w.id) > (w.user ? 0.8 : 0.28)) continue;
      const arrive = w.t + Math.hypot(cx - w.x, cy - w.y) / (SPEED * dpr);
      if (arrive <= now && (!best || arrive > best.arrive)) best = { arrive, id: w.id };
    }
    if (!best) return { kind: 'idle' };
    const dur = 0.9 + hash(col, row, best.id + 9) * 1.6;
    const p = now - best.arrive;
    if (p < dur) return { kind: 'sync', p: p / dur };
    if (p < dur + 2.2) return { kind: 'done', p: (p - dur) / 2.2 };
    return { kind: 'idle' };
  }

  function page(ctx, x, y, s, fold = true) {
    const w = s * 0.78, h = s, f = s * 0.26;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - h / 2); ctx.lineTo(x + w / 2 - f, y - h / 2); ctx.lineTo(x + w / 2, y - h / 2 + f);
    ctx.lineTo(x + w / 2, y + h / 2); ctx.lineTo(x - w / 2, y + h / 2); ctx.closePath();
    ctx.fillStyle = '#e9edf5'; ctx.fill();
    if (fold) {
      ctx.beginPath(); ctx.moveTo(x + w / 2 - f, y - h / 2); ctx.lineTo(x + w / 2 - f, y - h / 2 + f); ctx.lineTo(x + w / 2, y - h / 2 + f);
      ctx.fillStyle = '#b9c2d3'; ctx.fill();
    }
    return { w, h };
  }

  function drawIcon(ctx, type, x, y, s) {
    switch (type) {
      case 'folder': {
        const w = s * 1.1, h = s * 0.82, r = s * 0.08;
        ctx.fillStyle = css(BLUE, 85, 48);
        ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2 - s * 0.1, w * 0.45, s * 0.2, r); ctx.fill();
        ctx.fillStyle = css(BLUE, 90, 58);
        ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, r); ctx.fill();
        ctx.fillStyle = css(BLUE, 100, 68);
        ctx.fillRect(x - w / 2, y - h / 2 + s * 0.12, w, 1.5 * dpr);
        break;
      }
      case 'img': {
        const w = s * 1.0, h = s * 0.8;
        ctx.save();
        ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, s * 0.06); ctx.clip();
        const sky = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
        const hh = hash(Math.round(x), Math.round(y)) * 60;
        sky.addColorStop(0, css(200 + hh, 70, 65)); sky.addColorStop(1, css(30 + hh, 80, 70));
        ctx.fillStyle = sky; ctx.fillRect(x - w / 2, y - h / 2, w, h);
        ctx.fillStyle = 'rgba(255,240,200,.9)'; ctx.beginPath(); ctx.arc(x + w * 0.22, y - h * 0.18, s * 0.09, 0, TAU); ctx.fill();
        ctx.fillStyle = css(150, 30, 25);
        ctx.beginPath(); ctx.moveTo(x - w / 2, y + h / 2); ctx.lineTo(x - w * 0.15, y - h * 0.05); ctx.lineTo(x + w * 0.05, y + h * 0.15);
        ctx.lineTo(x + w * 0.25, y + h * 0.02); ctx.lineTo(x + w / 2, y + h / 2); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, s * 0.06); ctx.stroke();
        break;
      }
      case 'video': {
        const w = s * 1.0, h = s * 0.66;
        ctx.fillStyle = '#1d2333'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, s * 0.08); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = dpr; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - s * 0.1, y - s * 0.15); ctx.lineTo(x + s * 0.16, y); ctx.lineTo(x - s * 0.1, y + s * 0.15); ctx.fill();
        break;
      }
      case 'pdf': {
        const { w } = page(ctx, x, y, s);
        ctx.fillStyle = '#e5484d'; ctx.fillRect(x - w / 2, y + s * 0.08, w * 0.7, s * 0.2);
        ctx.fillStyle = '#fff'; ctx.font = `700 ${s * 0.14}px ${SANS}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'start';
        ctx.fillText('PDF', x - w / 2 + s * 0.06, y + s * 0.185);
        break;
      }
      case 'sheet': {
        const { w, h } = page(ctx, x, y, s);
        ctx.strokeStyle = '#2f9e5b'; ctx.lineWidth = dpr;
        for (let i = 1; i < 5; i++) { const yy = y - h / 2 + h * 0.3 + i * h * 0.12; ctx.beginPath(); ctx.moveTo(x - w * 0.35, yy); ctx.lineTo(x + w * 0.35, yy); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(x - w * 0.05, y - h * 0.08); ctx.lineTo(x - w * 0.05, y + h * 0.4); ctx.stroke();
        break;
      }
      default: {
        const { w, h } = page(ctx, x, y, s);
        ctx.fillStyle = '#9aa6bb';
        for (let i = 0; i < 4; i++) ctx.fillRect(x - w * 0.32, y - h * 0.15 + i * h * 0.13, w * (i === 3 ? 0.35 : 0.62), 1.5 * dpr);
      }
    }
  }

  function badge(ctx, x, y, r, st, t) {
    if (st.kind === 'sync') {
      ctx.fillStyle = css(BLUE, 100, 52); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6 * dpr; ctx.lineCap = 'round';
      const a = t * 5;
      for (const off of [0, Math.PI]) {
        ctx.beginPath(); ctx.arc(x, y, r * 0.5, a + off, a + off + 2.2); ctx.stroke();
        const ex = x + Math.cos(a + off + 2.2) * r * 0.5, ey = y + Math.sin(a + off + 2.2) * r * 0.5;
        const ta = a + off + 2.2 + Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(ex + Math.cos(ta - 2.4) * r * 0.32, ey + Math.sin(ta - 2.4) * r * 0.32); ctx.lineTo(ex, ey);
        ctx.lineTo(ex + Math.cos(ta + 2.4) * r * 0.32, ey + Math.sin(ta + 2.4) * r * 0.32); ctx.stroke();
      }
    } else if (st.kind === 'done') {
      const pop = Math.min(1, st.p * 8);
      const s = r * (pop < 1 ? 0.6 + pop * 0.6 : 1.2 - Math.min(0.2, (st.p - 0.125) * 2));
      ctx.globalAlpha = 1 - clamp((st.p - 0.7) / 0.3);
      ctx.fillStyle = '#2ebd6b'; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8 * dpr; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x - s * 0.4, y); ctx.lineTo(x - s * 0.1, y + s * 0.32); ctx.lineTo(x + s * 0.42, y - s * 0.3); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function draw(ctx, t, dt, pointer) {
    now = t;
    begin(ctx, W, H, '#060a14');
    if (t > nextWave) {
      addWave(W * (0.1 + Math.random() * 0.6), H * (0.15 + Math.random() * 0.7), t);
      nextWave = t + 3.5 + Math.random() * 2;
    }
    scroll += dt * (10 - pointer.ty * 80) * dpr; // drifts slowly upward; tilt slides it
    panX += dt * pointer.tx * 80 * dpr;
    const colShift = Math.floor(panX / pitch), fx = panX - colShift * pitch;

    const vignette = ctx.createRadialGradient(W * 0.4, H * 0.5, 0, W * 0.4, H * 0.5, Math.max(W, H) * 0.75);
    vignette.addColorStop(0, css(BLUE, 70, 14)); vignette.addColorStop(1, '#04060c');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);

    const row0 = Math.floor(scroll / pitch) - 1, rows = Math.ceil(H / pitch) + 2, cols = Math.ceil(W / pitch) + 2;
    let syncing = 0;
    const packets = [];
    ctx.textAlign = 'center';
    for (let r = row0; r < row0 + rows; r++) {
      for (let k = -1; k < cols; k++) {
        const c = k - colShift;
        const ox = (r & 1) ? pitch * 0.5 : 0; // staggered rows read less like a spreadsheet
        const cx = k * pitch + fx + pitch / 2 + ox - pitch * 0.25, wy = r * pitch + pitch / 2;
        const cy = wy - scroll;
        const [name, type] = FILES[Math.floor(hash(c, r) * FILES.length)];
        const st = stateOf(c, r, cx - panX, wy);
        const active = st.kind !== 'idle';
        if (st.kind === 'sync') syncing++;
        const hovered = pointer.on > 0.5 && Math.abs(pointer.x - cx) < pitch * 0.42 && Math.abs(pointer.y - cy) < pitch * 0.45;

        if (hovered) {
          ctx.fillStyle = css(BLUE, 90, 55, 0.22); ctx.strokeStyle = css(BLUE, 90, 65, 0.6); ctx.lineWidth = dpr;
          ctx.beginPath(); ctx.roundRect(cx - pitch * 0.42, cy - pitch * 0.4, pitch * 0.84, pitch * 0.86, 10 * dpr); ctx.fill(); ctx.stroke();
        }
        ctx.globalAlpha = hovered ? 1 : active ? 0.9 : 0.16;
        drawIcon(ctx, type, cx, cy - pitch * 0.08, icon * (hovered ? 1.08 : 1));
        ctx.globalAlpha = hovered ? 1 : active ? 0.8 : 0.18;
        ctx.font = `${10.5 * dpr}px ${SANS}`; spacing(ctx, 0); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center'; // icons (e.g. PDF) change alignment
        ctx.fillStyle = '#dfe6f5';
        ctx.fillText(name.length > 15 ? name.slice(0, 13) + '…' : name, cx, cy + pitch * 0.3);
        ctx.globalAlpha = 1;

        if (st.kind === 'sync') {
          const bw = pitch * 0.5, by = cy + pitch * 0.37;
          ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(cx - bw / 2, by, bw, 2.5 * dpr);
          ctx.fillStyle = css(BLUE, 100, 62); ctx.fillRect(cx - bw / 2, by, bw * st.p, 2.5 * dpr);
          packets.push([cx, cy - pitch * 0.25, st.p, c * 7 + r]);
        }
        badge(ctx, cx + icon * 0.48, cy - pitch * 0.08 + icon * 0.38, 8 * dpr, st, t);
      }
    }

    // upload packets rising toward the cloud
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, p, seed] of packets) {
      for (let k = 0; k < 3; k++) {
        const q = (t * 0.9 + k / 3 + hash(seed) ) % 1;
        const py = y - q * pitch * 0.9, px = x + Math.sin(q * 6 + seed) * 6 * dpr;
        ctx.fillStyle = css(BLUE, 100, 70, (1 - q) * 0.9);
        ctx.beginPath(); ctx.arc(px, py, 2 * dpr, 0, TAU); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // wave fronts
    for (const w of waves) {
      const age = t - w.t, R = age * SPEED * dpr;
      if (age > 4) continue;
      ctx.strokeStyle = css(BLUE, 100, 65, 0.25 * (1 - age / 4));
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.arc(w.x + panX, w.y - scroll, R, 0, TAU); ctx.stroke();
    }

    // menu-bar style status, the Dropbox app's whole personality in one line
    const label = syncing ? `Syncing ${syncing} file${syncing === 1 ? '' : 's'}…` : 'Up to date';
    ctx.font = `500 ${12 * dpr}px ${SANS}`; spacing(ctx, 0);
    const tw = ctx.measureText(label).width, pw = tw + 44 * dpr, ph = 30 * dpr, px = W / 2 - pw / 2, py = (W / dpr < 700 ? 86 : 26) * dpr;
    ctx.fillStyle = 'rgba(10,14,26,.85)'; ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, ph / 2); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();
    badge(ctx, px + 16 * dpr, py + ph / 2, 7 * dpr, syncing ? { kind: 'sync' } : { kind: 'done', p: 0.3 }, t);
    ctx.fillStyle = '#e8eefc'; ctx.textAlign = 'start'; ctx.textBaseline = 'middle';
    ctx.fillText(label, px + 30 * dpr, py + ph / 2 + 0.5 * dpr);
  }

  return { resize, draw, click };
}
