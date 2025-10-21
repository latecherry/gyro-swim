
import { clamp } from '../core/math.js';

function aabbCircleOverlap(ax,ay,aw,ah,cx,cy,cr){
  const nx = clamp(cx, ax, ax+aw);
  const ny = clamp(cy, ay, ay+ah);
  const dx = cx - nx, dy = cy - ny;
  return (dx*dx + dy*dy) <= cr*cr;
}

export function handleCollisions(state, events, H){
  const h = state.hero; const w = state.world;
  for (let i=state.obs.length-1;i>=0;i--){
    const o=state.obs[i];
    const zRel = o.z - w.z;
    if (zRel < -40){ state.obs.splice(i,1); continue; }
    if (!o.hit && Math.abs(zRel) < 40){
      if (aabbCircleOverlap(o.x - o.w/2, o.y - o.h/2, o.w, o.h, h.x, h.y, h.r)){
        o.hit=true;
        events.emit('hero:hit', {damage: state.cfg.damage});
      }
    }
  }
  for (let i=state.coins.length-1;i>=0;i--){
    const c=state.coins[i];
    const zRel = c.z - w.z;
    if (zRel < -20){ state.coins.splice(i,1); continue; }
    if (!c.got && Math.abs(zRel) < 40){
      const dx=c.x-h.x, dy=c.y-h.y;
      if (dx*dx+dy*dy < (h.r+12)*(h.r+12)){
        c.got=true;
        events.emit('coin:collect', {score:10});
      }
    }
  }
}
