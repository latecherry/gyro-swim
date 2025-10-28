
  ;(() => {
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
    const toast = document.getElementById('toast');
    const leaderboardBox = document.getElementById('leaderboardBox');

    function getDifficulty(){
      const r = document.querySelector('input[name="difficulty"]:checked');
      return r ? r.value : 'normal';
    }

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
    window.addEventListener('orientationchange', fitToViewport, {passive:true});

    const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
    const rand = (a,b)=>a + Math.random()*(b-a);

    function showToast(msg, ms=1400){
      toast.textContent = msg;
      toast.style.display='block';
      clearTimeout(showToast.tid);
      showToast.tid = setTimeout(()=>toast.style.display='none', ms);
    }

    function loadScores(mode){
      try{
        const raw = localStorage.getItem('scores_'+mode);
        if(!raw) return [];
        const arr = JSON.parse(raw);
        if(!Array.isArray(arr)) return [];
        return arr;
      }catch(e){ return []; }
    }
    function saveScore(mode, score){
      if(!mode) return;
      const entry = { score: Math.floor(score), time: Date.now() };
      const arr = loadScores(mode);
      arr.push(entry);
      arr.sort((a,b)=>b.score-a.score);
      const top3 = arr.slice(0,3);
      try{ localStorage.setItem('scores_'+mode, JSON.stringify(top3)); }catch(e){}
    }
    function formatRow(label, arr){
      const s1 = arr[0]?.score ?? '—';
      const s2 = arr[1]?.score ?? '—';
      const s3 = arr[2]?.score ?? '—';
      return `<div class="lb-row"><span class="lb-mode">${label}</span><span class="lb-scores">${s1} / ${s2} / ${s3}</span></div>`;
    }
    function renderLeaderboardPanel(){
      const easy   = loadScores('easy');
      const normal = loadScores('normal');
      const hard   = loadScores('hard');
      leaderboardBox.innerHTML = `
        <div class="lb-title">本机最高分</div>
        ${formatRow('Easy', easy)}
        ${formatRow('Normal', normal)}
        ${formatRow('Hard', hard)}
        <div class="lb-hint">（只记录前三名，保存在本设备）</div>`;
    }

    // 资源
    const coinImg = new Image();     coinImg.src     = 'assets/coin.svg';
    const diamondImg = new Image();  diamondImg.src  = 'assets/diamond.svg';
    const heartImg = new Image();    heartImg.src    = 'assets/heart.svg';
    const shieldImg = new Image();   shieldImg.src   = 'assets/shield.svg';
    const sharkImg = new Image();    sharkImg.src    = 'assets/shark.png';
    const swordfishImg = new Image(); swordfishImg.src = 'assets/swordfish.png';
    const inkImg = new Image();      inkImg.src      = 'assets/octo_inkcloud.svg';

    // 状态
    const State = {
      init(){
        this.reset();
        this.running=false;
        this.paused=false;
        this.device={beta:0,gamma:0, calib:{beta:0,gamma:0}, sens: parseFloat(sensSlider.value)};
        this.input={ax:0,ay:0,sprint:false};
        this.time={now:0,last:0};
        this.shake = { t:0, mag:0 };
        this.runDifficulty = getDifficulty();
        this.fx = { 
          particles: [], 
          pulse: 0, pulseMax: 0.3, 
          flash: 0, flashMax: 0.15,
          ink: {
            alpha:0,
            alphaMax:0.6,
            touching:false,
            hold:0
          }
        };
      },
      reset(){
        const diff = getDifficulty();
        // 难度相关参数
        const diffCfg = {
          easy:   { 
            baseSpeed:4,  maxSpeed:8.5,  spawn:1.1,  damage:1,
            heartRate:[12,18], sharkProb:0.15, 
            inkRate:[10,16],
            inkDuration:1.8,
            inkAlpha:0.55,
            inkFloatLinger:8.0,
            inkTopHold:1.0
          },
          normal: { 
            baseSpeed:5,  maxSpeed:10.5, spawn:0.95, damage:1, 
            heartRate:[16,24], sharkProb:0.30, 
            inkRate:[9,13],
            inkDuration:2.6,
            inkAlpha:0.65,
            inkFloatLinger:9.0,
            inkTopHold:1.2
          },
          hard:   { 
            baseSpeed:6,  maxSpeed:12.5, spawn:0.85, damage:2, 
            heartRate:[22,30], sharkProb:0.50, 
            inkRate:[7,11],
            inkDuration:3.4,
            inkAlpha:0.70,
            inkFloatLinger:10.0,
            inkTopHold:1.4
          }
        }[diff];

        const laneW = clamp(Math.round(W/9), 90, 140);
        const padding = clamp(Math.round(W*0.06), 32, 80);
        const lanes = clamp(Math.floor((W - 2*padding)/laneW), 5, 11);
        const shieldRateRange = [diffCfg.heartRate[0]*0.6, diffCfg.heartRate[1]*0.6];

        this.cfg = Object.assign({
          laneWidth: laneW, lanes, worldPadding: padding,
          swimAccel: 18, swimDamp:0.90, sprintBoost:1.8,
          bubbleRate:60,

          coinRate: 0.75,
          obstacleRate: diffCfg.spawn,
          hurtCooldown:0.9, hpMax:5,
          heartRateRange: diffCfg.heartRate,
          shieldRateRange,
          shieldDuration: 10.0,
          sharkProb: diffCfg.sharkProb,

          diamondRate: 5.0,

          inkRateRange: diffCfg.inkRate,
          inkDuration: diffCfg.inkDuration,
          inkAlpha: diffCfg.inkAlpha,
          inkFloatLinger: diffCfg.inkFloatLinger,
          inkTopHold: diffCfg.inkTopHold
        }, diffCfg);

        this.cfg.waveCooldownBase = this.cfg.obstacleRate;

        this.world = { z:0, speed:this.cfg.baseSpeed, t:0 };
        this.hero = {
          x:W/2, y:H/2,
          vx:0, vy:0,
          r:Math.max(14, Math.min(20, Math.round(Math.min(W,H)/30))),
          hp:3, invul:0,
          score:0,
          shieldTime:0
        };

        this.obs=[];
        this.coins=[];
        this.diamonds=[];
        this.bubbles=[];
        this.hearts=[];
        this.shields=[];
        this.inks=[];

        this.spawnTick=0;
        this.coinTick=0;
        this.diamondTick=0;
        this.bubbleTick=0;
        this.heartTick=rand(this.cfg.heartRateRange[0], this.cfg.heartRateRange[1]) * 0.3;
        this.shieldTick=rand(this.cfg.shieldRateRange[0], this.cfg.shieldRateRange[1]) * 0.3;
        this.inkTick=rand(this.cfg.inkRateRange[0], this.cfg.inkRateRange[1]) * 0.5;

        this.surviveTime=0;

        this.shake = { t:0, mag:0 };
        this.fx = { 
          particles: [], 
          pulse: 0, pulseMax: 0.3, 
          flash: 0, flashMax: 0.15,
          ink: { 
            alpha:0,
            alphaMax:this.cfg.inkAlpha,
            touching:false,
            hold:0
          }
        };
        this.runDifficulty = diff;
      }
    };
    State.init();

    function requestMotionPermission(){
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isIOS && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function'){
        DeviceMotionEvent.requestPermission().then(r1=>{
          if(r1!=='granted') throw new Error('未授权运动传感器');
          if (typeof DeviceOrientationEvent.requestPermission === 'function'){
            return DeviceOrientationEvent.requestPermission();
          }
        }).catch(e=>{ showToast(e.message || '需要传感器权限'); });
      }
    }

    function computeInputFromOrientation(beta, gamma){
      const b0=State.device.calib.beta, g0=State.device.calib.gamma, sens=State.device.sens;
      const isLandscape = W > H;
      let ax, ay;
      if (!isLandscape){
        ax = clamp((gamma - g0) / 25, -1, 1);
        ay = clamp((beta  - b0) / 25, -1, 1);
      }else{
        ax = clamp((beta  - b0) / 25, -1, 1);
        ay = clamp(-(gamma - g0) / 25, -1, 1);
      }
      State.input.ax = clamp(ax * sens, -1.5, 1.5);
      State.input.ay = clamp(ay * sens, -1.5, 1.5);
    }

    function calibrate(){
      State.device.calib.beta = State.device.beta;
      State.device.calib.gamma = State.device.gamma;
    }

    window.addEventListener('deviceorientation', (e)=>{
      State.device.beta=e.beta||0;
      State.device.gamma=e.gamma||0;
      computeInputFromOrientation(State.device.beta, State.device.gamma);
    });

    // 触摸（只是标记，有需要可扩展）
    let touchId = null;
    canvas.addEventListener('touchstart',(e)=>{ if (touchId===null){ touchId=e.changedTouches[0].identifier; } }, {passive:true});
    canvas.addEventListener('touchend',(e)=>{ for (const t of e.changedTouches){ if (t.identifier===touchId){ touchId=null; } } }, {passive:true});

    // 键盘
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
    }

    // ===== 生成物体 =====

    // 生成鲨鱼 / 剑鱼，带游动
    function spawnObstacleWaveMember(baseZ, indexInWave){
      const w = rand(State.cfg.laneWidth*0.7, State.cfg.laneWidth*1.2);
      const h = rand(Math.max(24,H*0.04), Math.max(40,H*0.08));
      const minX = State.cfg.worldPadding + w/2;
      const maxX = W - State.cfg.worldPadding - w/2;

      const x = rand(minX, maxX);
      const y = rand(h/2, H - h/2);

      const z = baseZ + indexInWave * rand(H*0.05, H*0.15);

      const type = (Math.random() < State.cfg.sharkProb) ? 'shark' : 'swordfish';
      const flip = (Math.random() < 0.5) ? 1 : -1;

      const swimVX = rand(-20,20); // px/s
      const swimVY = rand(-10,10);

      State.obs.push({
        x,y,z,w,h,
        type,
        hit:false,
        flip,
        vx:swimVX,
        vy:swimVY,

        // 新增的停顿控制字段
        paused:false,        // 是否已经进入过“贴脸停顿”
        pauseTimer:0,        // 贴脸剩余时间
        pauseAnchorZ:0       // 记录开始停顿时的z（后面可用于微调）
      });
    }

    function spawnCoin(){
      const r = Math.max(9, Math.min(14, Math.round(Math.min(W,H)/50)));
      const minX = State.cfg.worldPadding + r, maxX = W - State.cfg.worldPadding - r;
      const x = rand(minX, maxX), y = rand(r, H - r);
      const z = State.world.z + rand(H*0.9, H*1.8);
      State.coins.push({x,y,z,r,got:false,floating:false,linger:0,fx:0,fy:0,fr:0,remove:false});
    }

    function spawnDiamond(){
      const r = Math.max(10, Math.min(16, Math.round(Math.min(W,H)/45)));
      const minX = State.cfg.worldPadding + r, maxX = W - State.cfg.worldPadding - r;
      const x = rand(minX, maxX), y = rand(r, H - r);
      const z = State.world.z + rand(H*0.9, H*1.8);
      State.diamonds.push({x,y,z,r,got:false,floating:false,linger:0,fx:0,fy:0,fr:0,remove:false});
    }

    function spawnHeart(){
      const r = Math.max(11, Math.min(16, Math.round(Math.min(W,H)/46)));
      const minX = State.cfg.worldPadding + r, maxX = W - State.cfg.worldPadding - r;
      const x = rand(minX, maxX), y = rand(r, H - r);
      const z = State.world.z + rand(H*0.9, H*1.8);
      State.hearts.push({x,y,z,r,got:false,floating:false,linger:0,fx:0,fy:0,fr:0,remove:false});
    }

    function spawnShield(){
      const r = Math.max(11, Math.min(16, Math.round(Math.min(W,H)/46)));
      const minX = State.cfg.worldPadding + r, maxX = W - State.cfg.worldPadding - r;
      const x = rand(minX, maxX), y = rand(r, H - r);
      const z = State.world.z + rand(H*0.9, H*1.8);
      State.shields.push({x,y,z,r,got:false,floating:false,linger:0,fx:0,fy:0,fr:0,remove:false});
    }

    // 章鱼墨云
    function spawnInkCloud(){
      const r = Math.max(88, Math.min(100, Math.round(Math.min(W,H)/35)));
      const minX = State.cfg.worldPadding + r, maxX = W - State.cfg.worldPadding - r;
      const x = rand(minX, maxX), y = rand(r, H - r);
      const z = State.world.z + rand(H*1.0, H*1.8);
      State.inks.push({
        x,y,z,r,
        floating:false,
        fx:0,fy:0,fr:0,
        linger:0,
        topHoldLeft:0,
        hitCD:0,
        remove:false
      });
    }

    function spawnBubble(){
      const x = rand(20, W-20), y = rand(H-30, H-10);
      State.bubbles.push({x,y, r:rand(2,5), vz:rand(-120,-60), life:rand(0.8,1.8)});
    }

    // 工具
    const aabbCircleOverlap=(ax,ay,aw,ah,cx,cy,cr)=>{
      const nx = Math.max(ax, Math.min(cx, ax+aw));
      const ny = Math.max(ay, Math.min(cy, ay+ah));
      const dx=cx-nx, dy=cy-ny;
      return dx*dx+dy*dy <= cr*cr;
    };

    function spawnCoinBurst(x, y){
      for (let i=0;i<8;i++){
        const ang=Math.random()*Math.PI*2;
        const spd=60+Math.random()*80;
        State.fx.particles.push({
          type:'coin',
          x,y,
          vx:Math.cos(ang)*spd,
          vy:Math.sin(ang)*spd,
          life:0.2+Math.random()*0.15,
          t:0,
          r:3+Math.random()*2
        });
      }
    }

    function spawnDiamondBurst(x, y){
      for (let i=0;i<8;i++){
        const ang=Math.random()*Math.PI*2;
        const spd=60+Math.random()*80;
        State.fx.particles.push({
          type:'diamond',
          x,y,
          vx:Math.cos(ang)*spd,
          vy:Math.sin(ang)*spd,
          life:0.2+Math.random()*0.15,
          t:0,
          r:3+Math.random()*2
        });
      }
    }

    function triggerPulse(){ State.fx.pulse = State.fx.pulseMax; }
    function triggerFlash(){ State.fx.flash = State.fx.flashMax; }

    // 碰到墨云：标记本帧有接触
    function triggerInk(){
      State.fx.ink.touching = true;
      showToast('墨云!!');
    }

    // 绘制角色/道具/障碍/墨云
    function drawHero(h, t){
      const sway = Math.sin(t*8 + h.y*0.02) * 6, x=h.x, y=h.y;

      // 护盾发光
      if (h.shieldTime > 0){
        const glowR = h.r + 18;
        ctx.save();
        ctx.globalAlpha = 0.35;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, glowR);
        grd.addColorStop(0,'rgba(120,200,255,0.8)');
        grd.addColorStop(1,'rgba(120,200,255,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(x,y,glowR,0,Math.PI*2); ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = '#7fdcff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x,y,glowR,0,Math.PI*2); ctx.stroke();
        ctx.restore();
      }

      // 泡泡尾迹
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#7fdcff';
      for(let i=0;i<4;i++){
        const bx = x - 22 - i*10 + Math.sin(t*10+i)*2;
        const by = y + Math.cos(t*8+i)*2;
        ctx.beginPath(); ctx.arc(bx, by, 2+i*0.8, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 身体
      ctx.fillStyle = '#73c6ff';
      ctx.beginPath(); ctx.ellipse(x, y, 26, 12, 0, 0, Math.PI*2); ctx.fill();

      // 脸
      ctx.fillStyle = '#ffd4a3';
      ctx.beginPath(); ctx.arc(x+24, y-2, 7, 0, Math.PI*2); ctx.fill();

      // 护目镜
      ctx.fillStyle = '#144d66';
      ctx.fillRect(x+18, y-6, 12, 8);
      ctx.fillStyle = '#8be0ff';
      ctx.fillRect(x+19, y-5, 10, 6);

      // 手臂
      ctx.strokeStyle='#73c6ff';
      ctx.lineWidth=4; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-18, y + sway*0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+6,y+2); ctx.lineTo(x-8, y - sway*0.6); ctx.stroke();

      // 受伤无敌闪
      if (h.invul>0){
        ctx.globalAlpha = 0.5 + 0.5*Math.sin(t*30);
        ctx.fillStyle='#fff';
        ctx.beginPath(); ctx.ellipse(x, y, 29, 15, 0, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha=1;
      }
    }

    function drawObstacle(o, zRel){
      ctx.save();
      const par = clamp(1 - zRel/(H*2.0), 0, 1),
            rx=o.x, ry=o.y,
            boxW=o.w*par, boxH=o.h*par;
      if (o.type==='shark' || o.type==='swordfish'){
        const imgObj = (o.type==='shark') ? sharkImg : swordfishImg;
        const SCALE = (o.type==='shark') ? 3.5 : 2.5;
        if (imgObj.complete && imgObj.naturalWidth){
          const iw = imgObj.naturalWidth, ih = imgObj.naturalHeight;
          const imgRatio=iw/ih, boxRatio=boxW/boxH;
          let drawW, drawH;
          if (boxRatio > imgRatio){
            drawH = boxH; drawW = drawH * imgRatio;
          } else {
            drawW = boxW; drawH = drawW / imgRatio;
          }
          drawW *= SCALE; drawH *= SCALE;
          const flipSign = (o.flip === -1) ? -1 : 1;
          ctx.save();
          ctx.translate(rx, ry);
          ctx.scale(flipSign, 1);
          ctx.drawImage(imgObj, -drawW/2, -drawH/2, drawW, drawH);
          ctx.restore();
        }else{
          ctx.fillStyle = (o.type==='shark')? '#8a1f1f' : '#274e5f';
          ctx.beginPath(); ctx.ellipse(rx, ry, boxW*0.6, boxH*0.4, 0, 0, Math.PI*2); ctx.fill();
        }
      }else{
        ctx.fillStyle='#ff00ff';
        ctx.beginPath(); ctx.roundRect(rx-boxW/2, ry-boxH/2, boxW, boxH, 10); ctx.fill();
      }
      ctx.restore();
    }

    function drawCoinDepth(c, zRel){
      if (!coinImg.complete || !coinImg.naturalWidth) return;
      ctx.save();
      const par=clamp(1 - zRel/(H*2.0),0,1);
      const r=c.r*(par*0.8+0.2);
      const s=r*2;
      ctx.drawImage(coinImg, c.x - s/2, c.y - s/2, s, s);
      ctx.restore();
    }
    function drawCoinFloating(c){
      if (!coinImg.complete || !coinImg.naturalWidth) return;
      const s=c.fr*2;
      ctx.drawImage(coinImg, c.fx - s/2, c.fy - s/2, s, s);
    }

    function drawDiamondDepth(d, zRel){
      if (!diamondImg.complete || !diamondImg.naturalWidth) return;
      ctx.save();
      const par=clamp(1 - zRel/(H*2.0),0,1);
      const r=d.r*(par*0.8+0.2);
      const s=r*2;
      ctx.drawImage(diamondImg, d.x - s/2, d.y - s/2, s, s);
      ctx.restore();
    }
    function drawDiamondFloating(d){
      if (!diamondImg.complete || !diamondImg.naturalWidth) return;
      const s=d.fr*2;
      ctx.drawImage(diamondImg, d.fx - s/2, d.fy - s/2, s, s);
    }

    function drawHeartDepth(hc, zRel){
      const par=clamp(1 - zRel/(H*2.0),0,1);
      const r=hc.r*(par*0.8+0.2);
      if (heartImg.complete && heartImg.naturalWidth){
        const s=r*2;
        ctx.drawImage(heartImg, hc.x - s/2, hc.y - s/2, s, s);
      } else {
        ctx.save();
        ctx.translate(hc.x, hc.y);
        ctx.scale(r/12, r/12);
        ctx.fillStyle='#ff4d6d';
        ctx.beginPath();
        ctx.moveTo(0,8);
        ctx.bezierCurveTo(12,-6,8,-14,0,-6);
        ctx.bezierCurveTo(-8,-14,-12,-6,0,8);
        ctx.fill();
        ctx.restore();
      }
    }
    function drawHeartFloating(hc){
      if (heartImg.complete && heartImg.naturalWidth){
        const s=hc.fr*2;
        ctx.drawImage(heartImg, hc.fx - s/2, hc.fy - s/2, s, s);
      } else {
        ctx.save();
        ctx.translate(hc.fx, hc.fy);
        ctx.scale(hc.fr/12, hc.fr/12);
        ctx.fillStyle='#ff4d6d';
        ctx.beginPath();
        ctx.moveTo(0,8);
        ctx.bezierCurveTo(12,-6,8,-14,0,-6);
        ctx.bezierCurveTo(-8,-14,-12,-6,0,8);
        ctx.fill();
        ctx.restore();
      }
    }

    function drawShieldDepth(sh){
      const zRel = sh.z - State.world.z;
      const par=clamp(1 - zRel/(H*2.0),0,1);
      const r = sh.r*(par*0.8+0.2);
      if (shieldImg.complete && shieldImg.naturalWidth){
        const s=r*2;
        ctx.drawImage(shieldImg, sh.x - s/2, sh.y - s/2, s, s);
      } else {
        ctx.save();
        ctx.translate(sh.x, sh.y);
        ctx.scale(r/12, r/12);
        ctx.fillStyle='#5ad0ff';
        ctx.beginPath();
        ctx.moveTo(0,-10); ctx.lineTo(8,-4); ctx.lineTo(6,6);
        ctx.lineTo(0,10); ctx.lineTo(-6,6); ctx.lineTo(-8,-4);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    function drawShieldFloating(sh){
      if (shieldImg.complete && shieldImg.naturalWidth){
        const s=sh.fr*2;
        ctx.drawImage(shieldImg, sh.fx - s/2, sh.fy - s/2, s, s);
      } else {
        ctx.save();
        ctx.translate(sh.fx, sh.fy);
        ctx.scale(sh.fr/12, sh.fr/12);
        ctx.fillStyle='#5ad0ff';
        ctx.beginPath();
        ctx.moveTo(0,-10); ctx.lineTo(8,-4); ctx.lineTo(6,6);
        ctx.lineTo(0,10); ctx.lineTo(-6,6); ctx.lineTo(-8,-4);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    function drawInkBlob(cx, cy, rr){
      if (inkImg.complete && inkImg.naturalWidth){
        const s = rr * 2.2;
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.drawImage(inkImg, cx - s/2, cy - s/2, s, s);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      }
    }
    function drawInkDepth(ic, zRel){
      const par = clamp(1 - zRel/(H*2.0), 0, 1);
      const r = ic.r * (par*0.8 + 0.2);
      drawInkBlob(ic.x, ic.y, r);
    }
    function drawInkFloating(ic){
      drawInkBlob(ic.fx, ic.fy, ic.fr);
    }

    // ===== 浮动逻辑：道具 =====
    function maybeSwitchToFloatingPickup(item, zRel){
      if (item.floating || item.got) return;
      if (zRel < 0){
        const par=clamp(1 - zRel/(H*2.0),0,1);
        item.fx=item.x; item.fy=item.y;
        item.fr=item.r*(par*0.8+0.2);
        item.floating=true;
        item.linger=1.5;
      }
    }
    function updateFloatingItem(item, dt){
      if (!item.floating || item.got) return;
      item.linger -= dt;
      item.fy += -20*dt;
      if (item.linger <= 0){
        item.remove = true;
      }
    }
    function checkPickupFloatingCoin(item){
      if (item.got) return;
      const h=State.hero;
      const dx=item.fx-h.x, dy=item.fy-h.y;
      if (dx*dx+dy*dy < (h.r+12)*(h.r+12)){
        item.got=true;
        h.score += 10;
        showToast('+10');
        spawnCoinBurst(h.x,h.y);
      }
    }
    function checkPickupFloatingDiamond(item){
      if (item.got) return;
      const h=State.hero;
      const dx=item.fx-h.x, dy=item.fy-h.y;
      if (dx*dx+dy*dy < (h.r+12)*(h.r+12)){
        item.got=true;
        h.score += 50;
        showToast('+50💎');
        spawnDiamondBurst(h.x,h.y);
      }
    }
    function checkPickupFloatingHeart(item){
      if (item.got) return;
      const h=State.hero;
      const dx=item.fx-h.x, dy=item.fy-h.y;
      if (dx*dx+dy*dy < (h.r+item.fr)*(h.r+item.fr)){
        item.got=true;
        if (h.hp < State.cfg.hpMax){
          h.hp++;
          showToast('生命+1');
        }else{
          h.score += 5;
          showToast('+5（满血）');
        }
        triggerPulse(); triggerFlash();
      }
    }
    function checkPickupFloatingShield(item){
      if (item.got) return;
      const h=State.hero;
      const dx=item.fx-h.x, dy=item.fy-h.y;
      if (dx*dx+dy*dy < (h.r+item.fr)*(h.r+item.fr)){
        item.got=true;
        h.shieldTime = State.cfg.shieldDuration;
        showToast('护盾已激活');
      }
    }

    // ===== 墨云浮动逻辑 =====
    function maybeSwitchToFloatingInk(ic, zRel){
      if (!ic.floating && zRel < 0){
        const par=clamp(1 - zRel/(H*2.0),0,1);
        ic.fx = ic.x;
        ic.fy = ic.y;
        ic.fr = ic.r*(par*0.8+0.2);
        ic.floating = true;
        ic.linger = State.cfg.inkFloatLinger;
        ic.topHoldLeft = 0;
      }
    }

    function updateFloatingInk(ic, dt){
      if (!ic.floating) return;

      if (ic.hitCD > 0){
        ic.hitCD -= dt;
        if (ic.hitCD < 0) ic.hitCD = 0;
      }

      const topLimit = 20;
      const riseSpeed = 20;

      if (ic.topHoldLeft > 0){
        ic.topHoldLeft -= dt;
        if (ic.topHoldLeft <= 0){
          ic.remove = true;
        }
        return;
      }

      ic.fy += -riseSpeed * dt;
      ic.linger -= dt;

      if (ic.fy - ic.fr <= topLimit){
        ic.fy = topLimit + ic.fr;
        ic.topHoldLeft = State.cfg.inkTopHold;
      } else if (ic.linger <= 0){
        ic.remove = true;
      }
    }

    // 掉血（鲨鱼/剑鱼）
    function onHit(){
      const h=State.hero;
      if (h.shieldTime > 0){
        h.shieldTime = 0;
        h.invul = State.cfg.hurtCooldown * 0.5;
        State.shake.t = 0.2;
        State.shake.mag = 4;
        showToast('护盾抵挡!');
        return;
      }
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

      saveScore(State.runDifficulty, State.hero.score);

      panelTitleEl.textContent='Game Over · 再来一把？';
      panelDescEl.innerHTML='你被击倒了。可以直接重新开始，或点右下角“重开”回到主菜单重新调难度。';
      startBtn.textContent='重新开始';

      renderLeaderboardPanel();
      panel.style.display='block';
      State.time.last = 0;
    }

    function goToMenu(){
      State.running=false;
      State.paused=false;
      pauseOverlay.style.display='none';

      panelTitleEl.innerHTML='<span>Gyro Swim Runner · 游泳陀螺仪跑酷</span>';
      panelDescEl.innerHTML='按<strong>开始</strong>后，若是 iOS 设备会弹出“允许运动访问”的对话框，请选择允许。<br>左右倾斜控制水平移动；前后倾斜控制上/下浮。';
      startBtn.textContent='开始游戏';

      renderLeaderboardPanel();
      panel.style.display='block';
      State.time.last = 0;
    }

    function start(){
      State.reset();
      State.running=true;
      State.paused=false;
      State.time.last=0;
      panel.style.display='none';
      showToast('左右倾斜控制移动');
    }

    function restart(){ goToMenu(); }

    function togglePause(){
      if (!State.running) return;
      State.paused=!State.paused;
      pauseOverlay.style.display = State.paused?'grid':'none';
    }

    // ===== 主游戏更新（带“贴脸停顿”） =====
    function update(dt){
      if (!('ontouchstart' in window)) keyboardInput();

      const h=State.hero;
      const w=State.world;
      const cfg=State.cfg;

      State.time.now += dt;
      w.t += dt;
      State.surviveTime += dt;

      // 速度随生存时间提升
      const targetSpd = cfg.baseSpeed + Math.min(1, State.surviveTime/120) * (cfg.maxSpeed - cfg.baseSpeed);
      w.speed += (targetSpd - w.speed) * 0.2;
      w.z += w.speed * dt * 60;

      // 英雄位移
      h.vx += State.input.ax * cfg.swimAccel;
      h.vy += State.input.ay * cfg.swimAccel;
      h.vx *= cfg.swimDamp;
      h.vy *= cfg.swimDamp;
      h.x = clamp(h.x + h.vx * dt, cfg.worldPadding + h.r, W - cfg.worldPadding - h.r);
      h.y = clamp(h.y + h.vy * dt, h.r, H - h.r);

      // 护盾计时
      if (h.shieldTime > 0){
        h.shieldTime -= dt;
        if (h.shieldTime < 0) h.shieldTime = 0;
      }

      // 生成气泡
      if ((State.bubbleTick += dt) > 1/cfg.bubbleRate){
        State.bubbleTick=0; spawnBubble();
      }

      // 生成单个障碍物
      State.spawnTick += dt;
      if (State.spawnTick >= cfg.waveCooldownBase){
        State.spawnTick = 0;
        const baseZ = State.world.z + rand(H*1.1, H*2.0);
        spawnObstacleWaveMember(baseZ, 0);
      }

      // 金币
      if ((State.coinTick   += dt) > cfg.coinRate){
        State.coinTick  =0; 
        spawnCoin();
      }

      // 钻石
      if ((State.diamondTick += dt) > cfg.diamondRate){
        State.diamondTick = 0;
        const baseP = 0.18;
        const bonus = Math.min(0.12, State.surviveTime/180*0.12);
        if (Math.random() < baseP + bonus){ spawnDiamond(); }
      }

      // 爱心
      State.heartTick += dt;
      const heartInterval = rand(cfg.heartRateRange[0], cfg.heartRateRange[1]);
      if (State.heartTick >= heartInterval){
        const baseP=0.18;
        const bonus=Math.min(0.10, State.surviveTime/180*0.10);
        if (Math.random() < baseP + bonus){ spawnHeart(); }
        State.heartTick=0;
      }

      // 护盾
      State.shieldTick += dt;
      const shieldInterval = rand(cfg.shieldRateRange[0], cfg.shieldRateRange[1]);
      if (State.shieldTick >= shieldInterval){
        const baseSP=0.25;
        const bonusS=Math.min(0.12, State.surviveTime/180*0.12);
        if (Math.random() < baseSP + bonusS){ spawnShield(); }
        State.shieldTick=0;
      }

      // 章鱼墨云生成
      State.inkTick += dt;
      const inkInterval = rand(cfg.inkRateRange[0], cfg.inkRateRange[1]);
      if (State.inkTick >= inkInterval){
        const baseIP=0.28;
        const bonusI=Math.min(0.12, State.surviveTime/200*0.12);
        if (Math.random() < baseIP + bonusI){ spawnInkCloud(); }
        State.inkTick = 0;
      }

      // 气泡上浮+寿命
      for (let i=State.bubbles.length-1;i>=0;i--){
        const b=State.bubbles[i];
        b.life-=dt; b.y += -40*dt;
        if (b.life<=0){ State.bubbles.splice(i,1); }
      }

      // ===== 障碍物更新+碰撞（带停顿） =====
      for (let i = State.obs.length - 1; i >= 0; i--) {
        const o = State.obs[i];

        // 当前相对深度
        let zRel = o.z - w.z;

        if (o.pauseTimer > 0) {
          // 正在贴脸停顿阶段
          const lockDist = 20; // 离玩家多近（越小越贴脸）
          o.z = w.z + lockDist;

          // 这里选择停住不再左右游动。如果想停顿时也微微晃，可以注释掉下面两行：
          // （当前我们什么也不做，等于vx/vy暂停）

          // 停顿倒计时
          o.pauseTimer -= dt;
          if (o.pauseTimer <= 0) {
            o.pauseTimer = 0;
            // 暂停结束后自动恢复：vx/vy 已经可能被清零，没关系，它还是障碍，只是不会再特意贴脸
          }

          // 重新计算 zRel
          zRel = o.z - w.z;

        } else {
          // 正常游动阶段
          if (o.vx !== undefined && o.vy !== undefined){
            o.x += o.vx * dt;
            o.y += o.vy * dt;

            // 边界反弹，避免游出画面
            const minX = State.cfg.worldPadding + o.w/2;
            const maxX = W - State.cfg.worldPadding - o.w/2;
            if (o.x < minX){ o.x = minX; o.vx = Math.abs(o.vx); }
            if (o.x > maxX){ o.x = maxX; o.vx = -Math.abs(o.vx); }

            const minY = o.h/2;
            const maxY = H - o.h/2;
            if (o.y < minY){ o.y = minY; o.vy = Math.abs(o.vy); }
            if (o.y > maxY){ o.y = maxY; o.vy = -Math.abs(o.vy); }
          }

          // 判断是否要触发贴脸停顿
          // 条件：靠近玩家 (-10 < zRel < 30) 且还没贴过
          if (!o.paused && zRel < 30 && zRel > -10){
            o.paused = true;
            o.pauseTimer = 0.4;           // 停顿时长，可调0.6等
            o.pauseAnchorZ = o.z;         // 记录一下（目前没强用，但留给以后）
            const lockDist = 20;
            o.z = w.z + lockDist;

            // 贴脸时清掉游动速度，让它像是“冲到你面前卡住”
            o.vx = 0;
            o.vy = 0;

            // 更新 zRel
            zRel = o.z - w.z;
          }
        }

        // 超过玩家身后就清掉
        if (zRel < -40){
          State.obs.splice(i,1);
          continue;
        }

        // 碰撞判定
        if (!o.hit && Math.abs(zRel) < 40){
          if (aabbCircleOverlap(
            o.x - o.w/2, o.y - o.h/2, o.w, o.h,
            h.x, h.y, h.r
          )){
            o.hit = true;
            onHit();

            // 新增：玩家撞到后，这个障碍物立即消失
            State.obs.splice(i, 1);
            continue; // 很重要，防止后面再处理这个已经被删掉的对象
          }
        }
      }

      // ===== 金币 =====
      for (let i=State.coins.length-1;i>=0;i--){
        const c=State.coins[i];
        if (!c.floating){
          const zRel = c.z - w.z;
          maybeSwitchToFloatingPickup(c, zRel);
          if (!c.floating && zRel < -20){ State.coins.splice(i,1); continue; }
          if (!c.got && !c.floating && Math.abs(zRel) < 40){
            const dx=c.x-h.x, dy=c.y-h.y;
            if (dx*dx+dy*dy < (h.r+12)*(h.r+12)){
              c.got=true; h.score += 10; showToast('+10'); spawnCoinBurst(h.x,h.y);
            }
          }
        }else{
          updateFloatingItem(c, dt); checkPickupFloatingCoin(c);
          if (c.remove || c.got){ State.coins.splice(i,1); continue; }
        }
      }

      // ===== 钻石 =====
      for (let i=State.diamonds.length-1;i>=0;i--){
        const d=State.diamonds[i];
        if (!d.floating){
          const zRel = d.z - w.z;
          maybeSwitchToFloatingPickup(d, zRel);
          if (!d.floating && zRel < -20){ State.diamonds.splice(i,1); continue; }
          if (!d.got && !d.floating && Math.abs(zRel) < 40){
            const dx=d.x-h.x, dy=d.y-h.y;
            if (dx*dx+dy*dy < (h.r+12)*(h.r+12)){
              d.got=true; h.score += 50; showToast('+50💎'); spawnDiamondBurst(h.x,h.y);
            }
          }
        }else{
          updateFloatingItem(d, dt); checkPickupFloatingDiamond(d);
          if (d.remove || d.got){ State.diamonds.splice(i,1); continue; }
        }
      }

      // ===== 爱心 =====
      for (let i=State.hearts.length-1;i>=0;i--){
        const hc=State.hearts[i];
        if (!hc.floating){
          const zRel = hc.z - w.z;
          maybeSwitchToFloatingPickup(hc, zRel);
          if (!hc.floating && zRel < -20){ State.hearts.splice(i,1); continue; }
          if (!hc.got && !hc.floating && Math.abs(zRel) < 40){
            const dx=hc.x-h.x, dy=hc.y-h.y;
            if (dx*dx+dy*dy < (h.r+hc.r)*(h.r+hc.r)){
              hc.got=true;
              if (h.hp < cfg.hpMax){ h.hp++; showToast('生命+1'); }
              else { h.score += 5; showToast('+5（满血）'); }
              triggerPulse(); triggerFlash();
            }
          }
        }else{
          updateFloatingItem(hc, dt); checkPickupFloatingHeart(hc);
          if (hc.remove || hc.got){ State.hearts.splice(i,1); continue; }
        }
      }

      // ===== 护盾 =====
      for (let i=State.shields.length-1;i>=0;i--){
        const sh=State.shields[i];
        if (!sh.floating){
          const zRel = sh.z - w.z;
          maybeSwitchToFloatingPickup(sh, zRel);
          if (!sh.floating && zRel < -20){ State.shields.splice(i,1); continue; }
          if (!sh.got && !sh.floating && Math.abs(zRel) < 40){
            const dx=sh.x-h.x, dy=sh.y-h.y;
            if (dx*dx+dy*dy < (h.r+sh.r)*(h.r+sh.r)){
              sh.got=true; h.shieldTime = cfg.shieldDuration; showToast('护盾已激活');
            }
          }
        }else{
          updateFloatingItem(sh, dt); checkPickupFloatingShield(sh);
          if (sh.remove || sh.got){ State.shields.splice(i,1); continue; }
        }
      }

      // ===== 墨云（多次污染 + 漂浮消失） =====
      for (let i=State.inks.length-1;i>=0;i--){
        const ic = State.inks[i];

        if (!ic.floating){
          const zRel = ic.z - w.z;
          maybeSwitchToFloatingInk(ic, zRel);

          if (zRel < -60 && !ic.floating){
            State.inks.splice(i,1);
            continue;
          }

          if (Math.abs(zRel) < 40){
            if (ic.hitCD > 0){
              ic.hitCD -= dt;
              if (ic.hitCD < 0) ic.hitCD = 0;
            }
            const dx = ic.x - h.x, dy = ic.y - h.y;
            if (dx*dx + dy*dy < (h.r + ic.r)*(h.r + ic.r)){
              triggerInk();
              if (ic.hitCD <= 0){
                ic.hitCD = 0.4;
              }
            }
          }

        } else {
          updateFloatingInk(ic, dt);
          if (ic.remove){
            State.inks.splice(i,1);
            continue;
          }

          const dx = ic.fx - h.x, dy = ic.fy - h.y;
          if (ic.hitCD > 0){
            ic.hitCD -= dt;
            if (ic.hitCD < 0) ic.hitCD = 0;
          }
          if (dx*dx + dy*dy < (h.r + ic.fr)*(h.r + ic.fr)){
            triggerInk();
            if (ic.hitCD <= 0){
              ic.hitCD = 0.4;
            }
          }
        }
      }

      // 根据墨云接触情况刷新黑屏
      {
        const inkfx = State.fx.ink;
        if (inkfx.touching){
          inkfx.alpha = inkfx.alphaMax;
          inkfx.hold  = cfg.inkDuration;
        }else{
          if (inkfx.hold > 0){
            inkfx.hold -= dt;
            if (inkfx.hold < 0) inkfx.hold = 0;
          }else{
            inkfx.alpha = Math.max(0, inkfx.alpha - dt*2.0);
          }
        }
        inkfx.touching = false;
      }

      // 无敌时间 / 冷却
      h.invul = Math.max(0, h.invul - dt);

      // 粒子
      for (let i = State.fx.particles.length-1; i>=0; i--){
        const p = State.fx.particles[i];
        p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.t >= p.life){ State.fx.particles.splice(i,1); }
      }

      // 爱心柔光计时
      if (State.fx.pulse > 0){ State.fx.pulse = Math.max(0, State.fx.pulse - dt); }
      if (State.fx.flash > 0){ State.fx.flash = Math.max(0, State.fx.flash - dt); }

      // HUD
      scoreEl.textContent = Math.floor(h.score);
      spdEl.textContent = w.speed.toFixed(1);
      hpEl.textContent = h.hp;

      // 生存加分
      h.score += dt * w.speed * 0.7;

      // 摄像机抖动衰减
      if (State.shake.t > 0){
        State.shake.t -= dt;
        if (State.shake.t < 0) State.shake.t = 0;
      }
    }

    // ===== 渲染整个场景到 canvas =====
    function render(){
      // 计算抖动偏移
      let shakeX = 0, shakeY = 0;
      if (State.shake.t > 0){
        const m = State.shake.mag * (State.shake.t / 0.25); // 0.25是我们设的典型时间尺度
        shakeX = (Math.random()*2-1) * m;
        shakeY = (Math.random()*2-1) * m;
      }

      ctx.save();
      ctx.clearRect(0,0,W,H);

      // 整体平移用于抖动
      ctx.translate(shakeX, shakeY);

      const w = State.world;
      const h = State.hero;

      // 深度排序绘制：
      // 我们把所有“有深度的东西”（障碍物、金币、钻石、爱心、护盾、墨云）按 zRel 从大到小画
      const drawQueue = [];

      // 障碍物
      for (const o of State.obs){
        drawQueue.push({
          kind:'obs',
          ref:o,
          zRel:o.z - w.z
        });
      }

      // 金币
      for (const c of State.coins){
        if (!c.floating){
          drawQueue.push({kind:'coinDepth',ref:c,zRel:c.z - w.z});
        }
      }

      // 钻石
      for (const d of State.diamonds){
        if (!d.floating){
          drawQueue.push({kind:'diaDepth',ref:d,zRel:d.z - w.z});
        }
      }

      // 爱心
      for (const hc of State.hearts){
        if (!hc.floating){
          drawQueue.push({kind:'heartDepth',ref:hc,zRel:hc.z - w.z});
        }
      }

      // 护盾
      for (const sh of State.shields){
        if (!sh.floating){
          drawQueue.push({kind:'shieldDepth',ref:sh,zRel:sh.z - w.z});
        }
      }

      // 墨云
      for (const ic of State.inks){
        if (!ic.floating){
          drawQueue.push({kind:'inkDepth',ref:ic,zRel:ic.z - w.z});
        }
      }

      // 按 zRel 从大到小（远的先画，近的后画）
      drawQueue.sort((a,b)=>b.zRel - a.zRel);

      // 背景气泡
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#7fdcff';
      for (const b of State.bubbles){
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();

      // 画深度队列
      for (const item of drawQueue){
        if (item.kind==='obs'){
          drawObstacle(item.ref, item.zRel);
        }else if (item.kind==='coinDepth'){
          drawCoinDepth(item.ref, item.zRel);
        }else if (item.kind==='diaDepth'){
          drawDiamondDepth(item.ref, item.zRel);
        }else if (item.kind==='heartDepth'){
          drawHeartDepth(item.ref, item.zRel);
        }else if (item.kind==='shieldDepth'){
          drawShieldDepth(item.ref);
        }else if (item.kind==='inkDepth'){
          drawInkDepth(item.ref, item.zRel);
        }
      }

      // 画浮动道具（它们现在是屏幕坐标了，不按深度了）
      for (const c of State.coins){
        if (c.floating && !c.remove){
          drawCoinFloating(c);
        }
      }
      for (const d of State.diamonds){
        if (d.floating && !d.remove){
          drawDiamondFloating(d);
        }
      }
      for (const hc of State.hearts){
        if (hc.floating && !hc.remove){
          drawHeartFloating(hc);
        }
      }
      for (const sh of State.shields){
        if (sh.floating && !sh.remove){
          drawShieldFloating(sh);
        }
      }
      for (const ic of State.inks){
        if (ic.floating && !ic.remove){
          drawInkFloating(ic);
        }
      }

      // 画玩家
      drawHero(h, w.t);

      // 爱心拾取时的粉色柔光
      if (State.fx.pulse > 0){
        const alpha = (State.fx.pulse / State.fx.pulseMax) * 0.4;
        ctx.save();
        ctx.globalAlpha = alpha;
        const grd = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, Math.max(W,H)*0.6);
        grd.addColorStop(0,'rgba(255,77,109,0.7)');
        grd.addColorStop(1,'rgba(255,77,109,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0,0,W,H);
        ctx.restore();
      }

      // 护盾/受伤闪光
      if (State.fx.flash > 0){
        const alpha = (State.fx.flash / State.fx.flashMax) * 0.5;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0,W,H);
        ctx.restore();
      }

      // 粒子（金币飞溅、钻石爆裂）
      for (const p of State.fx.particles){
        const lifeRatio = 1 - p.t / p.life;
        ctx.save();
        ctx.globalAlpha = clamp(lifeRatio,0,1);
        if (p.type==='coin'){
          ctx.fillStyle = '#ffd166';
        }else if (p.type==='diamond'){
          ctx.fillStyle = '#aef';
        }else{
          ctx.fillStyle = '#fff';
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }

      // 墨云全屏遮挡（暗色+模糊感）
      {
        const inkfx = State.fx.ink;
        if (inkfx.alpha > 0){
          ctx.save();
          ctx.globalAlpha = inkfx.alpha;
          ctx.fillStyle = '#000814';
          ctx.fillRect(-shakeX,-shakeY,W,H); // 用未抖动的基准覆盖全屏
          ctx.restore();
        }
      }

      ctx.restore();
    }

    // ===== 主循环 =====
    function loop(){
      requestAnimationFrame(loop);
      if (!State.running || State.paused){
        State.time.last = performance.now();
        return;
      }

      const now = performance.now();
      if (!State.time.last) State.time.last = now;
      let dt = (now - State.time.last)/1000;
      State.time.last = now;

      // 防止切后台回来dt爆炸
      if (dt>0.05) dt=0.05;

      update(dt);
      render();
    }
    requestAnimationFrame(loop);

    // ===== 事件绑定 =====
    startBtn.addEventListener('click', ()=>{
      requestMotionPermission();
      start();
    });
    restartBtn.addEventListener('click', restart);
    pauseBtn.addEventListener('click', togglePause);
    resumeBtn.addEventListener('click', togglePause);
    calBtn.addEventListener('click', () => {
      calibrate();

      const oldText = calBtn.textContent;
      calBtn.textContent = '已校准 √';
      calBtn.disabled = true;
      calBtn.style.opacity = '0.7';

      setTimeout(() => {
        calBtn.textContent = oldText;
        calBtn.disabled = false;
        calBtn.style.opacity = '1';
      }, 1500);
    });

    sensSlider.addEventListener('input', ()=>{
      State.device.sens = parseFloat(sensSlider.value);
    });

    // 进来先展示菜单+排行榜
    goToMenu();
  })();
  