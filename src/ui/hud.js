
const scoreEl = document.getElementById('score');
const spdEl = document.getElementById('spd');
const hpEl = document.getElementById('hp');

export function updateHUD(state){
  scoreEl.textContent = Math.floor(state.hero.score);
  spdEl.textContent = state.world.speed.toFixed(1);
  hpEl.textContent = state.hero.hp;
}
