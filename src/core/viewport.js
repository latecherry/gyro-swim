
export function setupViewport(canvas){
  const ctx = canvas.getContext('2d');
  let W=0,H=0,dpr=1;
  function fit(){
    const vw = window.visualViewport?.width || window.innerWidth;
    const vh = window.visualViewport?.height || window.innerHeight;
    document.getElementById('wrap').style.width = vw + 'px';
    document.getElementById('wrap').style.height = vh + 'px';
    W = Math.max(320, Math.floor(vw));
    H = Math.max(320, Math.floor(vh));
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  fit();
  window.addEventListener('resize', fit, {passive:true});
  window.visualViewport?.addEventListener('resize', fit, {passive:true});
  return {ctx, get size(){ return {W,H,dpr}; }};
}
