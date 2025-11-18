/* ========== CONFIG ========== */
const CONFIG = {
  mapW:760, mapH:520,
  spawnInterval:1700,
  trashTTL:20000,
  trashPerBrick:5,
  brickPrice:2,
  hireCost:10,
  upgradeCost:25,
  helperRate:1600,
  upgradeEffect:1,
  zones:[
    {id:'Centro', x:20,y:20,w:340,h:180, unlocked:true, threshold:0},
    {id:'Plaza', x:400,y:20,w:340,h:180, unlocked:false, threshold:10},
    {id:'Lago', x:20,y:240,w:340,h:260, unlocked:false, threshold:25},
    {id:'Mirador', x:400,y:240,w:340,h:260, unlocked:false, threshold:50}
  ],
  levelTitles:['Fundador','Administrador','Ejecutivo','Director','Líder ecológico'],
  levelThresholds:[0,10,25,50,100]
};

/* ========== STATE ========== */
let state = {
  trashCount:0,
  bricks:0,
  money:0,
  helpers:0,
  trashPerBrick: CONFIG.trashPerBrick,
  bricksSoldTotal:0,
  gameWon:false
};

const mapEl = document.getElementById('map');
const playerEl = document.getElementById('player');
const hud = document.getElementById('hud');
const zonesListEl = document.getElementById('zones-list');
const logEl = document.getElementById('log');

let zones = [];
let trashItems = [];
let spawnTimer = null;
let helperTimer = null;
let keys = {};
let player = {x:60,y:60,w:44,h:56, zone:'Centro'};
let moveSpeed = 6;

/* ========== UTIL ========== */
function addLog(text){
  const time = new Date().toLocaleTimeString();
  const d = document.createElement('div');
  d.textContent = `[${time}] ${text}`;
  logEl.prepend(d);
  while(logEl.children.length>8) logEl.removeChild(logEl.lastChild);
}
function saveGame(){
  localStorage.setItem('qumara_save', JSON.stringify({state, player, zonesConfig: CONFIG.zones}));
  addLog('Progreso guardado');
}
function loadGame(){
  const raw = localStorage.getItem('qumara_save');
  if(!raw){ addLog('No hay partida guardada'); return; }
  try{
    const save = JSON.parse(raw);
    state = Object.assign(state, save.state);
    if(save.player) player = Object.assign(player, save.player);
    if(save.zonesConfig) CONFIG.zones = save.zonesConfig;
    updateUI();
    renderZones();
    placePlayerInZone(player.zone || 'Centro');
    addLog('Progreso cargado');
  }catch(e){ console.error(e); addLog('Error al cargar partida'); }
}

/* ========== INIT & ZONES ========== */
function init(){
  mapEl.style.width = CONFIG.mapW+'px';
  mapEl.style.height = CONFIG.mapH+'px';
  renderZones();
  updateUI();
  placePlayerInZone('Centro');

  spawnTimer = setInterval(spawnTrash, CONFIG.spawnInterval);
  helperTimer = setInterval(()=> {
    if(state.helpers>0) {
      for(let i=0;i<state.helpers;i++) autoCollectOne();
    }
  }, CONFIG.helperRate);

  setInterval(saveGame, 60000);
  addLog('Juego iniciado');
}
function renderZones(){
  // clear existing
  mapEl.querySelectorAll('.zone').forEach(n => n.remove());
  zones = CONFIG.zones.map(z=>{
    const el = document.createElement('div');
    el.className = 'zone' + (z.unlocked? '':' locked');
    el.style.left = z.x + 'px';
    el.style.top = z.y + 'px';
    el.style.width = z.w + 'px';
    el.style.height = z.h + 'px';
    el.textContent = z.id;
    mapEl.appendChild(el);
    return Object.assign({}, z, {el});
  });
  updateZonesList();
}

/* ========== PLAYER MOVEMENT ========== */
window.addEventListener('keydown', e=>{ keys[e.key]=true; if(e.key===' ') { e.preventDefault(); collectNearby(); } });
window.addEventListener('keyup', e=>{ keys[e.key]=false; });

function gameLoop(){
  let moved=false;
  if(keys['ArrowUp']||keys['w']){ player.y = Math.max(4, player.y - moveSpeed); moved=true; }
  if(keys['ArrowDown']||keys['s']){ player.y = Math.min(CONFIG.mapH - player.h - 4, player.y + moveSpeed); moved=true; }
  if(keys['ArrowLeft']||keys['a']){ player.x = Math.max(4, player.x - moveSpeed); moved=true; }
  if(keys['ArrowRight']||keys['d']){ player.x = Math.min(CONFIG.mapW - player.w - 4, player.x + moveSpeed); moved=true; }
  renderPlayer();
  if(moved) checkZone();
  requestAnimationFrame(gameLoop);
}
function renderPlayer(){
  playerEl.style.left = player.x + 'px';
  playerEl.style.top = player.y + 'px';
}

/* ========== ZONE CHECK ========== */
function placePlayerInZone(zoneId){
  const z = CONFIG.zones.find(x=>x.id===zoneId);
  if(!z) return;
  player.x = z.x + 20;
  player.y = z.y + 20;
  player.zone = zoneId;
  hud.textContent = 'Zona: ' + zoneId;
  renderPlayer();
}
function checkZone(){
  const z = CONFIG.zones.find(z=>{
    return player.x >= z.x && player.x <= z.x + z.w - player.w &&
           player.y >= z.y && player.y <= z.y + z.h - player.h;
  });
  if(z && z.id !== player.zone){
    player.zone = z.id; hud.textContent = 'Zona: ' + z.id;
    addLog(`Entró a zona: ${z.id}`);
  }
}

/* ========== TRASH SPAWN & POOL ========== */
function spawnTrash(){
  const unlocked = CONFIG.zones.filter(z=>z.unlocked);
  if(unlocked.length===0) return;
  const zone = unlocked[Math.floor(Math.random()*unlocked.length)];
  const tx = Math.floor(zone.x + Math.random()*(zone.w - 40));
  const ty = Math.floor(zone.y + Math.random()*(zone.h - 40));
  const el = document.createElement('div');
  const types = ['t-bottle','t-bag','t-wrapper'];
  const tclass = types[Math.floor(Math.random()*types.length)];
  el.className = 'trash ' + tclass;
  el.style.left = tx + 'px';
  el.style.top = ty + 'px';
  el.textContent = '♲';
  mapEl.appendChild(el);
  const id = Math.random().toString(36).slice(2,9);
  const timeout = setTimeout(()=> {
    const idx = trashItems.findIndex(it=>it.id===id);
    if(idx!==-1){
      try{ mapEl.removeChild(trashItems[idx].el);}catch(e){}
      trashItems.splice(idx,1);
    }
  }, CONFIG.trashTTL);
  trashItems.push({id, el, x:tx, y:ty, zone: zone.id, timeout});
  el.addEventListener('click', ()=> { collectTrashById(id); });
}

/* ========== COLLECTION LOGIC ========== */
function collectNearby(){
  const collected = [];
  trashItems.forEach((it, idx)=>{
    if(rectsOverlap(player, {x: it.x, y: it.y, w:28, h:28})){
      collected.push(it);
    }
  });
  if(collected.length===0){ addLog('No hay basura cerca'); return;}
  collected.forEach(it=>{ collectTrashById(it.id); });
}
function collectTrashById(id){
  const idx = trashItems.findIndex(t=>t.id===id);
  if(idx===-1) return;
  const it = trashItems[idx];
  state.trashCount++;
  updateUI();
  addLog(`Recolectada basura en ${it.zone}`);
  try{ mapEl.removeChild(it.el);}catch(e){}
  clearTimeout(it.timeout);
  trashItems.splice(idx,1);
}

/* auto-collect by helper */
function autoCollectOne(){
  if(trashItems.length===0) return;
  const it = trashItems[Math.floor(Math.random()*trashItems.length)];
  state.trashCount++;
  updateUI();
  addLog(`Ayudante recogió basura en ${it.zone}`);
  try{ mapEl.removeChild(it.el);}catch(e){}
  const idx = trashItems.findIndex(t=>t.id===it.id);
  if(idx!==-1){ clearTimeout(trashItems[idx].timeout); trashItems.splice(idx,1); }
}

/* ========== CREATE & SELL BRICKS ========== */
function createBrick(){
  if(state.trashCount >= state.trashPerBrick){
    state.trashCount -= state.trashPerBrick;
    state.bricks += 1;
    updateUI();
    addLog('Se creó 1 eco-ladrillo');
    checkUnlocks();
  } else addLog('No hay suficiente basura para crear ladrillo');
}
function sellBricks(){
  if(state.bricks <= 0){ addLog('No hay eco-ladrillos para vender'); return;}
  const amount = state.bricks * CONFIG.brickPrice;
  state.money += amount;
  state.bricksSoldTotal += state.bricks;
  addLog(`Se vendieron ${state.bricks} eco-ladrillo(s) por S/${amount}`);
  state.bricks = 0;
  updateUI();
  checkUnlocks();
  checkLevel();
}

/* ========== SHOP ========== */
document.getElementById('hire-btn').addEventListener('click', ()=>{
  if(state.money >= CONFIG.hireCost){
    state.money -= CONFIG.hireCost;
    state.helpers += 1;
    addLog('Contratado 1 ayudante');
    updateUI();
  } else addLog('Dinero insuficiente para contratar');
});
document.getElementById('upgrade-btn').addEventListener('click', ()=>{
  if(state.money >= CONFIG.upgradeCost){
    state.money -= CONFIG.upgradeCost;
    state.trashPerBrick = Math.max(2, state.trashPerBrick - CONFIG.upgradeEffect);
    addLog('Mejora aplicada: eficiencia aumentada');
    updateUI();
  } else addLog('Dinero insuficiente para mejorar');
});
document.getElementById('sell-btn').addEventListener('click', sellBricks);
document.getElementById('create-btn').addEventListener('click', createBrick);

document.getElementById('help-btn').addEventListener('click', ()=> {
  alert("Cómo jugar:\n- Mover: Flechas o WASD\n- Espacio o click para recoger basura\n- Crear eco-ladrillos (usa basura), Vender para ganar dinero\n- Contrata ayudantes y mejora la eficiencia\n- Desbloquea zonas vendiendo eco-ladrillos");
});
document.getElementById('reset-btn').addEventListener('click', ()=> {
  if(confirm('¿Reiniciar el juego y borrar guardado?')){
    localStorage.removeItem('qumara_save');
    location.reload();
  }
});
document.getElementById('save-btn').addEventListener('click', saveGame);
document.getElementById('load-btn').addEventListener('click', loadGame);

/* ========== UNLOCKS, LEVELS & PROGRESS ========== */
function checkUnlocks(){
  CONFIG.zones.forEach(z=>{
    if(!z.unlocked && state.bricksSoldTotal >= z.threshold){
      z.unlocked = true;
      addLog(`Zona desbloqueada: ${z.id}`);
      renderZones();
    }
  });
  updateZonesProgress();
  // if all unlocked -> trigger end
  const allUnlocked = CONFIG.zones.every(z => z.unlocked);
  if(allUnlocked && !state.gameWon){
    state.gameWon = true;
    setTimeout(()=> showPrizeModal(), 600); // small delay
  }
}
function updateZonesProgress(){
  const lastThreshold = CONFIG.zones[CONFIG.zones.length-1].threshold || 100;
  const percent = Math.min(100, Math.floor((state.bricksSoldTotal / Math.max(1,lastThreshold))*100));
  document.getElementById('progress-bar').style.width = percent + '%';
  updateZonesList();
}
function checkLevel(){
  let lvl = 0;
  for(let i=0;i<CONFIG.levelThresholds.length;i++){
    if(state.bricksSoldTotal >= CONFIG.levelThresholds[i]) lvl = i;
  }
  const title = CONFIG.levelTitles[Math.min(lvl, CONFIG.levelTitles.length-1)];
  document.getElementById('player-level').textContent = `${lvl+1} - ${title}`;
}

/* ========== UI UPDATE ========== */
function updateUI(){
  document.getElementById('stat-trash').textContent = state.trashCount;
  document.getElementById('stat-bricks').textContent = state.bricks;
  document.getElementById('stat-money').textContent = state.money;
  document.getElementById('helpers-count').textContent = state.helpers;
  document.getElementById('trash-per-brick').textContent = state.trashPerBrick || CONFIG.trashPerBrick;
  updateZonesList();
  checkUnlocks();
  checkLevel();
}
function updateZonesList(){
  const unlocked = CONFIG.zones.filter(z=>z.unlocked).map(z=>z.id).join(', ');
  zonesListEl.textContent = 'Zonas: ' + (unlocked || 'Ninguna');
}

/* ========== HELPERS ========== */
function rectsOverlap(a,b){
  return !(a.x + a.w < b.x || a.x > b.x + (b.w||28) || a.y + a.h < b.y || a.y > b.y + (b.h||28));
}
function distance(x1,y1,x2,y2){ return Math.hypot(x1-x2,y1-y2); }

/* ========== COLLECT BY COLLISION (continuous) ========== */
function collisionCollectLoop(){
  for(let i = trashItems.length-1; i>=0; i--){
    const it = trashItems[i];
    if(rectsOverlap(player, {x:it.x,y:it.y,w:28,h:28})){
      collectTrashById(it.id);
    }
  }
  setTimeout(collisionCollectLoop, 200);
}

/* ========== PRIZE MODAL ========== */
const modal = document.getElementById('modalPremio');
const claimBtn = document.getElementById('claimPrizeBtn');
const closePrizeBtn = document.getElementById('closePrizeBtn');

function showPrizeModal(){
  modal.style.display = 'flex';
  document.getElementById('prizeInfo').textContent = '';
}
closePrizeBtn.addEventListener('click', ()=> { modal.style.display='none'; });

claimBtn.addEventListener('click', ()=> {
  const name = document.getElementById('winnerName').value.trim();
  if(!name){ alert('Por favor escribe tu nombre para reclamar el premio.'); return; }
  // Save winner info locally (could be extended to server)
  const winners = JSON.parse(localStorage.getItem('qumara_winners')||'[]');
  // If first winner -> polera gratis (first-ever)
  let message = '';
  if(winners.length === 0){
    message = `¡Felicidades ${name}! Eres el primer ganador — obtienes una POLERA GRATIS.\nAdemás recibes un cupón del 40% de descuento.`;
  } else {
    message = `¡Gracias ${name}! Has recibido un cupón del 40% de descuento.`;
  }
  winners.push({name, date: new Date().toISOString(), money: state.money, bricksSoldTotal: state.bricksSoldTotal});
  localStorage.setItem('qumara_winners', JSON.stringify(winners));
  document.getElementById('prizeInfo').textContent = message;
  addLog(`Premio reclamado por: ${name}`);
  // Optional: close modal after a moment
  setTimeout(()=> { modal.style.display='none'; }, 2500);
});

/* ========== START ========== */
init();
requestAnimationFrame(gameLoop);
collisionCollectLoop();