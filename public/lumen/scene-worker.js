import { createHost } from './scene-host.js?v=13';

let host, start = performance.now(), last = start;

function tick() {
  const now = performance.now();
  host.frame((now - start) / 1000, Math.min((now - last) / 1000, 0.05));
  last = now;
}
function loop() { tick(); requestAnimationFrame(loop); } // rAF exists in workers that own an OffscreenCanvas

onmessage = ({ data }) => {
  switch (data.type) {
    case 'init':
      host = createHost(data.canvas);
      host.resize(data.w, data.h, data.dpr);
      host.setScene(data.scene, data.hue);
      if (self.requestAnimationFrame) requestAnimationFrame(loop);
      else setInterval(tick, 16);
      break;
    case 'resize': host.resize(data.w, data.h, data.dpr); break;
    case 'scene': host.setScene(data.scene, data.hue, data.x, data.y); break;
    case 'pointer': host.pointer(data.x, data.y, data.on); break;
    case 'tilt': host.tilt(data.x, data.y); break;
    case 'segment': host.segment(data.segment); break;
    case 'click': { const r = host.click(data.x, data.y); if (r) postMessage({ ...r, x: data.x, y: data.y }); break; }
  }
};
