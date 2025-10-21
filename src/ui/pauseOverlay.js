
import { togglePause, restartGame } from '../systems/lifecycle.js';

export function bindPause(state){
  const overlay = document.getElementById('pauseOverlay');
  const resumeBtn = document.getElementById('resumeBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn');

  const sync = ()=> overlay.style.display = state.paused? 'grid':'none';

  pauseBtn.addEventListener('click', ()=>{ togglePause(state); sync(); });
  resumeBtn.addEventListener('click', ()=>{ togglePause(state); sync(); });
  restartBtn.addEventListener('click', ()=>{
    document.getElementById('panel').style.display='none';
    restartGame(state);
    sync();
  });

  return { sync };
}
