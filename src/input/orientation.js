
import { clamp } from '../core/math.js';

export async function requestMotionPermission(){
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  try{
    if (isIOS && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function'){
      const r1 = await DeviceMotionEvent.requestPermission();
      const r2 = await DeviceOrientationEvent.requestPermission?.();
      if (r1 !== 'granted') throw new Error('未授权运动传感器');
      if (r2 && r2 !== 'granted') throw new Error('未授权方向传感器');
    }
  }catch(e){ throw e; }
}

export function bindOrientation(state){
  function handle(){
    const {beta, gamma} = state.device;
    const b0=state.device.calib.beta, g0=state.device.calib.gamma, sens=state.device.sens;
    const ax = clamp((gamma - g0) / 25, -1, 1) * sens;
    const ay = clamp(((beta - b0)) / 25, -1, 1) * sens;
    state.input.ax = clamp(ax, -1.5, 1.5);
    state.input.ay = clamp(ay, -1.5, 1.5);
  }
  window.addEventListener('deviceorientation', (e)=>{
    state.device.alpha=e.alpha||0;
    state.device.beta=e.beta||0;
    state.device.gamma=e.gamma||0;
    handle();
  });
}

export function calibrate(state){
  state.device.calib.beta = state.device.beta;
  state.device.calib.gamma = state.device.gamma;
}
