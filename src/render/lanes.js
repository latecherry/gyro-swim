
export function drawLaneGuides(ctx, state, W, H){
  ctx.strokeStyle = '#ffffff10';
  ctx.lineWidth = 1;
  const x0 = state.cfg.worldPadding;
  const laneW = state.cfg.laneWidth;
  for(let i=0;i<=state.cfg.lanes;i++){
    const x = x0 + i*laneW;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
}
