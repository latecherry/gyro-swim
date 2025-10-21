
export function bindTouch(canvas, state){
  let touchId = null;
  canvas.addEventListener('touchstart',(e)=>{
    if (touchId===null){
      touchId=e.changedTouches[0].identifier;
      state.input.sprint=true;
    }
  }, {passive:true});
  canvas.addEventListener('touchend',(e)=>{
    for (const t of e.changedTouches){
      if (t.identifier===touchId){
        touchId=null;
        state.input.sprint=false;
      }
    }
  }, {passive:true});
}
