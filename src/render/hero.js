
export function drawHero(ctx, h, t){
  const sway = Math.sin(t*8 + h.y*0.02) * 6; const x=h.x, y=h.y;
  ctx.globalAlpha = 0.8; ctx.fillStyle = '#7fdcff';
  for(let i=0;i<4;i++){
    const bx = x - 22 - i*10 + Math.sin(t*10+i)*2; const by = y + Math.cos(t*8+i)*2;
    ctx.beginPath(); ctx.arc(bx, by, 2+i*0.8, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#73c6ff'; ctx.beginPath(); ctx.ellipse(x, y, 26, 12, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffd4a3'; ctx.beginPath(); ctx.arc(x+24, y-2, 7, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#144d66'; ctx.fillRect(x+18, y-6, 12, 8);
  ctx.fillStyle = '#8be0ff'; ctx.fillRect(x+19, y-5, 10, 6);
  ctx.strokeStyle = '#73c6ff'; ctx.lineWidth = 4; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x-18, y + sway*0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+6, y+2); ctx.lineTo(x-8, y - sway*0.6); ctx.stroke();
  if (h.invul>0){
    ctx.globalAlpha = 0.5 + 0.5*Math.sin(t*30);
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(x, y, 29, 15, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }
}
