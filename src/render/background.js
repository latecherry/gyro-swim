
export function drawWaterBackground(ctx, W, H, t){
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#03233b'); g.addColorStop(1,'#011625');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.globalAlpha = 0.08;
  const waves = Math.ceil(H/90)+2;
  for(let i=0;i<waves;i++){
    const y=(t*30 + i*90) % (H+90) - 90;
    ctx.fillStyle='#3fd0ff';
    ctx.beginPath();
    ctx.ellipse(W*0.5, y, W*0.55, 40, 0, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha=1;
}
