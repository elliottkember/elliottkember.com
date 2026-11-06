// Clearbit X — visitors stream through a segment builder. Each top-level rule is a gate in a
// funnel: dots that fail a rule peel off through the wall, the rest narrow into the segment.
// The rules come from the builder on the homepage card (shared/segment.js), so edits reshape
// the funnel live: gates slide into place, the walls ease in or out, the counts tick over.
import { TAU, clamp, smoothstep, css, begin, spacing, MONO, SANS } from './util.js';
import { TOTAL, getSegment, gatesOf, passOf, summary, optionsOf } from '../../shared/segment.js?v=13';

const HUE0 = 205, HUE1 = 300;

export function createFunnelScene() {
  let W = 1, H = 1, dpr = 1, cy = 0, h0 = 0, unit = 1, compact = false, span = [0.1, 0.8], cardX = Infinity;
  let parts = [], spawnAcc = 0, rate = 200;
  let gates = [], live = [], seen = -1, name = '', isOr = false;
  let chips = []; // last frame's chip boxes, for hover and click

  // Pick up a new segment from the page: keep gates that still exist (so they glide rather than
  // jump), add new ones with open walls, and let removed ones fade and open back up.
  function sync(snap = false) {
    const seg = getSegment();
    if (seg.version === seen && !snap) return;
    seen = seg.version; name = seg.name?.trim() || 'Untitled segment'; isOr = seg.op === 'or';
    const nodes = gatesOf(seg), n = nodes.length, [a, b] = span;
    const old = new Map(gates.map((g) => [g.id, g]));
    live = nodes.map((node, i) => {
      const tx = n === 1 ? a + (b - a) * 0.4 : a + ((b - a) * i) / (n - 1);
      let g = old.get(node.id);
      old.delete(node.id);
      if (!g) g = { id: node.id, x: tx, pass: 1, a: 0, flash: 0, count: TOTAL };
      return Object.assign(g, { node, i, tx, tpass: passOf(node), ta: 1, live: true });
    });
    for (const g of old.values()) Object.assign(g, { tpass: 1, ta: 0, live: false });
    gates = [...live, ...old.values()];
    if (snap) for (const g of gates) { g.x = g.tx; g.pass = g.tpass; g.a = g.ta; }
    for (const p of parts) if (!p.dead) p.fail = roll(p.x);
  }

  // Which gate ahead of x (if any) this visitor will fail.
  function roll(x = -Infinity) {
    for (const g of live) if (g.tx * W > x && Math.random() > g.tpass) return g.id;
    return null;
  }

  function ease(dt) {
    const k = 1 - Math.exp(-dt * 5);
    for (const g of gates) {
      g.x += (g.tx - g.x) * k; g.pass += (g.tpass - g.pass) * k; g.a += (g.ta - g.a) * k;
      g.flash = Math.max(0, g.flash - dt * 3);
    }
    gates = gates.filter((g) => g.live || g.a > 0.02 || g.pass < 0.99);
    let c = TOTAL;
    for (const g of live) { c *= g.pass; g.count = c; }
  }

  function halfHeight(x) {
    let h = h0;
    for (const g of gates) h *= 1 - (1 - Math.sqrt(g.pass)) * smoothstep(g.x * W, g.x * W + 50 * dpr, x);
    return h;
  }

  function spawn(x = -10 * dpr, yn = Math.random() * 2 - 1) {
    return {
      x, yn, phase: Math.random() * TAU, v: (55 + Math.random() * 55) * unit,
      fail: roll(), dead: false, y: 0, vy: 0, vx: 0, a: 1, size: (1.6 + Math.random() * 1.4) * dpr,
    };
  }

  function resize(w, h, ratio) {
    W = w; H = h; dpr = ratio;
    const cw = W / dpr;
    unit = Math.max(0.6, W / 1440);
    compact = cw < 760; // matches the page's phone layout, where the card sits at the bottom
    cardX = Infinity;
    if (compact) span = [0.08, 0.74]; // the phone's chapter rail sits over the right edge
    else {
      // keep the gates in the gap between the side rail and the card, so they can be seen and clicked
      const rail = clamp(cw * 0.024, 16, 36) + 170, card = cw - clamp(cw * 0.05, 20, 96) - Math.min(560, cw * 0.48);
      const a = (rail + 60) / cw;
      span = [a, Math.min(0.9, Math.max((card - 80) / cw, a + 380 / cw))];
      cardX = card * dpr;
    }
    // on phones the card covers the bottom half, so the funnel sits higher and slimmer
    cy = compact ? H * 0.25 : H * 0.52;
    h0 = compact ? H * 0.085 : Math.min(H * 0.3, W * 0.3);
    rate = 260 * Math.min(1.3, unit / dpr * 2);
    parts = [];
    sync(true);
    const still = { x: -1e4, y: -1e4, on: 0 };
    for (let i = 0; i < 400; i++) step(i / 30, 1 / 30, still); // warm up to a steady flow
  }

  const hit = (x, y) => chips.find((c) => x >= c.left && x <= c.left + c.w && Math.abs(y - c.y) <= c.hh / 2 + 4 * dpr);

  function click(x, y) {
    const c = hit(x, y);
    if (c) return { edit: c.id }; // the page opens this rule in the builder
    for (let i = 0; i < 120; i++) parts.push(spawn(-Math.random() * 60 * dpr, clamp((y - cy) / h0 + (Math.random() - 0.5) * 0.4, -1, 1)));
    return null;
  }

  function chip(ctx, x, y, s, active) {
    ctx.font = `500 ${11.5 * dpr}px ${SANS}`;
    spacing(ctx, 0);
    const value = s.value.length > 18 ? `${s.value.slice(0, 17)}…` : s.value;
    const a = compact ? '' : s.field, b = compact ? value : ` ${value}`;
    const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width;
    const pad = (compact ? 8 : 12) * dpr, w = wa + wb + pad * 2 + 16 * dpr, hh = (compact ? 24 : 28) * dpr;
    const left = clamp(x - w / 2, 8 * dpr, W - w - 8 * dpr);
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

  // hovering a chip previews its rule, like the real builder's value dropdown
  function dropdown(ctx, c) {
    const lines = optionsOf(c.g.node);
    ctx.font = `${11.5 * dpr}px ${SANS}`; spacing(ctx, 0);
    const widest = Math.max(0, ...lines.map((l) => ctx.measureText(l.text).width));
    const w = clamp(widest + 48 * dpr, 150 * dpr, 280 * dpr), row = 26 * dpr, h = row * lines.length + 34 * dpr;
    const left = clamp(c.x - w / 2, 8 * dpr, W - w - 8 * dpr);
    const y = c.below ? c.y - c.hh / 2 - 8 * dpr - h : c.y + c.hh / 2 + 8 * dpr;
    ctx.beginPath(); ctx.roundRect(left, y, w, h, 10 * dpr);
    ctx.fillStyle = 'rgba(20,16,36,.97)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = dpr; ctx.stroke();
    ctx.textAlign = 'start'; ctx.textBaseline = 'middle';
    lines.forEach(({ text, on }, i) => {
      const ry = y + 6 * dpr + i * row + row / 2;
      ctx.beginPath(); ctx.roundRect(left + 12 * dpr, ry - 6 * dpr, 12 * dpr, 12 * dpr, 3 * dpr);
      ctx.fillStyle = on ? css(265, 90, 65) : 'transparent'; ctx.fill();
      ctx.strokeStyle = on ? css(265, 90, 65) : 'rgba(255,255,255,.3)'; ctx.stroke();
      if (on) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath(); ctx.moveTo(left + 15 * dpr, ry); ctx.lineTo(left + 17.5 * dpr, ry + 2.5 * dpr); ctx.lineTo(left + 21.5 * dpr, ry - 2.5 * dpr); ctx.stroke();
        ctx.lineWidth = dpr;
      }
      ctx.font = `${11.5 * dpr}px ${SANS}`; spacing(ctx, 0);
      ctx.fillStyle = on ? '#fff' : 'rgba(255,255,255,.55)';
      ctx.fillText(text, left + 32 * dpr, ry + 0.5 * dpr);
    });
    ctx.font = `${9 * dpr}px ${MONO}`; spacing(ctx, 1.4 * dpr);
    ctx.fillStyle = css(265, 90, 75, 0.8);
    ctx.fillText('CLICK TO EDIT', left + 12 * dpr, y + h - 15 * dpr);
  }

  function step(t, dt, pointer) {
    sync();
    ease(dt);
    spawnAcc += rate * dt;
    while (spawnAcc >= 1) { parts.push(spawn(-Math.random() * 20 * dpr)); spawnAcc--; }
    for (const p of parts) {
      if (!p.dead) {
        const px = p.x;
        p.x += p.v * dt * Math.max(0.4, 1 + (pointer.tx || 0) * 0.6);
        p.yn = clamp(p.yn + Math.sin(t * 1.7 + p.phase) * 0.15 * dt + (pointer.ty || 0) * 0.45 * dt, -0.95, 0.95);
        // cursor nudges the stream apart
        const ty = cy + p.yn * halfHeight(p.x) * 0.92;
        const dx = p.x - pointer.x, dy = ty - pointer.y, d2 = dx * dx + dy * dy, r = 70 * dpr;
        if (d2 < r * r) p.yn = clamp(p.yn + Math.sign(dy || 1) * (1 - Math.sqrt(d2) / r) * 2.5 * dt, -0.95, 0.95);
        p.y = cy + p.yn * halfHeight(p.x) * 0.92;
        for (const g of live) {
          const gx = g.x * W;
          if (px >= gx || p.x < gx) continue; // only gates crossed this step
          if (g.id === p.fail) {
            p.dead = true; p.vx = p.v * 0.35; p.vy = (p.yn >= 0 ? 1 : -1) * (30 + Math.random() * 60) * unit;
            break;
          }
          g.flash = Math.min(1, g.flash + 0.04);
        }
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= 1 + dt * 1.2; p.a -= dt * 0.7;
      }
    }
    parts = parts.filter((p) => p.x < W + 20 * dpr && p.a > 0 && p.y > -20 && p.y < H + 20);
  }

  function draw(ctx, t, dt, pointer) {
    step(t, dt, pointer);
    const lastGate = live[live.length - 1];
    const endX = (lastGate ? lastGate.x : span[1]) * W;
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

    // hover: a chip, or the gate's dashed line through the funnel
    let hover = null;
    if (pointer.on > 0.5) {
      hover = hit(pointer.x, pointer.y)?.id ?? null;
      if (!hover) for (const c of chips) if (Math.abs(pointer.x - c.x) < 20 * dpr && Math.abs(pointer.y - cy) < halfHeight(c.x) + 10 * dpr) hover = c.id;
    }

    // gates: dashed line, rule chip above, count below — alternating sides when they're crowded
    const gap = live.length > 1 ? ((span[1] - span[0]) * W) / (live.length - 1) : Infinity;
    const stagger = gap < 150 * dpr;
    const sx = Math.min(W - 120 * dpr, endX + W * 0.1);
    const resultShown = !compact && sx < cardX - 90 * dpr;
    const next = [];
    for (const gt of gates) {
      if (gt.a < 0.01) continue;
      ctx.globalAlpha = clamp(gt.a);
      const gx = gt.x * W, h = halfHeight(gx - 1), on = hover === gt.id;
      ctx.setLineDash([3 * dpr, 5 * dpr]);
      ctx.strokeStyle = css(265, 90, 75, 0.25 + gt.flash * 0.5 + (on ? 0.3 : 0));
      ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.moveTo(gx, cy - h - 18 * dpr); ctx.lineTo(gx, cy + h + 6 * dpr); ctx.stroke();
      ctx.setLineDash([]);
      const below = stagger && gt.i % 2 === 1;
      const chipY = below ? cy + h + 30 * dpr : cy - h - (compact ? 30 : 34) * dpr;
      const box = chip(ctx, gx, chipY, summary(gt.node), on);
      if (!gt.live) continue;
      next.push({ ...box, x: gx, y: chipY, id: gt.id, below, g: gt });

      const countY = below ? cy - h - 32 * dpr : cy + h + 30 * dpr;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `500 ${13 * dpr}px ${MONO}`; spacing(ctx, 0.5 * dpr);
      const count = Math.round(gt.count * (1 + 0.004 * Math.sin(t * 1.3 + gt.i)));
      const total = !resultShown && gt === lastGate; // this count is the segment's size: say so
      ctx.fillStyle = total ? css(320, 95, 80) : 'rgba(255,255,255,.85)';
      ctx.fillText(`${count.toLocaleString('en-US')}${total && !compact ? ' accounts' : ''}`, gx, countY);
      ctx.font = `${10 * dpr}px ${MONO}`; spacing(ctx, 1.4 * dpr);
      ctx.fillStyle = css(330, 80, 70, 0.7);
      ctx.fillText(`−${Math.round((1 - gt.pass) * 100)}%`, gx, countY + 16 * dpr);
      ctx.textAlign = 'start';
    }
    ctx.globalAlpha = 1;
    chips = next;

    // AND connectors between rule chips
    ctx.font = `600 ${9 * dpr}px ${MONO}`; spacing(ctx, 1.5 * dpr); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < (stagger || isOr ? 0 : chips.length - 1); i++) {
      const a = chips[i], b = chips[i + 1];
      const x0 = a.left + a.w, x1 = b.left;
      if (x1 - x0 < 30 * dpr) continue;
      ctx.strokeStyle = 'rgba(255,255,255,.14)';
      ctx.beginPath(); ctx.moveTo(x0, a.y); ctx.bezierCurveTo((x0 + x1) / 2, a.y, (x0 + x1) / 2, b.y, x1, b.y); ctx.stroke();
      ctx.fillStyle = '#07060d'; ctx.fillRect((x0 + x1) / 2 - 16 * dpr, (a.y + b.y) / 2 - 7 * dpr, 32 * dpr, 14 * dpr);
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillText('AND', (x0 + x1) / 2, (a.y + b.y) / 2);
    }
    // entry label (no room for it on phones)
    if (!compact) {
      ctx.textAlign = 'start'; ctx.font = `${10 * dpr}px ${MONO}`; spacing(ctx, 1.6 * dpr);
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.fillText(`ALL VISITORS · ${TOTAL.toLocaleString('en-US')}`, 20 * dpr, cy - h0 + 24 * dpr);
    }

    // visitors
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      const matched = !p.dead && lastGate && p.x >= lastGate.x * W;
      const hue = matched ? 320 : HUE0 + (HUE1 - HUE0) * clamp(p.x / endX) * 0.8;
      ctx.fillStyle = p.dead ? `rgba(150,150,170,${Math.max(0, p.a) * 0.35})` : css(hue, 95, matched ? 70 : 62, matched ? 0.95 : 0.75);
      ctx.beginPath(); ctx.arc(p.x, p.y, matched ? p.size * 1.3 : p.size, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // segment result
    const sh = halfHeight(sx);
    const glow = ctx.createRadialGradient(sx, cy, 0, sx, cy, sh * 3);
    glow.addColorStop(0, css(320, 95, 65, 0.25)); glow.addColorStop(1, css(320, 95, 65, 0));
    ctx.fillStyle = glow; ctx.fillRect(sx - sh * 3, cy - sh * 3, sh * 6, sh * 6);
    ctx.textAlign = 'center'; ctx.font = `${10 * dpr}px ${MONO}`; spacing(ctx, 1.6 * dpr);
    ctx.fillStyle = css(320, 90, 75, 0.85);
    if (resultShown) ctx.fillText(`SEGMENT · ${name.toUpperCase()}`, sx, cy - sh - 22 * dpr);
    ctx.font = `600 ${20 * dpr}px ${SANS}`; spacing(ctx, 0);
    ctx.fillStyle = '#fff';
    if (resultShown) ctx.fillText(`${Math.round(lastGate ? lastGate.count : TOTAL).toLocaleString('en-US')} accounts`, sx, cy + sh + 34 * dpr);

    const hc = chips.find((c) => c.id === hover);
    if (hc) dropdown(ctx, hc);
  }

  return { resize, draw, click };
}
