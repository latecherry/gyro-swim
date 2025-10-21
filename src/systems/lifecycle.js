
export function startGame(state){
  resetState(state);
  state.running = true;
  state.paused = false;
  state.time.last = 0;
}

export function restartGame(state){
  resetState(state);
  state.running = true;
  state.paused = false;
  state.time.last = 0;
}

export function togglePause(state){
  if (!state.running) return;
  state.paused = !state.paused;
}

export function resetState(state){
  const W = parseInt(document.getElementById('c').style.width) || window.innerWidth;
  const H = parseInt(document.getElementById('c').style.height) || window.innerHeight;
  // keep config's adaptive dimensions already computed externally if needed
  state.world = { z:0, speed: state.cfg.baseSpeed, t:0 };
  state.hero = { x:W/2, y:H/2, vx:0, vy:0, r:Math.max(14, Math.min(20, Math.round(Math.min(W,H)/30))), hp:3, invul:0, score:0 };
  state.obs=[]; state.coins=[]; state.bubbles=[];
  state.surviveTime=0; state.lastHealAt=0;
}
