
import { drawWaterBackground } from './background.js';
import { drawLaneGuides } from './lanes.js';
import { drawHero } from './hero.js';
import { drawObstacle } from './obstacle.js';
import { drawCoin } from './coin.js';

export function render(ctx, state, size){
  const {W,H} = size;
  drawWaterBackground(ctx, W, H, state.world.t);
  drawLaneGuides(ctx, state, W, H);
  for (const b of state.bubbles){
    ctx.globalAlpha=0.35;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fillStyle='#7fdcff'; ctx.fill();
    ctx.globalAlpha=1;
  }
  for (const c of state.coins){
    drawCoin(ctx, state, c, c.z - state.world.z, W, H);
  }
  for (const o of state.obs){
    drawObstacle(ctx, state, o, o.z - state.world.z, W, H);
  }
  drawHero(ctx, state.hero, state.world.t);
}
