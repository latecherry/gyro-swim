
export function scoringStep(state, dt, events){
  const h = state.hero; const w = state.world; const cfg = state.cfg;
  h.invul = Math.max(0, h.invul - dt);
  h.score += dt * w.speed * (state.input.sprint?1.0:0.7);

  if (Math.floor(h.score / cfg.healEvery) > Math.floor(state.lastHealAt / cfg.healEvery)){
    if (h.hp < 5){
      h.hp++;
      events.emit('system:toast', '生命+1');
    }
    state.lastHealAt = h.score;
  }
}

export function bindScoringEvents(state, events, onGameOver){
  events.on('hero:hit', ({damage})=>{
    const h=state.hero;
    if (h.invul>0) return;
    h.hp -= damage;
    h.invul = 0.9;
    events.emit('system:toast', h.hp>0 ? '碰撞！-HP' : '你被击倒了');
    if (h.hp<=0) onGameOver?.();
  });
  events.on('coin:collect', ({score})=>{
    state.hero.score += score;
    events.emit('system:toast', '+%d'.replace('%d', score));
  });
}
