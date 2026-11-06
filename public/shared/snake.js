// Easter egg: type the Konami code (↑ ↑ ↓ ↓ ← → ← → B A) to play snake over the page.
// On a phone, swipe the arrows and tap twice for B A; then swipe to steer and hold for turbo.
// A blocky remake of github.com/elliottkember/jSnake: the snake wraps around the edges,
// and the site slowly fades away behind it until there's nothing left but the game.
(() => {
  const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  const TOUCH_KONAMI = [...KONAMI.slice(0, 8), 'tap', 'tap'];
  const SWIPE = 30, STEER = 24, HOLD_MS = 220; // px for a swipe, px of drag per turn, ms held for turbo
  const CELL = 24, GAP = 2;
  const PINK = '#ff2d95', PINK_HEAD = '#ff7cc0', GREEN = '#2bff6b';
  const START_STEP = 110, MIN_STEP = 50; // ms per move; each fruit shaves a little off
  const TURBO = 2.5; // hold shift to go this many times faster
  const FADE_MS = 45000; // time for the site to fade out completely, sooner the more you eat
  const DIRS = {
    arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1],
    arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0],
  };

  let typed = [];
  let game = null;

  function press(k) {
    typed = [...typed, k].slice(-KONAMI.length);
    const t = typed.join();
    if (t === KONAMI.join() || t === TOUCH_KONAMI.join()) { typed = []; game = start(); }
  }
  const typing = (e) => e.target.closest?.('input, textarea, select, [contenteditable]');

  addEventListener('keydown', (e) => {
    if (game) return game.key(e);
    if (!typing(e)) press(e.key.toLowerCase());
  }, true);

  // touch version of the code: each swipe is an arrow, each tap is a button
  let touch0 = null;
  addEventListener('touchstart', (e) => {
    touch0 = game || e.touches.length > 1 || typing(e) ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { capture: true, passive: true });
  addEventListener('touchend', (e) => {
    if (game || !touch0) return;
    const t = e.changedTouches[0], dx = t.clientX - touch0.x, dy = t.clientY - touch0.y;
    touch0 = null;
    if (Math.hypot(dx, dy) < SWIPE) return press('tap');
    press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'arrowright' : 'arrowleft') : (dy > 0 ? 'arrowdown' : 'arrowup'));
  }, { capture: true, passive: true });

  function start() {
    const bg = getComputedStyle(document.body).backgroundColor;
    const layer = (css) => {
      const el = document.createElement('div');
      el.style.cssText = `position:fixed;inset:0;z-index:2147483646;${css}`;
      document.body.append(el);
      return el;
    };
    const veil = layer(`background:${bg};opacity:0;transition:opacity 1s linear;pointer-events:none`);
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;z-index:2147483647;width:100%;height:100%;touch-action:none';
    document.body.append(canvas);
    const hud = layer(`z-index:2147483647;inset:20px auto auto 50%;translate:-50% 0;white-space:nowrap;padding:6px 10px;border-radius:6px;background:#000;
      color:${PINK};font:11px/1.4 "JetBrains Mono",ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;pointer-events:none`);
    const quit = document.createElement('button');
    quit.textContent = '✕'; quit.setAttribute('aria-label', 'Quit snake');
    quit.style.cssText = `position:fixed;z-index:2147483647;top:14px;right:14px;width:40px;height:40px;border:0;border-radius:50%;
      background:#000;color:${PINK};font:16px/40px system-ui,sans-serif;cursor:pointer`;
    quit.addEventListener('click', () => stop());
    document.body.append(quit);
    const touchy = matchMedia('(pointer: coarse)').matches;
    const ctx = canvas.getContext('2d');

    let cols, rows, ox, oy;
    function resize() {
      const dpr = devicePixelRatio || 1;
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.floor(innerWidth / CELL); rows = Math.floor(innerHeight / CELL);
      ox = Math.floor((innerWidth - cols * CELL) / 2); oy = Math.floor((innerHeight - rows * CELL) / 2);
      if (snake) { snake.forEach((p) => { p[0] = mod(p[0], cols); p[1] = mod(p[1], rows); }); if (!free(fruit)) fruit = place(); }
      draw();
    }

    let snake, dir, queue, fruit, score, best = 0, step, deadUntil = 0, turbo = false;
    function reset() {
      const x = Math.floor(cols / 2), y = Math.floor(rows / 2);
      snake = [[x, y], [x - 1, y], [x - 2, y], [x - 3, y]];
      dir = [1, 0]; queue = []; score = 0; step = START_STEP;
      fruit = place();
    }
    const mod = (n, m) => ((n % m) + m) % m;
    const free = (f) => f && f[0] < cols && f[1] < rows && !snake.some((p) => p[0] === f[0] && p[1] === f[1]);
    function place() {
      for (;;) {
        const f = [Math.floor(Math.random() * cols), Math.floor(Math.random() * rows)];
        if (free(f)) return f;
      }
    }

    function tick() {
      if (queue.length) dir = queue.shift();
      const head = [mod(snake[0][0] + dir[0], cols), mod(snake[0][1] + dir[1], rows)];
      const eating = head[0] === fruit[0] && head[1] === fruit[1];
      const body = eating ? snake : snake.slice(0, -1); // the tail moves out of the way unless we grow
      if (body.some((p) => p[0] === head[0] && p[1] === head[1])) {
        deadUntil = performance.now() + 1000; // freeze for a beat, like the original, then start over
        return;
      }
      snake = [head, ...body];
      if (eating) { score++; best = Math.max(best, score); step = Math.max(MIN_STEP, step - 2); fruit = place(); }
    }

    function block([x, y], colour) {
      ctx.fillStyle = colour;
      ctx.fillRect(ox + x * CELL + GAP / 2, oy + y * CELL + GAP / 2, CELL - GAP, CELL - GAP);
    }
    function draw() {
      if (!snake) return;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const dying = performance.now() < deadUntil;
      block(fruit, GREEN);
      snake.forEach((p, i) => block(p, dying && Math.floor(performance.now() / 120) % 2 ? 'transparent' : i ? PINK : PINK_HEAD));
      const hint = turbo ? 'turbo!' : touchy ? 'swipe · hold for turbo' : 'shift for turbo · esc to quit';
      hud.textContent = `Score ${score}${best > score ? ` · best ${best}` : ''} · ${hint}`;
    }

    const began = performance.now();
    let last = began, raf;
    function frame(now) {
      if (deadUntil && now >= deadUntil) { deadUntil = 0; reset(); }
      if (!deadUntil && now - last >= (turbo ? step / TURBO : step)) { last = now; tick(); }
      veil.style.opacity = Math.min(1, (now - began) / FADE_MS + best * 0.03);
      draw();
      raf = requestAnimationFrame(frame);
    }

    function key(e) {
      const k = e.key.toLowerCase();
      turbo = e.shiftKey;
      e.preventDefault(); e.stopImmediatePropagation(); // the page underneath shouldn't react while we play
      if (k === 'escape') return stop();
      if (DIRS[k]) turn(DIRS[k]);
    }
    function turn(next) {
      const prev = queue.at(-1) || dir;
      if (next[0] === -prev[0] && next[1] === -prev[1]) return; // can't reverse into yourself
      if (next[0] === prev[0] && next[1] === prev[1]) return;
      if (queue.length < 2) queue.push(next);
    }

    // Touch: drag anywhere to steer — it turns mid-drag, so one long drag can turn several times.
    // A finger held still means turbo. Everything is kept from the page behind (no scrolling or
    // paging), except taps on the quit button.
    let drag = null, hold;
    function swallow(e) {
      if (e.target === quit) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.changedTouches) return; // wheel
      const t = e.changedTouches[0];
      if (e.type === 'touchstart') {
        drag = { x: t.clientX, y: t.clientY };
        clearTimeout(hold); hold = setTimeout(() => { turbo = true; }, HOLD_MS);
      } else if (e.type === 'touchmove' && drag) {
        const dx = t.clientX - drag.x, dy = t.clientY - drag.y;
        if (Math.hypot(dx, dy) < STEER) return;
        clearTimeout(hold);
        turn(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
        drag = { x: t.clientX, y: t.clientY };
      } else if (!e.touches.length) { // last finger lifted
        clearTimeout(hold); turbo = false; drag = null;
      }
    }
    const swallowed = ['wheel', 'touchmove', 'touchstart', 'touchend', 'touchcancel'];
    swallowed.forEach((t) => addEventListener(t, swallow, { capture: true, passive: false }));

    // shift held = turbo; let go (or leave the window) to slow back down
    const keyup = (e) => { turbo = e.shiftKey; };
    const blur = () => { turbo = false; };
    addEventListener('keyup', keyup, true);
    addEventListener('blur', blur);

    function stop() {
      cancelAnimationFrame(raf);
      removeEventListener('keyup', keyup, true);
      removeEventListener('blur', blur);
      removeEventListener('resize', resize);
      swallowed.forEach((t) => removeEventListener(t, swallow, { capture: true }));
      clearTimeout(hold);
      canvas.remove(); hud.remove(); quit.remove();
      veil.style.transition = 'opacity .6s ease';
      veil.style.opacity = 0;
      setTimeout(() => veil.remove(), 600);
      game = null;
    }

    addEventListener('resize', resize);
    resize();
    reset();
    raf = requestAnimationFrame(frame);
    return { key };
  }
})();
