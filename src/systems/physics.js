
import { clamp } from '../core/math.js';

export function physicsStep(state, dt, size){
  const {W,H} = size;
  const h = state.hero; const w = state.world; const cfg = state.cfg;
  state.time.now += dt; w.t += dt; state.surviveTime += dt;

  const targetSpd = cfg.baseSpeed + Math.min(1, state.surviveTime/120) * (cfg.maxSpeed - cfg.baseSpeed);
  w.speed += (targetSpd - w.speed) * 0.2;
  const spdMul = state.input.sprint ? cfg.sprintBoost : 1;
  w.z += w.speed * spdMul * dt * 60;

  h.vx += state.input.ax * cfg.swimAccel;
  h.vy += state.input.ay * cfg.swimAccel;
  h.vx *= cfg.swimDamp;
  h.vy *= cfg.swimDamp;
  h.x = clamp(h.x + h.vx * dt, cfg.worldPadding + h.r, W - cfg.worldPadding - h.r);
  h.y = clamp(h.y + h.vy * dt, h.r, H - h.r);
}
