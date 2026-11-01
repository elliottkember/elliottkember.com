// Clearbit X — visitors stream through a segment builder. Each filter is a gate in a
// funnel: dots that fail a rule peel off through the wall, the rest narrow into a segment.
import { TAU, clamp, smoothstep, hash, css, begin, spacing, MONO, SANS } from './util.js';

const FILTERS = [
  { field: 'Visited', op: '/pricing', short: '/pricing', pass: 0.55, options: ['/pricing', '/docs', '/careers', '/blog'] },
  { field: 'Employees', op: '≥ 50', short: '≥ 50 staff', pass: 0.6, options: ['1–10', '11–50', '51–250', '250+'] },
  { field: 'Industry', op: 'is SaaS', short: 'SaaS', pass: 0.62, options: ['SaaS', 'Fintech', 'Retail', 'Health'] },
  { field: 'Country', op: 'US · UK · NZ', short: 'US·UK·NZ', pass: 0.72, options: ['United States', 'United Kingdom', 'New Zealand', 'Germany'] },
  { field: 'Tech', op: 'uses Segment', short: 'Segment', pass: 0.7, options: ['Segment', 'Stripe', 'HubSpot', 'Salesforce'] },
];
const WIDE_GATES = [0.13, 0.26, 0.39, 0.52, 0.65], COMPACT_GATES = [0.12, 0.3, 0.48, 0.66, 0.84];
let GATE_X = WIDE_GATES;
const TOTAL = 48210;
const HUE0 = 205, HUE1 = 300;

export function createFunnelScene() {
  let W = 1, H = 1, dpr = 1, cy = 0, h0 = 0, unit = 1, compact = false;
  let parts = [], spawnAcc = 0, rate = 200;
  const flash = FILTERS.map(() => 0);
  const counts = [];
  { let c = TOTAL; for (const f of FILTERS) { c = Math.round(c * f.pass); counts.push(c); } }

  function halfHeight(x) {
    const xf = x / W;
    let h = h0;
    FILTERS.forEach((f, i) => { h *= 1 - (1 - Math.sqrt(f.pass)) * smoothstep(GATE_X[i], GATE_X[i] + 0.05, xf); });
    return h;
  }

  function spawn(x = -10 * dpr, yn = Math.random() * 2 - 1) {
    let fail = -1;
    for (let i = 0; i < FILTERS.length; i++) if (Math.random() > FILTERS[i].pass) { fail = i; break; }
    return {
      x, yn, phase: Math.random() * TAU, v: (55 + Math.random() * 55) * unit,
      fail, gate: 0, dead: false, y: 0, vy: 0, vx: 0, a: 1, size: (1.6 + Math.random() * 1.4) * dpr,
    };
  }

  function resize(w, h, ratio) {
    W = w; H = h; dpr = ratio;
    unit = Math.max(0.6, W / 1440);
    compact = W / dpr < 700;
    GATE_X = compact ? COMPACT_GATES : WIDE_GATES;
    cy = compact ? H * 0.3 : H * 0.52;
    h0 = compact ? H * 0.12 : Math.min(H * 0.3, W * 0.3);
    rate = 260 * Math.min(1.3, unit / dpr * 2);
    parts = [];
    const still = { x: -1e4, y: -1e4, on: 0 };
    for (let i = 0; i < 400; i++) step(i / 30, 1 / 30, still); // warm up to a steady flow
  }

  function click(x, y) {
    for (let i = 0; i < 120; i++) parts.push(spawn(-Math.random() * 60 * dpr, clamp((y - cy) / h0 + (Math.random() - 0.5) * 0.4, -1, 1)));
  }

  function chip(ctx, x, y, f, active) {
    ctx.font = `500 ${11.5 * dpr}px ${SANS}`;
    spacing(ctx, 0);
    const a = compact ? '' : f.field, b = compact ? f.short : ` ${f.op}`;
    const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width;
    const pad = (compact ? 8 : 12) * dpr, w = wa + wb + pad * 2 + 16 * dpr, hh = (compact ? 24 : 28) * dpr;
    const left = x - w / 2;
    ctx.beginPath(); ctx.roundRect(left, y - hh / 2, w, hh, hh / 2);
    ctx.fillStyle = active ? 'rgba(40,30,70,.95)' : 'rgba(16,13,30,.9)'; ctx.fill();
    ctx.strokeStyle = css(265, 90, 70, active ? 0.9 : 0.35); ctx.lineWidth = dpr; ctx.stroke();
    // filter glyph
    ctx.fillStyle = css(265, 90, 75, 0.9);
    ctx.beginPath(); ctx.moveTo(left + pad, y - 4 * dpr); ctx.lineTo(left + pad + 9 * dpr, y - 4 * dpr); ctx.lineTo(left + pad + 5.5 * dpr, y + 1 * dpr);
    ctx.lineTo(left + pad + 5.5 * dpr, y + 5 * dpr); ctx.lineTo(left + pad + 3.5 * dpr, y + 4 * dpr); ctx.lineTo(left + pad + 3.5 * dpr, y + 1 * dpr); ctx.closePath(); ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillText(a, left + pad + 16 * dpr, y + 0.5 * dpr);
    ctx.fillStyle = '#fff'; ctx.fillText(b, left + pad + 16 * dpr + wa, y + 0.5 * dpr);
    return { left, w, hh };
  }

  function dropdown(ctx, x, y, f) {
    const w = 168 * dpr, row = 26 * dpr, h = row * f.options.length + 12 * dpr;
    const left = x - w / 2;
    ctx.beginPath(); ctx.roundRect(left, y, w, h, 10 * dpr);
    ctx.fillStyle = 'rgba(20,16,36,.97)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.stroke();
    ctx.font = `${11.5 * dpr}px ${SANS}`; ctx.textAlign = 'start'; ctx.textBaseline = 'middle';
    f.options.forEach((o, i) => {
      const ry = y + 6 * dpr + i * row + row / 2;
      const on = f.op.includes(o) || (f.field === 'Country' && i < 3) || (f.field === 'Employees' && i >= 2);
      ctx.beginPath(); ctx.roundRect(left + 12 * dpr, ry - 6 * dpr, 12 * dpr, 12 * dpr, 3 * dpr);
      ctx.fillStyle = on ? css(265, 90, 65) : 'transparent'; ctx.fill();
      ctx.strokeStyle = on ? css(265, 90, 65) : 'rgba(255,255,255,.3)'; ctx.stroke();
      if (on) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath(); ctx.moveTo(left + 15 * dpr, ry); ctx.lineTo(left + 17.5 * dpr, ry + 2.5 * dpr); ctx.lineTo(left + 21.5 * dpr, ry - 2.5 * dpr); ctx.stroke();
        ctx.lineWidth = dpr;
      }
      ctx.fillStyle = on ? '#fff' : 'rgba(255,255,255,.55)';
      ctx.fillText(o, left + 32 * dpr, ry + 0.5 * dpr);
    });
  }

  function step(t, dt, pointer) {
    spawnAcc += rate * dt;
    while (spawnAcc >= 1) { parts.push(spawn(-Math.random() * 20 * dpr)); spawnAcc--; }
    for (const p of parts) {
      if (!p.dead) {
        p.x += p.v * dt * Math.max(0.4, 1 + (pointer.tx || 0) * 0.6);
        p.yn = clamp(p.yn + Math.sin(t * 1.7 + p.phase) * 0.15 * dt + (pointer.ty || 0) * 0.45 * dt, -0.95, 0.95);
        // cursor nudges the stream apart
        const ty = cy + p.yn * halfHeight(p.x) * 0.92;
        const dx = p.x - pointer.x, dy = ty - pointer.y, d2 = dx * dx + dy * dy, r = 70 * dpr;
        if (d2 < r * r) p.yn = clamp(p.yn + Math.sign(dy || 1) * (1 - Math.sqrt(d2) / r) * 2.5 * dt, -0.95, 0.95);
        p.y = cy + p.yn * halfHeight(p.x) * 0.92;
        while (p.gate < FILTERS.length && p.x >= GATE_X[p.gate] * W) {
          if (p.gate === p.fail) {
            p.dead = true; p.vx = p.v * 0.35; p.vy = (p.yn >= 0 ? 1 : -1) * (30 + Math.random() * 60) * unit;
            break;
          }
          flash[p.gate] = Math.min(1, flash[p.gate] + 0.04);
          p.gate++;
        }
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= 1 + dt * 1.2; p.a -= dt * 0.7;
      }
    }
    parts = parts.filter((p) => p.x < W + 20 * dpr && p.a > 0 && p.y > -20 && p.y < H + 20);
  }

  function draw(ctx, t, dt, pointer) {
    step(t, dt, pointer);
    const endX = GATE_X[GATE_X.length - 1] * W;
    begin(ctx, W, H, '#07060d');

    // dashboard dot grid
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    const g = 28 * dpr;
    for (let y = g / 2; y < H; y += g) for (let x = g / 2; x < W; x += g) ctx.fillRect(x, y, dpr, dpr);

    // funnel body
    const top = [], stride = 8 * dpr;
    for (let x = 0; x <= W + stride; x += stride) top.push([x, halfHeight(x)]);
    const body = ctx.createLinearGradient(0, 0, W, 0);
    body.addColorStop(0, css(HUE0, 90, 55, 0.10)); body.addColorStop(0.65, css(265, 90, 60, 0.10)); body.addColorStop(1, css(HUE1, 90, 60, 0.16));
    ctx.beginPath();
    top.forEach(([x, h], i) => (i ? ctx.lineTo(x, cy - h) : ctx.moveTo(x, cy - h)));
    for (let i = top.length - 1; i >= 0; i--) ctx.lineTo(top[i][0], cy + top[i][1]);
    ctx.closePath(); ctx.fillStyle = body; ctx.fill();
    const edge = ctx.createLinearGradient(0, 0, W, 0);
    edge.addColorStop(0, css(HUE0, 90, 70, 0.4)); edge.addColorStop(1, css(HUE1, 90, 70, 0.5));
    ctx.strokeStyle = edge; ctx.lineWidth = 1.2 * dpr;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      top.forEach(([x, h], i) => (i ? ctx.lineTo(x, cy + s * h) : ctx.moveTo(x, cy + s * h)));
      ctx.stroke();
    }

    // hovered gate opens its dropdown, like the real segment builder
    let hover = -1;
    if (pointer.on > 0.5) GATE_X.forEach((gx, i) => { if (Math.abs(pointer.x - gx * W) < 60 * dpr) hover = i; });

    // gates: dashed line, rule chip above, count below
    const chips = [];
    FILTERS.forEach((f, i) => {
      flash[i] = Math.max(0, flash[i] - dt * 3);
      const gx = GATE_X[i] * W, h = halfHeight(gx - 1);
      ctx.setLineDash([3 * dpr, 5 * dpr]);
      ctx.strokeStyle = css(265, 90, 75, 0.25 + flash[i] * 0.5 + (hover === i ? 0.3 : 0));
      ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.moveTo(gx, cy - h - 18 * dpr); ctx.lineTo(gx, cy + h + 6 * dpr); ctx.stroke();
      ctx.setLineDash([]);
      const below = compact && i % 2 === 1;
      const chipY = below ? cy + h + 30 * dpr : cy - h - (compact ? 30 : 34) * dpr;
      chips.push({ ...chip(ctx, gx, chipY, f, hover === i), x: gx, y: chipY });
      const countY = below ? cy - h - 32 * dpr : cy + h + 30 * dpr;

      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `500 ${13 * dpr}px ${MONO}`; spacing(ctx, 0.5 * dpr);
      const live = Math.round(counts[i] * (1 + 0.004 * Math.sin(t * 1.3 + i)));
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.fillText(live.toLocaleString('en-US'), gx, countY);
      ctx.font = `${10 * dpr}px ${MONO}`; spacing(ctx, 1.4 * dpr);
      ctx.fillStyle = css(330, 80, 70, 0.7);
      ctx.fillText(`−${Math.round((1 - f.pass) * 100)}%`, gx, countY + 16 * dpr);
      ctx.textAlign = 'start';
    });
    // AND connectors between rule chips
    ctx.font = `600 ${9 * dpr}px ${MONO}`; spacing(ctx, 1.5 * dpr); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < (compact ? 0 : chips.length - 1); i++) {
      const a = chips[i], b = chips[i + 1];
      const x0 = a.left + a.w, x1 = b.left;
      if (x1 - x0 < 30 * dpr) continue;
      ctx.strokeStyle = 'rgba(255,255,255,.14)';
      ctx.beginPath(); ctx.moveTo(x0, a.y); ctx.bezierCurveTo((x0 + x1) / 2, a.y, (x0 + x1) / 2, b.y, x1, b.y); ctx.stroke();
      ctx.fillStyle = '#07060d'; ctx.fillRect((x0 + x1) / 2 - 16 * dpr, (a.y + b.y) / 2 - 7 * dpr, 32 * dpr, 14 * dpr);
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillText('AND', (x0 + x1) / 2, (a.y + b.y) / 2);
    }
    // entry label
    ctx.textAlign = 'start'; ctx.font = `${10 * dpr}px ${MONO}`; spacing(ctx, 1.6 * dpr);
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.fillText(`ALL VISITORS · ${TOTAL.toLocaleString('en-US')}`, 20 * dpr, cy - h0 + 24 * dpr);

    // visitors
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      const matched = p.gate === FILTERS.length;
      const hue = matched ? 320 : HUE0 + (HUE1 - HUE0) * clamp(p.x / endX) * 0.8;
      ctx.fillStyle = p.dead ? `rgba(150,150,170,${Math.max(0, p.a) * 0.35})` : css(hue, 95, matched ? 70 : 62, matched ? 0.95 : 0.75);
      ctx.beginPath(); ctx.arc(p.x, p.y, matched ? p.size * 1.3 : p.size, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // segment result
    const sx = Math.min(W - 120 * dpr, endX + W * 0.1), sh = halfHeight(sx);
    const glow = ctx.createRadialGradient(sx, cy, 0, sx, cy, sh * 3);
    glow.addColorStop(0, css(320, 95, 65, 0.25)); glow.addColorStop(1, css(320, 95, 65, 0));
    ctx.fillStyle = glow; ctx.fillRect(sx - sh * 3, cy - sh * 3, sh * 6, sh * 6);
    ctx.textAlign = 'center'; ctx.font = `${10 * dpr}px ${MONO}`; spacing(ctx, 1.6 * dpr);
    ctx.fillStyle = css(320, 90, 75, 0.85);
    if (!compact) ctx.fillText('SEGMENT · HIGH-INTENT SAAS', sx, cy - sh - 22 * dpr);
    ctx.font = `600 ${20 * dpr}px ${SANS}`; spacing(ctx, 0);
    ctx.fillStyle = '#fff';
    if (!compact) ctx.fillText(`${counts[counts.length - 1].toLocaleString('en-US')} accounts`, sx, cy + sh + 34 * dpr);

    if (hover >= 0) dropdown(ctx, chips[hover].x, chips[hover].y + chips[hover].hh / 2 + 8 * dpr, FILTERS[hover]);
  }

  return { resize, draw, click };
}
