
import { clamp } from '../core/math.js';
export function drawObstacle(ctx, state, o, zRel, W, H){
  ctx.save();
  const par = clamp(1 - zRel/(H*2.0), 0, 1);
  const rx = (o.x - state.cfg.worldPadding) * par + state.cfg.worldPadding;
  const ry = (o.y - H/2) * par + H/2;
  const w = o.w * par, h = o.h * par;
  if (o.type==='mine'){
    ctx.fillStyle = '#8a1f1f'; ctx.beginPath(); ctx.roundRect(rx-w/2, ry-h/2, w, h, 6); ctx.fill();
    ctx.fillStyle = '#ff8080'; ctx.fillRect(rx-w/2+4, ry-h/2+4, w-8, 6);
  }else{
    ctx.fillStyle = '#274e5f'; ctx.beginPath(); ctx.roundRect(rx-w/2, ry-h/2, w, h, 10); ctx.fill();
  }
  ctx.restore();
}
