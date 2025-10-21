
export class EventBus{
  constructor(){ this.map = new Map(); }
  on(type, fn){ (this.map.get(type) || this.map.set(type,[]).get(type)).push(fn); return ()=>this.off(type, fn); }
  off(type, fn){ const arr=this.map.get(type)||[]; const i=arr.indexOf(fn); if(i>=0) arr.splice(i,1); }
  emit(type, payload){ const arr=this.map.get(type)||[]; for(const fn of arr) fn(payload); }
}
