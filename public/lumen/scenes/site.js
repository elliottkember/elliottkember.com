// OpenSpace — walking a construction site with a phone. An isometric blueprint of a floor
// under construction; a capture path is traced room by room, dropping 360° capture points,
// with the phone's field of view sweeping ahead. Click to take a 360° capture.
import { TAU, clamp, hash, css, begin, spacing, smoothstep, MONO, SANS } from './util.js';
import { noise3 } from '../../shared/noise.js';

const HUE = 195;
// The plan below is laid out in design units; K converts them to metres, so the corridor is 2.75 m and
// rooms are ~5.5–6.5 m — real proportions next to the phone's 6 m LiDAR cone.
const K = 0.55;
const PLAN_W = 48 * K, PLAN_H = 30 * K;

// --- floor plan (metres) ---
function wallWithGaps(x1, y1, x2, y2, gaps = []) {
  const horiz = y1 === y2, a0 = horiz ? x1 : y1, a1 = horiz ? x2 : y2;
  const out = [];
  let a = a0;
  for (const [g0, g1] of gaps) { out.push([a, g0]); a = g1; }
  out.push([a, a1]);
  return out.map(([s, e]) => (horiz ? [s, y1, e, y1] : [x1, s, x1, e]));
}
const WALLS = [
  ...wallWithGaps(0, 0, 48, 0), ...wallWithGaps(0, 30, 48, 30, [[22, 26]]),
  ...wallWithGaps(0, 0, 0, 30), ...wallWithGaps(48, 0, 48, 30),
  ...wallWithGaps(0, 12, 48, 12, [[4, 6], [14, 16], [25, 27], [35, 37], [43, 45]]),
  ...wallWithGaps(0, 17, 48, 17, [[6, 8], [20, 22], [32, 34], [42, 44]]),
  ...[10, 20, 32, 40].map((x) => [x, 0, x, 12]),
  ...[14, 28, 38].map((x) => [x, 17, x, 30]),
];
const COLUMNS = [];
for (let x = 0; x <= 48; x += 16) for (const y of [0, 10, 20, 30]) COLUMNS.push([x * K, y * K]);
const ROUTE = [
  [24, 34], [24, 14.5], [15, 14.5], [15, 6], [12, 3], [18, 3], [16, 8], [15, 14.5], [26, 14.5], [26, 6], [22, 3], [30, 3], [29, 9],
  [26, 14.5], [36, 14.5], [36, 6], [34, 3], [38, 8], [36, 14.5], [43, 14.5], [43, 24], [46, 27], [40, 27], [43, 21],
  [43, 14.5], [33, 14.5], [33, 24], [30, 27], [36, 27], [33, 21], [33, 14.5], [21, 14.5], [21, 24], [17, 27], [25, 27],
  [21, 22], [21, 14.5], [7, 14.5], [7, 24], [3, 27], [11, 27], [7, 22], [7, 14.5], [5, 14.5], [5, 6], [3, 3], [8, 3],
];
const ISSUES = [
  { at: [29, 7], label: 'Missing fire damper' },
  { at: [10, 23], label: 'Drywall · install L3' },
  { at: [45, 4], label: 'MEP clash · duct' },
];
for (const w of WALLS) for (let i = 0; i < 4; i++) w[i] *= K;
for (const p of ROUTE) { p[0] *= K; p[1] *= K; }
for (const iss of ISSUES) iss.at = iss.at.map((v) => v * K);

// precompute route arc length
const SEG = [];
let ROUTE_LEN = 0;
for (let i = 1; i < ROUTE.length; i++) {
  const [x0, y0] = ROUTE[i - 1], [x1, y1] = ROUTE[i];
  const len = Math.hypot(x1 - x0, y1 - y0);
  SEG.push({ x0, y0, x1, y1, len, start: ROUTE_LEN });
  ROUTE_LEN += len;
}
function along(d) {
  d = clamp(d, 0, ROUTE_LEN - 0.001);
  let lo = 0, hi = SEG.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (SEG[m].start <= d) lo = m; else hi = m - 1; }
  const s = SEG[lo], k = (d - s.start) / s.len;
  return [s.x0 + (s.x1 - s.x0) * k, s.y0 + (s.y1 - s.y0) * k, Math.atan2(s.y1 - s.y0, s.x1 - s.x0)];
}
// Corners worth pausing at: sharp turns, not every one. At each, the walker stops and looks around —
// the look direction follows a few keyframes (angles) over the pause, then they carry on.
const wrapA = (a) => ((a + Math.PI * 3) % TAU) - Math.PI;
const CORNERS = [];
for (let i = 1; i < SEG.length; i++) {
  const aIn = Math.atan2(SEG[i - 1].y1 - SEG[i - 1].y0, SEG[i - 1].x1 - SEG[i - 1].x0);
  const aOut = Math.atan2(SEG[i].y1 - SEG[i].y0, SEG[i].x1 - SEG[i].x0);
  const turn = wrapA(aOut - aIn), side = Math.sign(turn) || 1;
  if (Math.abs(turn) < 1.2 || hash(i, 5) < 0.35) continue;
  const keys = hash(i, 9) < 0.5
    ? [[0, aIn], [0.3, aIn - side * 0.9], [0.68, aOut + side * 0.6], [1, aOut]]   // glance away first, then swing round past the new way
    : [[0, aIn], [0.35, aOut + side * 1.1], [0.72, aOut - side * 0.5], [1, aOut]]; // look into the turn, overshoot, come back
  CORNERS.push({ d: SEG[i].start, keys, dur: 1.6 + Math.abs(turn) * 0.5 + hash(i, 7) * 1.0 });
}
function keyAngle(keys, k) {
  let i = 0;
  while (i < keys.length - 2 && k > keys[i + 1][0]) i++;
  const [t0, a0] = keys[i], [t1, a1] = keys[i + 1];
  return a0 + wrapA(a1 - a0) * smoothstep(t0, t1, k);
}
const CAPTURE_EVERY = 1.5;
const WALK = 1.9; // m/s — a brisk, sped-up walk

// --- LiDAR point cloud ---
// Points are pre-sampled on every surface (walls at full storey height, columns, floor). The phone's
// spinning scanner casts rays that stop at walls/columns; any point at or before a ray's hit distance
// lights up. Points stay in the cloud and dim with age, so the scan builds as you walk.
const WALL_H = 2.2; // drawn wall height — wall points stop here too, so the scan never pokes above a wall
const STOREY = 2.8, RANGE = 9, BINS = 720, SPIN = 9; // rad/s
// 'camera' mode: 360° captures build a sparse sphere of points; the phone's camera LiDAR adds a dense cone
// (~72°, 6 m) wherever it's pointed, held like a flashlight
const FWD_FOV = 1.26, FWD_RANGE = 6;
const cloud = (() => {
  const pts = [];
  const add = (x, y, z) => pts.push(x, y, z);
  for (const [x1, y1, x2, y2] of WALLS) {
    const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(len / 0.25));
    for (let k = 0; k <= n; k++) for (let z = 0.1; z < WALL_H; z += 0.22) {
      const f = k / n;
      add(x1 + (x2 - x1) * f + (hash(k, z, 1) - 0.5) * 0.08, y1 + (y2 - y1) * f + (hash(k, z, 2) - 0.5) * 0.08, Math.min(WALL_H - 0.02, z + (hash(k, z, 3) - 0.5) * 0.1));
    }
  }
  for (const [cx, cy] of COLUMNS) for (let side = 0; side < 4; side++) for (let k = 0; k < 4; k++) for (let z = 0.1; z < STOREY; z += 0.2) {
    const u = -0.35 + k * 0.233, o = 0.36;
    const [dx, dy] = [[u, -o], [o, u], [-u, o], [-o, -u]][side];
    add(cx + dx, cy + dy, z);
  }
  for (let x = 0.2; x < PLAN_W; x += 0.42) for (let y = 0.2; y < PLAN_H; y += 0.42) add(x + (hash(x, y) - 0.5) * 0.4, y + (hash(y, x) - 0.5) * 0.4, 0);
  return new Float32Array(pts);
})();
const CLOUD_N = cloud.length / 3;
// A 360° capture only resolves a sparse cloud (about 1 in 3 points); the camera LiDAR resolves all of them.
const SPARSE = new Uint8Array(CLOUD_N).map((_, i) => (hash(i * 0.37, 11) < 0.33 ? 1 : 0));
const R360 = 5, SPHERE_TIME = 0.9; // a capture's sphere grows out to 5 m over 0.9 s
// occluders for the scanner's rays: walls plus column faces
const OCCLUDERS = [...WALLS];
for (const [x, y] of COLUMNS) { const o = 0.35; OCCLUDERS.push([x - o, y - o, x + o, y - o], [x + o, y - o, x + o, y + o], [x + o, y + o, x - o, y + o], [x - o, y + o, x - o, y - o]); }
function castRay(ox, oy, a) {
  const dx = Math.cos(a), dy = Math.sin(a);
  let best = RANGE;
  for (const [x1, y1, x2, y2] of OCCLUDERS) {
    const ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const tx = ((x1 - ox) * ey - (y1 - oy) * ex) / den, u = ((x1 - ox) * dy - (y1 - oy) * dx) / den;
    if (tx > 0.05 && u >= 0 && u <= 1 && tx < best) best = tx;
  }
  return best;
}
// 2 m spatial buckets so each frame only tests points near the scanner
const CELL = 2, GX = Math.ceil((PLAN_W + 4) / CELL), GY = Math.ceil((PLAN_H + 4) / CELL);
const buckets = Array.from({ length: GX * GY }, () => []);
for (let i = 0; i < CLOUD_N; i++) {
  const cx = Math.floor((cloud[i * 3] + 2) / CELL), cy = Math.floor((cloud[i * 3 + 1] + 2) / CELL);
  buckets[clamp(cy, 0, GY - 1) * GX + clamp(cx, 0, GX - 1)].push(i);
}
const HEIGHT_BANDS = 7;


// centered: frame the floor in the middle of the canvas (no card beside it), e.g. for video export
// lidar: 'camera' (360° spheres + hand-held camera LiDAR cone) or 'spin' (rotating scanner)
export function createSiteScene({ centered = false, lidar = 'camera' } = {}) {
  const forward = lidar === 'camera' || lidar === 'forward';
  let W = 1, H = 1, dpr = 1, scale = 10, ox = 0, oy = 0, rot = 0;
  let dist = 0, heading = 0, lap = 0;
  const bubbles = []; // 360° capture spheres
  let rotTarget = 0, pitch = 0.5;
  // camera follows the phone, so it always sits at the anchor (ox, oy)
  let camX = ROUTE[0][0], camY = ROUTE[0][1];
  const seen = new Float32Array(CLOUD_N).fill(-1); // time each point was last hit
  const hits = new Float32Array(BINS).fill(RANGE);
  let beam = 0, revealed = 0, now = 0, primed = false;
  // where the phone is pointed: a spring chasing a target, so it moves like a hand, with momentum
  let look = Math.atan2(SEG[0].y1 - SEG[0].y0, SEG[0].x1 - SEG[0].x0), lookVel = 0;
  let pause = null, nextCorner = 0;
  const captures = []; // live 360° spheres: { x, y, t0, h (ray hit distances) }

  function capture360(x, y, big = false) {
    bubbles.push({ x, y, t: 0, big });
    if (!forward) return;
    const h = new Float32Array(BINS);
    for (let b = 0; b < BINS; b++) h[b] = Math.min(R360, castRay(x, y, (b + 0.5) / BINS * TAU));
    captures.push({ x, y, t0: now, h });
  }

  function resize(w, h, ratio) {
    W = w; H = h; dpr = ratio;
    const narrow = W / dpr < 760;
    scale = Math.min(W * (narrow ? 0.95 : 0.66) / 66, H * (narrow ? 0.5 : 0.78) / 40);
    ox = W * (narrow || centered ? 0.5 : 0.4); oy = H * (narrow ? 0.38 : 0.52);
    if (centered) scale = Math.min(W * 0.8 / 66, H * 0.84 / 40);
    scale *= 1.25 / K * 0.9; // closer: the view travels with the phone, and the plan is now real-sized
    oy += 2.6 * scale; // centre the floating phone itself, not the floor beneath it
  }

  // plan (x, y, z) → screen, isometric with a slow yaw
  function P(x, y, z = 0) {
    const cx = x - camX, cy = y - camY;
    const c = Math.cos(rot), s = Math.sin(rot);
    const rx = cx * c - cy * s, ry = cx * s + cy * c;
    return [ox + (rx - ry) * 0.866 * scale, oy + ((rx + ry) * pitch - z) * scale];
  }

  function click() { const [x, y] = along(dist); capture360(x, y, true); }

  function ring(ctx, x, y, r, z = 0) {
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU; const [sx, sy] = P(x + Math.cos(a) * r, y + Math.sin(a) * r, z); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }
  }

  function draw(ctx, t, dt, pointer) {
    rotTarget = 0.42 + Math.sin(t * 0.06) * 0.1 + (pointer.on > 0.5 ? (pointer.x / W - 0.5) * 0.25 : 0) + pointer.tx * 0.3;
    pitch += (clamp(0.5 - pointer.ty * 0.1, 0.38, 0.62) - pitch) * (1 - Math.exp(-dt * 1.5));
    rot += (rotTarget - rot) * (1 - Math.exp(-dt * 1.5));

    {
      // glide after the phone; z=2.6 is where the phone floats, so that's the point kept centred
      const [fx, fy] = along(Math.min(dist, ROUTE_LEN)), k = 1 - Math.exp(-dt * 2.5);
      camX += (fx - camX) * k; camY += (fy - camY) * k;
    }
    now = t;
    if (!primed) { primed = true; capture360(...along(0)); }
    const prev = dist;
    if (pause) {
      pause.t += dt;
      if (pause.t >= pause.dur) pause = null;
    } else {
      // ease off into a corner we're going to stop at
      const c = forward ? CORNERS[nextCorner] : null;
      dist += WALK * dt * (c ? 0.3 + 0.7 * smoothstep(0, 1.4, c.d - dist) : 1);
      if (c && dist >= c.d) { dist = c.d; pause = { ...c, t: 0 }; nextCorner++; capture360(...along(dist)); }
    }
    if (Math.floor(dist / CAPTURE_EVERY) > Math.floor(prev / CAPTURE_EVERY) && dist < ROUTE_LEN) {
      const n = Math.floor(dist / CAPTURE_EVERY);
      if (n % (forward ? 3 : 5) === 0) capture360(...along(dist));
    }
    if (dist > ROUTE_LEN + 6) {
      dist = 0; lap++; seen.fill(-1); revealed = 0; nextCorner = 0; pause = null; captures.length = 0;
      look = Math.atan2(SEG[0].y1 - SEG[0].y0, SEG[0].x1 - SEG[0].x0); lookVel = 0; capture360(...along(0));
    }

    if (forward) {
      // Flashlight aim: look a few metres down the path (so the phone swings into a turn before the walker
      // makes it), or follow the corner's look-around keyframes while paused; plus slow, non-repeating hand drift.
      const [wx, wy, segA] = along(Math.min(dist, ROUTE_LEN));
      let target;
      if (pause) target = keyAngle(pause.keys, pause.t / pause.dur);
      else {
        const [ax, ay] = along(Math.min(dist + 2, ROUTE_LEN));
        target = Math.hypot(ax - wx, ay - wy) > 0.3 ? Math.atan2(ay - wy, ax - wx) : segA;
      }
      target += noise3(t * 0.35, 7.3, lap) * 0.35 + noise3(t * 1.4, 2.1, lap) * 0.07;
      lookVel += (wrapA(target - look) * 20 - lookVel * 7.5) * dt;
      look += lookVel * dt;
    }
    const fadeOut = clamp((dist - ROUTE_LEN) / 6);

    begin(ctx, W, H, '#03101a');
    const bg = ctx.createRadialGradient(ox, oy, 0, ox, oy, Math.max(W, H) * 0.7);
    bg.addColorStop(0, '#08243a'); bg.addColorStop(1, '#020a12');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // ground grid
    ctx.strokeStyle = css(HUE, 70, 60, 0.07); ctx.lineWidth = dpr;
    ctx.beginPath();
    for (let x = -30; x <= PLAN_W + 30; x += 1) { const a = P(x, -30), b = P(x, PLAN_H + 30); ctx.moveTo(...a); ctx.lineTo(...b); }
    for (let y = -30; y <= PLAN_H + 30; y += 1) { const a = P(-30, y), b = P(PLAN_W + 30, y); ctx.moveTo(...a); ctx.lineTo(...b); }
    ctx.stroke();

    // slab
    ctx.beginPath(); [[0, 0], [PLAN_W, 0], [PLAN_W, PLAN_H], [0, PLAN_H]].forEach(([x, y], i) => (i ? ctx.lineTo(...P(x, y)) : ctx.moveTo(...P(x, y))));
    ctx.closePath(); ctx.fillStyle = css(HUE, 70, 40, 0.08); ctx.fill();

    // structural grid with bubbles
    ctx.setLineDash([6 * dpr, 6 * dpr]); ctx.strokeStyle = css(HUE, 80, 70, 0.16);
    ctx.font = `600 ${9.5 * dpr}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; spacing(ctx, 0);
    for (let i = 0, x = 0; x <= PLAN_W + 0.01; x += 8 * K, i++) {
      ctx.beginPath(); ctx.moveTo(...P(x, -2)); ctx.lineTo(...P(x, PLAN_H + 2)); ctx.stroke();
      const [bx, by] = P(x, -3);
      ctx.setLineDash([]); ctx.beginPath(); ctx.arc(bx, by, 9 * dpr, 0, TAU); ctx.stroke();
      ctx.fillStyle = css(HUE, 80, 75, 0.5); ctx.fillText(String.fromCharCode(65 + i), bx, by + 0.5 * dpr);
      ctx.setLineDash([6 * dpr, 6 * dpr]);
    }
    for (let i = 0, y = 0; y <= PLAN_H + 0.01; y += 10 * K, i++) {
      ctx.beginPath(); ctx.moveTo(...P(-2, y)); ctx.lineTo(...P(PLAN_W + 2, y)); ctx.stroke();
      const [bx, by] = P(-3, y);
      ctx.setLineDash([]); ctx.beginPath(); ctx.arc(bx, by, 9 * dpr, 0, TAU); ctx.stroke();
      ctx.fillStyle = css(HUE, 80, 75, 0.5); ctx.fillText(String(i + 1), bx, by + 0.5 * dpr);
      ctx.setLineDash([6 * dpr, 6 * dpr]);
    }
    ctx.setLineDash([]);

    // walls — some finished, some still bare studs
    WALLS.forEach(([x1, y1, x2, y2], i) => {
      const a = P(x1, y1), b = P(x2, y2), c = P(x2, y2, WALL_H), d = P(x1, y1, WALL_H);
      if (hash(i, 3) < 0.3) {
        ctx.strokeStyle = css(HUE, 80, 70, 0.35); ctx.lineWidth = dpr;
        const len = Math.hypot(x2 - x1, y2 - y1), n = Math.floor(len / 0.8);
        ctx.beginPath();
        for (let k = 0; k <= n; k++) { const f = k / Math.max(1, n); const p = P(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f); const q = P(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, WALL_H); ctx.moveTo(...p); ctx.lineTo(...q); }
        ctx.moveTo(...a); ctx.lineTo(...b); ctx.moveTo(...d); ctx.lineTo(...c);
        ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d); ctx.closePath();
        ctx.fillStyle = css(HUE, 70, 55, 0.12); ctx.fill();
        ctx.strokeStyle = css(HUE, 80, 72, 0.55); ctx.lineWidth = 1.1 * dpr;
        ctx.beginPath(); ctx.moveTo(...d); ctx.lineTo(...c); ctx.stroke();
        ctx.strokeStyle = css(HUE, 80, 72, 0.25);
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
      }
    });
    // columns
    for (const [x, y] of COLUMNS) {
      const s = 0.35;
      const base = [[x - s, y - s], [x + s, y - s], [x + s, y + s], [x - s, y + s]];
      ctx.fillStyle = css(HUE, 60, 70, 0.25); ctx.strokeStyle = css(HUE, 80, 80, 0.5); ctx.lineWidth = dpr;
      ctx.beginPath(); base.forEach(([px, py], i) => (i ? ctx.lineTo(...P(px, py, 3)) : ctx.moveTo(...P(px, py, 3)))); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); for (const [px, py] of base) { ctx.moveTo(...P(px, py)); ctx.lineTo(...P(px, py, 3)); } ctx.stroke();
    }
    // stairs
    ctx.strokeStyle = css(HUE, 80, 72, 0.35);
    ctx.beginPath();
    for (let k = 0; k < 10; k++) { const y = (1 + k * 0.9) * K; ctx.moveTo(...P(41 * K, y, k * 0.15)); ctx.lineTo(...P(44 * K, y, k * 0.15)); }
    ctx.stroke();

    // LiDAR sweep: cast rays for the bins the beam crossed this frame, light up points in front of the hit
    {
      const [lx, ly] = along(Math.min(dist, ROUTE_LEN));
      // spin: the beam's swept slice this frame. forward: the whole cone ahead of the phone, every frame.
      const a0 = forward ? ((look - FWD_FOV / 2) % TAU + TAU) % TAU : beam;
      const sweep = forward ? FWD_FOV : SPIN * dt, maxD = forward ? FWD_RANGE : RANGE;
      if (!forward) beam = (beam + sweep) % TAU;
      const b0 = Math.floor(a0 / TAU * BINS), nb = Math.ceil(sweep / TAU * BINS) + 1;
      for (let k = 0; k < nb; k++) { const b = (b0 + k) % BINS; hits[b] = Math.min(maxD, castRay(lx, ly, (b + 0.5) / BINS * TAU)); }
      const c0 = Math.floor((lx + 2 - RANGE) / CELL), c1 = Math.floor((lx + 2 + RANGE) / CELL);
      const r0 = Math.floor((ly + 2 - RANGE) / CELL), r1 = Math.floor((ly + 2 + RANGE) / CELL);
      for (let gy = Math.max(0, r0); gy <= Math.min(GY - 1, r1); gy++) for (let gx = Math.max(0, c0); gx <= Math.min(GX - 1, c1); gx++) {
        for (const i of buckets[gy * GX + gx]) {
          const dx = cloud[i * 3] - lx, dy = cloud[i * 3 + 1] - ly, d = Math.hypot(dx, dy);
          if (d > maxD) continue;
          const a = (Math.atan2(dy, dx) + TAU) % TAU;
          if (((a - a0 + TAU) % TAU) > sweep) continue;
          if (d > hits[Math.floor(a / TAU * BINS) % BINS] + 0.2) continue;
          if (seen[i] < 0) revealed++;
          // forward: points in view are hit every frame — only re-flash once they've faded, so new surfaces 'paint in'
          if (!forward || seen[i] < 0 || t - seen[i] > 2.5) seen[i] = t;
        }
      }
      // 360° captures: a sparse sphere of points spreading out from each capture point, stopped by walls
      for (let ci = captures.length - 1; ci >= 0; ci--) {
        const cap = captures[ci], age = t - cap.t0;
        if (age > SPHERE_TIME + 0.6) { captures.splice(ci, 1); continue; }
        const rr = Math.min(1, age / SPHERE_TIME) * R360;
        const q0 = Math.floor((cap.x + 2 - R360) / CELL), q1 = Math.floor((cap.x + 2 + R360) / CELL);
        const s0 = Math.floor((cap.y + 2 - R360) / CELL), s1 = Math.floor((cap.y + 2 + R360) / CELL);
        for (let gy = Math.max(0, s0); gy <= Math.min(GY - 1, s1); gy++) for (let gx = Math.max(0, q0); gx <= Math.min(GX - 1, q1); gx++) {
          for (const i of buckets[gy * GX + gx]) {
            if (!SPARSE[i] || seen[i] >= 0) continue;
            const dx = cloud[i * 3] - cap.x, dy = cloud[i * 3 + 1] - cap.y, d = Math.hypot(dx, dy);
            if (d > R360 || Math.hypot(d, cloud[i * 3 + 2] - 1.6) > rr) continue; // a sphere, centred at camera height
            if (d > cap.h[Math.floor(((Math.atan2(dy, dx) + TAU) % TAU) / TAU * BINS) % BINS] + 0.2) continue;
            seen[i] = t; revealed++;
          }
        }
      }

      // draw the cloud, batched by height band × freshness so it's a handful of fills
      const c = Math.cos(rot), sn = Math.sin(rot), sz = Math.max(1.6 * dpr, scale * 0.055);
      const paths = new Map();
      for (let i = 0; i < CLOUD_N; i++) {
        const st = seen[i];
        if (st < 0) continue;
        const x = cloud[i * 3] - camX, y = cloud[i * 3 + 1] - camY, z = cloud[i * 3 + 2];
        const rx = x * c - y * sn, ry = x * sn + y * c;
        const px = ox + (rx - ry) * 0.866 * scale, py = oy + ((rx + ry) * pitch - z) * scale;
        const age = t - st, fresh = age < 0.15 ? 0 : age < 2.5 ? 1 : 2;
        const key = fresh * 16 + Math.min(HEIGHT_BANDS - 1, Math.floor(z / STOREY * HEIGHT_BANDS));
        let p = paths.get(key);
        if (!p) { p = []; paths.set(key, p); }
        p.push(px, py);
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const [key, p] of paths) {
        const fresh = key >> 4, band = key & 15;
        const hue = 230 - (band / (HEIGHT_BANDS - 1)) * 230; // blue floor → red ceiling, the classic LiDAR ramp
        ctx.fillStyle = fresh === 0 ? 'rgba(255,255,255,.95)' : css(hue, 95, 62, fresh === 1 ? 0.9 : 0.5);
        ctx.beginPath();
        const s2 = fresh === 0 ? sz * 1.3 : sz;
        for (let k = 0; k < p.length; k += 2) ctx.rect(p[k] - s2 / 2, p[k + 1] - s2 / 2, s2, s2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // visibility polygon (faint) + bright trailing wedge behind the spinning beam
      const [sx0, sy0] = P(lx, ly);
      const poly = (from, count) => {
        ctx.beginPath(); ctx.moveTo(sx0, sy0);
        for (let k = 0; k <= count; k++) {
          const b = ((from + k) % BINS + BINS) % BINS, a = (b + 0.5) / BINS * TAU;
          ctx.lineTo(...P(lx + Math.cos(a) * hits[b], ly + Math.sin(a) * hits[b]));
        }
        ctx.closePath();
      };
      for (const cap of captures) {
        const age = t - cap.t0, k = Math.min(1, age / SPHERE_TIME), rr = k * R360;
        const fade = 1 - clamp((age - SPHERE_TIME * 0.6) / SPHERE_TIME);
        ctx.strokeStyle = css(HUE, 100, 80, 0.55 * fade); ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        for (let b = 0; b <= BINS; b += 4) {
          const bb = b % BINS, a = (bb + 0.5) / BINS * TAU, d = Math.min(rr, cap.h[bb]);
          const q = P(cap.x + Math.cos(a) * d, cap.y + Math.sin(a) * d);
          b ? ctx.lineTo(...q) : ctx.moveTo(...q);
        }
        ctx.stroke();
      }
      if (forward) {
        // the camera's depth frustum, clipped by walls, with a depth-pulse sweeping out through it
        const fr = ctx.createRadialGradient(sx0, sy0, 0, sx0, sy0, FWD_RANGE * scale);
        fr.addColorStop(0, css(150, 100, 70, 0.38)); fr.addColorStop(1, css(150, 100, 70, 0.04));
        ctx.fillStyle = fr; poly(b0, nb - 1); ctx.fill();
        ctx.strokeStyle = css(150, 100, 80, 0.55); ctx.lineWidth = dpr; poly(b0, nb - 1); ctx.stroke();
        const pr = ((t * 1.6) % 1) * FWD_RANGE;
        ctx.strokeStyle = css(150, 100, 85, 0.6 * (1 - pr / FWD_RANGE)); ctx.lineWidth = 1.4 * dpr;
        ctx.beginPath();
        for (let k = 0; k < nb; k++) {
          const b = (b0 + k) % BINS, a = (b + 0.5) / BINS * TAU, rr = Math.min(pr, hits[b]);
          const q = P(lx + Math.cos(a) * rr, ly + Math.sin(a) * rr);
          k ? ctx.lineTo(...q) : ctx.moveTo(...q);
        }
        ctx.stroke();
      } else {
      ctx.fillStyle = css(HUE, 100, 70, 0.05); poly(0, BINS); ctx.fill();
      const head = Math.floor(beam / TAU * BINS), tail = Math.floor(BINS * 0.09);
      const wedge = ctx.createRadialGradient(sx0, sy0, 0, sx0, sy0, RANGE * scale);
      wedge.addColorStop(0, css(150, 100, 70, 0.4)); wedge.addColorStop(1, css(150, 100, 70, 0.02));
      ctx.fillStyle = wedge; poly(head - tail, tail); ctx.fill();
      const ba = (head + 0.5) / BINS * TAU, hd = hits[head % BINS];
      ctx.strokeStyle = css(150, 100, 80, 0.9); ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath(); ctx.moveTo(...P(lx, ly, 1.4)); ctx.lineTo(...P(lx + Math.cos(ba) * hd, ly + Math.sin(ba) * hd, 1.4)); ctx.stroke();
      }
    }

    // trail + capture points
    const shown = Math.min(dist, ROUTE_LEN);
    ctx.globalAlpha = 1 - fadeOut;
    const trail = ctx.createLinearGradient(...P(0, PLAN_H), ...P(PLAN_W, 0));
    trail.addColorStop(0, css(HUE, 100, 70, 0.9)); trail.addColorStop(1, css(170, 100, 70, 0.9));
    ctx.strokeStyle = trail; ctx.lineWidth = 2.2 * dpr;
    ctx.beginPath();
    let started = false;
    for (const s of SEG) {
      if (s.start > shown) break;
      if (!started) { ctx.moveTo(...P(s.x0, s.y0)); started = true; }
      const [ex, ey] = s.start + s.len <= shown ? [s.x1, s.y1] : along(shown);
      ctx.lineTo(...P(ex, ey));
    }
    ctx.stroke();
    for (let d = CAPTURE_EVERY; d < shown; d += CAPTURE_EVERY) {
      const [x, y] = along(d), [sx, sy] = P(x, y);
      const fresh = clamp(1 - (shown - d) / 6);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx, sy, (2 + fresh * 2) * dpr, 0, TAU); ctx.fill();
      ctx.strokeStyle = css(HUE, 100, 70, 0.5); ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.arc(sx, sy, (5 + fresh * 3) * dpr, 0, TAU); ctx.stroke();
    }

    // issue pins
    ISSUES.forEach((iss, i) => {
      const [x, y] = iss.at, base = P(x, y), head = P(x, y, 3.2);
      const pulse = (t * 0.6 + i * 0.3) % 1;
      ctx.strokeStyle = css(24, 95, 60, 0.6 * (1 - pulse)); ctx.lineWidth = 1.2 * dpr;
      ring(ctx, x, y, 0.5 + pulse * 2); ctx.stroke();
      ctx.strokeStyle = css(24, 95, 60, 0.8); ctx.beginPath(); ctx.moveTo(...base); ctx.lineTo(...head); ctx.stroke();
      ctx.fillStyle = css(24, 95, 58); ctx.beginPath(); ctx.arc(head[0], head[1], 6 * dpr, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 ${8 * dpr}px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', head[0], head[1] + 0.5 * dpr);
      ctx.font = `${10 * dpr}px ${MONO}`; spacing(ctx, 0.8 * dpr); ctx.textAlign = 'start';
      ctx.fillStyle = css(24, 90, 75, 0.85);
      ctx.fillText(iss.label.toUpperCase(), head[0] + 11 * dpr, head[1] + 0.5 * dpr);
      spacing(ctx, 0);
    });

    // walker: field-of-view cone, position, phone
    const [wx, wy, ang] = along(shown);
    let dh = ((ang - heading + Math.PI * 3) % TAU) - Math.PI;
    heading += dh * (1 - Math.exp(-dt * 5));
    const [sx, sy] = P(wx, wy);
    if (!forward) { // forward mode already draws the real (wall-clipped) frustum
      const cone = ctx.createRadialGradient(sx, sy, 0, sx, sy, 6 * scale);
      cone.addColorStop(0, css(HUE, 100, 70, 0.45)); cone.addColorStop(1, css(HUE, 100, 70, 0));
      ctx.fillStyle = cone;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      for (let k = 0; k <= 16; k++) { const a = heading - 0.65 + (k / 16) * 1.3; ctx.lineTo(...P(wx + Math.cos(a) * 6, wy + Math.sin(a) * 6)); }
      ctx.closePath(); ctx.fill();
    }
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 22 * dpr);
    glow.addColorStop(0, 'rgba(255,255,255,.9)'); glow.addColorStop(0.25, css(HUE, 100, 70, 0.6)); glow.addColorStop(1, css(HUE, 100, 70, 0));
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, 22 * dpr, 0, TAU); ctx.fill();

    // the phone, floating at hand height
    const [px, py] = P(wx, wy, 2.6);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = dpr;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(px, py + 14 * dpr); ctx.stroke();
    const pw = 16 * dpr, ph = 28 * dpr;
    ctx.fillStyle = '#0b1a26'; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.4 * dpr;
    ctx.beginPath(); ctx.roundRect(px - pw / 2, py - ph / 2, pw, ph, 4 * dpr); ctx.fill(); ctx.stroke();
    const scr = ctx.createLinearGradient(0, py - ph / 2, 0, py + ph / 2);
    scr.addColorStop(0, css(HUE, 90, 55)); scr.addColorStop(1, css(170, 90, 45));
    ctx.fillStyle = scr; ctx.beginPath(); ctx.roundRect(px - pw / 2 + 2 * dpr, py - ph / 2 + 3 * dpr, pw - 4 * dpr, ph - 6 * dpr, 2 * dpr); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(px, py + ph / 2 - 6 * dpr, 2.2 * dpr, 0, TAU); ctx.fill();

    // HUD tag
    const caps = Math.floor(shown / CAPTURE_EVERY);
    ctx.font = `500 ${10 * dpr}px ${MONO}`; spacing(ctx, 1.2 * dpr); ctx.textBaseline = 'middle';
    const tag = `REC 360° · ${caps} CAPTURES · LIDAR ${revealed.toLocaleString('en-US')} PTS`;
    const tw = ctx.measureText(tag).width;
    const hx = px + 16 * dpr, hy = py - 6 * dpr;
    ctx.fillStyle = 'rgba(3,16,26,.85)'; ctx.strokeStyle = css(HUE, 90, 70, 0.4);
    ctx.beginPath(); ctx.roundRect(hx, hy - 11 * dpr, tw + 30 * dpr, 22 * dpr, 11 * dpr); ctx.fill(); ctx.stroke();
    ctx.fillStyle = (t % 1) < 0.6 ? '#ff4d4d' : 'rgba(255,77,77,.3)';
    ctx.beginPath(); ctx.arc(hx + 11 * dpr, hy, 3.5 * dpr, 0, TAU); ctx.fill();
    ctx.fillStyle = '#dff6ff'; ctx.textAlign = 'start'; ctx.fillText(tag, hx + 20 * dpr, hy + 0.5 * dpr);
    spacing(ctx, 0);

    // 360° capture bubbles: a wireframe sphere blooms at the capture point
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.t += dt;
      const life = b.big ? 2.2 : 1.6;
      if (b.t > life) { bubbles.splice(i, 1); continue; }
      const k = b.t / life, grow = 1 - Math.pow(1 - Math.min(1, k * 2.5), 3);
      const [cx, cy] = P(b.x, b.y, 1.6);
      const r = (b.big ? 3.2 : 2.0) * scale * grow;
      ctx.globalAlpha = (1 - fadeOut) * (1 - Math.max(0, (k - 0.6) / 0.4));
      ctx.strokeStyle = css(HUE, 100, 80, 0.8); ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = css(HUE, 100, 75, 0.4);
      for (let m = 0; m < 4; m++) { const a = b.t * 1.5 + (m / 4) * Math.PI; ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(Math.cos(a)) * r, r, 0, 0, TAU); ctx.stroke(); }
      for (const lat of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.ellipse(cx, cy + lat * r, r * Math.sqrt(1 - lat * lat), r * 0.28 * Math.sqrt(1 - lat * lat), 0, 0, TAU); ctx.stroke(); }
      ctx.strokeStyle = css(HUE, 100, 70, 0.6 * (1 - k)); ring(ctx, b.x, b.y, 1 + k * 5); ctx.stroke();
      ctx.globalAlpha = 1 - fadeOut;
    }
    ctx.globalAlpha = 1;

    // title block, like the corner of a drawing sheet
    const [tx, ty] = P(PLAN_W, PLAN_H);
    ctx.font = `${9.5 * dpr}px ${MONO}`; spacing(ctx, 1.5 * dpr); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = css(HUE, 70, 75, 0.45);
    ctx.fillText(`SHEET A-301 · LEVEL 3 · WALK ${String(lap + 1).padStart(2, '0')}`, tx + 18 * dpr, ty + 6 * dpr);
    ctx.fillText(`${(shown).toFixed(0).padStart(3, '0')} M WALKED · ${Math.round(shown / ROUTE_LEN * 100)}% COVERAGE`, tx + 18 * dpr, ty + 22 * dpr);
  }

  return { resize, draw, click, laps: () => lap };
}
