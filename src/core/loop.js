
export function startLoop(step){
  let id=0, last=0;
  function loop(now){
    id = requestAnimationFrame(loop);
    if(!last) last = now;
    const dt = Math.max(0, Math.min((now - last)/1000, 0.05));
    last = now;
    step(dt);
  }
  id = requestAnimationFrame(loop);
  return ()=> cancelAnimationFrame(id);
}
