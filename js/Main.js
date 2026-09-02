// js/Main.js — Inicialización y GameLoop

import { config } from './Core/Config.js';
import { initAudio, toggleVolume, sfx } from './Core/Audio.js';
import { platform, toggleTouchUI, setTouchMove, setRightJoyActive, setUsingGamepad, toggleDeviceMode, bindResize } from './State.js';
import { nave, changeNaveColor as changeColor } from './entities/Player.js';
import { enemies, spawnEnemy, spawnFormation } from './entities/Enemy.js';
import { bosses, createBoss, renderBossUI, updateBossHP } from './entities/Boss.js';
import { bullets, enemyBullets, pickUps, weaponPowerUps, weaponState, homingState, droneState } from './entities/Projectile.js';
import { particles, debrisChunks, floatingTexts, shipTrail, fxState, createExplosion, spawnDebris } from './system/Effects.js';
import { combatState, dropRevivePickup, playerHit as combatPlayerHit, triggerBomb as combatTriggerBomb, triggerRevive } from './system/Combat.js';
import { progression, checkProgression } from './system/Progression.js';
import { hudState, updateHUD as hudUpdate, updateComboDisplay, updateWaveProgress } from './ui/Hud.js';
import { showScreen, updateVolumeVisibility, initPreview } from './ui/Menu.js';
import { stars, nebulas, planets, initParallax, drawParallax } from './world/Parallax.js';
import { DASH } from './Data/Constants.js';
import { initLayoutEditor, enterEditMode, exitEditMode, isEditorActive } from './ui/LayoutEditor.js';

// --- Canvas ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Exponer para ui/Menu que consulta estado global
let gameState = 'MENU';
let gameMode = 'progressive';
let customSelection = [];
window.__getGameState = () => gameState;
window.__getGameMode = () => gameMode;

// Globals equivalentes al original
let parryActive = false, parryCooldown = false;
let parryTimer = 0;
let dashActive = false, dashCooldown = false;
let dashHitSet = new Set();

// Compat wrappers para que Menu pueda consultar visibilidad
window.toggleVolume = toggleVolume;
window.changeNaveColor = (c) => changeColor(c);
window.showScreen = showScreen;
window.toggleTouchUI = toggleTouchUI;
window.togglePause = togglePause;
window.toggleDeviceMode = () => {
    toggleDeviceMode(config, canvas);
    nave.x = canvas.width / 2; nave.y = canvas.height - 100;
};
window.applyOptions = applyOptions;
window.startMission = startMission;
window.startCustom = startCustom;
window.acceptContinue = acceptContinue;
window.exitToMenu = exitToMenu;
window.openLayoutEditor = () => {
    // Cierra el menú de pausa visualmente pero mantiene estado PAUSED
    document.querySelectorAll('.ui-screen').forEach(s => s.classList.remove('active'));
    updateVolumeVisibility();
    enterEditMode();
};
window.closeLayoutEditor = (save) => exitEditMode(save);

const input = { moveX: 0, moveY: 0, aimX: 400, aimY: 300, shoot: false, triple: false, bomb: false, parry: false, pause: false, dash: false };
const keys = {};
let startBtnPressed = false;

// --- Preview nave ---
initPreview();

// --- Audio volume visibility ---
function refreshVolumeVisibility() { updateVolumeVisibility(); }

// --- applyOptions con platform awareness ---
function applyOptions() {
    const sizeVal = document.getElementById('opt-size')?.value || '800x600';
    if (sizeVal === 'auto' || platform.isForcedMobile) {
        config.w = window.innerWidth; config.h = window.innerHeight;
    } else {
        const [w, h] = sizeVal.split('x').map(Number);
        config.w = w; config.h = h;
    }
    canvas.width = config.w; canvas.height = config.h;
    const container = document.getElementById('game-container');
    if (container) { container.style.width = config.w + 'px'; container.style.height = config.h + 'px'; }

    const touchOpt = document.getElementById('opt-touch')?.value;
    if (touchOpt === 'force') platform.isMobile = true;
    else if (touchOpt === 'hide') platform.isMobile = false;
    else if (!platform.isForcedMobile) platform.isMobile = /Mobi|Android/i.test(navigator.userAgent);

    nave.x = canvas.width / 2; nave.y = canvas.height - 100;
    showScreen('menu-main');
}

bindResize(config, canvas, nave, () => gameState);

function showScreenWrapper(id) { showScreen(id); }
function togglePause() {
    if (isEditorActive()) { exitEditMode(true); showScreen('menu-pause'); updateVolumeVisibility(); return; }
    if (gameState === 'PLAYING') { gameState = 'PAUSED'; showScreen('menu-pause'); }
    else if (gameState === 'PAUSED') { gameState = 'PLAYING'; showScreen('none'); }
    updateVolumeVisibility();
}
function setHudVisible(v) {
    ['hud-block-score','hud-block-sector','hud-block-vida'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = v ? 'block' : 'none';
    });
    // boss-container se maneja por renderBossUI, no forzar aquí
    if (!v) { const bc=document.getElementById('boss-container'); if(bc) bc.style.display='none'; }
}
function exitToMenu() {
    gameState = 'MENU';
    setHudVisible(false);
    const mu = document.getElementById('mobile-ui'); if (mu) mu.style.display = 'none';
    bosses.length = 0; renderBossUI();
    showScreen('menu-main');
}
function promptContinue() {
    gameState = 'CONTINUE';
    setHudVisible(false);
    const mu = document.getElementById('mobile-ui'); if (mu) mu.style.display = 'none';
    showScreen('menu-continue');
}
function acceptContinue() {
    initAudio(); combatState.health = 100; gameState = 'PLAYING'; showScreen('none');
    setHudVisible(true);
    if (platform.isMobile && !platform.isTouchUIHidden) { const mu = document.getElementById('mobile-ui'); if (mu) mu.style.display = 'block'; }
    enemyBullets.length = 0; nave.inmune = true; setTimeout(() => nave.inmune = false, 3000); syncHud();
}
function winGame() {
    gameState = 'WIN';
    setHudVisible(false);
    const mu = document.getElementById('mobile-ui'); if (mu) mu.style.display = 'none';
    showScreen('menu-win');
}

// --- Init layout editor (HUD / controles editables) ---
initLayoutEditor();

// --- Input listeners ---
window.addEventListener('keydown', e => { if (e.code === 'Escape' && isEditorActive()) { exitEditMode(true); showScreen('menu-pause'); updateVolumeVisibility(); return; } keys[e.code] = true; if (e.code === 'KeyP') { togglePause(); keys[e.code] = false; } });
window.addEventListener('keyup', e => keys[e.code] = false);
canvas.addEventListener('mousemove', e => { if (isEditorActive()) return; const rect = canvas.getBoundingClientRect(); input.aimX = e.clientX - rect.left; input.aimY = e.clientY - rect.top; setUsingGamepad(false); });
canvas.addEventListener('mousedown', e => { if (isEditorActive()) return; initAudio(); if (e.button === 0) input.shoot = true; if (e.button === 2) input.triple = true; });
canvas.addEventListener('mouseup', e => { if (e.button === 0) input.shoot = false; if (e.button === 2) input.triple = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

function setupJoystick(baseId, stickId, type) {
    const base = document.getElementById(baseId);
    const stick = document.getElementById(stickId);
    let touchId = null;
    let center = { x: 0, y: 0 };
    base.addEventListener('touchstart', e => {
        if (isEditorActive()) return;
        initAudio(); e.preventDefault(); e.stopPropagation();
        if (touchId !== null) return;
        const touch = e.changedTouches[0]; touchId = touch.identifier;
        const rect = base.getBoundingClientRect();
        center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
        if (type === 'right') setRightJoyActive(true);
        updateJoy(touch);
    }, { passive: false });
    base.addEventListener('touchmove', e => {
        e.preventDefault(); e.stopPropagation();
        for (let t of e.changedTouches) if (t.identifier === touchId) { updateJoy(t); break; }
    }, { passive: false });
    const endTouch = e => {
        e.preventDefault(); e.stopPropagation();
        for (let t of e.changedTouches) if (t.identifier === touchId) {
            touchId = null; stick.style.transform = `translate(-50%, -50%)`;
            if (type === 'left') setTouchMove(0, 0);
            if (type === 'right') { setRightJoyActive(false); input.shoot = false; }
            break;
        }
    };
    base.addEventListener('touchend', endTouch, { passive: false });
    base.addEventListener('touchcancel', endTouch, { passive: false });
    function updateJoy(touch) {
        let dx = touch.clientX - center.x; let dy = touch.clientY - center.y;
        let dist = Math.hypot(dx, dy); let maxDist = 40;
        if (dist > maxDist) { dx = (dx/dist)*maxDist; dy = (dy/dist)*maxDist; }
        stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        if (type === 'left') setTouchMove(dx / maxDist, dy / maxDist);
        else if (type === 'right') {
            if (dist > 5) { input.aimX = nave.x + (dx / maxDist) * 300; input.aimY = nave.y + (dy / maxDist) * 300; input.shoot = true; }
            else input.shoot = false;
        }
    }
}
setupJoystick('joy-base-l', 'joy-stick-l', 'left');
setupJoystick('joy-base-r', 'joy-stick-r', 'right');
const bindTouchBtn = (id, action) => {
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener('touchstart', e => { if (isEditorActive()) return; initAudio(); e.preventDefault(); e.stopPropagation(); input[action]=true; el.style.transform='scale(0.85)'; el.style.backgroundColor='rgba(255,255,255,0.2)'; }, {passive:false});
    const endBtn = e => { e.preventDefault(); e.stopPropagation(); input[action]=false; el.style.transform='scale(1)'; el.style.backgroundColor='rgba(10,10,10,0.7)'; };
    el.addEventListener('touchend', endBtn, {passive:false}); el.addEventListener('touchcancel', endBtn, {passive:false});
};
bindTouchBtn('btn-triple','triple'); bindTouchBtn('btn-parry','parry'); bindTouchBtn('btn-bomb','bomb'); bindTouchBtn('btn-dash','dash');

function pollInput() {
    if (isEditorActive()) return;
    if (gameState === 'MENU' || gameState === 'CONTINUE' || gameState === 'WIN') return;
    input.moveX = platform.touchMoveX; input.moveY = platform.touchMoveY;
    if (keys['KeyW']) input.moveY = -1; if (keys['KeyS']) input.moveY = 1;
    if (keys['KeyA']) input.moveX = -1; if (keys['KeyD']) input.moveX = 1;
    if (keys['Space']) { input.bomb = true; keys['Space']=false; } else if(!platform.isMobile) input.bomb=false;
    if (keys['KeyE']) { input.parry=true; keys['KeyE']=false; } else if(!platform.isMobile) input.parry=false;
    if (keys['ShiftLeft']||keys['ShiftRight']) { input.dash=true; keys['ShiftLeft']=false; keys['ShiftRight']=false; } else if(!platform.isMobile) input.dash=false;
    const pads = navigator.getGamepads();
    if (pads[0]) {
        const pad = pads[0]; setUsingGamepad(true);
        if(Math.abs(pad.axes[0])>0.1) input.moveX=pad.axes[0];
        if(Math.abs(pad.axes[1])>0.1) input.moveY=pad.axes[1];
        if(Math.hypot(pad.axes[2],pad.axes[3])>0.2){ input.aimX+=pad.axes[2]*15; input.aimY+=pad.axes[3]*15; input.aimX=Math.max(0,Math.min(canvas.width,input.aimX)); input.aimY=Math.max(0,Math.min(canvas.height,input.aimY)); }
        input.shoot=pad.buttons[7].value>0.2; input.triple=pad.buttons[6].value>0.2;
        if(pad.buttons[4].pressed && !input.bomb) input.bomb=true; else if(!pad.buttons[4].pressed) input.bomb=false;
        if(pad.buttons[5].pressed && !input.parry) input.parry=true; else if(!pad.buttons[5].pressed) input.parry=false;
        if(pad.buttons[2].pressed && !input.dash) input.dash=true; else if(!pad.buttons[2].pressed) input.dash=false;
        if(pad.buttons[9].pressed && !startBtnPressed){ togglePause(); startBtnPressed=true; } else if(!pad.buttons[9].pressed) startBtnPressed=false;
    }
    if(platform.isMobile && !platform.usingGamepad && !platform.rightJoyActive && (input.moveX!==0||input.moveY!==0)){
        input.aimX = nave.x + input.moveX * 150; input.aimY = nave.y + input.moveY * 150;
    }
}

function startCustom(){
    const cbs=document.querySelectorAll('#custom-checkboxes input:checked');
    customSelection=Array.from(cbs).map(cb=>cb.value);
    if(customSelection.length===0) return alert("Selecciona al menos un objetivo.");
    startMission('custom');
}

function startMission(mode){
    initAudio(); gameMode=mode; gameState='PLAYING';
    hudState.score=0; progression.currentWave=1; progression.wavePhase=1;
    combatState.damagePerHit = parseInt(document.getElementById('opt-damage')?.value) || 20;
    combatState.health=100; combatState.hasRevive=false; combatState.bombs=3;
    fxState.screenShake=0; parryTimer=0; parryCooldown=false;
    progression.waveKills=0; progression.waveTransition=false; progression.waveTransitionTimer=0;
    progression.waveKillTarget = parseInt(document.getElementById('opt-kills')?.value) || 50;
    dashActive=false; dashCooldown=false;
    hudState.comboCount=0; hudState.comboMultiplier=1; if(hudState.comboResetTimer){clearTimeout(hudState.comboResetTimer); hudState.comboResetTimer=null;}
    weaponState.current='normal'; weaponState.timer=0; weaponPowerUps.length=0; debrisChunks.length=0; fxState.hitStopFrames=0;
    homingState.active=false; homingState.timer=0; droneState.drones.length=0; droneState.timer=0; shipTrail.length=0;
    bullets.length=0; enemyBullets.length=0; enemies.length=0; bosses.length=0; pickUps.length=0; particles.length=0; floatingTexts.length=0;
    nave.x=canvas.width/2; nave.y=canvas.height-100; nave.vx=0; nave.vy=0;
    showScreen('none');
    setHudVisible(true);
    const mu=document.getElementById('mobile-ui'); if(mu) mu.style.display=(platform.isMobile && !platform.isTouchUIHidden)?'block':'none';
    if(mode==='custom'){
        customSelection.forEach(val=>{
            if(val==='b1') createBoss({canvas, type:'static', id:'B1'});
            if(val==='b2') createBoss({canvas, type:'moving', id:'B2'});
            if(val==='b3'){ createBoss({canvas, type:'static', id:'B1'}); createBoss({canvas, type:'moving', id:'B2'}); }
            if(val==='b_hunter') createBoss({canvas, type:'hunter', id:'B_HUNTER'});
            if(val==='b_berserker') createBoss({canvas, type:'berserker', id:'B_BERSERK'});
            if(val==='b4') createBoss({canvas, type:'doppel', id:'DOPPEL'});
        });
    }
    syncHud();
}

function syncHud(){ hudUpdate({ combatState, weaponState, progression, gameMode: { value: gameMode }}); }

// --- Helpers for update loop ---
function spawnBullets(isTriple){
    const baseAngle = Math.atan2(input.aimY - nave.y, input.aimX - nave.x);
    if(weaponState.current==='laser'){ sfx.laser(); return; }
    sfx.shoot();
    if(weaponState.current==='spread'){
        for(let i=0;i<5;i++){ const a=baseAngle+(i-2)*0.25; bullets.push({x:nave.x,y:nave.y,vx:Math.cos(a)*13,vy:Math.sin(a)*13,color:'#ff9900',dmg:15}); }
        fxState.screenShake=2;
    } else if(isTriple){ for(let i=-1;i<=1;i++){const a=baseAngle+(i*0.2); bullets.push({x:nave.x,y:nave.y,vx:Math.cos(a)*12,vy:Math.sin(a)*12,color:'#ffcc00',dmg:25});} fxState.screenShake=3; }
    else { bullets.push({x:nave.x,y:nave.y,vx:Math.cos(baseAngle)*15,vy:Math.sin(baseAngle)*15,color:'#1e90ff',dmg:20}); }
    droneState.drones.forEach(d=>{ bullets.push({x:d.x,y:d.y,vx:Math.cos(baseAngle)*13,vy:Math.sin(baseAngle)*13,color:'#ffffff',dmg:8,isDrone:true}); });
}

function triggerBomb(isPlayer, origin){
    if(isPlayer){ if(combatState.bombs<=0) return; combatState.bombs--; input.bomb=false; sfx.bomb(); }
    fxState.screenShake=40; particles.push({x:origin.x,y:origin.y,vx:0,vy:0,life:1,type:'bomb_ring',color:isPlayer?'#fff':'#ff0044'});
    if(isPlayer){ enemyBullets.length=0; enemies.forEach(e=>createExplosion(e.x,e.y,'#fff',10)); enemies.length=0; bosses.forEach(b=>{ b.hp -= b.maxHp*0.1; updateBossHP(b); }); } else { bullets.length=0; if(!parryActive) doPlayerHit(true); }
    syncHud();
}
function doPlayerHit(heavy=false){
    if(nave.inmune) return;
    sfx.hit(); fxState.hitStopFrames = heavy?7:4;
    combatState.health -= heavy? combatState.damagePerHit*2 : combatState.damagePerHit;
    combatState.health=Math.max(0,combatState.health); fxState.screenShake=heavy?30:15; nave.inmune=true; createExplosion(nave.x,nave.y,'#ff0000', heavy?40:25); syncHud();
    setTimeout(()=>nave.inmune=false,2000); if(combatState.health<=0){ if(combatState.hasRevive){ triggerRevive({updateHUD:syncHud}); } else promptContinue(); }
}

// --- UPDATE ---
function update(){
    pollInput();
    if(gameState!=='PLAYING') return;
    if(fxState.hitStopFrames>0){ fxState.hitStopFrames--; return; }
    fxState.frameCount++; checkProgression({ gameMode:{value:gameMode}, currentWaveRef:{canvas}, customSelection, frameCount: fxState.frameCount, winGame }); if(gameMode==='progressive') updateWaveProgress({gameMode:{value:gameMode}, progression, bosses});

    if(weaponState.current!=='normal'){ weaponState.timer--; if(weaponState.timer<=0){ weaponState.current='normal'; weaponState.timer=0; } }
    if(homingState.active){
        homingState.timer--; if(homingState.timer<=0){ homingState.active=false; floatingTexts.push({x:nave.x,y:nave.y-40,text:'Misiles agotados',life:1.0,color:'#00ffaa'}); }
        if(homingState.active && fxState.frameCount%70===0){
            let target=null,bestDist=Infinity; enemies.forEach(e=>{const d=Math.hypot(e.x-nave.x,e.y-nave.y); if(d<bestDist){bestDist=d; target=e;}}); bosses.forEach(bx=>{ if(!bx.immune){ const d=Math.hypot(bx.x-nave.x,bx.y-nave.y); if(d<bestDist){bestDist=d; target=bx;}}});
            const ang=target?Math.atan2(target.y-nave.y,target.x-nave.x):Math.atan2(input.aimY-nave.y,input.aimX-nave.x);
            bullets.push({x:nave.x,y:nave.y,vx:Math.cos(ang)*9,vy:Math.sin(ang)*9,color:'#00ffaa',dmg:35,isHoming:true,life:240}); sfx.shoot(); floatingTexts.push({x:nave.x,y:nave.y-30,text:'🎯 MISIL',life:0.8,color:'#00ffaa'});
        }
    }
    if(droneState.drones.length>0){
        droneState.timer--; droneState.drones.forEach(d=>{ const orbitAngle=(fxState.frameCount*0.045)+d.angleOffset; d.x=nave.x+Math.cos(orbitAngle)*55; d.y=nave.y+Math.sin(orbitAngle)*55; });
        if(droneState.timer<=0){ droneState.drones.length=0; floatingTexts.push({x:nave.x,y:nave.y-40,text:'Drones desactivados',life:1.0,color:'#ffffff'}); }
    }
    for(let wi=weaponPowerUps.length-1; wi>=0; wi--){
        const wp=weaponPowerUps[wi]; wp.y+=wp.vy; wp.life--;
        if(Math.hypot(wp.x-nave.x,wp.y-nave.y)<25){
            if(wp.letter==='R'){ homingState.active=true; homingState.timer=900; sfx.powerup(); floatingTexts.push({x:wp.x,y:wp.y,text:'🎯 MISILES TELEDIRIGIDOS!',life:1.2,color:'#00ffaa'}); }
            else if(wp.letter==='D'){ if(droneState.drones.length<2) droneState.drones.push({angleOffset:droneState.drones.length*Math.PI,x:nave.x,y:nave.y}); droneState.timer=900; sfx.powerup(); floatingTexts.push({x:wp.x,y:wp.y,text:'🛰️ DRONES ACTIVADOS!',life:1.2,color:'#ffffff'}); }
            else { weaponState.current=wp.letter==='S'?'spread':'laser'; weaponState.timer=600; sfx.powerup(); floatingTexts.push({x:wp.x,y:wp.y,text:wp.letter==='S'?'★ SPREAD!':'★ LASER!',life:1.2,color:'#ff9900'}); }
            weaponPowerUps.splice(wi,1);
        } else if(wp.life<=0|| wp.y>canvas.height) weaponPowerUps.splice(wi,1);
    }
    for(let di=debrisChunks.length-1; di>=0; di--){
        const d=debrisChunks[di]; const distToNave=Math.hypot(d.x-nave.x,d.y-nave.y);
        if(distToNave<26){ const pushAng=Math.atan2(d.y-nave.y,d.x-nave.x); const pushForce=(26-distToNave)*(dashActive?1.1:0.5); d.vx+=Math.cos(pushAng)*pushForce; d.vy+=Math.sin(pushAng)*pushForce; d.rotSpeed+=(Math.random()-0.5)*0.05; }
        d.x+=d.vx; d.y+=d.vy; d.rot+=d.rotSpeed; d.vx*=0.98; d.vy*=0.98; d.life-=0.008; if(d.life<=0) debrisChunks.splice(di,1);
    }
    if(parryCooldown){ parryTimer-=1000/60; if(parryTimer<=0) parryTimer=0; }
    nave.vx+=input.moveX*nave.accel; nave.vy+=input.moveY*nave.accel; nave.vx*=nave.fric; nave.vy*=nave.fric; nave.x=Math.max(10,Math.min(canvas.width-10,nave.x+nave.vx)); nave.y=Math.max(10,Math.min(canvas.height-10,nave.y+nave.vy));
    const naveSpd=Math.hypot(nave.vx,nave.vy);
    if((dashActive||naveSpd>7) && fxState.frameCount%3===0){ const trailAngle=Math.atan2(input.aimY-nave.y,input.aimX-nave.x); shipTrail.push({x:nave.x,y:nave.y,angle:trailAngle,life:1.0,color:dashActive?'#a0c4ff':nave.color}); }
    for(let ti=shipTrail.length-1; ti>=0; ti--){ shipTrail[ti].life-=0.09; if(shipTrail[ti].life<=0) shipTrail.splice(ti,1); }
    if(Math.hypot(nave.vx,nave.vy)>0.2){ const aimAngle=Math.atan2(input.aimY-nave.y,input.aimX-nave.x); const px=nave.x-Math.cos(aimAngle)*15; const py=nave.y-Math.sin(aimAngle)*15; particles.push({x:px+(Math.random()-0.5)*10,y:py+(Math.random()-0.5)*10,vx:-Math.cos(aimAngle)*2+(Math.random()-0.5),vy:-Math.sin(aimAngle)*2+(Math.random()-0.5),life:0.8,color:'#ffcc00',type:'spark'}); }
    if(input.shoot && fxState.frameCount%6===0) spawnBullets(false);
    if(input.triple && fxState.frameCount%12===0) spawnBullets(true);
    if(input.bomb) triggerBomb(true,nave);
    if(weaponState.current==='laser' && input.shoot && fxState.frameCount%3===0){
        sfx.laser(); const ang=Math.atan2(input.aimY-nave.y,input.aimX-nave.x); const cos=Math.cos(ang),sin=Math.sin(ang);
        enemies.forEach((e,ei)=>{ const dx=e.x-nave.x,dy=e.y-nave.y; const proj=dx*cos+dy*sin; const perpDist=Math.abs(dx*sin-dy*cos); if(proj>0 && perpDist<18){ if(e.shield){e.shield=false;} else { createExplosion(e.x,e.y); if(e.type==='elite'||e.type==='special') spawnDebris(e.x,e.y,'#00ccff'); enemies.splice(ei,1); if(e.type!=='life'){ hudState.comboCount++; hudState.comboMultiplier=hudState.comboCount>=10?3:hudState.comboCount>=5?2:1; if(hudState.comboResetTimer) clearTimeout(hudState.comboResetTimer); hudState.comboResetTimer=setTimeout(()=>{hudState.comboCount=0;hudState.comboMultiplier=1;updateComboDisplay();},2500); const pts=150*hudState.comboMultiplier; hudState.score+=pts; floatingTexts.push({x:e.x,y:e.y,text:hudState.comboMultiplier>1?`+${pts} x${hudState.comboMultiplier}!`:`+${pts}`,life:1.0,color:hudState.comboMultiplier>=3?'#ff3366':hudState.comboMultiplier===2?'#ffcc00':'#00ccff'}); updateComboDisplay(); if(gameMode==='progressive'){progression.waveKills++; updateWaveProgress({gameMode:{value:gameMode},progression,bosses});} if(e.type==='elite'&&Math.random()>0.4){ const letters=['S','L','R','D']; const wt=letters[Math.floor(Math.random()*4)]; weaponPowerUps.push({x:e.x,y:e.y,letter:wt,vy:1.5,life:600}); } } else { combatState.health=Math.min(100, combatState.health+combatState.damagePerHit); syncHud(); floatingTexts.push({x:e.x,y:e.y,text:`+${combatState.damagePerHit}% VIDA`,life:1.0,color:'#ff66cc'}); } } } });
        bosses.forEach((b,bLIdx)=>{ if(b.type==='doppel'&&b.parryActive) return; if(b.immune) return; const dx=b.x-nave.x,dy=b.y-nave.y; const proj=dx*cos+dy*sin,perp=Math.abs(dx*sin-dy*cos); const lRadius=(b.type==='doppel_y'||b.type==='doppel_o')?30:50; if(proj>0 && perp<lRadius){ b.hp-=100; updateBossHP(b); if(b.hp<=0 && (b.type==='doppel_y'||b.type==='doppel_o')){ const col=b.type==='doppel_y'?'#ffff00':'#ff6600'; createExplosion(b.x,b.y,col,50); spawnDebris(b.x,b.y,col,6); fxState.hitStopFrames=8; fxState.screenShake=20; hudState.score+=8000; floatingTexts.push({x:b.x,y:b.y-50,text:b.type==='doppel_y'?'★ DOPPEL AMARILLO DESTRUIDO ★':'★ DOPPEL NARANJA DESTRUIDO ★',life:2.0,color:col}); bosses.splice(bLIdx,1); renderBossUI(); dropRevivePickup(b.x,b.y); } } });
    }
    if(input.parry && !parryCooldown){ sfx.parry(); parryActive=true; parryCooldown=true; input.parry=false; parryTimer=2000; const el=document.getElementById('val-parry'); if(el){el.innerText="ACTIVE"; el.style.color="var(--success)";} setTimeout(()=>{parryActive=false; const e2=document.getElementById('val-parry'); if(e2){e2.innerText="RECHARGING"; e2.style.color="var(--danger)";}},200); setTimeout(()=>{parryCooldown=false; const e3=document.getElementById('val-parry'); if(e3){e3.innerText="READY"; e3.style.color="var(--success)";}},2000); }
    if(input.dash && !dashCooldown && !dashActive){ input.dash=false; sfx.dash(); dashActive=true; dashCooldown=true; nave.inmune=true; dashHitSet.clear(); const dx=input.moveX||0,dy=input.moveY||0; const len=Math.hypot(dx,dy)||1; nave.vx=(dx/len)*DASH.SPEED; nave.vy=(dy/len)*DASH.SPEED; const el=document.getElementById('val-dash'); if(el){el.innerText="ACTIVE"; el.style.color="#a0c4ff";} for(let i=0;i<12;i++) particles.push({x:nave.x,y:nave.y,vx:(Math.random()-0.5)*4,vy:(Math.random()-0.5)*4,life:0.9,color:'#a0c4ff',type:'spark'}); setTimeout(()=>{dashActive=false; nave.inmune=false; const e2=document.getElementById('val-dash'); if(e2){e2.innerText="RECHARGING"; e2.style.color="var(--danger)";}},DASH.DURATION); setTimeout(()=>{dashCooldown=false; const e3=document.getElementById('val-dash'); if(e3){e3.innerText="READY"; e3.style.color="var(--success)";}},DASH.COOLDOWN); }
    if(Math.random()<0.02+(progression.currentWave*0.005) && bosses.length===0) spawnEnemy({canvas,bosses,gameMode:{value:gameMode},currentWave:{value:progression.currentWave},waveTransition:{value:progression.waveTransition},customSelection});
    if(bosses.length===0 && fxState.frameCount%420===0 && gameMode!=='custom'){ const forms=['triangle','square','circle']; spawnFormation({canvas,bosses,formType:forms[Math.floor(Math.random()*forms.length)]}); }
    enemies.forEach((e,i)=>{
        if(e.zigzag){ e.zigzagPhase=(e.zigzagPhase||0)+0.05; e.vx=Math.sin(e.zigzagPhase)*3; }
        e.x+=e.vx; e.y+=e.vy;
        if(e.type==='kamikaze'){ const ang=Math.atan2(nave.y-e.y,nave.x-e.x); e.vx+=Math.cos(ang)*0.4; e.vy+=Math.sin(ang)*0.4; const spd=Math.hypot(e.vx,e.vy); if(spd>9){e.vx=(e.vx/spd)*9; e.vy=(e.vy/spd)*9; } }
        if(e.type==='elite' && !(e.dodgeCooldown)){ const aimAngle=Math.atan2(input.aimY-nave.y,input.aimX-nave.x); const toEnemy=Math.atan2(e.y-nave.y,e.x-nave.x); const angleDiff=Math.abs(((aimAngle-toEnemy)+Math.PI)%(Math.PI*2)-Math.PI); const dist=Math.hypot(e.x-nave.x,e.y-nave.y); if(angleDiff<0.12 && dist<350 && input.shoot){ e.vx+=(Math.random()>0.5?1:-1)*8; e.dodgeCooldown=true; setTimeout(()=>{if(e) e.dodgeCooldown=false;},1200); } }
        if(e.suicidal){ const ang=Math.atan2(nave.y-e.y,nave.x-e.x); e.vx+=Math.cos(ang)*0.25; e.vy+=Math.sin(ang)*0.25; const spd=Math.hypot(e.vx,e.vy); if(spd>6){e.vx=(e.vx/spd)*6; e.vy=(e.vy/spd)*6; } }
        if(e.type==='elite' && fxState.frameCount%70===0){ const angle=Math.atan2(nave.y-e.y,nave.x-e.x); enemyBullets.push({x:e.x,y:e.y,vx:Math.cos(angle)*6,vy:Math.sin(angle)*6,color:'#00ffcc'}); }
        if(Math.hypot(e.x-nave.x,e.y-nave.y)<20){ if(dashActive && !dashHitSet.has(e)){ dashHitSet.add(e); createExplosion(e.x,e.y,'#a0c4ff',22); spawnDebris(e.x,e.y,'#a0c4ff',3); hudState.score+=100; floatingTexts.push({x:e.x,y:e.y,text:'¡EMBESTIDA! +100',life:1.0,color:'#a0c4ff'}); fxState.hitStopFrames=3; fxState.screenShake=5; } else { doPlayerHit(); } enemies.splice(i,1); }
        if(e.y>canvas.height) enemies.splice(i,1);
    });

    // --- Bosses (resumen idéntico al original, compactado) ---
    bosses.forEach((b,i)=>{
        if(b.y<b.targetY) b.y+=2;
        if(dashActive && !b.immune && !dashHitSet.has(b)){
            const ramRadius=(b.type==='doppel_y'||b.type==='doppel_o')?42:55;
            if(Math.hypot(b.x-nave.x,b.y-nave.y)<ramRadius){ dashHitSet.add(b); const ramDmg=Math.max(60,Math.round(b.maxHp*0.06)); b.hp-=ramDmg; updateBossHP(b); createExplosion(b.x,b.y,'#a0c4ff',25); spawnDebris(b.x,b.y,'#a0c4ff',4); floatingTexts.push({x:b.x,y:b.y-50,text:`¡EMBESTIDA! -${ramDmg}`,life:1.2,color:'#a0c4ff'}); fxState.hitStopFrames=6; fxState.screenShake=10; }
        }
        // moving B2 etc handled igual que original — se replica lógica completa
        if(b.type==='moving' || b.id==='B2'){
            const enrageSpeed=b.hp<b.maxHp*0.3?5:3;
            b.x+=b.dir*enrageSpeed; if(b.x>canvas.width-50||b.x<50) b.dir*=-1;
            const b2Enraged=b.hp<b.maxHp*0.3;
            if(!b2Enraged){
                if(!b.telegraphActive && (Date.now()-b.lastShot)>(400-600)){ b.telegraphActive=true; setTimeout(()=>{if(b) b.telegraphActive=false;},600); }
                if(Date.now()-b.lastShot>400){ const ang=Math.atan2(nave.y-b.y,nave.x-b.x); for(let j=-2;j<=2;j++){ const a=ang+j*0.18; enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*5.5,vy:Math.sin(a)*5.5,color:'#ffcc00'}); } b.lastShot=Date.now(); }
            } else {
                if(Date.now()-b.lastShot>200){ const ang=Math.atan2(nave.y-b.y,nave.x-b.x); for(let j=-1;j<=1;j++){ const a=ang+j*0.1; enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*7,vy:Math.sin(a)*7,color:'#ff6600'}); } b.lastShot=Date.now(); }
            }
        } else if(b.type==='doppel'){
            if(!b.transformed && b.hp<=0){ b.transformed=true; b.immune=true; b.vx=0; b.vy=0; b.transformPhase='toCenter'; floatingTexts.push({x:b.x,y:b.y-70,text:'⚡ COLAPSO — FASE 2 ⚡',life:3.0,color:'#ffff00'}); fxState.screenShake=12; setTimeout(()=>{ const bi2=bosses.indexOf(b); if(bi2!==-1) bosses.splice(bi2,1); bosses.push({id:'DOPPEL_Y',type:'doppel_y',x:canvas.width*0.3,y:140,targetY:140,hp:3000,maxHp:3000,vx:0,vy:0,lastMissile:Date.now(),lastSpiral:Date.now(),spiralActive:false,spiralCount:0,parryCooldown:false,parryActive:false,enraged:false,bombs:0}); bosses.push({id:'DOPPEL_O',type:'doppel_o',x:canvas.width*0.7,y:140,targetY:140,hp:3000,maxHp:3000,vx:0,vy:0,dashState:'chase',dashTimer:0,dashVx:0,dashVy:0,dashCount:0,maxDashes:3,lastDashTime:Date.now(),lastExplosion:0,explodeCooldown:false,enraged:false,bombs:0}); renderBossUI(); fxState.hitStopFrames=10; fxState.screenShake=20; createExplosion(canvas.width/2,canvas.height/2,'#ffff00',40); spawnDebris(canvas.width/2,canvas.height/2,'#ffff00',8); },2000); }
            if(b.immune){ const cx=canvas.width/2,cy=canvas.height/2; if(b.transformPhase==='toCenter'){ const dx=cx-b.x,dy=cy-b.y,dist=Math.hypot(dx,dy); if(dist>6){b.x+=(dx/dist)*Math.min(12,dist); b.y+=(dy/dist)*Math.min(12,dist);} else {b.x=cx;b.y=cy;b.transformPhase='spinning'; b.spinAngle=0; floatingTexts.push({x:cx,y:cy-70,text:'¡FUSIÓN INESTABLE!',life:1.6,color:'#ffff00'});} } else if(b.transformPhase==='spinning'){ b.spinAngle=(b.spinAngle||0)+0.85; b.x=cx+Math.sin(fxState.frameCount*0.6)*3; b.y=cy+Math.cos(fxState.frameCount*0.5)*3; } return; }
            let targetX=nave.x+Math.sin(fxState.frameCount/30)*150; let targetY=nave.y-150+Math.cos(fxState.frameCount/20)*50; targetX=Math.max(50,Math.min(canvas.width-50,targetX)); targetY=Math.max(50,Math.min(canvas.height-150,targetY)); b.x+=(targetX-b.x)*0.04; b.y+=(targetY-b.y)*0.04; let danger=bullets.find(bul=>Math.hypot(bul.x-b.x,bul.y-b.y)<70); if(danger && !b.parryCooldown && Math.random()>0.5){b.parryActive=true; b.parryCooldown=true; setTimeout(()=>b.parryActive=false,300); setTimeout(()=>b.parryCooldown=false,2500);} if(Date.now()-b.lastShot>150){ const ang=Math.atan2(nave.y-b.y,nave.x-b.x); enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(ang)*14,vy:Math.sin(ang)*14,color:'#ff0044'}); if(fxState.frameCount%60===0){for(let j=-2;j<=2;j++) enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(ang+(j*0.2))*10,vy:Math.sin(ang+(j*0.2))*10,color:'#ffcc00'});} b.lastShot=Date.now(); } if(b.bombs>0 && Math.hypot(b.x-nave.x,b.y-nave.y)<100){ triggerBomb(false,b); b.bombs--; }
        } else if(b.type==='doppel_y'){
            const now=Date.now(); const enraged=b.enraged; const missileRate=enraged?2200:5000;
            const distToPlayer=Math.hypot(nave.x-b.x,nave.y-b.y); const safeZone=enraged?220:280;
            if(distToPlayer<safeZone){ const ang=Math.atan2(b.y-nave.y,b.x-nave.x); b.vx+=Math.cos(ang)*(enraged?0.4:0.3); b.vy+=Math.sin(ang)*(enraged?0.4:0.3);} else { b.vx+=Math.sin(fxState.frameCount/40)*(enraged?0.22:0.15); b.vy+=Math.cos(fxState.frameCount/40)*(enraged?0.22:0.15); }
            const maxYSpd=enraged?4.5:3.5; const spd=Math.hypot(b.vx,b.vy); if(spd>maxYSpd){b.vx=(b.vx/spd)*maxYSpd; b.vy=(b.vy/spd)*maxYSpd;} b.x+=b.vx; b.y+=b.vy; b.vx*=0.96; b.vy*=0.96; b.x=Math.max(30,Math.min(canvas.width-30,b.x)); b.y=Math.max(30,Math.min(canvas.height*0.6,b.y));
            if(!b.enraged && bosses.every(bx=>bx.type!=='doppel_o')){ b.enraged=true; b.lastMissile=0; b.lastSpiral=now+1200; fxState.screenShake=16; fxState.hitStopFrames=10; floatingTexts.push({x:b.x,y:b.y-60,text:'⚠ ÚLTIMO DOPPEL — FURIA AMARILLA ⚠',life:2.4,color:'#ffff00'}); }
            if(now-b.lastMissile>missileRate){ const ang=Math.atan2(nave.y-b.y,nave.x-b.x); enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(ang)*4,vy:Math.sin(ang)*4,color:'#ffff00',isMissile:true,hp:3,life:420}); if(enraged){for(let j=-1;j<=1;j+=2) enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(ang+j*0.35)*6,vy:Math.sin(ang+j*0.35)*6,color:'#ffcc00'});} floatingTexts.push({x:b.x,y:b.y-40,text:'⚠ MISIL',life:1.0,color:'#ffff00'}); b.lastMissile=now; }
            if(enraged){ if(!b.spiralActive && now-b.lastSpiral>5500){ b.spiralActive=true; b.spiralStart=now; b.spiralCount=0; floatingTexts.push({x:b.x,y:b.y-60,text:'¡ESPIRAL!',life:1.2,color:'#ffee00'}); } if(b.spiralActive){ if(fxState.frameCount%3===0){ const arms=3; for(let a=0;a<arms;a++){ const spAng=(b.spiralCount*0.28)+(a*(Math.PI*2/arms)); enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(spAng)*3.4,vy:Math.sin(spAng)*3.4,color:'#ffee00'}); } b.spiralCount++; } if(now-b.spiralStart>2600){ b.spiralActive=false; b.lastSpiral=now; } } }
        } else if(b.type==='doppel_o'){
            const now=Date.now(); const enraged=b.enraged;
            if(!b.enraged && bosses.every(bx=>bx.type!=='doppel_y')){ b.enraged=true; b.maxDashes=4; fxState.screenShake=12; floatingTexts.push({x:b.x,y:b.y-60,text:'⚠ FURIA NARANJA ⚠',life:2.0,color:'#ff6600'}); }
            if(enraged && !b.explodeCooldown && now-b.lastExplosion>7000){ b.lastExplosion=now; b.explodeCooldown=true; b.dashState='toCenter'; floatingTexts.push({x:b.x,y:b.y-60,text:'¡EXPLOSIÓN!',life:1.5,color:'#ff4400'}); }
            if(b.dashState==='toCenter'){ const cx=canvas.width/2,cy=canvas.height/2; const dx=cx-b.x,dy=cy-b.y,dist=Math.hypot(dx,dy); if(dist>8){b.x+=(dx/dist)*6; b.y+=(dy/dist)*6;} else { b.x=cx; b.y=cy; if(!b.centerTimer){ b.centerTimer=setTimeout(()=>{ b.lastBreathCount=2; b.dashState='centerExploding'; b.centerTimer=null; b.countInterval=setInterval(()=>{ b.lastBreathCount--; fxState.screenShake=8; if(b.lastBreathCount<=0){clearInterval(b.countInterval); fxState.hitStopFrames=10; fxState.screenShake=30; const ringCount=28; for(let j=0;j<ringCount;j++){const a=(j/ringCount)*Math.PI*2; enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*16,vy:Math.sin(a)*16,color:'#ff6600',isBerserkerSpike:true}); const a2=a+(Math.PI/ringCount); enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(a2)*9,vy:Math.sin(a2)*9,color:'#ffaa00',isBerserkerSpike:true});} createExplosion(b.x,b.y,'#ff6600',60); spawnDebris(b.x,b.y,'#ff6600',5); b.dashState='chase'; b.explodeCooldown=false; b.lastBreathCount=0;}},1000); },500); } } return; }
            const maxSpd=enraged?7:5.5; b.vx+=(nave.x-b.x)*0.028; b.vy+=(nave.y-b.y)*0.028; const spd=Math.hypot(b.vx,b.vy); if(spd>maxSpd && b.dashState==='chase'){b.vx=(b.vx/spd)*maxSpd; b.vy=(b.vy/spd)*maxSpd;} if(b.dashState==='chase'){ b.x+=b.vx; b.y+=b.vy; b.x=Math.max(20,Math.min(canvas.width-20,b.x)); b.y=Math.max(20,Math.min(canvas.height*0.85,b.y)); const interval=enraged?900:1500; if(now-b.lastDashTime>interval){b.vx=0;b.vy=0;b.dashCount=0;b.dashState='telegraph';b.dashTimer=now;}} else if(b.dashState==='telegraph'){ const dur=enraged?200:280; if(now-b.dashTimer>dur){ const ang=Math.atan2(nave.y-b.y,nave.x-b.x); const dspd=enraged?38:30; b.dashVx=Math.cos(ang)*dspd; b.dashVy=Math.sin(ang)*dspd; b.dashState='dashing'; b.dashTimer=now; }} else if(b.dashState==='dashing'){ b.x+=b.dashVx; b.y+=b.dashVy; if(b.x<20){b.x=20;b.dashVx=Math.abs(b.dashVx)*0.4;} if(b.x>canvas.width-20){b.x=canvas.width-20;b.dashVx=-Math.abs(b.dashVx)*0.4;} if(b.y<20){b.y=20;b.dashVy=Math.abs(b.dashVy)*0.4;} if(b.y>canvas.height-20){b.y=canvas.height-20;b.dashVy=-Math.abs(b.dashVy)*0.4;} b.dashVx*=0.93; b.dashVy*=0.93; const cs=Math.hypot(b.dashVx,b.dashVy); if(cs<1.5||now-b.dashTimer>900){b.vx=0;b.vy=0;b.dashVx=0;b.dashVy=0;b.dashCount++; if(b.dashCount>=(b.maxDashes||3)){b.dashState='chase';b.lastDashTime=now;} else {b.dashState='telegraph';b.dashTimer=now;}} }
            if(Math.hypot(b.x-nave.x,b.y-nave.y)<38) doPlayerHit(b.dashState==='dashing');
        } else if(b.type==='hunter'){
            const enraged=b.hp<b.maxHp*0.3; if(!b.enraged && enraged){b.enraged=true; fxState.screenShake=8; floatingTexts.push({x:b.x,y:b.y-60,text:'⚠ PÁNICO ⚠',life:2.0,color:'#ff0000'});}
            const spd=enraged?4.5:3; b.vx=b.vx||0; b.vy=b.vy||0; b.vx+=(nave.x-b.x)*0.018; b.vy+=(nave.y-200-b.y)*0.018; const curSpd=Math.hypot(b.vx,b.vy); if(curSpd>spd){b.vx=(b.vx/curSpd)*spd; b.vy=(b.vy/curSpd)*spd;} b.x+=b.vx; b.y+=b.vy; b.x=Math.max(50,Math.min(canvas.width-50,b.x)); b.y=Math.max(40,Math.min(canvas.height*0.55,b.y));
            if(!b.dodgeCooldown){ const threat=bullets.find(bul=>{const dx=bul.x-b.x,dy=bul.y-b.y; const dist=Math.hypot(dx,dy); const proj=(dx*b.vx+dy*b.vy); return dist<120 && proj<0;}); if(threat){b.vx+=(Math.random()>0.5?1:-1)*6; b.dodgeCooldown=true; setTimeout(()=>{if(b) b.dodgeCooldown=false;},900);} }
            const laserRate=enraged?600:1200; if(!b.telegraphActive && (Date.now()-b.lastLaser)>(laserRate-600)){b.telegraphActive=true; setTimeout(()=>{if(b) b.telegraphActive=false;},600);} if(Date.now()-b.lastLaser>laserRate){ const ang=Math.atan2(nave.y-b.y,nave.x-b.x); const shots=enraged?5:3; for(let j=0;j<shots;j++){const spread=(j-Math.floor(shots/2))*0.15; enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(ang+spread)*8,vy:Math.sin(ang+spread)*8,color:'#ff00ff',isLaser:true});} b.lastLaser=Date.now(); } if(enraged && Date.now()-b.lastShot>300){ for(let j=0;j<6;j++){const a=(fxState.frameCount/20)+(j*(Math.PI*2/6)); enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*3.5,vy:Math.sin(a)*3.5,color:'#ff6600'});} b.lastShot=Date.now(); }
        } else if(b.type==='berserker'){
            const enraged=b.hp<b.maxHp*0.3; const now=Date.now();
            if(b.lastBreath){ b.immune=true; const cx=canvas.width/2,cy=canvas.height/2; const dx=cx-b.x,dy=cy-b.y,dist=Math.hypot(dx,dy); if(dist>8){b.x+=(dx/dist)*5; b.y+=(dy/dist)*5;} else { b.x=cx; b.y=cy; if(!b.lastBreathInterval){ b.lastBreathInterval=setInterval(()=>{ b.lastBreathCount--; fxState.screenShake=6; if(b.lastBreathCount<=0){clearInterval(b.lastBreathInterval); fxState.hitStopFrames=12; fxState.screenShake=35; for(let j=0;j<24;j++){const a=(j/24)*Math.PI*2; enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*16,vy:Math.sin(a)*16,color:'#ff4400',isBerserkerSpike:true});} createExplosion(b.x,b.y,'#ff4400',80); spawnDebris(b.x,b.y,'#ff4400',8); hudState.score+=10000; const bi2=bosses.indexOf(b); if(bi2!==-1){bosses.splice(bi2,1); renderBossUI(); dropRevivePickup(b.x,b.y);} }},1000); } } return; }
            if(!b.enraged && enraged){ b.enraged=true; b.maxDashes=3; b.dashInterval=300; b.dashState='chase'; fxState.screenShake=10; floatingTexts.push({x:b.x,y:b.y-70,text:'⚠ FRENESÍ ⚠',life:2.0,color:'#ff4400'}); }
            if(b.hp<=0 && !b.lastBreath){ b.lastBreath=true; b.vx=0; b.vy=0; b.dashState='chase'; floatingTexts.push({x:b.x,y:b.y-60,text:'¡ÚLTIMO ALIENTO!',life:2.5,color:'#ff0000'}); fxState.screenShake=15; return; }
            if(b.dashState==='chase'){ const maxSpd=enraged?5.2:3.8; b.vx+=(nave.x-b.x)*0.022; b.vy+=(nave.y-b.y)*0.022; const spd=Math.hypot(b.vx,b.vy); if(spd>maxSpd){b.vx=(b.vx/spd)*maxSpd; b.vy=(b.vy/spd)*maxSpd;} b.x+=b.vx; b.y+=b.vy; b.x=Math.max(30,Math.min(canvas.width-30,b.x)); b.y=Math.max(30,Math.min(canvas.height*0.75,b.y)); const interval=enraged?1400:2400; if(now-b.lastDashTime>interval){b.vx=0;b.vy=0;b.dashCount=0;b.dashState='telegraph';b.dashTimer=now;}} else if(b.dashState==='telegraph'){ const telegraphDuration=enraged?300:500; if(now-b.dashTimer>telegraphDuration){ const ang=Math.atan2(nave.y-b.y,nave.x-b.x); const spd2=enraged?30:24; b.dashVx=Math.cos(ang)*spd2; b.dashVy=Math.sin(ang)*spd2; b.dashState='dashing'; b.dashTimer=now; }} else if(b.dashState==='dashing'){ b.x+=b.dashVx; b.y+=b.dashVy; if(b.x<20){b.x=20;b.dashVx=Math.abs(b.dashVx)*0.5;} if(b.x>canvas.width-20){b.x=canvas.width-20;b.dashVx=-Math.abs(b.dashVx)*0.5;} if(b.y<20){b.y=20;b.dashVy=Math.abs(b.dashVy)*0.5;} if(b.y>canvas.height-20){b.y=canvas.height-20;b.dashVy=-Math.abs(b.dashVy)*0.5;} b.dashVx*=0.95; b.dashVy*=0.95; const curSpd=Math.hypot(b.dashVx,b.dashVy); if(curSpd<1.5||now-b.dashTimer>1200){b.vx=0;b.vy=0;b.dashVx=0;b.dashVy=0;b.dashCount++; if(!enraged||b.dashCount>=b.maxDashes){b.dashState='exhausted'; b.dashTimer=now; b.lastDashTime=now; if(enraged) floatingTexts.push({x:b.x,y:b.y-50,text:'AGOTADO...',life:1.5,color:'#aaa'});} else {b.dashState='telegraph'; b.dashTimer=now;}}} else if(b.dashState==='exhausted'){ b.vx+=(nave.x-b.x)*0.002; b.vy+=(nave.y-b.y)*0.002; b.x+=b.vx*0.3; b.y+=b.vy*0.3; if(now-b.dashTimer>2500){b.vx=0;b.vy=0;b.dashState='chase'; b.lastDashTime=now;}}
            if(Math.hypot(b.x-nave.x,b.y-nave.y)<46) doPlayerHit(b.dashState==='dashing');
        } else {
            const enraged=b.hp<b.maxHp*0.3; if(!b.enraged && enraged){b.enraged=true; fxState.screenShake=8; floatingTexts.push({x:b.x,y:b.y-60,text:'⚠ PÁNICO ⚠',life:2.0,color:'#ff0000'});}
            let fireRate=b.type==='static'?(enraged?150:300):(enraged?200:400);
            if(!b.telegraphActive && (Date.now()-b.lastShot)>(fireRate-600)){ b.telegraphActive=true; setTimeout(()=>{b.telegraphActive=false;},600); }
            if(Date.now()-b.lastShot>fireRate){ let total=(8+(config.diff*2))*(enraged?1.5:1)|0; if(b.type==='static'||b.id==='B1'){for(let j=0;j<total;j++){const a=(fxState.frameCount/15)+(j*(Math.PI*2/total)); enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*4,vy:Math.sin(a)*4,color:enraged?'#ff6600':'#ff3366'});} } else if(b.type==='moving'||b.id==='B2'){let baseDir=Math.PI/2+Math.sin(fxState.frameCount/20)*0.8; for(let j=-2;j<=2;j++){const a=baseDir+(j*0.2); enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*5.5,vy:Math.sin(a)*5.5,color:enraged?'#ff6600':'#ffcc00'});} } b.lastShot=Date.now(); }
        }
        if(b.hp<=0 && b.type!=='berserker' && b.type!=='doppel'){ createExplosion(b.x,b.y,'#fff',50); spawnDebris(b.x,b.y,'#ff3366',5); fxState.hitStopFrames=8; dropRevivePickup(b.x,b.y); bosses.splice(i,1); hudState.score+=10000; renderBossUI(); }
    });

    bullets.forEach((bul,bi)=>{
        if(bul.isHoming){ bul.life=(bul.life!==undefined?bul.life:240)-1; let target=null,bestDist=Infinity; enemies.forEach(e=>{const d=Math.hypot(e.x-bul.x,e.y-bul.y); if(d<bestDist){bestDist=d; target=e;}}); bosses.forEach(bx=>{ if(!bx.immune){const d=Math.hypot(bx.x-bul.x,bx.y-bul.y); if(d<bestDist){bestDist=d; target=bx;}}}); if(target){const hAng=Math.atan2(target.y-bul.y,target.x-bul.x); bul.vx+=Math.cos(hAng)*0.7; bul.vy+=Math.sin(hAng)*0.7;} const hs=Math.hypot(bul.vx,bul.vy); if(hs>9){bul.vx=(bul.vx/hs)*9; bul.vy=(bul.vy/hs)*9;}}
        bul.x+=bul.vx; bul.y+=bul.vy; let hit=bul.isHoming && bul.life<=0;
        enemies.forEach((e,ei)=>{ if(!hit && Math.hypot(bul.x-e.x,bul.y-e.y)<25){ hit=true; if(e.shield){e.shield=false; e.vy*=1.5;} else { e.hp-=bul.dmg; if(e.hp<=0){ createExplosion(e.x,e.y); if(e.type==='elite') fxState.hitStopFrames=5; if(e.type==='elite'||e.type==='special') spawnDebris(e.x,e.y,e.type==='elite'?'#00ffcc':'#ffcc00'); enemies.splice(ei,1); if(e.type!=='life' && gameMode==='progressive'){progression.waveKills++; updateWaveProgress({gameMode:{value:gameMode},progression,bosses});} hudState.comboCount++; hudState.comboMultiplier=hudState.comboCount>=10?3:hudState.comboCount>=5?2:1; if(hudState.comboResetTimer) clearTimeout(hudState.comboResetTimer); hudState.comboResetTimer=setTimeout(()=>{hudState.comboCount=0;hudState.comboMultiplier=1;updateComboDisplay();},2500); const pts=150*hudState.comboMultiplier; hudState.score+=pts; floatingTexts.push({x:e.x,y:e.y,text:hudState.comboMultiplier>1?`+${pts} x${hudState.comboMultiplier}!`:`+${pts}`,life:1.0,color:hudState.comboMultiplier>=3?'#ff3366':hudState.comboMultiplier===2?'#ffcc00':'#fff'}); updateComboDisplay(); if(e.type==='life'){ combatState.health=Math.min(100, combatState.health+combatState.damagePerHit); syncHud(); floatingTexts.push({x:e.x,y:e.y-20,text:`+${combatState.damagePerHit}% VIDA`,life:1.0,color:'#ff66cc'}); } if(e.type==='elite'&&Math.random()>0.4){ const letters=['S','L','R','D']; const wt=letters[Math.floor(Math.random()*4)]; weaponPowerUps.push({x:e.x,y:e.y,letter:wt,vy:1.5,life:600}); } if(Math.random()>0.95 && e.type!=='life') pickUps.push({x:e.x,y:e.y,type:'bomb'}); } } } });
        if(!hit){ for(let mi=enemyBullets.length-1; mi>=0; mi--){ const mb=enemyBullets[mi]; if(mb.isMissile && Math.hypot(bul.x-mb.x,bul.y-mb.y)<18){ createExplosion(mb.x,mb.y,'#ffff00',8); floatingTexts.push({x:mb.x,y:mb.y,text:'MISIL ✓',life:0.8,color:'#ffff00'}); enemyBullets.splice(mi,1); hit=true; break; } } }
        bosses.forEach((b,bIdx)=>{ const bRadius=b.type==='doppel'?30:(b.type==='berserker'?44:(b.type==='doppel_y'||b.type==='doppel_o'?28:45)); if(!hit && Math.hypot(bul.x-b.x,bul.y-b.y)<bRadius){ if(b.immune){ createExplosion(bul.x,bul.y,b.type==='berserker'?'#ff4400':'#ffff00',3); hit=true; } else if(b.type==='doppel'&&b.parryActive){ createExplosion(bul.x,bul.y,'#00ffcc',5); hit=true; } else { hit=true; b.hp-=bul.dmg; updateBossHP(b); floatingTexts.push({x:b.x+(Math.random()-0.5)*40,y:b.y-20+(Math.random()-0.5)*20,text:`-${bul.dmg}`,life:1.0,color:'#ff3366'}); if(b.hp<=0 && (b.type==='doppel_y'||b.type==='doppel_o')){ const col=b.type==='doppel_y'?'#ffff00':'#ff6600'; createExplosion(b.x,b.y,col,50); spawnDebris(b.x,b.y,col,6); fxState.hitStopFrames=8; fxState.screenShake=20; hudState.score+=8000; floatingTexts.push({x:b.x,y:b.y-50,text:b.type==='doppel_y'?'★ DOPPEL AMARILLO DESTRUIDO ★':'★ DOPPEL NARANJA DESTRUIDO ★',life:2.0,color:col}); bosses.splice(bIdx,1); renderBossUI(); dropRevivePickup(b.x,b.y); } } } });
        if(hit || bul.y<0 || bul.y>canvas.height || bul.x<0 || bul.x>canvas.width) bullets.splice(bi,1);
    });
    for(let ei=enemyBullets.length-1; ei>=0; ei--){
        let eb=enemyBullets[ei];
        if(eb.isMissile){ eb.life=(eb.life||420)-1; if(eb.life<=0){enemyBullets.splice(ei,1); continue;} const mAng=Math.atan2(nave.y-eb.y,nave.x-eb.x); eb.vx+=Math.cos(mAng)*0.35; eb.vy+=Math.sin(mAng)*0.35; const ms=Math.hypot(eb.vx,eb.vy); if(ms>10){eb.vx=(eb.vx/ms)*10; eb.vy=(eb.vy/ms)*10; } }
        eb.x+=eb.vx; eb.y+=eb.vy; let destroyed=false;
        if(parryActive && Math.hypot(eb.x-nave.x,eb.y-nave.y)<45){ createExplosion(eb.x,eb.y,'#00ffcc',5); hudState.score+=50; enemyBullets.splice(ei,1); destroyed=true; }
        if(!destroyed && Math.hypot(eb.x-nave.x,eb.y-nave.y)<12){ doPlayerHit(); enemyBullets.splice(ei,1); destroyed=true; }
        if(!destroyed && (eb.y>canvas.height||eb.x<0||eb.x>canvas.width||eb.y<-50)) enemyBullets.splice(ei,1);
    }
    pickUps.forEach((p,i)=>{ p.y+=2; if(Math.hypot(p.x-nave.x,p.y-nave.y)<30){ if(p.type==='bomb'){ combatState.bombs++; } else if(p.type==='revive'){ combatState.hasRevive=true; sfx.powerup(); floatingTexts.push({x:p.x,y:p.y-20,text:'✨ 2ª OPORTUNIDAD LISTA',life:1.4,color:'#ffee88'}); } syncHud(); pickUps.splice(i,1); } });
    floatingTexts.forEach((ft,i)=>{ ft.y-=1; ft.life-=0.02; if(ft.life<=0) floatingTexts.splice(i,1); });
    syncHud();
}

// --- DRAW ---
let lastDrawTime=0; const fpsInterval=1000/60;
function draw(currentTime){
    requestAnimationFrame(draw);
    if(!currentTime) currentTime=performance.now();
    const deltaTime=currentTime-lastDrawTime;
    if(deltaTime<fpsInterval) return;
    lastDrawTime=currentTime-(deltaTime%fpsInterval);
    ctx.save();
    if(fxState.screenShake>0){ ctx.translate((Math.random()-0.5)*fxState.screenShake,(Math.random()-0.5)*fxState.screenShake); fxState.screenShake*=0.9; if(fxState.screenShake<0.5) fxState.screenShake=0; }
    ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
    drawParallax(ctx, canvas, gameState);
    if(gameState==='PLAYING'||gameState==='PAUSED'||gameState==='CONTINUE'||gameState==='WIN'){
        pickUps.forEach(p=>{
            if(p.type==='revive'){ const pulse=0.75+Math.sin(fxState.frameCount*0.15)*0.25; ctx.save(); ctx.globalAlpha=pulse; ctx.shadowBlur=16; ctx.shadowColor='#ffee88'; ctx.fillStyle='#ffee88'; ctx.beginPath(); ctx.arc(p.x,p.y,12,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; ctx.shadowBlur=0; ctx.fillStyle='#000'; ctx.font='bold 13px Orbitron'; ctx.fillText('✨',p.x-7,p.y+5); ctx.restore(); }
            else { ctx.fillStyle='#ffcc00'; ctx.beginPath(); ctx.arc(p.x,p.y,10,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#000'; ctx.fillText('B',p.x-4,p.y+4); }
        });
        enemies.forEach(e=>{
            ctx.fillStyle=e.type==='elite'?'#00ffcc':(e.shield?'#ffcc00':(e.type==='life'?'#ff66cc':(e.type==='kamikaze'?'#ff6600':'#ff3366')));
            if(e.type==='elite'){ ctx.beginPath(); ctx.moveTo(e.x,e.y+15); ctx.lineTo(e.x-15,e.y-10); ctx.lineTo(e.x+15,e.y-10); ctx.fill(); }
            else if(e.type==='kamikaze'){ const ang=Math.atan2(e.vy,e.vx); ctx.save(); ctx.translate(e.x,e.y); ctx.rotate(ang); ctx.shadowBlur=10; ctx.shadowColor='#ff6600'; ctx.beginPath(); ctx.moveTo(16,0); ctx.lineTo(-10,-10); ctx.lineTo(-5,0); ctx.lineTo(-10,10); ctx.fill(); ctx.shadowBlur=0; ctx.restore(); }
            else { ctx.fillRect(e.x-12,e.y-12,24,24); if(e.shield){ctx.strokeStyle='#fff'; ctx.strokeRect(e.x-15,e.y-15,30,30);} }
        });
        bosses.forEach(b=>{
            const enraged=b.type==='doppel_y'||b.type==='doppel_o'?b.enraged:(b.hp<b.maxHp*0.3);
            const bossColor=enraged?'#ff6600':'#ff3366'; const bossGlow=enraged?'#ff6600':'#ff3366'; const enragePulse=enraged?(0.8+Math.sin(fxState.frameCount*0.25)*0.2):1;
            if(b.telegraphActive && b.type!=='doppel_y' && b.type!=='doppel_o'){ ctx.globalAlpha=0.25+Math.sin(Date.now()/60)*0.15; ctx.fillStyle='#ff0000'; ctx.beginPath(); ctx.arc(b.x,b.y,b.type==='doppel'?50:70,0,Math.PI*2); ctx.fill(); if(b.type==='static'||b.id==='B1'){ ctx.strokeStyle='rgba(255,0,0,0.4)'; ctx.lineWidth=1; const total=8+(config.diff*2); for(let j=0;j<total;j++){const a=(fxState.frameCount/15)+(j*(Math.PI*2/total)); ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.x+Math.cos(a)*canvas.width,b.y+Math.sin(a)*canvas.width); ctx.stroke();}} ctx.globalAlpha=1; }
            if(b.type==='doppel'){ const spinning=b.immune && b.transformPhase==='spinning'; const angle=spinning?(b.spinAngle||0):Math.atan2(nave.y-b.y,nave.x-b.x); ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(angle); if(b.parryActive){ctx.strokeStyle='#00ffcc'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(0,0,35,0,Math.PI*2); ctx.stroke();} const dColor=b.immune?(fxState.frameCount%6<3?'#ffffff':'#ffff00'):'#ff0044'; ctx.fillStyle=dColor; ctx.shadowBlur=b.immune?30:15; ctx.shadowColor=dColor; ctx.beginPath(); ctx.moveTo(20,0); ctx.lineTo(-15,-15); ctx.lineTo(-15,15); ctx.fill(); ctx.restore(); if(spinning){ctx.save(); ctx.translate(b.x,b.y); ctx.strokeStyle=fxState.frameCount%6<3?'#ffffff':'#ffff00'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,38+Math.sin(fxState.frameCount*0.3)*8,0,Math.PI*2); ctx.stroke(); ctx.restore();} }
            else if(b.type==='doppel_y'){ const angle=Math.atan2(nave.y-b.y,nave.x-b.x); ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(angle); const yEnrage=b.enraged; const yPulse=yEnrage?(0.85+Math.sin(fxState.frameCount*0.25)*0.15):1; ctx.shadowBlur=yEnrage?30:15; ctx.shadowColor=yEnrage?'#ffff00':'#ffcc00'; ctx.globalAlpha=yPulse; ctx.fillStyle='#ff2200'; ctx.beginPath(); ctx.moveTo(22,0); ctx.lineTo(-14,-20); ctx.lineTo(-14,20); ctx.fill(); ctx.fillStyle=yEnrage?'#ffffff':'#ffee00'; ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(-8,-13); ctx.lineTo(-8,13); ctx.fill(); ctx.globalAlpha=1; ctx.shadowBlur=0; ctx.restore(); }
            else if(b.type==='doppel_o'){ const isTelegraph=b.dashState==='telegraph'; const isDashing=b.dashState==='dashing'; const goingCenter=b.dashState==='toCenter'||b.dashState==='centerExploding'; const angle=isDashing?Math.atan2(b.dashVy,b.dashVx):Math.atan2(nave.y-b.y,nave.x-b.x); ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(angle); if(isTelegraph){ctx.strokeStyle='rgba(255,100,0,0.5)'; ctx.lineWidth=1.5; ctx.setLineDash([5,4]); const global={x:nave.x-b.x,y:nave.y-b.y}; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(global.x,global.y); ctx.stroke(); ctx.setLineDash([]);} ctx.shadowBlur=isDashing?35:(b.enraged?25:15); ctx.shadowColor=isDashing?'#fff':'#ff6600'; ctx.fillStyle='#ff2200'; ctx.beginPath(); ctx.moveTo(22,0); ctx.lineTo(-14,-20); ctx.lineTo(-14,20); ctx.fill(); ctx.fillStyle=isDashing?'#ffffff':(b.enraged?'#ff8800':'#ff7700'); ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(-8,-13); ctx.lineTo(-8,13); ctx.fill(); ctx.shadowBlur=0; ctx.restore(); if(goingCenter && b.lastBreathCount>0){const p=0.5+Math.abs(Math.sin(fxState.frameCount*0.3))*0.5; ctx.globalAlpha=p; ctx.textAlign='center'; ctx.font=`bold ${36+p*8}px Orbitron`; ctx.fillStyle='#ff4400'; ctx.shadowBlur=15; ctx.shadowColor='#ff4400'; ctx.fillText(`${b.lastBreathCount}...`,b.x,b.y-50); ctx.shadowBlur=0; ctx.globalAlpha=1; ctx.textAlign='left';}}
            else if(b.type==='berserker'){
                const enraged=b.hp<b.maxHp*0.3; const isLastBreath=b.lastBreath; const isExhausted=b.dashState==='exhausted'; const isDashing=b.dashState==='dashing'; const isTelegraph=b.dashState==='telegraph';
                if(isTelegraph){ctx.save(); ctx.globalAlpha=0.4+Math.sin(Date.now()/40)*0.3; ctx.strokeStyle='#ff0000'; ctx.lineWidth=1.5; ctx.setLineDash([6,4]); ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(nave.x,nave.y); ctx.stroke(); ctx.setLineDash([]); ctx.restore();}
                const lbPulse=isLastBreath?(fxState.frameCount%6<3?'#ffffff':'#ff0000'):null; const baseColor=isLastBreath?lbPulse:enraged?`hsl(${10+Math.sin(fxState.frameCount*0.2)*10}, 100%, ${50+Math.sin(fxState.frameCount*0.3)*10}%)`:isExhausted?'#888':isDashing?'#ffffff':'#cc3300'; const glowColor=isLastBreath?'#ff0000':enraged?'#ff4400':isDashing?'#fff':'#cc3300'; const glowBlur=isDashing?30:enraged?25:15;
                ctx.save(); ctx.translate(b.x,b.y); const rotAng=Math.hypot(b.vx||b.dashVx,b.vy||b.dashVy)>0.5?Math.atan2(b.dashVy||b.vy,b.dashVx||b.vx):Math.atan2(nave.y-b.y,nave.x-b.x); ctx.rotate(rotAng); ctx.shadowBlur=glowBlur; ctx.shadowColor=glowColor; ctx.fillStyle=baseColor; const spikeCount=enraged?10:8; const outerR=enraged?50:44; const innerR=enraged?16:18; ctx.beginPath(); for(let s=0;s<spikeCount*2;s++){const a=(s/(spikeCount*2))*Math.PI*2; const r=s%2===0?outerR:innerR; s===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);} ctx.closePath(); ctx.fill(); ctx.shadowBlur=8; ctx.fillStyle=isLastBreath?lbPulse:(enraged?'#ff8800':'#ff5500'); ctx.beginPath(); ctx.arc(0,0,innerR*0.7,0,Math.PI*2); ctx.fill(); if(isExhausted){ctx.globalAlpha=0.25; ctx.fillStyle='#aaaaaa'; ctx.beginPath(); ctx.arc(0,0,outerR+10,0,Math.PI*2); ctx.fill();} ctx.globalAlpha=1; ctx.shadowBlur=0; ctx.restore();
                if(isLastBreath && b.lastBreathCount>0){const pulse=0.5+Math.abs(Math.sin(fxState.frameCount*0.3))*0.5; ctx.globalAlpha=pulse; ctx.textAlign='center'; ctx.font=`bold ${40+pulse*10}px Orbitron`; ctx.fillStyle='#ff0000'; ctx.shadowBlur=20; ctx.shadowColor='#ff0000'; ctx.fillText(`${b.lastBreathCount}...`,b.x,b.y-55); ctx.shadowBlur=0; ctx.globalAlpha=1; ctx.textAlign='left';}
            } else if(b.type==='hunter'){ const ang=Math.atan2(nave.y-b.y,nave.x-b.x); ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(ang); ctx.shadowBlur=enraged?35*enragePulse:20; ctx.shadowColor=enraged?'#ff00ff':'#cc00ff'; ctx.fillStyle=enraged?'#ff00ff':'#cc00ff'; ctx.globalAlpha=enragePulse; ctx.beginPath(); ctx.moveTo(28,0); ctx.lineTo(-10,-18); ctx.lineTo(-20,0); ctx.lineTo(-10,18); ctx.fill(); ctx.fillStyle=enraged?'#ffff00':'#aa66ff'; ctx.globalAlpha=0.7; ctx.beginPath(); ctx.arc(-22,0,6+Math.sin(fxState.frameCount*0.3)*2,0,Math.PI*2); ctx.fill(); if(enraged){ctx.fillStyle='#ff6600'; ctx.globalAlpha=0.8; ctx.beginPath(); ctx.arc(-12,-12,4+Math.sin(fxState.frameCount*0.4)*2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(-12,12,4+Math.sin(fxState.frameCount*0.4+1)*2,0,Math.PI*2); ctx.fill();} ctx.globalAlpha=1; ctx.shadowBlur=0; ctx.restore(); }
            else { ctx.shadowBlur=enraged?30*enragePulse:20; ctx.shadowColor=bossGlow; ctx.fillStyle=bossColor; ctx.globalAlpha=enragePulse; ctx.beginPath(); ctx.arc(b.x,b.y,45,0,Math.PI*2); ctx.fill(); if(enraged){ctx.fillStyle='#ffff00'; ctx.globalAlpha=0.7; for(let j=0;j<3;j++){const ja=(fxState.frameCount*0.15)+j*(Math.PI*2/3); ctx.beginPath(); ctx.arc(b.x+Math.cos(ja)*30,b.y+Math.sin(ja)*30,6+Math.sin(fxState.frameCount*0.3+j)*3,0,Math.PI*2); ctx.fill();}} ctx.globalAlpha=1; ctx.shadowBlur=0; }
        });
        enemyBullets.forEach(eb=>{
            if(eb.isMissile){ const mAng=Math.atan2(eb.vy,eb.vx); ctx.save(); ctx.translate(eb.x,eb.y); ctx.rotate(mAng); ctx.shadowBlur=14; ctx.shadowColor='#ffff00'; ctx.fillStyle='#ff2200'; ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(-8,-7); ctx.lineTo(-8,7); ctx.closePath(); ctx.fill(); ctx.fillStyle='#ffee00'; ctx.beginPath(); ctx.moveTo(7,0); ctx.lineTo(-4,-4); ctx.lineTo(-4,4); ctx.closePath(); ctx.fill(); ctx.globalAlpha=0.4; ctx.fillStyle='#ff6600'; ctx.beginPath(); ctx.arc(-10,0,5,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0; ctx.globalAlpha=1; ctx.restore(); }
            else if(eb.isLaser){ const ang=Math.atan2(eb.vy,eb.vx); ctx.save(); ctx.translate(eb.x,eb.y); ctx.rotate(ang); ctx.shadowBlur=10; ctx.shadowColor='#ff00ff'; ctx.fillStyle='#ff00ff'; ctx.globalAlpha=0.9; ctx.fillRect(-10,-3,20,6); ctx.fillStyle='#fff'; ctx.fillRect(-6,-1,12,2); ctx.globalAlpha=1; ctx.shadowBlur=0; ctx.restore(); }
            else if(eb.isBerserkerSpike){ const ang=Math.atan2(eb.vy,eb.vx); ctx.save(); ctx.translate(eb.x,eb.y); ctx.rotate(ang); ctx.shadowBlur=12; ctx.shadowColor='#ff4400'; ctx.fillStyle='#ff4400'; ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(0,-5); ctx.lineTo(-10,0); ctx.lineTo(0,5); ctx.closePath(); ctx.fill(); ctx.fillStyle='#ffaa00'; ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(0,-3); ctx.lineTo(-6,0); ctx.lineTo(0,3); ctx.closePath(); ctx.fill(); ctx.shadowBlur=0; ctx.restore(); }
            else { ctx.fillStyle=eb.color; ctx.beginPath(); ctx.arc(eb.x,eb.y,5,0,Math.PI*2); ctx.fill(); }
        });
        bullets.forEach(b=>{ ctx.fillStyle=b.color; if(b.isHoming){ctx.save(); ctx.shadowBlur=12; ctx.shadowColor=b.color; ctx.fillRect(b.x-4,b.y-16,8,32); ctx.restore();} else if(b.isDrone){ctx.fillRect(b.x-1.5,b.y-7,3,14);} else {ctx.fillRect(b.x-2,b.y-10,4,20);} });
        droneState.drones.forEach(d=>{ ctx.save(); ctx.shadowBlur=10; ctx.shadowColor='#ffffff'; ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(d.x,d.y,5,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=1; ctx.shadowBlur=0; ctx.beginPath(); ctx.moveTo(d.x,d.y); ctx.lineTo(nave.x,nave.y); ctx.stroke(); ctx.restore(); });
        if(weaponState.current==='laser' && input.shoot){ const ang=Math.atan2(input.aimY-nave.y,input.aimX-nave.x); const endX=nave.x+Math.cos(ang)*canvas.width*2; const endY=nave.y+Math.sin(ang)*canvas.width*2; ctx.save(); ctx.globalAlpha=0.18+Math.sin(fxState.frameCount*0.4)*0.07; ctx.strokeStyle='#00ccff'; ctx.lineWidth=18; ctx.shadowBlur=20; ctx.shadowColor='#00ccff'; ctx.beginPath(); ctx.moveTo(nave.x,nave.y); ctx.lineTo(endX,endY); ctx.stroke(); ctx.globalAlpha=0.85; ctx.strokeStyle='#ffffff'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(nave.x,nave.y); ctx.lineTo(endX,endY); ctx.stroke(); ctx.shadowBlur=0; ctx.globalAlpha=1; ctx.restore(); }
        weaponPowerUps.forEach(wp=>{ const pulse=0.7+Math.sin(fxState.frameCount*0.12)*0.3; ctx.globalAlpha=pulse; const boxColor=wp.letter==='R'?'#00ffaa':wp.letter==='D'?'#66ccff':'#ff9900'; ctx.fillStyle=boxColor; ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.fillRect(wp.x-14,wp.y-14,28,28); ctx.strokeRect(wp.x-14,wp.y-14,28,28); ctx.fillStyle='#fff'; ctx.font='bold 16px Orbitron'; ctx.fillText(wp.letter,wp.x-6,wp.y+6); ctx.globalAlpha=1; });
        debrisChunks.forEach(d=>{ ctx.save(); ctx.globalAlpha=d.life; ctx.translate(d.x,d.y); ctx.rotate(d.rot); ctx.fillStyle=d.color; ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(d.pts[0][0],d.pts[0][1]); d.pts.forEach(p=>ctx.lineTo(p[0],p[1])); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); });
        shipTrail.forEach(g=>{ ctx.save(); ctx.globalAlpha=g.life*0.3; ctx.translate(g.x,g.y); ctx.rotate(g.angle); ctx.shadowBlur=10; ctx.shadowColor=g.color; ctx.fillStyle=g.color; ctx.beginPath(); ctx.moveTo(20,0); ctx.lineTo(-15,-15); ctx.lineTo(-15,15); ctx.fill(); ctx.restore(); }); ctx.globalAlpha=1;
        if(!nave.inmune || fxState.frameCount%10<5){
            if(parryActive){ctx.strokeStyle='#00ffcc'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(nave.x,nave.y,35,0,Math.PI*2); ctx.stroke();}
            const angle=Math.atan2(input.aimY-nave.y,input.aimX-nave.x);
            ctx.save(); ctx.translate(nave.x,nave.y); ctx.rotate(angle); ctx.shadowBlur=15; ctx.shadowColor=nave.color; ctx.fillStyle=nave.color; ctx.beginPath(); ctx.moveTo(20,0); ctx.lineTo(-15,-15); ctx.lineTo(-15,15); ctx.fill(); ctx.restore();
            if(parryCooldown && parryTimer>0){ let ratio=1-(parryTimer/2000); ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(nave.x-20,nave.y+25,40,4); ctx.fillStyle='#00ffcc'; ctx.fillRect(nave.x-20,nave.y+25,40*ratio,4); }
        }
        ctx.strokeStyle='rgba(255,0,0,0.5)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(input.aimX,input.aimY,10,0,Math.PI*2); ctx.moveTo(input.aimX-15,input.aimY); ctx.lineTo(input.aimX+15,input.aimY); ctx.moveTo(input.aimX,input.aimY-15); ctx.lineTo(input.aimX,input.aimY+15); ctx.stroke();
        particles.forEach((p,i)=>{ if(p.type==='bomb_ring'){ctx.strokeStyle=p.color; ctx.globalAlpha=p.life; ctx.lineWidth=10; ctx.beginPath(); ctx.arc(p.x,p.y,(1-p.life)*1500,0,Math.PI*2); ctx.stroke();} else {ctx.globalAlpha=p.life; ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,3,3);} p.life-=0.02; if(p.life<=0) particles.splice(i,1); }); ctx.globalAlpha=1;
        floatingTexts.forEach(ft=>{ ctx.globalAlpha=Math.max(0,ft.life); ctx.fillStyle=ft.color; ctx.font="bold 16px Orbitron"; ctx.fillText(ft.text,ft.x-25,ft.y-15); }); ctx.globalAlpha=1;
        if(combatState.health>0 && combatState.health<=combatState.damagePerHit && gameState==='PLAYING'){ const pulse=0.32+Math.sin(fxState.frameCount*0.12)*0.18; const grad=ctx.createRadialGradient(canvas.width/2,canvas.height/2,canvas.height*0.32,canvas.width/2,canvas.height/2,canvas.height*0.78); grad.addColorStop(0,'rgba(255,0,0,0)'); grad.addColorStop(1,`rgba(255,0,30,${pulse})`); ctx.fillStyle=grad; ctx.fillRect(0,0,canvas.width,canvas.height); for(let s=0;s<22;s++){const sx=Math.random()*canvas.width,sy=Math.random()*canvas.height; ctx.globalAlpha=Math.random()*0.35; ctx.fillStyle=Math.random()>0.5?'#ffffff':'#ff2222'; ctx.fillRect(sx,sy,Math.random()*2+1,Math.random()*2+1);} ctx.globalAlpha=1; }
        if(progression.waveTransition && progression.waveTransitionMsg){ const progress=1-(progression.waveTransitionTimer/150); const alpha=progress<0.2?progress/0.2:progress>0.8?(1-progress)/0.2:1; ctx.globalAlpha=alpha*0.85; ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.globalAlpha=alpha; ctx.textAlign='center'; ctx.font='bold 14px Orbitron'; ctx.fillStyle='#666'; ctx.fillText('— PREPARATE —',canvas.width/2,canvas.height/2-50); ctx.font='bold 40px Orbitron'; const grad=ctx.createLinearGradient(canvas.width/2-200,0,canvas.width/2+200,0); grad.addColorStop(0,'#ff3366'); grad.addColorStop(0.5,'#fff'); grad.addColorStop(1,'#1e90ff'); ctx.fillStyle=grad; ctx.shadowBlur=20; ctx.shadowColor='#fff'; ctx.fillText(progression.waveTransitionMsg,canvas.width/2,canvas.height/2+10); ctx.shadowBlur=0; ctx.font='13px Orbitron'; ctx.fillStyle='#aaa'; const waveLabel=['SECTOR 1','BOSS 1','SECTOR 2','BOSS 2','SECTOR 3','BOSS 3','SECTOR 4','JEFE FINAL','FIN'][progression.wavePhase-1]||''; ctx.fillText(`SIGUIENTE: ${waveLabel}`,canvas.width/2,canvas.height/2+55); ctx.globalAlpha=1; ctx.textAlign='left'; if(progression.waveTransitionTimer>0) progression.waveTransitionTimer--; }
        if(nave.inmune && !dashActive){ const pulse=Math.abs(Math.sin(fxState.frameCount*0.18)); const vGrad=ctx.createRadialGradient(canvas.width/2,canvas.height/2,canvas.height*0.3,canvas.width/2,canvas.height/2,canvas.height*0.85); vGrad.addColorStop(0,'rgba(255,0,0,0)'); vGrad.addColorStop(1,`rgba(255,0,0,${0.35*pulse})`); ctx.fillStyle=vGrad; ctx.fillRect(0,0,canvas.width,canvas.height); }
    }
    ctx.restore(); update();
}

initParallax(canvas);
applyOptions(); updateVolumeVisibility();
requestAnimationFrame(draw);
