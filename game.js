
// Loza-Game: main JS
// Assets in assets/ folder.
const CANVAS_W = 1024;
const CANVAS_H = 576;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Responsive sizing (landscape first)
function resize(){
  const vw = Math.min(window.innerWidth, window.innerHeight*1.9);
  const scale = Math.min(vw / CANVAS_W, 1);
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  canvas.style.width = Math.round(CANVAS_W * scale) + 'px';
  canvas.style.height = Math.round(CANVAS_H * scale) + 'px';
}
window.addEventListener('resize', resize);
resize();

// Load images
const IMG_PATHS = {
  bg: 'assets/background_tile.png',
  loza: 'assets/cat_pixel.png',
  heart: 'assets/heart_pixel.png',
  plat: 'assets/platform.png',
  pill: 'assets/pill.png',
  sparkleV: 'assets/sparkle_violet.png',
  sparkleG: 'assets/sparkle_gold.png',
  seashell: 'assets/seashell.png',
  starfish: 'assets/starfish.png',
  sun: 'assets/sun_pixel.png',
  cloud: 'assets/cloud_pixel.png',
  arrowL: 'assets/arrow_left.png',
  arrowU: 'assets/arrow_up.png',
  arrowR: 'assets/arrow_right.png'
};
const assets = {};
let loadPromises = [];
for(const k in IMG_PATHS){
  loadPromises.push(new Promise(res => {
    const i = new Image();
    i.src = IMG_PATHS[k];
    i.onload = ()=>{ assets[k]=i; res(); };
    i.onerror = ()=>{ console.error('Failed to load', IMG_PATHS[k]); res(); };
  }));
}

// Audio
const bgAudio = new Audio('assets/bg-music.mp3');
bgAudio.loop = true;
bgAudio.volume = 0.7;
const victoryAudio = new Audio('assets/victory.mp3');
victoryAudio.loop = true;
victoryAudio.volume = 0.8;

// UI elements
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const upBtn = document.getElementById('upBtn');
const playHint = document.getElementById('playHint');
const winModal = document.getElementById('winModal');
const playAgainBtn = document.getElementById('playAgain');

// Controls state
let keys = {left:false,right:false,jump:false};
// touch handlers for mobile controls
function bindButton(el, keyName){ 
  el.addEventListener('touchstart', e=>{ e.preventDefault(); keys[keyName]=true; }, {passive:false});
  el.addEventListener('touchend', e=>{ keys[keyName]=false; }, {passive:true});
  el.addEventListener('mousedown', e=>{ keys[keyName]=true; });
  el.addEventListener('mouseup', e=>{ keys[keyName]=false; });
}
bindButton(leftBtn,'left'); bindButton(rightBtn,'right'); bindButton(upBtn,'jump');

// Keyboard support
window.addEventListener('keydown', e=>{
  if(e.key === 'ArrowLeft') keys.left = true;
  if(e.key === 'ArrowRight') keys.right = true;
  if(e.key === 'ArrowUp') keys.jump = true;
});
window.addEventListener('keyup', e=>{
  if(e.key === 'ArrowLeft') keys.left = false;
  if(e.key === 'ArrowRight') keys.right = false;
  if(e.key === 'ArrowUp') keys.jump = false;
});

// Try autoplay background music; if blocked show playHint button
function tryAutoPlayBg(){
  bgAudio.play().then(()=>{
    playHint.classList.add('hidden');
  }).catch(()=>{
    playHint.classList.remove('hidden');
  });
}
// If user clicks hint button, play bg
playHint.addEventListener('click', ()=>{
  bgAudio.play().then(()=>{ playHint.classList.add('hidden'); }).catch(()=>{});
});

// Game state
let worldWidth = 4000;
let cameraX = 0;
let player = {x:60,y:420,w:64,h:64,vx:0,vy:0,onGround:false, facing:1, idleTimer:0};
let gravity = 1800;
let platforms = [];
let obstacles = [];
let pills = [];
let shellPositions = [];
let starPositions = [];
let heart = {x:3400,y:360,w:48,h:48};
let win = false;
let bigSparkles = [];

// Build level with platforms, obstacles and monsters (Ahmed Taha)

function buildLevel(){
  platforms = [];
  pills = [];
  shellPositions=[]; starPositions=[];
  // ground across world
  platforms.push({x:0,y:520,w:worldWidth,h:56});
  // obstacle tile width
  const obsW = 160; const obsH = 48;
  // starting platform: size = 2 * obsW, connected to first obstacle (no gap)
  const startPlat = {x:60, y:420, w: obsW*2, h:24};
  platforms.push(startPlat);
  // first obstacle placed connected to starting platform (no gap)
  obstacles = [];
  const firstObs = {x: startPlat.x + startPlat.w, y: startPlat.y + startPlat.h - obsH/2, w: obsW, h: obsH};
  obstacles.push(firstObs);
  // More platforms (Mario-style) positioned horizontally
  const plats = [
    {x:420,y:380,w:220},{x:700,y:340,w:180},{x:980,y:300,w:150},{x:1220,y:340,w:200},
    {x:1480,y:300,w:140},{x:1740,y:340,w:180},{x:2000,y:320,w:160},{x:2260,y:360,w:220},
    {x:2620,y:320,w:160},{x:2880,y:360,w:180},{x:3180,y:300,w:220},{x:3500,y:340,w:220}
  ];
  for(let p of plats) platforms.push(p);
  // additional obstacles on ground/platforms
  obstacles.push({x:820,y:506,w:80,h:48});
  obstacles.push({x:1880,y:286,w:80,h:48});
  obstacles.push({x:2380,y:326,w:80,h:48});
  // pills (Ahmed Taha) smaller sizes and slower speeds and patrol ranges on some platforms
  pills = [
    {x:startPlat.x + 80, y:startPlat.y - 40, w:40, h:40, range:[startPlat.x + 20, startPlat.x + startPlat.w - 40], speed:50, dir:1, blinkTimer:0},
    {x:760,y:268,w:36,h:36, range:[700,820], speed:55, dir:1, blinkTimer:0},
    {x:1500,y:328,w:36,h:36, range:[1480,1640], speed:50, dir:1, blinkTimer:0},
    {x:1900,y:288,w:36,h:36, range:[1840,2060], speed:45, dir:1, blinkTimer:0},
    {x:2500,y:328,w:36,h:36, range:[2420,2780], speed:60, dir:1, blinkTimer:0},
    {x:3100,y:268,w:36,h:36, range:[2920,3300], speed:50, dir:1, blinkTimer:0},
  ];
  // decorative shells/starfish on some platforms
  shellPositions = [{x:320,y:352},{x:1160,y:324},{x:2560,y:292},{x:3440,y:312}];
  starPositions = [{x:640,y:316},{x:2200,y:336},{x:3120,y:284}];
  // heart position (final), safe platform (no pills)
  heart = {x:3780,y:284,w:56,h:56};
  worldWidth = Math.max(worldWidth, heart.x + 400);
  // reset player
  player.x = 80; player.y = 380; player.vx = 0; player.vy = 0; player.onGround = false; win=false;
  cameraX = 0;
  bigSparkles = [];
  // hide modal initially
  try{ winModal.classList.add('hidden'); }catch(e){}
}
);
  // sample platforms across world
  const plats = [
    {x:180,y:420,w:220},{x:420,y:360,w:180},{x:680,y:300,w:150},{x:920,y:360,w:200},
    {x:1200,y:300,w:140},{x:1480,y:360,w:180},{x:1740,y:320,w:160},{x:2020,y:360,w:220},
    {x:2360,y:320,w:160},{x:2620,y:360,w:180},{x:2920,y:300,w:220},{x:3240,y:360,w:220}
  ];
  for(let p of plats) platforms.push(p);
  // place some obstacles as boxes
  obstacles = [{x:560,y:486,w:40,h:34},{x:1560,y:266,w:40,h:34},{x:2100,y:326,w:40,h:34},{x:2800,y:266,w:40,h:34}];
  // place several pill monsters on certain platforms; each has patrol range
  pills = [
    {x:230,y:388,w:48,h:48, range:[180,360], speed:70, dir:1, blinkTimer:0},
    {x:760,y:268,w:48,h:48, range:[680,820], speed:90, dir:1, blinkTimer:0},
    {x:1500,y:328,w:48,h:48, range:[1480,1640], speed:80, dir:1, blinkTimer:0},
    {x:1890,y:288,w:48,h:48, range:[1740,2060], speed:60, dir:1, blinkTimer:0},
    {x:2500,y:328,w:48,h:48, range:[2420,2780], speed:100, dir:1, blinkTimer:0},
    {x:3100,y:268,w:48,h:48, range:[2920,3300], speed:80, dir:1, blinkTimer:0},
  ];
  // decorative shells/starfish on some platforms
  shellPositions = [{x:220,y:392},{x:950,y:344},{x:2360,y:292},{x:3240,y:344}];
  starPositions = [{x:680,y:284},{x:2020,y:336},{x:2920,y:284}];
  // heart position (final), ensure no pills on final platform
  heart = {x:3460,y:304,w:56,h:56}; // a bit beyond worldWidth earlier; ensure within worldWidth
  worldWidth = Math.max(worldWidth, heart.x + 400);
  // reset player
  player.x = 60; player.y = 420; player.vx = 0; player.vy = 0; player.onGround = false; win=false;
  cameraX = 0;
  bigSparkles = [];
}

// Collision helper
function rects(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

// Update loop
let lastTime = performance.now();
function loop(now){
  const dt = Math.min(0.03, (now-lastTime)/1000);
  update(dt);
  render();
  lastTime = now;
  if(!win) requestAnimationFrame(loop);
}

// Update physics and game state
function update(dt){
  // controls
  const speed = 220; // normal speed
  if(keys.left){ player.vx = -speed; player.facing = -1; player.idleTimer = 0; }
  else if(keys.right){ player.vx = speed; player.facing = 1; player.idleTimer = 0; }
  else { player.vx = 0; player.idleTimer += dt; }

  // jump (single press)
  if(keys.jump && player.onGround){ player.vy = -700; player.onGround = false; keys.jump=false; }

  // physics
  player.vy += gravity * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // world bounds
  if(player.x < 0) player.x = 0;
  if(player.x + player.w > worldWidth) player.x = worldWidth - player.w;

  // platform collisions
  player.onGround = false;
  for(let p of platforms){
    if(player.x + player.w > p.x && player.x < p.x + p.w){
      if(player.y + player.h > p.y && player.y + player.h - player.vy*dt <= p.y){
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
      }
    }
  }

  // obstacles collisions (simple knockback)
  for(let o of obstacles){
    if(rects(player,o)){
      // push back and reset position
      resetToStart();
    }
  }

  // monsters movement and collision
  for(let m of pills){
    m.x += m.dir * m.speed * dt;
    if(m.x < m.range[0]){ m.x = m.range[0]; m.dir = 1; }
    if(m.x > m.range[1]){ m.x = m.range[1]; m.dir = -1; }
    // blink timer
    m.blinkTimer = (m.blinkTimer + dt) % 3.0;
    // collision with player
    if(rects(player, m)){
      resetToStart();
    }
  }

  // Check falling off bottom
  if(player.y > CANVAS_H + 200){
    resetToStart();
  }

  // Check heart win
  if(rects(player, heart)){
    onWin();
  }

  // camera follow (center-ish)
  cameraX = player.x - 200;
  cameraX = Math.max(0, Math.min(cameraX, worldWidth - CANVAS_W));

  // spawn small sparkles near heart when player is close
  const dx = (player.x + player.w/2) - (heart.x + heart.w/2);
  const dy = (player.y + player.h/2) - (heart.y + heart.h/2);
  const dist = Math.hypot(dx,dy);
  heart.near = (dist < 300);

  // update big sparkles if any (they persist until play again)
  for(let s of bigSparkles){
    s.life += dt;
  }
}

// Reset player to start (on fall or monster collision) - music keeps playing
function resetToStart(){
  player.x = 60; player.y = 420; player.vx = 0; player.vy = 0; player.onGround = false;
  // cameraX = 0; // will follow
}

// Win handling
function onWin(){
  if(win) return;
  win = true;
  // stop bg audio, play victory loop
  try{ bgAudio.pause(); bgAudio.currentTime = 0; }catch(e){}
  victoryAudio.currentTime = 0; victoryAudio.play().catch(()=>{});
  // big sparkle burst
  for(let i=0;i<40;i++){
    bigSparkles.push({x: heart.x + heart.w/2 + (Math.random()-0.5)*220, y: heart.y + heart.h/2 + (Math.random()-0.5)*160, color: (Math.random()<0.5?'violet':'gold'), life:0});
  }
  // show centered modal
  winModal.classList.remove('hidden');
}

// Play Again resets game and stops all audio, and restarts background music automatically
playAgainBtn.addEventListener('click', ()=>{
  winModal.classList.add('hidden');
  // stop victory music
  try{ victoryAudio.pause(); victoryAudio.currentTime = 0; }catch(e){}
  // stop bg music (to reset) and attempt to play again automatically
  try{ bgAudio.pause(); bgAudio.currentTime = 0; }catch(e){}
  // reset level
  buildLevel();
  // clear sparkles
  bigSparkles = [];
  // try to autoplay bg music; if blocked show playHint
  tryAutoPlayBg();
  // resume game loop
  lastTime = performance.now();
  requestAnimationFrame(loop);
});

// Render function
function render(){
  ctx.imageSmoothingEnabled = false;
  // clear
  ctx.clearRect(0,0,CANVAS_W,CANVAS_H);
  // draw repeating background tile with parallax
  if(assets.bg){
    const tile = assets.bg;
    const tx = Math.floor(cameraX % tile.width);
    for(let x = -tx; x < CANVAS_W + tile.width; x += tile.width){
      ctx.drawImage(tile, x, 0, tile.width, CANVAS_H);
    }
  } else {
    ctx.fillStyle = '#87cefa'; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  }

  ctx.save();
  ctx.translate(-cameraX,0);

  // draw platforms
  for(let p of platforms){
    // tile the platform image
    const t = assets.plat;
    if(t){
      for(let px = p.x; px < p.x + p.w; px += t.width){
        ctx.drawImage(t, px, p.y, t.width, p.h);
      }
    } else {
      ctx.fillStyle = '#8B5A2B'; ctx.fillRect(p.x, p.y, p.w, p.h);
    }
  }

  // draw decorations
  for(let s of shellPositions){
    if(assets.seashell) ctx.drawImage(assets.seashell, s.x, s.y, 32,32);
  }
  for(let s of starPositions){
    if(assets.starfish) ctx.drawImage(assets.starfish, s.x, s.y, 32,32);
  }

  // draw obstacles (boxes)
  ctx.fillStyle = '#8b0000';
  for(let o of obstacles){
    ctx.fillRect(o.x, o.y, o.w, o.h);
  }

  // draw pills (monsters) with small text above
  for(let m of pills){
    if(assets.ahmed) ctx.drawImage(assets.ahmed, m.x, m.y, m.w, m.h);
    else if(assets.pill) ctx.drawImage(assets.pill, m.x, m.y, m.w, m.h);
    // draw small "Ahmed Taha" text above (pixel font)
    ctx.fillStyle = '#000'; ctx.font = '9px "Press Start 2P", monospace'; ctx.textAlign='center';
    ctx.fillText('Ahmed Taha', m.x + m.w/2, m.y - 6);
    // blink overlay occasionally
    if(m.blinkTimer < 0.15){
      ctx.fillStyle = '#ffccff'; ctx.fillRect(m.x + (m.w/2)-6, m.y + (m.h/2)-4, Math.max(6, Math.floor(m.w*0.3)), Math.max(3, Math.floor(m.h*0.15)));
    }
  }

  // draw heart (with sparkle when near)
  if(assets.heart){
    // small bounce when near
    let hy = heart.y;
    if(heart.near) hy -= 6 * Math.sin(Date.now()/200);
    ctx.drawImage(assets.heart, heart.x, hy, heart.w, heart.h);
  } else {
    ctx.fillStyle = 'red'; ctx.fillRect(heart.x, heart.y, heart.w, heart.h);
  }

  // draw big sparkles (persist until play again)
  for(let s of bigSparkles){
    const img = (s.color==='violet'?assets.sparkleV:assets.sparkleG);
    if(img) ctx.drawImage(img, s.x - 12, s.y - 12, 24,24);
  }

  // draw player (Loza) with idle tail wag when standing still
  if(assets.loza){
    let px = player.x, py = player.y;
    let wobble = 0;
    if(player.vx === 0 && player.onGround){
      wobble = Math.sin(Date.now()/250) * 2; // small tail wag/bob
    }
    ctx.drawImage(assets.loza, px, py + wobble, player.w, player.h);
  } else {
    ctx.fillStyle='orange'; ctx.fillRect(player.x, player.y, player.w, player.h);
  }

  ctx.restore();

  // HUD hint
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(12,12,360,36);
  ctx.fillStyle = '#222'; ctx.font = '12px "Press Start 2P", monospace'; ctx.fillText('Loza — Reach the heart! Avoid Ahmed Taha', 18,36);
}

// Start game after assets load
Promise.all(loadPromises).then(()=>{
  buildLevel();
  // try autoplay bg
  tryAutoPlayBg();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}).catch(e=>{ console.error('Asset load error', e); buildLevel(); requestAnimationFrame(loop); });

