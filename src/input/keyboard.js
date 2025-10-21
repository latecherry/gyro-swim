
export function bindKeyboard(state, onPause, onRestart){
  if ('ontouchstart' in window) return;
  const keys = new Set();
  window.addEventListener('keydown', (e)=>{
    keys.add(e.key);
    if (e.key==='p'||e.key==='P'){ onPause?.(); }
    if (e.key==='r'||e.key==='R'){ onRestart?.(); }
  });
  window.addEventListener('keyup', (e)=> keys.delete(e.key));
  function tick(){
    const ax = (keys.has('ArrowRight')?1:0) - (keys.has('ArrowLeft')?1:0);
    const ay = (keys.has('ArrowDown')?1:0) - (keys.has('ArrowUp')?1:0);
    state.input.ax = ax * state.device.sens;
    state.input.ay = ay * state.device.sens;
    state.input.sprint = keys.has(' ');
  }
  return { tick };
}
