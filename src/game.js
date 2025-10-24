(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const spdEl = document.getElementById('spd');
  const hpEl = document.getElementById('hp');
  const panel = document.getElementById('panel');
  const panelTitleEl = document.getElementById('panelTitle');
  const panelDescEl = document.getElementById('panelDesc');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const restartBtn = document.getElementById('restartBtn');
  const calBtn = document.getElementById('calBtn');
  const sensSlider = document.getElementById('sens');
  const diffSel = document.getElementById('difficulty');
  const toast = document.getElementById('toast');

  let W = 0, H = 0, dpr = 1;
  function fitToViewport(){
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
  fitToViewport();
  window.addEventListener('resize', fitToViewport, {passive:true});
  window.visualViewport?.addEventListener('resize', fitToViewport, {passive:true});

  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  const rand = (a,b)=>a + Math.random()*(b-a);

  function showToast(msg, ms=1400){
    toast.textContent = msg;
    toast.style.display='block';
    clearTimeout(showToast.tid);
    showToast.tid = setTimeout(()=>toast.style.display='none', ms);
  }

  const coinImg = new Image();
  coinImg.src = 'assets/coin.svg';
  const heartImg = new Image();
  heartImg.src = 'assets/heart.svg';

  const State = {
    init(){
      this.reset();
      this.running=false;
      this.paused=false;
      this.device={alpha:0,beta:0,gamma:0, calib:{beta:0,gamma:0}, sens: parseFloat(sensSlider.value)};
      this.input={ax:0,ay:0,sprint:false};
      this.time={now:0,last:0,dt:0};
      this.shake = { t:0, mag:0 };

      this.fx = {
        particles: [],
        pulse: 0,
        pulseMax: 0.3,
        flash: 0,
        flashMax: 0.15
      };
    },
    reset(){
      const diff = diffSel.value;
      const diffCfg = {
        easy:   { baseSpeed:4,  maxSpeed:8.5,  spawn:1.1,  damage:1, heartRate:[12,18] },
        normal: { baseSpeed:5,  maxSpeed:10.5, spawn:0.95, damage:1, heartRate:[16,24] },
        hard:   { baseSpeed:6,  maxSpeed:12.5, spawn:0.85, damage:2, heartRate:[22,30] }
      }[diff];

      const laneW = clamp(Math.round(W/9), 90, 140);
      const padding = clamp(Math.round(W*0.06), 32, 80);
      const lanes = clamp(Math.floor((W - 2*padding)/laneW), 5, 11);

      this.cfg = Object.assign({
        laneWidth: laneW,
        lanes,
        worldPadding: padding,
        swimAccel: 18,
        swimDamp:0.90,
        gravity:0,
        sprintBoost:1.8,
        bubbleRate:60,
        coinRate:2.2,
        obstacleRate: diffCfg.spawn,
        hurtCooldown:0.9,
        hpMax:5,
        heartRateRange: diffCfg.heartRate
      }, diffCfg);

      this.world = { z:0, speed:this.cfg.baseSpeed, t:0 };
      this.hero = {
        x:W/2, y:H/2,
        vx:0, vy:0,
        r:Math.max(14, Math.min(20, Math.round(Math.min(W,H)/30))),
        hp:3,
        invul:0,
        score:0
      };

      this.obs=[];
      this.coins=[];
      this.bubbles=[];
      this.hearts=[];

      this.spawnTick=0;
      this.coinTick=0;
      this.bubbleTick=0;
      this.heartTick=rand(this.cfg.heartRateRange[0], this.cfg.heartRateRange[1]) * 0.3;

      this.surviveTime=0;
      this.shake = { t:0, mag:0 };

      this.fx = {
        particles: [],
        pulse: 0,
        pulseMax: 0.3,
        flash: 0,
        flashMax: 0.15
      };
    }
  };
  State.init();

  async function requestMotionPermission(){
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    try{
      if (isIOS && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function'){
        const r1 = await DeviceMotionEvent.requestPermission();
        const r2 = await DeviceOrientationEvent.requestPermission?.();
        if (r1 !== 'granted') throw new Error('未授权运动传感器');
        if (r2 && r2 !== 'granted') throw new Error('未授权方向传感器');
      }
    }catch(e){
      showToast(e.message || '需要传感器权限');
    }
  }

  function handleOrientation(e){
    const {beta, gamma} = e;
    const b0=State.device.calib.beta, g0=State.device.calib.gamma, sens=State.device.sens;
    const ax = clamp((gamma - g0) / 25, -1, 1) * sens; // 左右
    const ay = clamp(((beta - b0)) / 25, -1, 1) * sens; // 上下
    State.input.ax = clamp(ax, -1.5, 1.5);
    State.input.ay = clamp(ay, -1.5, 1.5);
  }

  function calibrate(){
    State.device.calib.beta = State.device.beta;
    State.device.calib.gamma = State.device.gamma;
    showToast('已校准');
  }

  window.addEventListener('deviceorientation', (e)=>{
    State.device.alpha=e.alpha||0;
    State.device.beta=e.beta||0;
    State.device.gamma=e.gamma||0;
    handleOrientation(State.device);
  });

  // touch sprint
  let touchId = null;
  canvas.addEventListener('touchstart',(e)=>{
    if (touchId===null){
      touchId=e.changedTouches[0].identifier;
      State.input.sprint=true;
    }
  }, {passive:true});
  canvas.addEventListener('touchend',(e)=>{
    for (const t of e.changedTouches){
      if (t.identifier===touchId){
        touchId=null;
        State.input.sprint=false;
      }
    }
  }, {passive:true});

  // keyboard debug
  const keys = new Set();
  window.addEventListener('keydown', (e)=>{
    keys.add(e.key);
    if (e.key==='p'||e.key==='P'){ togglePause(); }
    if (e.key==='r'||e.key==='R'){ restart(); }
  });
  window.addEventListener('keyup', (e)=>{ keys.delete(e.key); });

  function keyboardInput(){
    const ax = (keys.has('ArrowRight')?1:0) - (keys.has('ArrowLeft')?1:0);
    const ay = (keys.has('ArrowDown')?1:0) - (keys.has('ArrowUp')?1:0);
    State.input.ax = ax * State.device.sens;
    State.input.ay = ay * State.device.sens;
    State.input.sprint = keys.has(' ');
  }

  function laneX(l){ return State.cfg.worldPadding + l*State.cfg.laneWidth; }

  function spawnObstacle(){
    const laneW = State.cfg.laneWidth, lanes=State.cfg.lanes;
    const w = rand(laneW*0.7, laneW*1.2);
    const h = rand(Math.max(24,H*0.04), Math.max(40,H*0.08));
    const lane = Math.floor(rand(0, lanes));
    const x = laneX(lane) + (laneW - w)/2;
    const y = rand(Math.max(50,H*0.12), H - Math.max(50,H*0.12));
    const z = State.world.z + rand(H*1.1, H*2.0);
    const type = Math.random()<0.4 ? 'mine' : 'rock';
    State.obs.push({x,y,z,w,h,type,hit:false});
  }

  function spawnCoin(){
    const laneW = State.cfg.laneWidth, lanes=State.cfg.lanes;
    const lane = Math.floor(rand(0, lanes));
    const x = laneX(lane) + laneW/2;
    const y = rand(Math.max(70,H*0.14), H - Math.max(70,H*0.14));
    const z = State.world.z + rand(H*0.9, H*1.8);
    State.coins.push({
      x,y,z,
      r:Math.max(9, Math.min(14, Math.round(Math.min(W,H)/50))),
      got:false,
      floating:false,
      linger:0,
      fx:0,fy:0,fr:0,
      remove:false
    });
  }

  function spawnHeart(){
    const laneW = State.cfg.laneWidth, lanes=State.cfg.lanes;
    const lane = Math.floor(rand(0, lanes));
    const x = laneX(lane) + laneW/2;
    const y = rand(Math.max(70,H*0.14), H - Math.max(70,H*0.14));
    const z = State.world.z + rand(H*0.9, H*1.8);
    State.hearts.push({
      x,y,z,
      r:Math.max(11, Math.min(16, Math.round(Math.min(W,H)/46))),
      got:false,
      floating:false,
      linger:0,
      fx:0,fy:0,fr:0,
      remove:false
    });
  }

  function spawnBubble(){
    const x = rand(20, W-20);
    const y = rand(H-30, H-10);
    State.bubbles.push({
      x,y,
      r:rand(2,5),
      vz:rand(-120,-60),
      life:rand(0.8,1.8)
    });
  }

  function aabbCircleOverlap(ax,ay,aw,ah,cx,cy,cr){
    const nx = clamp(cx, ax, ax+aw);
    const ny = clamp(cy, ay, ay+ah);
    const dx = cx - nx, dy = cy - ny;
    return (dx*dx + dy*dy) <= cr*cr;
  }

  function drawWaterBackground(t){
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#03233b');
    g.addColorStop(1,'#011625');
    ctx.fillStyle=g;
    ctx.fillRect(0,0,W,H);

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

  function drawHero(h, t){
    const sway = Math.sin(t*8 + h.y*0.02) * 6;
    const x=h.x, y=h.y;

    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#7fdcff';
    for(let i=0;i<4;i++){
      const bx = x - 22 - i*10 + Math.sin(t*10+i)*2;
      const by = y + Math.cos(t*8+i)*2;
      ctx.beginPath();
      ctx.arc(bx, by, 2+i*0.8, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#73c6ff';
    ctx.beginPath();
    ctx.ellipse(x, y, 26, 12, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = '#ffd4a3';
    ctx.beginPath();
    ctx.arc(x+24, y-2, 7, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = '#144d66';
    ctx.fillRect(x+18, y-6, 12, 8);
    ctx.fillStyle = '#8be0ff';
    ctx.fillRect(x+19, y-5, 10, 6);

    ctx.strokeStyle = '#73c6ff';
    ctx.lineWidth = 4;
    ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x-18, y + sway*0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x+6, y+2);
    ctx.lineTo(x-8, y - sway*0.6);
    ctx.stroke();

    if (h.invul>0){
      ctx.globalAlpha = 0.5 + 0.5*Math.sin(t*30);
      ctx.fillStyle='#fff';
      ctx.beginPath();
      ctx.ellipse(x, y, 29, 15, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha=1;
    }
  }

  function drawObstacle(o, zRel){
    ctx.save();
    const par = clamp(1 - zRel/(H*2.0), 0, 1);
    const rx = (o.x - State.cfg.worldPadding) * par + State.cfg.worldPadding;
    const ry = (o.y - H/2) * par + H/2;
    const w = o.w * par, h = o.h * par;

    if (o.type==='mine'){
      ctx.fillStyle = '#8a1f1f';
      ctx.beginPath();
      ctx.roundRect(rx-w/2, ry-h/2, w, h, 6);
      ctx.fill();

      ctx.fillStyle = '#ff8080';
      ctx.fillRect(rx-w/2+4, ry-h/2+4, w-8, 6);
    }else{
      ctx.fillStyle = '#274e5f';
      ctx.beginPath();
      ctx.roundRect(rx-w/2, ry-h/2, w, h, 10);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCoinDepth(c, zRel){
    if (!coinImg.complete || !coinImg.naturalWidth) return;
    ctx.save();
    const par = clamp(1 - zRel/(H*2.0), 0, 1);
    const rx = (c.x - State.cfg.worldPadding) * par + State.cfg.worldPadding;
    const ry = (c.y - H/2) * par + H/2;
    const r = c.r * (par*0.8+0.2);
    const s = r*2;
    ctx.drawImage(coinImg, rx - s/2, ry - s/2, s, s);
    ctx.restore();
  }
  function drawCoinFloating(c){
    if (!coinImg.complete || !coinImg.naturalWidth) return;
    ctx.save();
    const r = c.fr;
    const s = r*2;
    ctx.drawImage(coinImg, c.fx - s/2, c.fy - s/2, s, s);
    ctx.restore();
  }

  function drawHeartDepth(hc, zRel){
    const par = clamp(1 - zRel/(H*2.0), 0, 1);
    const rx = (hc.x - State.cfg.worldPadding) * par + State.cfg.worldPadding;
    const ry = (hc.y - H/2) * par + H/2;
    const r  = hc.r * (par*0.8+0.2);

    if (heartImg.complete && heartImg.naturalWidth){
      const s = r*2;
      ctx.drawImage(heartImg, rx - s/2, ry - s/2, s, s);
    }else{
      ctx.save();
      ctx.translate(rx, ry);
      ctx.scale(r/12, r/12);
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.bezierCurveTo(12, -6, 8, -14, 0, -6);
      ctx.bezierCurveTo(-8, -14, -12, -6, 0, 8);
      ctx.fill();
      ctx.restore();
    }
  }
  function drawHeartFloating(hc){
    const r = hc.fr;
    if (heartImg.complete && heartImg.naturalWidth){
      const s = r*2;
      ctx.drawImage(heartImg, hc.fx - s/2, hc.fy - s/2, s, s);
    }else{
      ctx.save();
      ctx.translate(hc.fx, hc.fy);
      ctx.scale(r/12, r/12);
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.bezierCurveTo(12, -6, 8, -14, 0, -6);
      ctx.bezierCurveTo(-8, -14, -12, -6, 0, 8);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawLaneGuides(){
    ctx.strokeStyle = '#ffffff10';
    ctx.lineWidth = 1;
    const x0 = State.cfg.worldPadding;
    const laneW = State.cfg.laneWidth;
    for(let i=0;i<=State.cfg.lanes;i++){
      const x = x0 + i*laneW;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
  }

  function maybeSwitchToFloatingPickup(item, zRel){
    if (item.floating || item.got) return;
    if (zRel < 0){
      const par = clamp(1 - zRel/(H*2.0), 0, 1);
      item.fx = (item.x - State.cfg.worldPadding) * par + State.cfg.worldPadding;
      item.fy = (item.y - H/2) * par + H/2;
      item.fr = item.r * (par*0.8+0.2);
      item.floating = true;
      item.linger = 1.5;
    }
  }
  function updateFloatingItem(item, dt){
    if (!item.floating || item.got) return;
    item.linger -= dt;
    item.fy += -20 * dt;
    if (item.linger <= 0){
      item.remove = true;
    }
  }

  // ================== FX helpers ==================
  function spawnCoinBurst(x, y){
    for (let i=0; i<8; i++){
      const ang = Math.random()*Math.PI*2;
      const spd = 60 + Math.random()*80;
      State.fx.particles.push({
        x,
        y,
        vx: Math.cos(ang)*spd,
        vy: Math.sin(ang)*spd,
        life: 0.2 + Math.random()*0.15,
        t: 0,
        r: 3 + Math.random()*2
      });
    }
  }
  function triggerPulse(){
    State.fx.pulse = State.fx.pulseMax;
  }
  function triggerFlash(){
    State.fx.flash = State.fx.flashMax;
  }
  // ================== /FX helpers ==================

  function checkPickupFloatingCoin(item){
    if (item.got) return;
    const h = State.hero;
    const dx=item.fx-h.x, dy=item.fy-h.y;
    if (dx*dx+dy*dy < (h.r+12)*(h.r+12)){
      item.got=true;
      State.hero.score += 10;
      showToast('+10');
      spawnCoinBurst(h.x, h.y);
    }
  }
  function checkPickupFloatingHeart(item){
    if (item.got) return;
    const h = State.hero;
    const dx=item.fx-h.x, dy=item.fy-h.y;
    if (dx*dx+dy*dy < (h.r+item.fr)*(h.r+item.fr)){
      item.got=true;
      if (h.hp < State.cfg.hpMax){
        h.hp++;
        showToast('生命+1');
      }else{
        State.hero.score += 5;
        showToast('+5（满血）');
      }
      triggerPulse();
      triggerFlash();
    }
  }

  function update(dt){
    if (!('ontouchstart' in window)) keyboardInput();

    const h = State.hero;
    const w = State.world;
    const cfg = State.cfg;

    State.time.now += dt;
    w.t += dt;
    State.surviveTime += dt;

    const targetSpd = cfg.baseSpeed + Math.min(1, State.surviveTime/120) * (cfg.maxSpeed - cfg.baseSpeed);
    w.speed += (targetSpd - w.speed) * 0.2;

    const spdMul = State.input.sprint ? cfg.sprintBoost : 1;
    w.z += w.speed * spdMul * dt * 60;

    h.vx += State.input.ax * cfg.swimAccel;
    h.vy += State.input.ay * cfg.swimAccel;
    h.vx *= cfg.swimDamp;
    h.vy *= cfg.swimDamp;
    h.x = clamp(h.x + h.vx * dt, cfg.worldPadding + h.r, W - cfg.worldPadding - h.r);
    h.y = clamp(h.y + h.vy * dt, h.r, H - h.r);

    if ((State.bubbleTick += dt) > 1/cfg.bubbleRate){
      State.bubbleTick = 0;
      spawnBubble();
    }
    if ((State.spawnTick  += dt) > cfg.obstacleRate){
      State.spawnTick  = 0;
      spawnObstacle();
    }
    if ((State.coinTick   += dt) > cfg.coinRate){
      State.coinTick   = 0;
      spawnCoin();
    }

    State.heartTick += dt;
    const heartInterval = rand(cfg.heartRateRange[0], cfg.heartRateRange[1]);
    if (State.heartTick >= heartInterval){
      const baseP = 0.18;
      const bonus = Math.min(0.10, State.surviveTime / 180 * 0.10);
      if (Math.random() < baseP + bonus){
        spawnHeart();
      }
      State.heartTick = 0;
    }

    for (let i=State.bubbles.length-1;i>=0;i--){
      const b=State.bubbles[i];
      b.life -= dt;
      b.y += -40*dt;
      if (b.life<=0) State.bubbles.splice(i,1);
    }

    for (let i=State.obs.length-1;i>=0;i--){
      const o=State.obs[i];
      const zRel = o.z - w.z;
      if (zRel < -40){
        State.obs.splice(i,1);
        continue;
      }
      if (!o.hit && Math.abs(zRel) < 40){
        if (aabbCircleOverlap(o.x - o.w/2, o.y - o.h/2, o.w, o.h, h.x, h.y, h.r)){
          o.hit=true;
          onHit();
        }
      }
    }

    for (let i=State.coins.length-1;i>=0;i--){
      const c=State.coins[i];
      if (!c.floating){
        const zRel = c.z - w.z;
        maybeSwitchToFloatingPickup(c, zRel);
        if (!c.floating && zRel < -20){
          State.coins.splice(i,1);
          continue;
        }
        if (!c.got && !c.floating && Math.abs(zRel) < 40){
          const dx=c.x-h.x, dy=c.y-h.y;
          if (dx*dx+dy*dy < (h.r+12)*(h.r+12)){
            c.got=true;
            State.hero.score += 10;
            showToast('+10');
            spawnCoinBurst(h.x, h.y);
          }
        }
      }else{
        updateFloatingItem(c, dt);
        checkPickupFloatingCoin(c);
        if (c.remove || c.got){
          State.coins.splice(i,1);
          continue;
        }
      }
    }

    for (let i=State.hearts.length-1;i>=0;i--){
      const hc=State.hearts[i];
      if (!hc.floating){
        const zRel = hc.z - w.z;
        maybeSwitchToFloatingPickup(hc, zRel);
        if (!hc.floating && zRel < -20){
          State.hearts.splice(i,1);
          continue;
        }
        if (!hc.got && !hc.floating && Math.abs(zRel) < 40){
          const dx=hc.x-h.x, dy=hc.y-h.y;
          if (dx*dx+dy*dy < (h.r+hc.r)*(h.r+hc.r)){
            hc.got=true;
            if (h.hp < cfg.hpMax){
              h.hp++;
              showToast('生命+1');
            }else{
              State.hero.score += 5;
              showToast('+5（满血）');
            }
            triggerPulse();
            triggerFlash();
          }
        }
      }else{
        updateFloatingItem(hc, dt);
        checkPickupFloatingHeart(hc);
        if (hc.remove || hc.got){
          State.hearts.splice(i,1);
          continue;
        }
      }
    }

    h.invul = Math.max(0, h.invul - dt);

    // FX state update
    for (let i = State.fx.particles.length-1; i>=0; i--){
      const p = State.fx.particles[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.t >= p.life){
        State.fx.particles.splice(i,1);
      }
    }
    if (State.fx.pulse > 0){
      State.fx.pulse -= dt;
      if (State.fx.pulse < 0) State.fx.pulse = 0;
    }
    if (State.fx.flash > 0){
      State.fx.flash -= dt;
      if (State.fx.flash < 0) State.fx.flash = 0;
    }

    scoreEl.textContent = Math.floor(h.score);
    spdEl.textContent = w.speed.toFixed(1);
    hpEl.textContent = h.hp;

    h.score += dt * w.speed * (State.input.sprint?1.0:0.7);

    if (State.shake.t > 0){
      State.shake.t -= dt;
      if (State.shake.t < 0) State.shake.t = 0;
    }
  }

  function onHit(){
    const h=State.hero;
    if (h.invul>0) return;

    h.hp -= State.cfg.damage;
    h.invul = State.cfg.hurtCooldown;

    State.shake.t = 0.25;
    State.shake.mag = 5;

    showToast(h.hp>0 ? '-HP' : '你被击倒了');
    if (h.hp <= 0){
      gameOver();
    }
  }

  function gameOver(){
    State.running=false;
    State.paused=false;
    pauseOverlay.style.display='none';

    panelTitleEl.textContent='Game Over · 再来一把？';
    panelDescEl.innerHTML='你被击倒了。可以直接重新开始，或点右下角“重开”回到主菜单重新调难度。';
    startBtn.textContent='重新开始';

    panel.style.display='block';
    State.time.last = 0;
  }

  function goToMenu(){
    State.running=false;
    State.paused=false;
    pauseOverlay.style.display='none';

    panelTitleEl.textContent='Gyro Swim Runner · 游泳陀螺仪跑酷';
    panelDescEl.innerHTML='按<strong>开始</strong>后，若是 iOS 设备会弹出“允许运动访问”的对话框，请选择允许。左右倾斜控制水平移动；前后倾斜控制上/下浮；长按屏幕冲刺。';
    startBtn.textContent='开始游戏';

    panel.style.display='block';

    State.time.last = 0;
  }

  function start(){
    State.reset();
    State.running=true;
    State.paused=false;
    State.time.last=0;
    panel.style.display='none';
    showToast('左右倾斜移动，长按冲刺');
  }

  function restart(){
    panel.style.display='none';
    State.reset();
    State.running=true;
    State.paused=false;
    State.time.last=0;
  }

  function togglePause(){
    if (!State.running) return;
    State.paused=!State.paused;
    pauseOverlay.style.display = State.paused?'grid':'none';
  }

  let rafId=0;
  function loop(){
    rafId = requestAnimationFrame(loop);
    if (!State.running || State.paused) return;
    const now=performance.now();
    if (!State.time.last) State.time.last=now;
    const dt = clamp((now - State.time.last)/1000, 0, 0.05);
    State.time.last=now;

    update(dt);

    ctx.save();

    if (State.shake.t > 0){
      const decay = State.shake.t / 0.25;
      const magNow = State.shake.mag * decay;
      const sx = (Math.random()*2-1) * magNow;
      const sy = (Math.random()*2-1) * magNow;
      ctx.translate(sx, sy);
    }

    drawWaterBackground(State.world.t);
    drawLaneGuides();

    for (const b of State.bubbles){
      ctx.globalAlpha=0.35;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fillStyle='#7fdcff';
      ctx.fill();
      ctx.globalAlpha=1;
    }

    for (const c of State.coins){
      if (!c.floating){
        const zRel = c.z - State.world.z;
        drawCoinDepth(c, zRel);
      }else{
        drawCoinFloating(c);
      }
    }

    for (const o of State.obs){
      drawObstacle(o, o.z - State.world.z);
    }

    for (const hc of State.hearts){
      if (!hc.floating){
        const zRel = hc.z - State.world.z;
        drawHeartDepth(hc, zRel);
      }else{
        drawHeartFloating(hc);
      }
    }

    // 角色脉冲光晕
    if (State.fx.pulse > 0){
      const h = State.hero;
      const k = 1 - (State.fx.pulse / State.fx.pulseMax); // 0→1
      const radius = 50 + k * (150-50); // 50 ->150
      const alpha  = 0.4 * (1 - k);     // 0.4 ->0
      ctx.save();
      ctx.globalAlpha = alpha;
      const grd = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, radius);
      grd.addColorStop(0, 'rgba(255,120,160,1)');
      grd.addColorStop(1, 'rgba(255,120,160,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(h.x, h.y, radius, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    drawHero(State.hero, State.world.t);

    // 金币爆发粒子
    for (const p of State.fx.particles){
      const lifeK = 1 - (p.t / p.life); // 1 -> 0
      ctx.save();
      ctx.globalAlpha = lifeK;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r*2);
      grad.addColorStop(0, 'rgba(255,230,150,1)');
      grad.addColorStop(1, 'rgba(255,230,150,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r*2, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // 全屏柔光闪烁
    if (State.fx.flash > 0){
      const k = 1 - (State.fx.flash / State.fx.flashMax); // 0→1
      const alpha = 0.2 * (1 - k); // 0.2 -> 0
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ff99bb';
      ctx.fillRect(0,0,W,H);
      ctx.restore();
    }

    ctx.restore();
  }

  startBtn.addEventListener('click', async ()=>{
    await requestMotionPermission();
    start();
  }, {passive:true});

  pauseBtn.addEventListener('click', ()=> togglePause());
  resumeBtn.addEventListener('click', ()=> togglePause());

  restartBtn.addEventListener('click', ()=> {
    goToMenu();
  });

  calBtn.addEventListener('click', ()=> calibrate());
  sensSlider.addEventListener('input', ()=>{
    State.device.sens = parseFloat(sensSlider.value);
  });
  diffSel.addEventListener('change', ()=>{
    showToast('难度：'+diffSel.value);
  });

  loop();
})();
