
import { clamp, rand } from '../core/math.js';

export function laneX(state, l){ return state.cfg.worldPadding + l*state.cfg.laneWidth; }

export function spawnObstacle(state, H){
  const laneW = state.cfg.laneWidth, lanes=state.cfg.lanes;
  const w = rand(laneW*0.7, laneW*1.2);
  const h = rand(Math.max(24,H*0.04), Math.max(40,H*0.08));
  const lane = Math.floor(rand(0, lanes));
  const x = laneX(state, lane) + (laneW - w)/2;
  const y = rand(Math.max(50,H*0.12), H - Math.max(50,H*0.12));
  const z = state.world.z + rand(H*1.1, H*2.0);
  const type = Math.random()<0.4 ? 'mine' : 'rock';
  state.obs.push({x,y,z,w,h,type,hit:false});
}

export function spawnCoin(state, H, W){
  const laneW = state.cfg.laneWidth, lanes=state.cfg.lanes;
  const lane = Math.floor(rand(0, lanes));
  const x = laneX(state, lane) + laneW/2;
  const y = rand(Math.max(70,H*0.14), H - Math.max(70,H*0.14));
  const z = state.world.z + rand(H*0.9, H*1.8);
  state.coins.push({x,y,z,r:Math.max(9, Math.min(14, Math.round(Math.min(W,H)/50))),got:false});
}

export function spawnBubble(state, W, H){
  const x = rand(20, W-20); const y = rand(H-30, H-10);
  state.bubbles.push({x,y,r:rand(2,5),vz:rand(-120,-60),life:rand(0.8,1.8)});
}
