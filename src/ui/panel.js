
import { requestMotionPermission, calibrate } from '../input/orientation.js';
import { startGame } from '../systems/lifecycle.js';
import { Difficulty } from '../config/difficulty.js';

export function bindPanel(state, events, onStart){
  const panel = document.getElementById('panel');
  const startBtn = document.getElementById('startBtn');
  const calBtn = document.getElementById('calBtn');
  const sensSlider = document.getElementById('sens');
  const diffSel = document.getElementById('difficulty');

  function applyDifficulty(){
    const diff = diffSel.value;
    const cfg = Difficulty[diff];
    state.cfg.baseSpeed = cfg.baseSpeed;
    state.cfg.maxSpeed  = cfg.maxSpeed;
    state.cfg.obstacleRate = cfg.spawn;
    state.cfg.damage = cfg.damage;
  }
  applyDifficulty();

  sensSlider.addEventListener('input', ()=> state.device.sens = parseFloat(sensSlider.value));
  diffSel.addEventListener('change', ()=> events.emit('system:toast','难度：'+diffSel.value));
  calBtn.addEventListener('click', ()=> { calibrate(state); events.emit('system:toast','已校准'); });

  startBtn.addEventListener('click', async ()=>{
    try{
      await requestMotionPermission();
    }catch(e){
      events.emit('system:toast', e.message || '需要传感器权限');
    }
    applyDifficulty();
    panel.style.display='none';
    startGame(state);
    events.emit('system:toast','左右倾斜移动，长按冲刺');
    onStart?.();
  }, {passive:true});
}
