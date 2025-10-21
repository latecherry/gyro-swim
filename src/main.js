
import { setupViewport } from './core/viewport.js';
import { createState, defaultConfig } from './core/state.js';
import { startLoop } from './core/loop.js';
import { EventBus } from './core/eventBus.js';
import { bindKeyboard } from './input/keyboard.js';
import { bindTouch } from './input/touch.js';
import { bindOrientation } from './input/orientation.js';
import { render } from './render/renderer.js';
import { physicsStep } from './systems/physics.js';
import { spawnObstacle, spawnCoin, spawnBubble } from './systems/spawner.js';
import { handleCollisions } from './systems/collision.js';
import { scoringStep, bindScoringEvents } from './systems/scoring.js';
import { bindToast } from './ui/toast.js';
import { updateHUD } from './ui/hud.js';
import { bindPanel } from './ui/panel.js';
import { bindPause } from './ui/pauseOverlay.js';

const canvas = document.getElementById('c');
const {ctx, size} = setupViewport(canvas);
let {W,H} = size;

let state = createState(W,H);
state.cfg = Object.assign({}, defaultConfig(W,H), state.cfg);

const events = new EventBus();
bindToast(events);
bindOrientation(state);

const keyboard = bindKeyboard(state, ()=>{
  state.paused = !state.paused;
  pauseSync();
}, ()=>{
  document.getElementById('panel').style.display='none';
  // restart
  state.world = { z:0, speed: state.cfg.baseSpeed, t:0 };
  state.hero = { x:W/2, y:H/2, vx:0, vy:0, r:Math.max(14, Math.min(20, Math.round(Math.min(W,H)/30))), hp:3, invul:0, score:0 };
  state.obs=[]; state.coins=[]; state.bubbles=[];
  state.surviveTime=0; state.lastHealAt=0;
});

bindTouch(canvas, state);
bindScoringEvents(state, events, ()=>{
  state.running=false;
  state.paused=false;
  const panel = document.getElementById('panel');
  panel.querySelector('h1').textContent='Game Over · 再来一把？';
  document.getElementById('startBtn').textContent='重新开始';
  panel.style.display='block';
});

const { sync: pauseSync } = bindPause(state);
bindPanel(state, events, ()=> pauseSync());

let bubbleTick=0, spawnTick=0, coinTick=0;
function step(dt){
  ({W,H} = size); // updated by viewport
  if (!state.running || state.paused) return;

  keyboard?.tick?.();

  // spawn
  bubbleTick += dt; spawnTick += dt; coinTick += dt;
  if (bubbleTick > 1/state.cfg.bubbleRate){ bubbleTick = 0; spawnBubble(state, W, H); }
  if (spawnTick > state.cfg.obstacleRate){ spawnTick = 0; spawnObstacle(state, H); }
  if (coinTick > state.cfg.coinRate){ coinTick = 0; spawnCoin(state, H, W); }

  // physics & collisions & scoring
  physicsStep(state, dt, {W,H});
  handleCollisions(state, events, H);
  scoringStep(state, dt, events);

  // bubbles rise
  for (let i=state.bubbles.length-1;i>=0;i--){
    const b=state.bubbles[i]; b.life -= dt; b.y += -40*dt;
    if (b.life<=0) state.bubbles.splice(i,1);
  }

  // render & ui
  render(ctx, state, {W,H});
  updateHUD(state);
}

startLoop(step);
