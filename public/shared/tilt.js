// Device tilt as a smoothed { x, y } in -1..1.
//   x > 0: right edge tipped down.   y > 0: top edge tipped up (things should slide down the screen).
// y is relative to however the phone is being held, and the baseline drifts slowly to follow it.
// iOS only grants motion access after a tap, so we ask on the first tap and show a small hint.
const clamp = (v) => Math.max(-1, Math.min(1, v));
const RANGE = 45; // degrees of tilt for full deflection
const DEAD = 0.1; // ignore the first ~4.5° so a resting hand doesn't drift things
const soft = (v) => Math.sign(v) * Math.max(0, Math.abs(v) - DEAD) / (1 - DEAD);

export function tilt(onChange = () => {}) {
  const state = { x: 0, y: 0, active: false };
  let base = null;

  function handle(e) {
    if (e.beta == null || e.gamma == null) return;
    const angle = screen.orientation?.angle ?? window.orientation ?? 0;
    let x, y;
    if (angle === 90) { x = e.beta; y = -e.gamma; }
    else if (angle === -90 || angle === 270) { x = -e.beta; y = e.gamma; }
    else { x = e.gamma; y = e.beta; }
    if (base == null) base = y;
    base += (y - base) * 0.004;
    // heavy smoothing: tilt should feel like a slow lean, not a twitch
    state.x += (soft(clamp(x / RANGE)) - state.x) * 0.06;
    state.y += (soft(clamp((y - base) / RANGE)) - state.y) * 0.06;
    state.active = true;
    onChange(state);
  }
  let hint = null;
  addEventListener('deviceorientation', (e) => {
    handle(e);
    if (state.active && hint) { hint.remove(); hint = null; } // motion already flowing (Android): no prompt needed
  });

  const touch = matchMedia('(pointer: coarse)').matches;
  if (!touch || !('DeviceOrientationEvent' in window)) return state;

  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    hint = document.createElement('div');
    hint.textContent = 'Tap anywhere to enable tilt';
    hint.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 76px);translate:-50% 0;white-space:nowrap;z-index:99;' +
      'padding:8px 14px;border-radius:99px;background:rgba(0,0,0,.65);color:#fff;font:500 12px system-ui,sans-serif;' +
      'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);pointer-events:none;transition:opacity .4s';
    document.body.append(hint);
    const ask = async () => {
      removeEventListener('touchend', ask);
      if (hint) { const h = hint; hint = null; h.style.opacity = 0; setTimeout(() => h.remove(), 500); }
      try { await DeviceOrientationEvent.requestPermission(); } catch {}
    };
    addEventListener('touchend', ask);
  }
  return state;
}
