
import { clamp } from '../core/math.js';
export function drawCoin(ctx, state, c, zRel, W, H){
  ctx.save();
  const par = clamp(1 - zRel/(H*2.0), 0, 1);
  const rx = (c.x - state.cfg.worldPadding) * par + state.cfg.worldPadding;
  const ry = (c.y - H/2) * par + H/2;
  const r = c.r * (par*0.8+0.2);
  ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(rx, ry, r, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff8'; ctx.fillRect(rx-r*0.2, ry-r*0.8, r*1.6*0.25, r*1.6);
  ctx.restore();
}
