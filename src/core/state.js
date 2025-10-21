
export function defaultConfig(W,H){
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  const laneW = clamp(Math.round(W/9), 90, 140);
  const padding = clamp(Math.round(W*0.06), 32, 80);
  const lanes = clamp(Math.floor((W - 2*padding)/laneW), 5, 11);
  return {
    laneWidth: laneW, lanes, worldPadding: padding,
    swimAccel: 18, swimDamp: 0.90, gravity: 0, sprintBoost: 1.8,
    bubbleRate: 60, coinRate: 2.2, obstacleRate: 0.95, // default normal
    baseSpeed:5, maxSpeed:10.5, damage:1, healEvery:1000
  };
}

export function createState(W,H){
  return {
    device:{alpha:0,beta:0,gamma:0, calib:{beta:0, gamma:0}, sens:1.3},
    input:{ax:0,ay:0,sprint:false},
    time:{now:0,last:0,dt:0},
    world:{z:0,speed:5,t:0},
    hero:{x:W/2,y:H/2,vx:0,vy:0,r:Math.max(14, Math.min(20, Math.round(Math.min(W,H)/30))), hp:3, invul:0, score:0},
    obs:[], coins:[], bubbles:[],
    surviveTime:0, lastHealAt:0,
    running:false, paused:false,
    cfg: defaultConfig(W,H)
  };
}
