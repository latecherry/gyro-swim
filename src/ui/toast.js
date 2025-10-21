
const toast = document.getElementById('toast');
let tid = 0;
export function showToast(msg, ms=1400){
  toast.textContent = msg;
  toast.style.display = 'block';
  clearTimeout(tid);
  tid = setTimeout(()=> toast.style.display='none', ms);
}
export function bindToast(events){
  events.on('system:toast', (msg)=> showToast(msg));
}
