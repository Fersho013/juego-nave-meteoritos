// js/Main.js — Inicialización y GameLoop

import { config } from './Core/Config.js';
import { initAudio, toggleVolume, sfx } from './Core/Audio.js';
import { platform, toggleTouchUI, setTouchMove, setRightJoyActive, setUsingGamepad, toggleDeviceMode, bindResize } from './State.js';
import { nave, changeNaveColor as changeColor } from './entities/Player.js';
import { enemies, spawnEnemy, spawnFormation } from './entities/Enemy.js';
import { bosses, createBoss, renderBossUI, updateBossHP } from './entities/Boss.js';
import { bullets, enemyBullets, pickUps, weaponPowerUps, weaponState, homingState, droneState } from './entities/Projectile.js';
import * as EffectsNS from './system/Effects.js';
import { particles, debrisChunks, floatingTexts, shipTrail, fxState, createExplosion, spawnDebris } from './system/Effects.js';
// Si el navegador tiene cacheada una versión anterior de Effects.js (GitHub Pages
// cachea 10 min), las funciones nuevas no existirían y el módulo fallaría al
// importar. Se accede por namespace y se cae a equivalentes locales.
const MAX_PARTICLES = EffectsNS.MAX_PARTICLES || 400;
const pushParticle = EffectsNS.pushParticle || ((p) => { if (particles.length < MAX_PARTICLES) { particles.push(p); return true; } return false; });
const setParticleBudget = EffectsNS.setParticleBudget || (() => {});
const getParticleBudget = EffectsNS.getParticleBudget || (() => MAX_PARTICLES);
const clearParticles = EffectsNS.clearParticles || (() => { particles.length = 0; });
const updateBlasts = EffectsNS.updateBlasts || (() => {});
const drawBlasts = EffectsNS.drawBlasts || (() => {});
const clearBlasts = EffectsNS.clearBlasts || (() => {});
const updateParticles = EffectsNS.updateParticles || (() => {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= 0.02;
        if (p.type !== 'bomb_ring') { p.x += p.vx || 0; p.y += p.vy || 0; }
        if (p.life <= 0) { const last = particles.length - 1; if (i !== last) particles[i] = particles[last]; particles.length = last; }
    }
});
const drawParticles = EffectsNS.drawParticles || ((c) => {
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        c.globalAlpha = p.life;
        if (p.type === 'bomb_ring') {
            c.strokeStyle = p.color; c.lineWidth = 10;
            c.beginPath(); c.arc(p.x, p.y, (1 - p.life) * 1500, 0, Math.PI * 2); c.stroke();
        } else { c.fillStyle = p.color; c.fillRect(p.x, p.y, 3, 3); }
    }
    c.globalAlpha = 1;
});
import { drawGlow } from './system/Sprites.js';
import { combatState, awardCredits, dropRevivePickup, playerHit as combatPlayerHit, triggerBomb as combatTriggerBomb, triggerRevive } from './system/Combat.js';
import { progression, checkProgression, cancelWaveTransition, startWaveTransition } from './system/Progression.js';
import { loadPlayerSave, savePlayerState, clearPlayerSave } from './system/Save.js';
import { hudState, updateHUD as hudUpdate, updateWaveProgress, resetCombo, registerComboHit, registerComboHits } from './ui/Hud.js';
// Namespace + fallback: si GitHub Pages sirve un Hud.js antiguo (sin
// resetWaveProgressUI) el juego sigue arrancando igual.
import * as HudNS from './ui/Hud.js';
const resetWaveProgressUI = HudNS.resetWaveProgressUI || (() => {
    const wp = document.getElementById('wave-progress');
    if (wp) { wp.style.display = 'none'; wp.innerHTML = ''; }
    const ba = document.getElementById('bomb-alert');
    if (ba) { ba.style.display = 'none'; ba.textContent = ''; }
});
// Namespace + fallback: si GitHub Pages sirve un Menu.js antiguo (sin
// refreshPreview) el juego sigue arrancando igual.
import * as MenuNS from './ui/Menu.js';
const showScreen = MenuNS.showScreen;
const updateVolumeVisibility = MenuNS.updateVolumeVisibility;
const initPreview = MenuNS.initPreview;
const refreshPreview = MenuNS.refreshPreview || (() => {});
import { stars, nebulas, planets, superAsteroids, initParallax, drawParallax, drawSuperArena } from './world/Parallax.js';
import { drawPlanetAtmosphere, drawPlanetForeground } from './world/PlanetAtmosphere.js?v=20261102g';
import { world, resetCamera, centerCamera } from './world/Camera.js';
import { enterExploration, updateExploration, drawExploration, exploration, resetExplorationProgress, isPointExplored } from './world/Exploration.js';
import { hubState, initHub, updateHub, closeStationPanel } from './world/Hub.js';
import { initSystemMap, isSystemMapOpen, toggleSystemMap, closeSystemMap, drawSystemMapFrame } from './ui/StarMap.js?v=20261102g';
import { DASH } from './Data/Constants.js';
import { initLayoutEditor, enterEditMode, exitEditMode, isEditorActive, setEditorExitHandler } from './ui/LayoutEditor.js';
import { portals, spawnPortal, clearPortals, updatePortals, drawPortals } from './entities/Portal.js';
import { superBossState, spawnSuperBoss, clearSuperBoss, updateSuperBoss, drawSuperBoss, canDamageSuperBoss, damageSuperBoss, damageCannon, damageGate, hasSuperModifierActive, grantSuperModifier, clearSuperModifier } from './entities/SuperBoss.js';

// El guardado global antiguo solo se usa para migrar la primera vez. Si ya
// existen perfiles por modo, no debe resucitar datos borrados.
const hasModeProfiles = (() => {
    try { return Boolean(localStorage.getItem('space-mission-mode-profiles-v1')); } catch { return false; }
})();
const savedPlayerState = hasModeProfiles ? null : loadPlayerSave();
if (savedPlayerState) {
    Object.assign(combatState, savedPlayerState.combat);
    Object.assign(nave, savedPlayerState.ship);
    Object.assign(progression, savedPlayerState.progression);
}

// --- Canvas ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

// Math.hypot es ~6x más lento que sqrt(x*x+y*y): usamos len2/dist2 en los bucles calientes.
const dist2 = (x1, y1, x2, y2) => { const dx = x1 - x2, dy = y1 - y2; return Math.sqrt(dx * dx + dy * dy); };
const len2 = (x, y) => Math.sqrt(x * x + y * y);

// Viñetas pre-renderizadas a un canvas: antes se rellenaba la pantalla con un
// degradado radial cada frame; ahora es un drawImage con globalAlpha.
let vignetteKey = '', dangerVignette = null, immuneVignette = null;
// Degradado del rótulo de oleada: también cacheado (se creaba cada frame).
let waveGradKey = '', waveGrad = null;
function waveGradient() {
    const key = canvas.width + 'x' + canvas.height;
    if (key === waveGradKey) return waveGrad;
    waveGradKey = key;
    waveGrad = ctx.createLinearGradient(canvas.width/2-200, 0, canvas.width/2+200, 0);
    waveGrad.addColorStop(0, '#ff3366');
    waveGrad.addColorStop(0.5, '#fff');
    waveGrad.addColorStop(1, '#1e90ff');
    return waveGrad;
}
function makeVignette(w, h, r0, r1, color) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(w/2, h/2, h*r0, w/2, h/2, h*r1);
    grad.addColorStop(0, 'rgba(255,0,0,0)');
    grad.addColorStop(1, color);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    return c;
}
function ensureVignettes() {
    const key = canvas.width + 'x' + canvas.height;
    if (key === vignetteKey) return;
    vignetteKey = key;
    dangerVignette = makeVignette(canvas.width, canvas.height, 0.32, 0.78, 'rgba(255,0,30,1)');
    immuneVignette = makeVignette(canvas.width, canvas.height, 0.3, 0.85, 'rgba(255,0,0,1)');
}

// Exponer para ui/Menu que consulta estado global
let gameState = 'MENU';
let gameMode = 'progressive';
let customSelection = [];
let pausedFrom = 'PLAYING'; // estado al que vuelve el menú de pausa
window.__getGameState = () => gameState;
window.__getGameMode = () => gameMode;

// --- Fase 1: nave en órbita del menú + transición de lanzamiento ---
// En MENU la nave orbita el centro del canvas; al pulsar Jugar se desactiva
// la órbita, la nave vuela al punto de salida (centro-abajo) y solo entonces
// arranca la partida. Así el menú deja de ser una pantalla muerta.
const MENU_ORBIT_SPEED = 0.55;      // rad/s
const MENU_ORBIT_RADIUS_X = 0.38;   // fracción del ancho del canvas
const MENU_ORBIT_RADIUS_Y = 0.36;   // fracción del alto del canvas
const MENU_ORBIT_CY = 0.50;         // centro vertical de la órbita
const LAUNCH_DURATION = 0.8;        // segundos de la transición
const menuIdle = {
    angle: -Math.PI / 2,
    rot: -Math.PI / 2,
    time: 0,
    launching: false,
    launchT: 0,
    pendingMode: null,
    pendingFresh: false,
    pendingHard: false,
    startX: 0, startY: 0, startRot: -Math.PI / 2,
    scale: 1
};

// Globals equivalentes al original
let parryActive = false, parryCooldown = false;
let parryTimer = 0;
let dashActive = false, dashCooldown = false;
let dashHitSet = new Set();
// Estado real del ratón, independiente del mando (evita que un gamepad inactivo lo pise).
let mouseShootHeld = false, mouseTripleHeld = false;
// Botones one-shot del mando: solo se liberan si los activó el propio mando.
let padBombHeld = false, padParryHeld = false, padDashHeld = false;

// Inmunidad con token: un timer viejo (2 s) no debe anular una inmunidad más
// larga (revive/continue = 3 s). El token vive en `nave` para compartirlo con
// Combat.js sin exportar nada nuevo (tolera caché mixta de GitHub Pages).
function grantImmunity(ms) {
    const token = (nave.__immToken || 0) + 1;
    nave.__immToken = token;
    nave.inmune = true;
    setTimeout(() => { if (nave.__immToken === token) nave.inmune = false; }, ms);
}
function clearImmunity() {
    nave.__immToken = (nave.__immToken || 0) + 1;
    nave.inmune = false;
}

// Compat wrappers para que Menu pueda consultar visibilidad
window.toggleVolume = toggleVolume;
window.changeNaveColor = (c) => { changeColor(c); refreshPreview(); };
window.showScreen = (id) => { showScreen(id); if (id === 'menu-play') refreshModeSlots(); };
window.toggleTouchUI = toggleTouchUI;
window.togglePause = togglePause;
window.toggleDeviceMode = () => {
    toggleDeviceMode(config, canvas);
    nave.x = canvas.width / 2; nave.y = canvas.height - 100;
};
window.applyOptions = applyOptions;
window.startMission = startMission;
window.restartCurrentMode = restartCurrentMode;
window.startExploration = startExploration;
window.startCustom = startCustom;
window.exitCustomScreen = () => {
    if (trainingSetup) {
        trainingSetup = false;
        gameState = 'EXPLORING';
        showScreen('none');
    } else showScreen('menu-main');
    const title = document.querySelector('#menu-custom h1');
    const start = document.getElementById('custom-start-button');
    if (title) title.textContent = 'MODO PERSONALIZADO';
    if (start) start.textContent = 'Iniciar Simulador';
};
window.openTrainingMode = () => {
    if (gameState !== 'EXPLORING') return;
    trainingSetup = true;
    closeStationPanel();
    gameState = 'TRAINING_SETUP';
    const title = document.querySelector('#menu-custom h1');
    const start = document.getElementById('custom-start-button');
    if (title) title.textContent = 'CÁMARA DE ENTRENAMIENTO';
    if (start) start.textContent = 'Iniciar entrenamiento';
    showScreen('menu-custom');
};
window.acceptContinue = acceptContinue;
window.continueCheckpoint = continueCheckpoint;
window.returnToHub = returnToHub;
window.returnToSpace = () => returnToHub(true);
window.exitToMenu = exitToMenu;
window.openLayoutEditor = () => {
    // Cierra el menú de pausa visualmente pero mantiene estado PAUSED
    document.querySelectorAll('.ui-screen').forEach(s => s.classList.remove('active'));
    updateVolumeVisibility();
    enterEditMode();
};
window.closeLayoutEditor = (save) => exitEditMode(save);

const input = { moveX: 0, moveY: 0, aimX: 400, aimY: 300, shoot: false, triple: false, bomb: false, parry: false, pause: false, dash: false, interact: false };
const keys = {};
initSystemMap(() => {
    const objects = [];
    const add = (item, type, color, label) => objects.push({ ...item, type, color, label });
    for (const event of exploration.proceduralEvents.values()) if (event?.discovered) add(event, 'procedural', '#cf8cff', `RETO · NIV ${1 + Math.round((event.difficulty || 0) * 9)}`);
    for (const zone of exploration.combatZones) if (zone.type !== 'procedural' && zone.discovered) add(zone, zone.type, zone.type === 'meteors' ? '#ffae62' : '#6ec8ff', zone.type === 'meteors' ? 'CINTURÓN' : 'PORTAL DE COMBATE');
    for (const belt of hubState.zones) if (belt.discovered) add(belt, 'belt', '#ff9966', belt.cleared ? 'CINTURÓN DESPEJADO' : 'CINTURÓN');
    return { planets: exploration.planets, cells: [...exploration.exploredCells], objects, stations: hubState.stations.filter(station => isPointExplored(station.x, station.y)), ship: { x: nave.x, y: nave.y } };
});
document.getElementById('btn-system-map')?.addEventListener('click', () => { if (gameState === 'EXPLORING') toggleSystemMap(); });
let startBtnPressed = false;
// getGamepads() se consulta cada 30 frames hasta detectar un mando (ahorra trabajo por frame).
let gamepadSeen = false, gamepadPoll = 0;

// --- Preview nave ---
initPreview();

// --- Audio volume visibility ---
function refreshVolumeVisibility() { updateVolumeVisibility(); }

// --- applyOptions con platform awareness ---
function applyOptions() {
    // Primero el modo (móvil/PC): de él depende el tamaño.
    const touchOpt = document.getElementById('opt-touch')?.value;
    if (touchOpt === 'force') platform.isMobile = true;
    else if (touchOpt === 'hide') platform.isMobile = false;
    else if (!platform.isForcedMobile) platform.isMobile = /Mobi|Android/i.test(navigator.userAgent);

    const sizeVal = document.getElementById('opt-size')?.value || '800x600';
    let w, h;
    if (sizeVal === 'auto' || platform.isForcedMobile || platform.isMobile) {
        w = window.innerWidth; h = window.innerHeight;
    } else {
        [w, h] = sizeVal.split('x').map(Number);
        // Si la resolución elegida no cabe en la ventana, se recortaría el
        // canvas y se perderían la nave y los joysticks: usar el área visible.
        if (w > window.innerWidth || h > window.innerHeight) { w = window.innerWidth; h = window.innerHeight; }
    }
    config.w = w; config.h = h;
    const prevW = canvas.width, prevH = canvas.height;
    canvas.width = config.w; canvas.height = config.h;
    const container = document.getElementById('game-container');
    if (container) { container.style.width = config.w + 'px'; container.style.height = config.h + 'px'; }
    if (prevW && prevH && (prevW !== canvas.width || prevH !== canvas.height)) rescaleBackground(prevW, prevH);

    nave.x = canvas.width / 2; nave.y = canvas.height - 100;
    showScreen('menu-main');
}

// Reajusta las estrellas al nuevo tamaño del canvas. Sin esto, al cambiar de
// resolución (o girar el móvil) el fondo solo cubriría el tamaño antiguo.
function rescaleBackground(prevW, prevH) {
    if (!prevW || !prevH) return;
    const sx = canvas.width / prevW, sy = canvas.height / prevH;
    if (sx === 1 && sy === 1) return;
    stars.forEach(s => { s.x *= sx; s.y *= sy; });
}

bindResize(config, canvas, nave, () => gameState, (prevW, prevH) => rescaleBackground(prevW, prevH));

function showScreenWrapper(id) { showScreen(id); }
function togglePause() {
    if (isEditorActive()) { exitEditMode(true); showScreen('menu-pause'); updateVolumeVisibility(); return; }
    if (gameState === 'EXPLORING' && hubState.panelOpen) { closeStationPanel(); return; }
    if (gameState === 'PLAYING' || gameState === 'EXPLORING') {
        pausedFrom = gameState;
        gameState = 'PAUSED';
        const retreat = document.getElementById('btn-return-space');
        if (retreat) retreat.style.display = pausedFrom === 'PLAYING' ? 'block' : 'none';
        showScreen('menu-pause');
    }
    else if (gameState === 'PAUSED') { gameState = pausedFrom || 'PLAYING'; showScreen('none'); }
    updateVolumeVisibility();
}
function setHudVisible(v) {
    ['hud-block-score','hud-block-sector','hud-block-vida'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = v ? 'block' : 'none';
    });
    if (!v) { const bc=document.getElementById('boss-container'); if(bc) bc.style.display='none'; }
}
// Limpia todos los procesos asíncronos asociados a un jefe (explosiones, transformación, último aliento).
function cleanupBossTimers(b) {
    if (!b) return;
    if (b.countInterval) { clearInterval(b.countInterval); b.countInterval = null; }
    if (b.centerTimer) { clearTimeout(b.centerTimer); b.centerTimer = null; }
    if (b.lastBreathInterval) { clearInterval(b.lastBreathInterval); b.lastBreathInterval = null; }
    if (b.transformTimeout) { clearTimeout(b.transformTimeout); b.transformTimeout = null; }
}
function cleanupAllBossTimers() { bosses.forEach(cleanupBossTimers); }

function exitToMenu() {
    saveActiveRunProfile();
    trainingRun = false;
    trainingSetup = false;
    exploreCheckpoint = null;
    closeSystemMap();
    if (planetShipSnapshot) { nave.accel = planetShipSnapshot.accel; nave.fric = planetShipSnapshot.fric; planetShipSnapshot = null; }
    activePlanet = null;
    document.getElementById('boss-checkpoint')?.style.setProperty('display', 'none');
    gameState = 'MENU';
    pausedFrom = 'PLAYING';
    closeStationPanel();
    if (HudNS.updateExplorationHUD) HudNS.updateExplorationHUD({ active: false });
    // Cancelar cualquier lanzamiento a medias y devolver el menú a su estado normal.
    menuIdle.launching = false;
    menuIdle.pendingMode = null;
    menuIdle.pendingFresh = false;
    menuIdle.pendingHard = false;
    menuIdle.scale = 1;
    document.querySelectorAll('.ui-screen.launch-fade').forEach(s => s.classList.remove('launch-fade'));
    cancelWaveTransition();
    setHudVisible(false);
    const mu = document.getElementById('mobile-ui'); if (mu) mu.style.display = 'none';
    cleanupAllBossTimers();
    resetCombo();
    bosses.length = 0; renderBossUI();
    clearPortals(); clearSuperBoss(); clearSuperModifier();
    progression.awaitingCheckpoint = false;
    progression.awaitingBossReward = false;
    progression.suspendedAdventure = false;
    progression.pendingBossRewardType = null;
    exploreCheckpoint = null;
    savePlayerState(combatState, nave, progression);
    // restaurar fondo normal al salir
    showScreen('menu-main');
    refreshModeSlots();
}
function promptContinue() {
    if (gameState !== 'PLAYING') return;
    gameState = 'CONTINUE';
    setHudVisible(false);
    const mu = document.getElementById('mobile-ui'); if (mu) mu.style.display = 'none';
    showScreen('menu-continue');
}
function acceptContinue() {
    if (gameState !== 'CONTINUE') return;
    initAudio(); combatState.health = 100; gameState = 'PLAYING'; showScreen('none');
    setHudVisible(true);
    renderBossUI();
    if (platform.isMobile && !platform.isTouchUIHidden) { const mu = document.getElementById('mobile-ui'); if (mu) mu.style.display = 'block'; }
    enemyBullets.length = 0; grantImmunity(3000); syncHud(true);
}
function winGame() {
    if (trainingRun) {
        trainingRun = false;
        trainingSetup = false;
        exploration.statusMessage = 'ENTRENAMIENTO COMPLETADO · VOLVIENDO A AEGIS PRIME';
        exploration.statusMessageTimer = 4;
        gameState = 'CHECKPOINT';
        returnToHub();
        return;
    }
    saveActiveRunProfile();
    gameState = 'WIN';
    setHudVisible(false);
    const mu = document.getElementById('mobile-ui'); if (mu) mu.style.display = 'none';
    showScreen('menu-win');
}

let exploreCheckpoint = null;
let transitionBusy = false;
let proceduralRun = null;
let pendingFreeBossTypes = [];
let freeBossCombat = null;
let freeBossDeathStartedAt = 0;
let trainingRun = false;
let trainingSetup = false;
let deathSequenceState = '';
let activePlanet = null;
let planetGimmickTimer = 0;
let planetShipSnapshot = null;

// Cada modo conserva su propio casco, recursos, mejoras, score y progresión.
// El espacio libre es su propio perfil; los eventos que nacen de él (planetas
// y retos opcionales) usan ese mismo perfil y al regresar lo recuperan intacto.
const MODE_PROFILE_KEY = 'space-mission-mode-profiles-v1';
let modeProfiles = {};
let activeRunProfile = 'progressive';
let activeRunStarted = false;
function freshRunProfile() {
    return {
        combat: { health: 100, maxHealth: 100, bombs: 3, hasRevive: false, credits: 0 },
        ship: { accel: 0.9, damageLevel: 0, dashLevel: 0, shieldLevel: 0, tripleLevel: 0 },
        progression: { currentWave: 1, wavePhase: 1, waveKills: 0, waveKillTarget: parseInt(document.getElementById('opt-kills')?.value) || 50, awaitingCheckpoint: false, awaitingBossReward: false, suspendedAdventure: false, pendingBossRewardType: null },
        score: 0,
        started: false,
        updatedAt: 0
    };
}
function profileHasProgress(profile) {
    if (!profile || typeof profile !== 'object') return false;
    const combat = profile.combat || {};
    const ship = profile.ship || {};
    const run = profile.progression || {};
    return (Number(combat.credits) || 0) > 0
        || (Number(profile.score) || 0) > 0
        || (Number(ship.accel) || 0.9) > 0.9
        || ['damageLevel', 'dashLevel', 'shieldLevel', 'tripleLevel'].some(key => (Number(ship[key]) || 0) > 0)
        || (Number(run.currentWave) || 1) > 1
        || (Number(run.wavePhase) || 1) > 1
        || (Number(run.waveKills) || 0) > 0
        || Boolean(run.awaitingCheckpoint)
        || Boolean(run.awaitingBossReward)
        || Boolean(run.suspendedAdventure);
}
function captureRunProfile() {
    return {
        combat: { health: combatState.health, maxHealth: combatState.maxHealth, bombs: combatState.bombs, hasRevive: combatState.hasRevive, credits: combatState.credits },
        ship: { accel: nave.accel, damageLevel: nave.damageLevel || 0, dashLevel: nave.dashLevel || 0, shieldLevel: nave.shieldLevel || 0, tripleLevel: nave.tripleLevel || 0 },
        progression: { currentWave: progression.currentWave, wavePhase: progression.wavePhase, waveKills: progression.waveKills, waveKillTarget: progression.waveKillTarget, awaitingCheckpoint: progression.awaitingCheckpoint, awaitingBossReward: progression.awaitingBossReward, suspendedAdventure: progression.suspendedAdventure, pendingBossRewardType: progression.pendingBossRewardType },
        score: hudState.score,
        started: activeRunStarted,
        updatedAt: activeRunStarted ? Date.now() : (modeProfiles[activeRunProfile]?.updatedAt || 0)
    };
}
function restoreRunProfile(profile) {
    const defaults = freshRunProfile();
    const combat = profile?.combat || defaults.combat;
    const ship = profile?.ship || defaults.ship;
    const run = profile?.progression || defaults.progression;
    const savedHealth = Number(combat.health);
    combatState.health = Math.max(0, Math.min(100, Number.isFinite(savedHealth) ? savedHealth : 100));
    combatState.maxHealth = 100;
    combatState.bombs = Math.max(0, Math.min(99, Number.isFinite(Number(combat.bombs)) ? Number(combat.bombs) : 3));
    combatState.hasRevive = Boolean(combat.hasRevive);
    combatState.credits = Math.max(0, Number(combat.credits) || 0);
    nave.accel = Math.max(0.9, Math.min(1.3, Number(ship.accel) || 0.9));
    nave.fric = 0.90;
    nave.damageLevel = Math.max(0, Math.min(5, Number(ship.damageLevel) || 0));
    nave.dashLevel = Math.max(0, Math.min(5, Number(ship.dashLevel) || 0));
    nave.shieldLevel = Math.max(0, Math.min(5, Number(ship.shieldLevel) || 0));
    nave.tripleLevel = Math.max(0, Math.min(1, Number(ship.tripleLevel) || 0));
    progression.currentWave = Math.max(1, Math.min(4, Number(run.currentWave) || 1));
    progression.wavePhase = [1,2,3,4,5,6,7,8,9].includes(run.wavePhase) ? run.wavePhase : 1;
    progression.waveKills = Math.max(0, Number(run.waveKills) || 0);
    progression.waveKillTarget = Math.max(50, Math.min(200, Number(run.waveKillTarget) || defaults.progression.waveKillTarget));
    progression.awaitingCheckpoint = Boolean(run.awaitingCheckpoint);
    progression.awaitingBossReward = Boolean(run.awaitingBossReward);
    progression.suspendedAdventure = Boolean(run.suspendedAdventure);
    progression.pendingBossRewardType = ['bomb', 'revive'].includes(run.pendingBossRewardType) ? run.pendingBossRewardType : null;
    progression.waveTransition = false; progression.waveTransitionTimer = 0; progression.waveTransitionMsg = '';
    hudState.score = Math.max(0, Number(profile?.score) || 0);
}
let lastModeProfilesSerialized = '';
function storeModeProfiles() {
    const serialized = JSON.stringify(modeProfiles);
    if (serialized === lastModeProfilesSerialized) return;
    try { localStorage.setItem(MODE_PROFILE_KEY, serialized); lastModeProfilesSerialized = serialized; } catch { /* Perfiles en memoria disponibles durante esta sesión. */ }
}
function persistModeProfiles() {
    modeProfiles[activeRunProfile] = captureRunProfile();
    storeModeProfiles();
}
function saveActiveRunProfile() { persistModeProfiles(); }
// Autoguardado ligero: los perfiles no se escriben en cada frame.
let lastProfileAutosaveAt = 0;
function maybeAutosaveProfile() {
    const now = Date.now();
    if (now - lastProfileAutosaveAt < 4000) return;
    lastProfileAutosaveAt = now;
    saveActiveRunProfile();
}
function resetModeTransientState() {
    clearImmunity();
    weaponState.current = 'normal'; weaponState.timer = 0;
    homingState.active = false; homingState.timer = 0;
    droneState.drones.length = 0; droneState.timer = 0;
    weaponPowerUps.length = 0;
    dashActive = false; dashCooldown = false; dashHitSet.clear();
    parryActive = false; parryCooldown = false; parryTimer = 0;
    input.moveX = input.moveY = 0;
    input.shoot = input.triple = input.bomb = input.parry = input.dash = input.interact = input.pause = false;
    padBombHeld = padParryHeld = padDashHeld = false;
    for (const code in keys) keys[code] = false;
    setRightJoyActive(false); setTouchMove(0, 0);
    mouseShootHeld = mouseTripleHeld = false;
}
function activateModeProfile(key, { fresh = false, hard = false } = {}) {
    if (key === activeRunProfile && !fresh) { activeRunStarted = true; return; }
    saveActiveRunProfile();
    activeRunProfile = key;
    const previousProfile = modeProfiles[key];
    let profile;
    if (fresh) {
        profile = freshRunProfile();
        // Un reinicio conserva la nave comprada; una partida nueva desde el
        // gestor de partidas (hard) empieza realmente de cero.
        if (!hard && previousProfile?.ship) profile.ship = { ...profile.ship, ...previousProfile.ship };
        if (!hard && key === 'explore' && previousProfile?.combat) profile.combat.credits = previousProfile.combat.credits;
    } else {
        profile = previousProfile || freshRunProfile();
    }
    activeRunStarted = true;
    restoreRunProfile(profile);
    modeProfiles[key] = captureRunProfile();
    resetModeTransientState();
    persistModeProfiles();
}
function modeProfileFor(mode) {
    if (mode === 'explore' || mode === 'procedural' || mode === 'planet' || mode === 'free_boss') return 'explore';
    if (mode === 'solo_boss') return 'solo_boss';
    if (mode === 'custom') return trainingRun ? 'training' : 'custom';
    return 'progressive';
}

const SAVE_SLOT_LABELS = { explore: 'Explorar Universo', progressive: 'Juego Progresivo', solo_boss: 'Solo Boss' };
function formatSaveDate(timestamp) {
    const value = Number(timestamp);
    if (!value) return '';
    try {
        return new Date(value).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
}
function saveSlotSummary(key) {
    const profile = modeProfiles[key];
    if (!profile?.started) return 'Sin partida guardada. "Nueva partida" creará un progreso desde cero.';
    const combat = profile.combat || {};
    const ship = profile.ship || {};
    const run = profile.progression || {};
    const upgrades = ['damageLevel', 'dashLevel', 'shieldLevel', 'tripleLevel'].reduce((sum, stat) => sum + (Number(ship[stat]) || 0), 0);
    let summary;
    if (key === 'explore') summary = `Créditos ${Number(combat.credits) || 0} · mejoras ${upgrades} · casco ${Math.round(Number(combat.health) || 0)}%`;
    else if (key === 'progressive') summary = `Oleada ${Number(run.currentWave) || 1} · fase ${Number(run.wavePhase) || 1} · ${Number(run.waveKills) || 0}/${Number(run.waveKillTarget) || 50} bajas · score ${Number(profile.score) || 0}`;
    else summary = `Score ${Number(profile.score) || 0} · créditos ${Number(combat.credits) || 0} · mejoras ${upgrades}`;
    const date = formatSaveDate(profile.updatedAt);
    return date ? `${summary} · ${date}` : summary;
}
function refreshModeSlots() {
    for (const key of Object.keys(SAVE_SLOT_LABELS)) {
        const profile = modeProfiles[key];
        const started = Boolean(profile?.started);
        const status = document.getElementById(`slot-${key}-status`);
        if (status) {
            const text = saveSlotSummary(key);
            if (status.textContent !== text) status.textContent = text;
            status.classList.toggle('has-save', started);
        }
        const continueButton = document.getElementById(`slot-${key}-continue`);
        if (continueButton) {
            continueButton.disabled = !started;
            const label = started ? 'CONTINUAR' : 'SIN PARTIDA';
            if (continueButton.textContent !== label) continueButton.textContent = label;
        }
        const deleteButton = document.getElementById(`slot-${key}-delete`);
        if (deleteButton) deleteButton.disabled = !started;
    }
}
function startModeFromSlots(key, { fresh = false, hard = false } = {}) {
    closeStationPanel();
    closeSystemMap();
    if (key === 'explore') startExploration({ fresh, hard });
    else startMission(key, { fresh, hard });
}
window.continueMode = (key) => {
    if (!modeProfiles[key]?.started) { window.newGameMode(key); return; }
    startModeFromSlots(key);
};
window.newGameMode = (key) => {
    if (!modeProfiles[key]?.started || window.confirm(`¿Empezar una partida nueva de ${SAVE_SLOT_LABELS[key] || key}? Se perderá el progreso guardado de este modo.`)) {
        startModeFromSlots(key, { fresh: true, hard: true });
    }
};
window.deleteModeProfile = (key) => {
    if (!modeProfiles[key]?.started) return;
    if (!window.confirm(`¿Borrar la partida de ${SAVE_SLOT_LABELS[key] || key}? Esta acción no se puede deshacer.`)) return;
    modeProfiles[key] = freshRunProfile();
    if (activeRunProfile === key) {
        restoreRunProfile(modeProfiles[key]);
        activeRunStarted = false;
        resetModeTransientState();
    }
    if (key === 'progressive') clearPlayerSave();
    if (key === 'explore') resetExplorationProgress();
    storeModeProfiles();
    refreshModeSlots();
};
window.deleteAllSaves = () => {
    if (!window.confirm('¿Borrar TODOS los datos de juego (partidas, universo y récord)? Esta acción no se puede deshacer.')) return;
    try { localStorage.removeItem('space-mission-highscore'); } catch { /* Sin almacenamiento disponible. */ }
    clearPlayerSave();
    resetExplorationProgress();
    modeProfiles = {
        progressive: freshRunProfile(),
        explore: freshRunProfile(),
        solo_boss: freshRunProfile(),
        custom: freshRunProfile(),
        training: freshRunProfile()
    };
    activeRunProfile = 'progressive';
    activeRunStarted = false;
    restoreRunProfile(modeProfiles.progressive);
    resetModeTransientState();
    lastModeProfilesSerialized = '';
    storeModeProfiles();
    refreshModeSlots();
    showScreen('menu-main');
};
try {
    const parsedProfiles = JSON.parse(localStorage.getItem(MODE_PROFILE_KEY) || '{}');
    if (parsedProfiles && typeof parsedProfiles === 'object') modeProfiles = parsedProfiles;
} catch { modeProfiles = {}; }
// Migración: los perfiles antiguos no tenían `started`. Se deduce del progreso
// real para no perder partidas ni ofrecer "Continuar" en perfiles vacíos.
for (const key of Object.keys(modeProfiles)) {
    const profile = modeProfiles[key];
    if (profile && typeof profile === 'object' && typeof profile.started !== 'boolean') {
        profile.started = profileHasProgress(profile);
        profile.updatedAt = profile.updatedAt || 0;
    }
}
if (modeProfiles.progressive) restoreRunProfile(modeProfiles.progressive);
else {
    modeProfiles.progressive = captureRunProfile(); // Migra el guardado antiguo al perfil Progressive.
    modeProfiles.progressive.started = Boolean(savedPlayerState) || profileHasProgress(modeProfiles.progressive);
}
modeProfiles.explore ||= freshRunProfile();
modeProfiles.solo_boss ||= freshRunProfile();
modeProfiles.custom ||= freshRunProfile();
modeProfiles.training ||= freshRunProfile();
activeRunStarted = Boolean(modeProfiles.progressive.started);
persistModeProfiles();
const dashCooldownMs = () => DASH.COOLDOWN * Math.max(0.5, 1 - (nave.dashLevel || 0) * 0.1);
const parryCooldownMs = () => 2000 * Math.max(0.5, 1 - (nave.shieldLevel || 0) * 0.1);
const parryWindowMs = () => 200 * (1 + (nave.shieldLevel || 0) * 0.15);
function fadeTransition(action) {
    if (transitionBusy) return;
    transitionBusy = true;
    const overlay = document.getElementById('transition-fade');
    overlay?.classList.add('active');
    setTimeout(() => {
        action();
        setTimeout(() => { overlay?.classList.remove('active'); transitionBusy = false; }, 70);
    }, 330);
}

function enterCombatZone() {
    if (gameState !== 'EXPLORING' || transitionBusy) return;
    exploreCheckpoint = { x: nave.x, y: nave.y, vx: nave.vx, vy: nave.vy };
    const event = exploration.gate?.type === 'procedural' ? exploration.gate : null;
    gameState = 'TRANSITION';
    fadeTransition(() => beginMission(event ? 'procedural' : 'progressive', true));
}

function enterPlanetOrbit() {
    if (gameState !== 'EXPLORING' || transitionBusy || !exploration.nearPlanet) return;
    exploreCheckpoint = { x: nave.x, y: nave.y, vx: nave.vx, vy: nave.vy };
    exploration.enteringZone = exploration.nearPlanet;
    exploration.gate = exploration.nearPlanet;
    gameState = 'TRANSITION';
    fadeTransition(() => beginMission('planet', true));
}

function onBossDefeated() {
    if (gameMode !== 'progressive' || gameState !== 'PLAYING') return;
    if (progression.awaitingBossReward) {
        if (!pickUps.some(pickup => pickup.bossReward)) {
            dropRevivePickup(canvas.width / 2, canvas.height / 2 - 90);
        }
        saveActiveRunProfile();
        floatingTexts.push({ x: canvas.width / 2, y: 105, text: 'RECOGE LA RECOMPENSA DEL JEFE PARA GUARDAR', life: 4, color: '#ffdd88' });
        return;
    }
    if (!progression.awaitingCheckpoint) return;
    saveActiveRunProfile();
    gameState = 'CHECKPOINT';
    input.moveX = 0; input.moveY = 0; input.shoot = false; input.triple = false;
    input.bomb = false; input.parry = false; input.dash = false;
    mouseShootHeld = false; mouseTripleHeld = false;
    setHudVisible(false);
    const mobile = document.getElementById('mobile-ui');
    if (mobile) mobile.style.display = 'none';
    const panel = document.getElementById('boss-checkpoint');
    if (panel) panel.style.display = 'block';
}

function continueCheckpoint() {
    if (gameState !== 'CHECKPOINT' || gameMode !== 'progressive' || !progression.awaitingCheckpoint) return;
    const panel = document.getElementById('boss-checkpoint');
    if (panel) panel.style.display = 'none';
    gameState = 'PLAYING';
    setHudVisible(true);
    const mobile = document.getElementById('mobile-ui');
    if (mobile) mobile.style.display = (platform.isMobile && !platform.isTouchUIHidden) ? 'block' : 'none';
    const phase = progression.wavePhase;
    progression.awaitingCheckpoint = false;
    progression.awaitingBossReward = false;
    progression.pendingBossRewardType = null;
    if (phase === 2) startCheckpointSector('SECTOR 2', 3, 2);
    else if (phase === 4) startCheckpointSector('SECTOR 3', 5, 3);
    else if (phase === 6) startCheckpointSector('SECTOR 4', 7, 4);
    else if (phase === 8) progression.wavePhase = 9;
    syncHud(true);
}

function startCheckpointSector(label, nextPhase, wave) {
    startWaveTransition(label, nextPhase, () => {
        progression.currentWave = wave;
        progression.waveKills = 0;
    });
}

function returnToHub(fromPause = false) {
    if (fromPause) {
        if (gameState !== 'PAUSED' || pausedFrom !== 'PLAYING') return;
        if (gameMode === 'progressive') {
            progression.suspendedAdventure = true;
            const phaseBeforeBoss = { 2: 1, 4: 3, 6: 5, 8: 7 };
            if (progression.awaitingBossReward || (!superBossState.active && !progression.waveTransition && phaseBeforeBoss[progression.wavePhase] && bosses.length === 0)) {
                progression.awaitingBossReward = true;
                const reward = pickUps.find(pickup => pickup.bossReward);
                progression.pendingBossRewardType = reward?.type || (combatState.hasRevive ? 'bomb' : 'revive');
            }
            if (phaseBeforeBoss[progression.wavePhase] && (bosses.length > 0 || progression.waveTransition)) {
                progression.wavePhase = phaseBeforeBoss[progression.wavePhase];
                progression.waveKills = progression.waveKillTarget;
            } else if (progression.waveTransition && [3, 5, 7].includes(progression.wavePhase)) {
                progression.waveKills = 0;
            }
        }
    } else if (gameState !== 'CHECKPOINT') return;
    saveActiveRunProfile();
    const panel = document.getElementById('boss-checkpoint');
    if (panel) panel.style.display = 'none';
    fadeTransition(() => {
        // Si la campaña empezó desde el menú clásico, crea un universo de
        // exploración para que la salida al taller también esté disponible.
        if (!exploreCheckpoint) {
            enterExploration(nave, canvas);
            initHub();
            exploreCheckpoint = { x: nave.x, y: nave.y, vx: 0, vy: 0 };
        }
        cleanupAllBossTimers();
        bosses.length = 0; renderBossUI();
        enemies.length = 0; enemyBullets.length = 0; bullets.length = 0;
        pickUps.length = 0; clearParticles(); clearBlasts(); floatingTexts.length = 0;
        clearPortals(); clearSuperBoss(); clearSuperModifier();
        cancelWaveTransition();
        if (gameMode === 'procedural' || gameMode === 'planet') proceduralRun = null;
        if (planetShipSnapshot) { nave.accel = planetShipSnapshot.accel; nave.fric = planetShipSnapshot.fric; planetShipSnapshot = null; }
        activePlanet = null;
        if (gameMode === 'free_boss') { freeBossCombat = null; exploration.huntBosses.length = 0; }
        activateModeProfile('explore');
        nave.x = exploreCheckpoint.x; nave.y = exploreCheckpoint.y;
        nave.vx = 0; nave.vy = 0;
        centerCamera(nave.x, nave.y);
        gameMode = 'explore';
        gameState = 'EXPLORING';
        pausedFrom = 'EXPLORING';
        setHudVisible(true);
        if (HudNS.updateExplorationHUD) HudNS.updateExplorationHUD({ active: true, credits: combatState.credits, health: combatState.health, bombs: combatState.bombs, hasRevive: combatState.hasRevive, accel: nave.accel });
        syncHud(true);
        savePlayerState(combatState, nave, progression);
        const mobile = document.getElementById('mobile-ui');
        if (mobile) mobile.style.display = (platform.isMobile && !platform.isTouchUIHidden) ? 'block' : 'none';
        showScreen('none');
    });
}

// --- Init layout editor (HUD / controles editables) ---
// Al cerrar el editor restauramos el menú de pausa para no dejar el juego
// en estado PAUSED sin ninguna pantalla activa.
setEditorExitHandler(() => { showScreen('menu-pause'); updateVolumeVisibility(); });
initLayoutEditor();

// --- Input listeners ---
window.addEventListener('keydown', e => {
    // e.repeat: mantener Espacio gastaba todas las bombas y mantener P
    // alternaba pausa sin parar. La primera pulsación ya fija keys[code].
    if (e.repeat) return;
    if (e.code === 'Escape' && isSystemMapOpen()) { closeSystemMap(); return; }
    if (e.code === 'Escape' && isEditorActive()) { exitEditMode(true); showScreen('menu-pause'); updateVolumeVisibility(); return; }
    if (e.code === 'Escape' && gameState === 'EXPLORING' && hubState.panelOpen) { closeStationPanel(); return; }
    if (e.code === 'Escape' && gameState === 'EXPLORING') { togglePause(); return; }
    if (e.code === 'KeyM' && gameState === 'EXPLORING') { toggleSystemMap(); return; }
    keys[e.code] = true;
    if (e.code === 'KeyP') { togglePause(); keys[e.code] = false; }
});
window.addEventListener('keyup', e => keys[e.code] = false);
canvas.addEventListener('mousemove', e => { if (isEditorActive()) return; const rect = canvas.getBoundingClientRect(); input.aimX = e.clientX - rect.left; input.aimY = e.clientY - rect.top; setUsingGamepad(false); });
canvas.addEventListener('mousedown', e => { if (isEditorActive()) return; initAudio(); if (e.button === 0) { mouseShootHeld = true; input.shoot = true; } if (e.button === 2) { mouseTripleHeld = true; input.triple = true; } });
const releaseMouseButtons = e => { if (e.button === 0) { mouseShootHeld = false; input.shoot = false; } if (e.button === 2) { mouseTripleHeld = false; input.triple = false; } };
canvas.addEventListener('mouseup', releaseMouseButtons);
// También al soltar fuera del canvas, para no dejar el disparo trabado.
window.addEventListener('mouseup', releaseMouseButtons);
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
            if (type === 'right') { setRightJoyActive(false); input.shoot = false; platform.rightJoyX = 0; platform.rightJoyY = 0; }
            break;
        }
    };
    base.addEventListener('touchend', endTouch, { passive: false });
    base.addEventListener('touchcancel', endTouch, { passive: false });
    function updateJoy(touch) {
        let dx = touch.clientX - center.x; let dy = touch.clientY - center.y;
        let dist = len2(dx, dy); let maxDist = 40;
        if (dist > maxDist) { dx = (dx/dist)*maxDist; dy = (dy/dist)*maxDist; }
        stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        if (type === 'left') setTouchMove(dx / maxDist, dy / maxDist);
        else if (type === 'right') {
            // Guardamos la DIRECCIÓN, no el punto del mundo: si se fijara en
            // coordenadas absolutas, al mover la nave el disparo giraría solo.
            if (dist > 5) { platform.rightJoyX = dx / maxDist; platform.rightJoyY = dy / maxDist; input.shoot = true; }
            else { platform.rightJoyX = 0; platform.rightJoyY = 0; input.shoot = false; }
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
document.getElementById('btn-interact')?.addEventListener('click', e => { e.preventDefault(); input.interact = true; });
document.getElementById('btn-minimap')?.addEventListener('click', e => {
    e.preventDefault();
    if (gameState === 'EXPLORING' && !hubState.panelOpen) toggleSystemMap();
});

function pollInput() {
    if (isEditorActive()) return;
    if (gameState === 'CHECKPOINT') return;
    if (gameState === 'MENU' || gameState === 'LAUNCHING' || gameState === 'CONTINUE' || gameState === 'WIN') return;
    input.moveX = platform.touchMoveX; input.moveY = platform.touchMoveY;
    // El joystick derecho apunta relativo a la nave: se recalcula cada frame.
    if (platform.rightJoyActive) {
        const aimOriginX = gameState === 'EXPLORING' ? nave.x - world.cameraX : nave.x;
        const aimOriginY = gameState === 'EXPLORING' ? nave.y - world.cameraY : nave.y;
        input.aimX = aimOriginX + (platform.rightJoyX || 0) * 300;
        input.aimY = aimOriginY + (platform.rightJoyY || 0) * 300;
    }
    if (keys['KeyW']) input.moveY = -1; if (keys['KeyS']) input.moveY = 1;
    if (keys['KeyA']) input.moveX = -1; if (keys['KeyD']) input.moveX = 1;
    if (keys['Space']) { input.bomb = true; keys['Space']=false; } else if(!platform.isMobile) input.bomb=false;
    if (keys['KeyE']) { if (gameState === 'EXPLORING') input.interact = true; keys['KeyE'] = false; }
    if (keys['KeyQ']) { input.parry=true; keys['KeyQ']=false; } else if(!platform.isMobile) input.parry=false;
    if (keys['ShiftLeft']||keys['ShiftRight']) { input.dash=true; keys['ShiftLeft']=false; keys['ShiftRight']=false; } else if(!platform.isMobile) input.dash=false;
    const pads = (gamepadSeen || (gamepadPoll++ % 30 === 0)) && navigator.getGamepads ? navigator.getGamepads() : null;
    const pad = pads && pads[0];
    if (pad) gamepadSeen = true;
    if (pad) {
        const axes = pad.axes || [];
        const buttons = pad.buttons || [];
        const btn = i => buttons[i] || { pressed: false, value: 0 };
        const padShoot = btn(7).value > 0.2;
        const padTriple = btn(6).value > 0.2;
        const stickActive = Math.abs(axes[0] || 0) > 0.2 || Math.abs(axes[1] || 0) > 0.2 || len2(axes[2] || 0, axes[3] || 0) > 0.25;
        const buttonsActive = [0,1,2,3,4,5,6,7,8,9,10,11].some(i => btn(i).pressed || btn(i).value > 0.2);
        const padActive = stickActive || buttonsActive;

        if (padActive) {
            setUsingGamepad(true);
            if (Math.abs(axes[0] || 0) > 0.1) input.moveX = axes[0];
            if (Math.abs(axes[1] || 0) > 0.1) input.moveY = axes[1];
            if (len2(axes[2] || 0, axes[3] || 0) > 0.2) { input.aimX += axes[2] * 15; input.aimY += axes[3] * 15; input.aimX = Math.max(0, Math.min(canvas.width, input.aimX)); input.aimY = Math.max(0, Math.min(canvas.height, input.aimY)); }
            // Solo un mando en uso controla el disparo; si el ratón sigue pulsado, se respeta.
            if (padShoot) input.shoot = true;
            else if (!mouseShootHeld && !platform.rightJoyActive) input.shoot = false;
            if (padTriple) input.triple = true;
            else if (!mouseTripleHeld && !platform.isMobile) input.triple = false;
            if (btn(4).pressed) { if (!padBombHeld) { input.bomb = true; padBombHeld = true; } }
            else if (padBombHeld) { input.bomb = false; padBombHeld = false; }
            if (btn(5).pressed) { if (!padParryHeld) { input.parry = true; padParryHeld = true; } }
            else if (padParryHeld) { input.parry = false; padParryHeld = false; }
            if (btn(2).pressed) { if (!padDashHeld) { input.dash = true; padDashHeld = true; } }
            else if (padDashHeld) { input.dash = false; padDashHeld = false; }
            if (btn(9).pressed && !startBtnPressed) { togglePause(); startBtnPressed = true; } else if (!btn(9).pressed) startBtnPressed = false;
        } else {
            // Mando conectado pero inactivo: no debe secuestrar ratón, teclado ni táctil.
            setUsingGamepad(false);
            if (!mouseShootHeld && !platform.rightJoyActive) input.shoot = false;
            if (!mouseTripleHeld && !platform.isMobile) input.triple = false;
            if (padBombHeld) { input.bomb = false; padBombHeld = false; }
            if (padParryHeld) { input.parry = false; padParryHeld = false; }
            if (padDashHeld) { input.dash = false; padDashHeld = false; }
        }
    } else if (platform.usingGamepad) {
        // El mando se desconectó: liberar cualquier control que hubiera quedado activo.
        setUsingGamepad(false);
        if (!mouseShootHeld && !platform.rightJoyActive) input.shoot = false;
        if (!mouseTripleHeld && !platform.isMobile) input.triple = false;
        padBombHeld = padParryHeld = padDashHeld = false;
        input.bomb = false; input.parry = false; input.dash = false;
    }
    if(platform.isMobile && !platform.usingGamepad && !platform.rightJoyActive && (input.moveX!==0||input.moveY!==0)){
        const aimOriginX = gameState === 'EXPLORING' ? nave.x - world.cameraX : nave.x;
        const aimOriginY = gameState === 'EXPLORING' ? nave.y - world.cameraY : nave.y;
        input.aimX = aimOriginX + input.moveX * 150; input.aimY = aimOriginY + input.moveY * 150;
    }
}

function startCustom(){
    const cbs=document.querySelectorAll('#custom-checkboxes input:checked');
    customSelection=Array.from(cbs).map(cb=>cb.value);
    if(customSelection.length===0) return alert("Selecciona al menos un objetivo.");
    if (trainingSetup) {
        trainingSetup = false;
        trainingRun = true;
        gameState = 'EXPLORING';
        exploreCheckpoint = { x: nave.x, y: nave.y, vx: nave.vx, vy: nave.vy };
        exploration.enteringZone = null;
        closeStationPanel();
    } else trainingRun = false;
    startMission('custom', { fresh: true, hard: true });
}

function startExploration({ fresh = false, hard = false } = {}){
    if (gameState === 'MENU') { beginLaunch('explore', { fresh, hard }); return; }
    initAudio();
    activateModeProfile('explore', { fresh, hard });
    if (fresh) exploreCheckpoint = null;
    trainingRun = false;
    trainingSetup = false;
    closeSystemMap();
    gameState = 'EXPLORING';
    pausedFrom = 'EXPLORING';
    gameMode = 'explore';
    cancelWaveTransition();
    cleanupAllBossTimers();
    bosses.length = 0; renderBossUI();
    clearPortals(); clearSuperBoss(); clearSuperModifier();
    enemies.length = 0; enemyBullets.length = 0; bullets.length = 0; pickUps.length = 0;
    clearParticles(); clearBlasts(); floatingTexts.length = 0;
    resetCombo();
    fxState.screenShake = 0; fxState.hitStopFrames = 0;
    resetModeTransientState();
    input.moveX = 0; input.moveY = 0;
    input.shoot = false; input.triple = false; input.bomb = false;
    input.parry = false; input.dash = false; input.interact = false;
    mouseShootHeld = false; mouseTripleHeld = false;
    enterExploration(nave, canvas, { fresh: hard });
    initHub();
    setHudVisible(true);
    const mu = document.getElementById('mobile-ui');
    if (mu) mu.style.display = (platform.isMobile && !platform.isTouchUIHidden) ? 'block' : 'none';
    if (HudNS.updateExplorationHUD) HudNS.updateExplorationHUD({ active: true, credits: combatState.credits, health: combatState.health, bombs: combatState.bombs, hasRevive: combatState.hasRevive, accel: nave.accel });
    syncHud(true);
    showScreen('none');
}

function startMission(mode, options = {}){
    if (mode === 'explore') {
        if (gameState === 'MENU') { beginLaunch('explore', { fresh: Boolean(options.fresh), hard: Boolean(options.hard) }); return; }
        startExploration({ fresh: Boolean(options.fresh), hard: Boolean(options.hard) });
        return;
    }
    // Desde el menú se reproduce la transición de lanzamiento. Sin `fresh`
    // explícito se retoma el perfil guardado de ese modo.
    if (gameState === 'MENU') { beginLaunch(mode, { fresh: Boolean(options.fresh), hard: Boolean(options.hard) }); return; }
    // Si ya se está despegando, el último modo elegido manda sin cortar la transición.
    if (gameState === 'LAUNCHING') { menuIdle.pendingMode = mode; menuIdle.pendingFresh = Boolean(options.fresh); menuIdle.pendingHard = Boolean(options.hard); return; }
    if (options.fromHubPortal) {
        exploreCheckpoint = { x: nave.x, y: nave.y, vx: nave.vx, vy: nave.vy };
        exploration.enteringZone = null;
    }
    beginMission(mode, false, { fresh: gameState === 'PAUSED' || Boolean(options.fresh), hard: Boolean(options.hard) });
}

function restartCurrentMode() {
    if (gameState !== 'PAUSED') return;
    closeSystemMap();
    if (pausedFrom === 'EXPLORING') {
        gameState = 'EXPLORING';
        startExploration({ fresh: true });
        return;
    }
    if (gameMode === 'free_boss') {
        const bossTypes = freeBossCombat?.bossTypes || pendingFreeBossTypes;
        beginMission('free_boss', false, { bossTypes: [...bossTypes] });
        return;
    }
    if (gameMode === 'planet' && planetShipSnapshot) {
        nave.accel = planetShipSnapshot.accel;
        nave.fric = planetShipSnapshot.fric;
        planetShipSnapshot = null;
    }
    const runMode = gameMode;
    beginMission(runMode, false, { fresh: runMode !== 'procedural' && runMode !== 'planet' });
}

function beginLaunch(mode, { fresh = mode !== 'explore', hard = false } = {}){
    if (gameState !== 'MENU' || menuIdle.launching) return;
    initAudio();
    menuIdle.launching = true;
    menuIdle.launchT = 0;
    menuIdle.pendingMode = mode;
    menuIdle.pendingFresh = fresh;
    menuIdle.pendingHard = hard;
    menuIdle.startX = nave.x;
    menuIdle.startY = nave.y;
    menuIdle.startRot = menuIdle.rot;
    gameState = 'LAUNCHING';
    setHudVisible(false);
    // El menú se desvanece (CSS) mientras la nave vuela al centro.
    document.querySelectorAll('.ui-screen.active').forEach(s => s.classList.add('launch-fade'));
}

function lerpAngle(a, b, t){
    let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return a + d * t;
}

function updateMenuIdle(dt){
    menuIdle.time += dt;
    menuIdle.angle += MENU_ORBIT_SPEED * dt;
    const cx = canvas.width / 2;
    const cy = canvas.height * MENU_ORBIT_CY;
    const rx = canvas.width * MENU_ORBIT_RADIUS_X;
    const ry = canvas.height * MENU_ORBIT_RADIUS_Y;
    const wobble = 1 + Math.sin(menuIdle.time * 1.1) * 0.05;
    const x = cx + Math.cos(menuIdle.angle) * rx * wobble;
    const y = cy + Math.sin(menuIdle.angle) * ry * wobble;
    // Rumbo tangente a la órbita: la nave "vuela" alrededor del menú.
    const vx = -Math.sin(menuIdle.angle) * rx;
    const vy = Math.cos(menuIdle.angle) * ry;
    menuIdle.rot = Math.atan2(vy, vx);
    menuIdle.scale = 1;
    nave.x = x; nave.y = y; nave.vx = 0; nave.vy = 0;
}

function updateLaunch(dt){
    menuIdle.launchT += dt / LAUNCH_DURATION;
    const t = Math.min(1, menuIdle.launchT);
    // Ease-in-out cúbico: arranca suave y frena al llegar al punto de salida.
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const tx = canvas.width / 2;
    const ty = menuIdle.pendingMode === 'explore' ? canvas.height / 2 : canvas.height - 100;
    nave.x = menuIdle.startX + (tx - menuIdle.startX) * e;
    nave.y = menuIdle.startY + (ty - menuIdle.startY) * e;
    menuIdle.rot = lerpAngle(menuIdle.startRot, -Math.PI / 2, e);
    menuIdle.scale = 1 + 0.35 * Math.sin(Math.PI * t);
    if (t >= 1){
        const mode = menuIdle.pendingMode || 'progressive';
        const fresh = Boolean(menuIdle.pendingFresh);
        const hard = Boolean(menuIdle.pendingHard);
        menuIdle.launching = false;
        menuIdle.pendingMode = null;
        menuIdle.pendingFresh = false;
        menuIdle.pendingHard = false;
        menuIdle.scale = 1;
        if (mode === 'explore') startExploration({ fresh, hard });
        else beginMission(mode, false, { fresh, hard });
    }
}

function beginMission(mode, fromExploration = false, { fresh = false, hard = false, bossTypes = null } = {}){
    const enteringFromExploration = gameState === 'EXPLORING' || fromExploration;
    const targetProfile = modeProfileFor(mode);
    if (bossTypes) pendingFreeBossTypes = [...bossTypes];
    activateModeProfile(targetProfile, { fresh, hard });
    const marketLoadout = targetProfile === 'explore' && enteringFromExploration ? { ...hubState.marketLoadout } : { homing:false, spread:false };
    initAudio(); gameMode=mode; gameState='PLAYING';
    if (mode === 'planet') {
        planetShipSnapshot = { accel: nave.accel, fric: nave.fric };
        if (exploration.enteringZone?.style === 'glacia') nave.fric = 0.985;
        if (exploration.enteringZone?.style === 'caelum') nave.fric = 0.999;
    }
    closeStationPanel();
    if (HudNS.updateExplorationHUD) HudNS.updateExplorationHUD({ active: false });
    // La arena clásica usa coordenadas locales: cámara en el origen.
    resetCamera();
    if (fresh) hudState.score = 0;
    if (fresh) {
        progression.currentWave=1; progression.wavePhase=1;
        progression.awaitingCheckpoint=false; progression.awaitingBossReward=false; progression.suspendedAdventure=false;
        progression.pendingBossRewardType = null;
        progression.waveKills = 0;
        progression.waveKillTarget = parseInt(document.getElementById('opt-kills')?.value) || 50;
    }
    combatState.damagePerHit = parseInt(document.getElementById('opt-damage')?.value) || 20;
    fxState.screenShake=0; parryTimer=0; parryCooldown=false;
    cancelWaveTransition();
    // Al reiniciar (o al pasar de progresivo a custom/solo_boss) no deben quedar
    // el contador de oleada ni el aviso de bomba con datos de la partida anterior.
    resetWaveProgressUI();
    dashActive=false; dashCooldown=false;
    resetCombo();
    weaponState.current='normal'; weaponState.timer=0; weaponPowerUps.length=0; debrisChunks.length=0; fxState.hitStopFrames=0;
    homingState.active=false; homingState.timer=0; droneState.drones.length=0; droneState.timer=0; shipTrail.length=0;
    if (marketLoadout.homing) { homingState.active = true; homingState.timer = 1800; }
    if (marketLoadout.spread) { weaponState.current = 'spread'; weaponState.timer = 1800; }
    if (targetProfile === 'explore' && enteringFromExploration) hubState.marketLoadout = { homing:false, spread:false };
    bullets.length=0; enemyBullets.length=0; enemies.length=0; cleanupAllBossTimers(); bosses.length=0; renderBossUI(); pickUps.length=0; clearParticles(); clearBlasts(); floatingTexts.length=0;
    if (mode === 'progressive' && progression.awaitingBossReward) {
        pickUps.push({ x: canvas.width / 2, y: canvas.height / 2 - 90, type: progression.pendingBossRewardType || (combatState.hasRevive ? 'bomb' : 'revive'), bossReward: true });
        progression.pendingBossRewardType = null;
    }
    clearPortals(); clearSuperBoss(); clearSuperModifier();
    if (enteringFromExploration && exploration.enteringZone && ['procedural', 'planet'].includes(mode)) {
        const zone = exploration.enteringZone;
        const zoneLabel = zone.type === 'planet' ? `ÓRBITA DE ${zone.name}` : zone.type === 'procedural' ? `RETO ${zone.kind}` : zone.type === 'meteors' ? 'SECCIÓN DE METEOROS' : 'SECCIÓN INVADIDA';
        floatingTexts.push({ x: canvas.width / 2, y: canvas.height / 2 - 35, text: `¡ENTRANDO: ${zoneLabel}!`, life: 2.2, color: zone.type === 'planet' ? zone.color : zone.type === 'procedural' ? '#cf8cff' : zone.type === 'meteors' ? '#ffae62' : '#6ec8ff' });
    }
    // Estado del jugador que antes se arrastraba entre partidas.
    clearImmunity(); parryActive=false; parryCooldown=false; parryTimer=0;
    input.shoot=false; input.triple=false; input.bomb=false; input.parry=false; input.dash=false;
    mouseShootHeld=false; mouseTripleHeld=false;
    nave.x=canvas.width/2; nave.y=canvas.height-100; nave.vx=0; nave.vy=0;
    showScreen('none');
    setHudVisible(true);
    const mu=document.getElementById('mobile-ui'); if(mu) mu.style.display=(platform.isMobile && !platform.isTouchUIHidden)?'block':'none';
    if(mode==='custom'){
        // b1/b2/b3 comparten jefes: sin deduplicar, elegir "b1" + "b3" creaba
        // dos B1 superpuestos y dos barras #hp-B1 (la segunda nunca se actualizaba).
        const madeBosses = new Set();
        const addBoss = (type, id) => { if (madeBosses.has(id)) return; madeBosses.add(id); createBoss({ canvas, type, id }); };
        customSelection.forEach(val=>{
            if(val==='b1') addBoss('static','B1');
            if(val==='b2') addBoss('moving','B2');
            if(val==='b3'){ addBoss('static','B1'); addBoss('moving','B2'); }
            if(val==='b_hunter') addBoss('hunter','B_HUNTER');
            if(val==='b_berserker') addBoss('berserker','B_BERSERK');
            if(val==='b4') addBoss('doppel','DOPPEL');
            if(val==='superboss_direct') { spawnSuperBoss(canvas); floatingTexts.push({x: canvas.width/2, y: canvas.height/2 - 40, text: '★ NODRIZA SUPER BOSS ★', life: 1.8, color: '#6ec8ff'}); }
        });
        if(customSelection.includes('superboss_portal')) {
            floatingTexts.push({x: canvas.width/2, y: 80, text: 'Portal azul habilitado (usa bomba)', life: 2.5, color: '#6ec8ff'});
        }
    }
    if (mode === 'procedural' || mode === 'planet') {
        const event = exploration.enteringZone?.type === 'procedural' ? exploration.enteringZone : exploration.gate;
        proceduralRun = event ? { event, stageIndex: 0, groupIndex: 0, groupRemaining: event.stages[0]?.groups[0]?.count || 0, spawnTimer: 0, bossesSpawned: false } : null;
        if (mode === 'planet' && event) {
            event.cleared = false;
            activePlanet = event;
            planetGimmickTimer = 0;
            floatingTexts.push({ x: canvas.width / 2, y: 105, text: `ÓRBITA DE ${event.name.toUpperCase()} · ${event.gimmick.toUpperCase()}`, life: 3.4, color: event.color });
        } else {
            activePlanet = null;
            floatingTexts.push({ x: canvas.width / 2, y: 105, text: 'SECTOR PROCEDURAL · PREPÁRATE', life: 2.5, color: '#cf8cff' });
        }
        freeBossCombat = null;
    } else if (mode === 'free_boss') {
        proceduralRun = null;
        const encounterBossTypes = [...pendingFreeBossTypes];
        freeBossCombat = { bossTypes: encounterBossTypes, rewardSpawned: false, rewardCollected: false, rewardTimer: 0, exitTimer: null };
        pendingFreeBossTypes.forEach((type, index) => {
            createBoss({ canvas, type, id: `FREE_BOSS_${index + 1}` });
            const boss = bosses[bosses.length - 1];
            boss.x = canvas.width * (index + 1) / (pendingFreeBossTypes.length + 1);
            boss.y = -100 - index * 65;
            boss.targetY = 100 + index * 20;
            boss.enraged = true;
        });
        for (let i = 0; i < Math.max(3, pendingFreeBossTypes.length * 2); i++) {
            spawnEnemy({ canvas, bosses, gameMode: { value: 'custom' }, currentWave: { value: 4 }, waveTransition: { value: false }, customSelection: [], forcedType: 'common' });
        }
        pendingFreeBossTypes = [];
        floatingTexts.push({ x: canvas.width / 2, y: 105, text: '¡JEFE HOSTIL EN FURIA!', life: 2.5, color: '#ff3344' });
    } else { proceduralRun = null; freeBossCombat = null; }
    syncHud(true);
}

function updateProceduralChallenge() {
    if (!proceduralRun || gameState !== 'PLAYING') return;
    const run = proceduralRun;
    const stage = run.event.stages[run.stageIndex];
    if (!stage) {
        run.event.cleared = true;
        if (gameMode === 'planet') run.event.discovered = true;
        if (gameMode === 'planet' && activePlanet?.style === 'aurum') { awardCredits(250); floatingTexts.push({ x:canvas.width/2, y:canvas.height/2+40, text:'+250 CR · CAMPO MINERO', life:2.4, color:'#ffcf52' }); }
        proceduralRun = null;
        floatingTexts.push({ x: canvas.width / 2, y: canvas.height / 2, text: gameMode === 'planet' ? `ÓRBITA DE ${run.event.name.toUpperCase()} ASEGURADA` : 'SECTOR PROCEDURAL COMPLETADO', life: 3, color: gameMode === 'planet' ? run.event.color : '#cf8cff' });
        gameState = 'CHECKPOINT';
        returnToHub();
        return;
    }

    run.spawnTimer -= 1 / 60;
    if (gameMode === 'planet' && activePlanet?.style === 'terra' && !run.formationSpawned) {
        run.formationSpawned = true;
        spawnFormation({ canvas, bosses, formType: 'v', waveTransition: { value: false } });
    }
    let spawned = 0;
    while (run.groupIndex < stage.groups.length && enemies.length < 26 && run.spawnTimer <= 0 && spawned < 3) {
        const group = stage.groups[run.groupIndex];
        if (run.groupRemaining <= 0) run.groupRemaining = group.count;
        const enemyCountBeforeSpawn = enemies.length;
        spawnEnemy({ canvas, bosses, gameMode: { value: 'procedural' }, currentWave: { value: 4 }, waveTransition: { value: false }, customSelection: [], forcedType: group.type });
        if (run.event.type === 'procedural' && enemies.length > enemyCountBeforeSpawn) {
            const enemy = enemies[enemies.length - 1];
            const strength = 1 + (run.event.difficulty || 0) * 0.65;
            enemy.hp = Math.ceil(enemy.hp * strength);
        }
        if (activePlanet?.style === 'krono' && enemies.length > enemyCountBeforeSpawn) enemies[enemies.length - 1].hp = Math.max(1, Math.round(enemies[enemies.length - 1].hp * 0.68));
        run.groupRemaining--;
        spawned++;
        run.spawnTimer = 0.12;
        if (run.groupRemaining <= 0) {
            run.groupIndex++;
            run.groupRemaining = stage.groups[run.groupIndex]?.count || 0;
        }
    }

    const groupsFinished = run.groupIndex >= stage.groups.length;
    if (!groupsFinished || enemies.length > 0) return;
    if (!run.bossesSpawned && stage.bosses.length) {
        run.bossesSpawned = true;
        stage.bosses.forEach((type, index) => {
            const id = `EVENT_${run.event.cellX}_${run.event.cellY}_${run.stageIndex}_${index}`;
            createBoss({ canvas, type, id });
            const boss = bosses[bosses.length - 1];
            if (run.event.type === 'procedural') {
                const strength = 1 + (run.event.difficulty || 0) * 1.5;
                boss.maxHp = Math.ceil(boss.maxHp * strength);
                boss.hp = boss.maxHp;
                updateBossHP(boss);
            }
            boss.x = canvas.width * (index + 1) / (stage.bosses.length + 1);
            boss.y = -90 - index * 70;
            boss.targetY = 120 + index * 24;
        });
        if (stage.superBoss && !run.superBossSpawned) { spawnSuperBoss(canvas); run.superBossSpawned = true; }
        floatingTexts.push({ x: canvas.width / 2, y: 105, text: stage.bosses.length > 1 ? '¡DOBLE JEFE!' : '¡JEFE DETECTADO!', life: 2.2, color: '#ff6688' });
        return;
    }
    if (stage.superBoss && run.superBossSpawned && superBossState.active) return;
    if (stage.bosses.length && (!run.bossesSpawned || bosses.length > 0)) return;
    run.stageIndex++;
    run.groupIndex = 0;
    run.groupRemaining = run.event.stages[run.stageIndex]?.groups[0]?.count || 0;
    run.bossesSpawned = false;
    run.spawnTimer = 1.2;
}

function updatePlanetGimmick(dt) {
    if (!activePlanet || gameState !== 'PLAYING') return;
    planetGimmickTimer += dt;
    if (activePlanet.style === 'ignis' && len2(nave.vx, nave.vy) < 2 && planetGimmickTimer >= 3.5) {
        planetGimmickTimer = 0; doPlayerHit();
        floatingTexts.push({ x:nave.x, y:nave.y-45, text:'TORMENTA SOLAR · ¡MUÉVETE!', life:1.4, color:'#ff9a42' });
    } else if (activePlanet.style === 'toxina' && planetGimmickTimer >= 5.5) {
        planetGimmickTimer = 0;
        const inGas = Math.hypot(nave.x-canvas.width*.25,nave.y-canvas.height*.32)<110 || Math.hypot(nave.x-canvas.width*.72,nave.y-canvas.height*.68)<125;
        if (inGas) { doPlayerHit(); floatingTexts.push({ x:nave.x, y:nave.y-45, text:'GAS ÁCIDO', life:1.2, color:'#b8ff4d' }); }
    } else if (activePlanet.style === 'mecanis' && planetGimmickTimer >= 1.6) {
        planetGimmickTimer = 0;
        if (Math.abs(nave.y-canvas.height*.34)<25 || Math.abs(nave.y-canvas.height*.66)<25) doPlayerHit();
    } else if (activePlanet.style === 'krono' && planetGimmickTimer >= 8) {
        planetGimmickTimer = 0;
        enemies.forEach(enemy => { enemy.vx *= 0.18; enemy.vy *= 0.18; });
        enemyBullets.forEach(shot => { shot.vx *= 0.18; shot.vy *= 0.18; });
        floatingTexts.push({ x:canvas.width/2, y:80, text:'FISURA TEMPORAL', life:1.1, color:'#ffe18b' });
    }
}

function spawnExplorationThreat(count) {
    const types = ['common', 'special', 'elite', 'kamikaze', 'kamikaze_bomb'];
    for (let i = 0; i < count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.max(canvas.width, canvas.height) * 0.8 + 260 + Math.random() * 320;
        const hp = type === 'elite' ? 120 : type === 'special' ? 60 : type === 'kamikaze' ? 25 : type === 'kamikaze_bomb' ? 35 : 30;
        enemies.push({
            x: nave.x + Math.cos(angle) * distance, y: nave.y + Math.sin(angle) * distance,
            type, hp, vx: 0, vy: 0, shield: type === 'special', suicidal: true,
            isBombKamikaze: type === 'kamikaze_bomb', bombRadius: 42, lastShot: 0
        });
    }
}

function triggerExplorationBomb() {
    input.bomb = false;
    if (exploration.bombCooldown > 0 || combatState.bombs <= 0) return;
    triggerBomb(true, nave);
    exploration.bombDetonations++;
    exploration.bombCooldown = 20;
    const used = exploration.bombDetonations;
    if (used === 1) {
        exploration.threatMessage = 'No llames la atención de lo desconocido...';
        exploration.threatMessageTimer = 4.2;
    } else if (used === 2) spawnExplorationThreat(20);
    else if (used === 3) spawnExplorationThreat(50);
    else {
        const count = Math.min(3, used - 3);
        const types = ['static', 'moving', 'hunter', 'berserker', 'doppel'];
        exploration.huntBosses.length = 0;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 2400 + Math.random() * 700;
            const type = types[Math.floor(Math.random() * types.length)];
            exploration.huntBosses.push({
                type, huntIndex: i,
                x: nave.x + Math.cos(angle) * distance, y: nave.y + Math.sin(angle) * distance,
                speed: 80, hp: type === 'doppel' ? 6000 : type === 'hunter' ? 5000 : 4000,
                maxHp: type === 'doppel' ? 6000 : type === 'hunter' ? 5000 : 4000
            });
        }
    }
}

function handleExplorationCombatInput(dt) {
    fxState.frameCount++;
    const insideStationShield = Math.hypot(nave.x - exploration.spawnX, nave.y - exploration.spawnY) <= 1500;
    if (insideStationShield) { input.shoot = false; input.triple = false; input.bomb = false; }
    if (input.dash && !dashCooldown && !dashActive) {
        input.dash = false; sfx.dash(); dashActive = true; dashCooldown = true;
        grantImmunity(DASH.DURATION); dashHitSet.clear();
        const dx = input.moveX || 0, dy = input.moveY || 0, length = len2(dx, dy) || 1;
        const dashSpeed = DASH.SPEED * (activePlanet?.style === 'aquamar' ? 0.7 : 1);
        nave.vx = dx / length * dashSpeed; nave.vy = dy / length * dashSpeed;
        const dashLabel = document.getElementById('val-dash');
        if (dashLabel) { dashLabel.textContent = 'ACTIVE'; dashLabel.style.color = '#a0c4ff'; }
        setTimeout(() => { dashActive = false; const label = document.getElementById('val-dash'); if (label) { label.textContent = 'RECHARGING'; label.style.color = 'var(--danger)'; } }, DASH.DURATION);
        setTimeout(() => { dashCooldown = false; const label = document.getElementById('val-dash'); if (label) { label.textContent = 'READY'; label.style.color = 'var(--success)'; } }, dashCooldownMs());
    }
    if (input.parry && !parryCooldown) {
        input.parry = false; parryActive = true; parryCooldown = true; parryTimer = parryCooldownMs(); sfx.parry();
        const parryLabel = document.getElementById('val-parry');
        if (parryLabel) { parryLabel.textContent = 'ACTIVE'; parryLabel.style.color = 'var(--success)'; }
        setTimeout(() => { parryActive = false; const label = document.getElementById('val-parry'); if (label) { label.textContent = 'RECHARGING'; label.style.color = 'var(--danger)'; } }, parryWindowMs());
        setTimeout(() => { parryCooldown = false; parryTimer = 0; const label = document.getElementById('val-parry'); if (label) { label.textContent = 'READY'; label.style.color = 'var(--success)'; } }, parryCooldownMs());
    }
    if (!insideStationShield && input.shoot && fxState.frameCount % 6 === 0) spawnBullets(false);
    if (!insideStationShield && input.triple && fxState.frameCount % 12 === 0) spawnBullets(true);
    if (!insideStationShield && input.bomb) triggerExplorationBomb();
    if (weaponState.current !== 'normal') {
        weaponState.timer--;
        if (weaponState.timer <= 0) { weaponState.current = 'normal'; weaponState.timer = 0; }
    }
    droneState.drones.forEach(drone => {
        const angle = fxState.frameCount * 0.045 + drone.angleOffset;
        drone.x = nave.x + Math.cos(angle) * 55; drone.y = nave.y + Math.sin(angle) * 55;
    });
}

function updateExplorationCombat(dt) {
    const step = Math.min(2, Math.max(0, dt || 0) * 60);
    const safe = Math.hypot(nave.x - exploration.spawnX, nave.y - exploration.spawnY) <= 1500;
    if (safe) { enemyBullets.length = 0; bullets.length = 0; }

    if (weaponState.current === 'laser' && input.shoot && fxState.frameCount % 3 === 0) {
        const aimX = input.aimX + world.cameraX, aimY = input.aimY + world.cameraY;
        const angle = Math.atan2(aimY - nave.y, aimX - nave.x), cs = Math.cos(angle), sn = Math.sin(angle);
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i], dx = enemy.x - nave.x, dy = enemy.y - nave.y;
            const proj = dx * cs + dy * sn, perp = Math.abs(dx * sn - dy * cs);
            if (proj <= 0 || perp > 22) continue;
            if (enemy.shield) enemy.shield = false;
            else enemy.hp -= 36;
            if (enemy.hp <= 0) { createExplosion(enemy.x, enemy.y); enemies.splice(i, 1); awardCredits(5); }
        }
        if (exploration.encounter) {
            const enemy = exploration.encounter, dx = enemy.x - nave.x, dy = enemy.y - nave.y;
            if (dx * cs + dy * sn > 0 && Math.abs(dx * sn - dy * cs) < 22) {
                if (enemy.shield) enemy.shield = false; else enemy.hp -= 36;
                if (enemy.hp <= 0) exploration.encounter = null;
            }
        }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        const shot = bullets[i];
        shot.x += shot.vx * step; shot.y += shot.vy * step;
        shot.life = (shot.life ?? 240) - step;
        let remove = shot.life <= 0;
        for (let j = enemies.length - 1; j >= 0 && !remove; j--) {
            const enemy = enemies[j];
            if (dist2(shot.x, shot.y, enemy.x, enemy.y) > 25) continue;
            remove = true;
            if (enemy.shield) enemy.shield = false;
            else enemy.hp -= shot.dmg || 20;
            if (enemy.hp <= 0) { createExplosion(enemy.x, enemy.y); enemies.splice(j, 1); awardCredits(5); }
        }
        if (!remove && exploration.encounter && dist2(shot.x, shot.y, exploration.encounter.x, exploration.encounter.y) < 25) {
            const enemy = exploration.encounter; remove = true;
            if (enemy.shield) enemy.shield = false; else enemy.hp -= shot.dmg || 20;
            if (enemy.hp <= 0) { createExplosion(enemy.x, enemy.y); exploration.encounter = null; }
        }
        if (remove) bullets.splice(i, 1);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const dx = nave.x - enemy.x, dy = nave.y - enemy.y, distance = len2(dx, dy) || 1;
        const away = safe;
        const angle = Math.atan2(away ? -dy : dy, away ? -dx : dx);
        const accel = enemy.type === 'kamikaze' || enemy.type === 'kamikaze_bomb' ? 0.46 : 0.24;
        enemy.vx += Math.cos(angle) * accel; enemy.vy += Math.sin(angle) * accel;
        const max = enemy.type === 'kamikaze' ? 7.5 : enemy.type === 'kamikaze_bomb' ? 6.5 : 4.5;
        const speed = len2(enemy.vx, enemy.vy);
        if (speed > max) { enemy.vx *= max / speed; enemy.vy *= max / speed; }
        enemy.x += enemy.vx * step; enemy.y += enemy.vy * step;
        if (!away && distance < 820 && enemy.type !== 'kamikaze' && Date.now() - enemy.lastShot > 1450) {
            const fireAngle = Math.atan2(dy, dx);
            enemyBullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(fireAngle) * 5.3, vy: Math.sin(fireAngle) * 5.3, color: enemy.shield ? '#ffcc66' : '#ff6688', life: 260 });
            enemy.lastShot = Date.now();
        }
        if (away && distance > 2200) { enemies.splice(i, 1); continue; }
        if (!away && distance < 27) {
            if (dashActive && !dashHitSet.has(enemy)) { dashHitSet.add(enemy); enemies.splice(i, 1); createExplosion(enemy.x, enemy.y, '#a0c4ff', 10); }
            else window.explorationPlayerHit(enemy.type === 'kamikaze_bomb');
        }
    }
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const shot = enemyBullets[i];
        shot.x += shot.vx * step; shot.y += shot.vy * step; shot.life = (shot.life ?? 260) - step;
        if (safe || shot.life <= 0 || dist2(shot.x, shot.y, nave.x, nave.y) > 2600) { enemyBullets.splice(i, 1); continue; }
        if (parryActive && dist2(shot.x, shot.y, nave.x, nave.y) < 44) { enemyBullets.splice(i, 1); hudState.score += 50; continue; }
        if (dist2(shot.x, shot.y, nave.x, nave.y) < 16) { enemyBullets.splice(i, 1); window.explorationPlayerHit(); }
    }
}

function updateExplorationBossHunt(dt) {
    if (!exploration.huntBosses.length || gameState !== 'EXPLORING') return false;
    let reached = false;
    for (const boss of exploration.huntBosses) {
        const dx = nave.x - boss.x, dy = nave.y - boss.y, distance = len2(dx, dy) || 1;
        boss.speed = Math.min(1900, boss.speed + 1250 * dt);
        boss.x += dx / distance * boss.speed * dt;
        boss.y += dy / distance * boss.speed * dt;
        if (distance < 200) reached = true;
    }
    if (!reached) return false;
    pendingFreeBossTypes = exploration.huntBosses.map(boss => boss.type);
    exploration.huntBosses.length = 0;
    exploreCheckpoint = { x: nave.x, y: nave.y, vx: nave.vx, vy: nave.vy };
    gameState = 'TRANSITION';
    fadeTransition(() => beginMission('free_boss', true));
    return true;
}

function updateFreeBossReward(dt) {
    if (gameMode !== 'free_boss' || !freeBossCombat || bosses.length > 0) return false;
    if (!freeBossCombat.rewardSpawned) {
        pickUps.length = 0;
        dropRevivePickup(nave.x, nave.y - 90);
        freeBossCombat.rewardSpawned = true;
        freeBossCombat.rewardTimer = 9;
    } else if (freeBossCombat.exitTimer === null) {
        freeBossCombat.rewardTimer -= dt;
        if (freeBossCombat.rewardCollected || freeBossCombat.rewardTimer <= 0) {
            freeBossCombat.exitTimer = 2.7;
            exploration.statusMessage = 'Has derrotado al jefe hostil, saliendo al espacio';
            exploration.statusMessageTimer = 3.2;
        }
    } else {
        freeBossCombat.exitTimer -= dt;
        if (freeBossCombat.exitTimer <= 0) {
            freeBossCombat = null;
            gameState = 'CHECKPOINT';
            returnToHub();
            return true;
        }
    }
    return false;
}

function beginFreeBossDeath() {
    beginDeathSequence('FREE_BOSS_DEATH');
}

function beginDeathSequence(state) {
    if (['FREE_BOSS_DEATH', 'EXPLORATION_DEATH', 'TRAINING_DEATH'].includes(gameState)) return;
    gameState = state;
    deathSequenceState = state;
    freeBossDeathStartedAt = performance.now();
    setHudVisible(false);
    showScreen('none');
    input.moveX = input.moveY = 0; input.shoot = input.triple = input.bomb = input.dash = input.parry = false;
    enemies.length = 0; bullets.length = 0; enemyBullets.length = 0; bosses.length = 0; renderBossUI();
    pickUps.length = 0;
}

function respawnExplorationAtSafeZone() {
    exploration.bombDetonations = 0; exploration.bombCooldown = 0;
    exploration.huntBosses.length = 0;
    freeBossCombat = null; pendingFreeBossTypes = [];
    combatState.health = 100;
    enemies.length = 0; bullets.length = 0; enemyBullets.length = 0; bosses.length = 0; pickUps.length = 0;
    clearImmunity();
    nave.x = exploration.spawnX; nave.y = exploration.spawnY; nave.vx = nave.vy = 0;
    world.cameraX = nave.x - canvas.width / 2; world.cameraY = nave.y - canvas.height / 2;
    exploration.mapReveal = 1;
    gameMode = 'explore'; gameState = 'EXPLORING'; pausedFrom = 'EXPLORING';
    setHudVisible(true); showScreen('none');
    if (HudNS.updateExplorationHUD) HudNS.updateExplorationHUD({ active: true, credits: combatState.credits, health: combatState.health, bombs: combatState.bombs, hasRevive: combatState.hasRevive, accel: nave.accel });
    syncHud(true);
    savePlayerState(combatState, nave, progression);
}

function updateFreeBossDeath() {
    const elapsed = performance.now() - freeBossDeathStartedAt;
    if (elapsed < 7000 || transitionBusy) return;
    exploration.bombDetonations = 0;
    if (deathSequenceState === 'TRAINING_DEATH') {
        gameState = 'CHECKPOINT';
        trainingRun = false;
        trainingSetup = false;
        combatState.health = 100;
        returnToHub();
    } else {
        gameState = 'TRANSITION';
        fadeTransition(respawnExplorationAtSafeZone);
    }
}

let lastHudSync = 0;
function syncHud(force = false){
    // El HUD se refresca como máximo ~12 veces/s: escribir el DOM cada frame
    // provoca recálculo de layout y es lo que más traba en móvil.
    const now = performance.now();
    if (!force && now - lastHudSync < 80) return;
    lastHudSync = now;
    savePlayerState(combatState, nave, progression);
    hudUpdate({ combatState, weaponState, progression, gameMode: { value: gameMode }});
    if (hasSuperModifierActive()) {
        const wEl = document.getElementById('val-weapon');
        if (wEl) { wEl.innerText = 'TRIPLE VERDE ★'; wEl.style.color = '#00ff66'; }
    }
}

// --- Helpers for update loop ---
function spawnBullets(isTriple){
    const aimX = gameState === 'EXPLORING' ? input.aimX + world.cameraX : input.aimX;
    const aimY = gameState === 'EXPLORING' ? input.aimY + world.cameraY : input.aimY;
    const baseAngle = Math.atan2(aimY - nave.y, aimX - nave.x);
    const hasGreen = hasSuperModifierActive();
    const damageScale = 1 + (nave.damageLevel || 0) * 0.12;
    const shotSpeedScale = activePlanet?.style === 'aquamar' ? 0.7 : 1;
    if(weaponState.current==='laser'){ sfx.laser(); return; }
    sfx.shoot();
    // Modifier verde permanente: disparo individual se vuelve triple verde
    if ((hasGreen || nave.tripleLevel > 0) && !isTriple && weaponState.current==='normal') isTriple = true;
    if(weaponState.current==='spread'){
        for(let i=0;i<5;i++){ const a=baseAngle+(i-2)*0.25; bullets.push({x:nave.x,y:nave.y,vx:Math.cos(a)*13*shotSpeedScale,vy:Math.sin(a)*13*shotSpeedScale,color:'#ff9900',dmg:15*damageScale}); }
        fxState.screenShake=2;
    } else if(isTriple){
        const col = hasGreen && weaponState.current==='normal' ? '#00ff66' : '#ffcc00';
        const dmg = (hasGreen ? 18 : 25) * damageScale;
        for(let i=-1;i<=1;i++){const a=baseAngle+(i*0.2); bullets.push({x:nave.x,y:nave.y,vx:Math.cos(a)*12*shotSpeedScale,vy:Math.sin(a)*12*shotSpeedScale,color:col,dmg, isSuperGreen: hasGreen});}
        fxState.screenShake=3;
    }
    else { bullets.push({x:nave.x,y:nave.y,vx:Math.cos(baseAngle)*15*shotSpeedScale,vy:Math.sin(baseAngle)*15*shotSpeedScale,color:'#1e90ff',dmg:20*damageScale}); }
    if (activePlanet?.style !== 'caelum') droneState.drones.forEach(d=>{ bullets.push({x:d.x,y:d.y,vx:Math.cos(baseAngle)*13*shotSpeedScale,vy:Math.sin(baseAngle)*13*shotSpeedScale,color:'#ffffff',dmg:8*damageScale,isDrone:true}); });
    // Si tiene modifier, el dron también dispara verde triple al combinar
    if (hasGreen && !isTriple) { /* ya convertido arriba */ }
}

function triggerBomb(isPlayer, origin){
    if(isPlayer){ if(combatState.bombs<=0) return; combatState.bombs--; input.bomb=false; sfx.bomb(); }
    fxState.screenShake=40; pushParticle({x:origin.x,y:origin.y,vx:0,vy:0,life:1,type:'bomb_ring',color:isPlayer?'#fff':'#ff0044'});
    if(isPlayer){
        enemyBullets.length=0;
        let bombKills=0;
        enemies.forEach(e=>{ createExplosion(e.x,e.y,'#fff',10); if(e.type!=='life') bombKills++; });
        enemies.length=0;
        if(bombKills>0){
            const {pts}=registerComboHits(bombKills);
            awardCredits(bombKills * 5);
            floatingTexts.push({x:origin.x,y:origin.y-60,text:`+${pts} BOMBA x${bombKills}`,life:1.5,color:'#ffcc00'});
            if(gameMode==='progressive'){ progression.waveKills += bombKills; updateWaveProgress({gameMode:{value:gameMode},progression,bosses}); }
        }
        bosses.forEach(b=>{ b.hp -= b.maxHp*0.1; updateBossHP(b); });
        // Bombas dañan al Super Boss (atraviesan escudo)
        if (superBossState.active && !superBossState.destroyed) {
            const sb = superBossState;
            // Cañones
            sb.cannons.forEach(c=>{ if(c.alive){ c.hp -= Math.round(c.maxHp*0.22); if(c.hp<=0){c.hp=0; c.alive=false; createExplosion(c.x,c.y,'#00ff66',14); spawnDebris(c.x,c.y,'#ff5555',3);} }});
            // Compuerta
            if(sb.gate){ sb.gate.hp -= Math.round(sb.gate.maxHp*0.22); if(sb.gate.hp<0) sb.gate.hp=0; createExplosion(sb.gate.x, sb.gate.y, '#ff9900', 10); }
            // Nodriza directo (bomba atraviesa)
            sb.hp -= 1500; if(sb.hp<0) sb.hp=0;
            createExplosion(sb.x, sb.y, '#00ff66', 16);
            fxState.hitStopFrames = 6;
        }
        // 1% portal azul solo si no hay boss activo ni super boss, en combate normal
        const canSpawnPortal = bosses.length===0 && !superBossState.active && !superBossState.arena && !progression.waveTransition && gameState==='PLAYING';
        // En custom, solo si el usuario habilitó super boss
        const customAllows = gameMode!=='custom' || customSelection.includes('superboss_portal');
        const portalProb = parseInt(document.getElementById('opt-portal')?.value) || 1;
        if (canSpawnPortal && customAllows && Math.random() < portalProb / 100) {
            const px = Math.random()*(canvas.width-100)+50; const py = Math.random()*(canvas.height*0.5)+40;
            spawnPortal(px, py);
            floatingTexts.push({x:px, y:py-30, text:'¡PORTAL AZUL!', life:1.6, color:'#6ec8ff'});
        }
    } else { bullets.length=0; if(!parryActive) doPlayerHit(true); }
    syncHud();
}
function doPlayerHit(heavy=false){
    if(nave.inmune) return;
    sfx.hit(); fxState.hitStopFrames = heavy?7:4;
    combatState.health -= heavy? combatState.damagePerHit*2 : combatState.damagePerHit;
    combatState.health=Math.max(0,combatState.health); fxState.screenShake=heavy?30:15; grantImmunity(2000); createExplosion(nave.x,nave.y,'#ff0000', heavy?40:25); syncHud();
    // Si el golpe mata, triggerRevive/acceptContinue dan 3 s: el token invalida
    // el timer de 2 s que se acaba de programar. El grant extra cubre también
    // el caso de caché mixta (Main nuevo + Combat.js antiguo en Pages).
    if(combatState.health<=0){
        if(combatState.hasRevive){ triggerRevive({updateHUD:syncHud}); grantImmunity(3000); }
        else if(gameMode==='free_boss') beginFreeBossDeath();
        else if (trainingRun) beginDeathSequence('TRAINING_DEATH');
        else if (gameState === 'EXPLORING') beginDeathSequence('EXPLORATION_DEATH');
        else promptContinue();
    }
}
window.explorationPlayerHit = (heavy = false) => {
    if (gameState !== 'EXPLORING') return;
    doPlayerHit(heavy);
};
window.explorationBeltAsteroidDestroyed = (x, y) => {
    if (gameState !== 'EXPLORING') return;
    spawnExplorationThreat(1);
    hubState.floaters.push({ x, y, life: 1.6, text: '¡HOSTIL DETECTADO!' });
};
window.getExplorationStats = () => {
    const all = exploration.planets || [];
    return { discovered: all.filter(planet => planet.discovered).length, total: all.length || 12 };
};
window.getShipUpgrades = () => ({
    damage: nave.damageLevel || 0, dash: nave.dashLevel || 0,
    shield: nave.shieldLevel || 0, triple: nave.tripleLevel || 0
});
window.claimExplorationCache = () => {
    if (Math.random() < 0.42) {
        spawnExplorationThreat(5);
        floatingTexts.push({ x:nave.x, y:nave.y-55, text:'¡COFRE MIMÉTICO! · PIRATAS', life:2.4, color:'#ffcf52' });
    } else {
        awardCredits(60);
        floatingTexts.push({ x:nave.x, y:nave.y-55, text:'DATOS RECUPERADOS · +60 CR', life:2.4, color:'#ffe45c' });
    }
};

// Busca el objetivo más cercano para misiles teledirigidos, incluyendo al Super Boss Nodriza.
function findHomingTarget(fromX, fromY) {
    if (activePlanet?.style === 'caelum') return null;
    let target = null, bestDist = Infinity;
    const consider = (x, y) => {
        const d = len2(x - fromX, y - fromY);
        if (d < bestDist) { bestDist = d; target = { x, y }; }
    };
    enemies.forEach(e => consider(e.x, e.y));
    bosses.forEach(b => { if (!b.immune) consider(b.x, b.y); });
    if (superBossState.active && !superBossState.destroyed) {
        if (superBossState.phase === 1) {
            superBossState.cannons.forEach(c => { if (c.alive) consider(c.x, c.y); });
        } else if (superBossState.phase === 2 && superBossState.gate && superBossState.gate.hp > 0) {
            consider(superBossState.gate.x, superBossState.gate.y);
        } else if (superBossState.phase === 3 && superBossState.lasersActive) {
            consider(superBossState.x, superBossState.y);
        }
    }
    return target;
}

// --- UPDATE ---
function update(dtMs){
    const dt = Math.min(0.05, (dtMs || 1000 / 60) / 1000);
    pollInput();
    if (gameState === 'PLAYING' || gameState === 'EXPLORING') maybeAutosaveProfile();
    if (gameState === 'MENU') { updateMenuIdle(dt); return; }
    if (gameState === 'LAUNCHING') { updateLaunch(dt); return; }
    if (['FREE_BOSS_DEATH', 'EXPLORATION_DEATH', 'TRAINING_DEATH'].includes(gameState)) { updateFreeBossDeath(); return; }
    if (gameState === 'EXPLORING') {
        if (isSystemMapOpen()) { syncHud(); return; }
        if (!hubState.panelOpen) {
            const explorationAction = updateExploration(dt, nave, input, canvas, bullets, parryActive);
            if (explorationAction === 'enterPlanet') { enterPlanetOrbit(); return; }
            if (explorationAction === 'enterArena') {
                enterCombatZone();
                return;
            }
            handleExplorationCombatInput(dt);
            updateExplorationCombat(dt);
            if (updateExplorationBossHunt(dt)) return;
            if (gameState !== 'EXPLORING') return;
        }
        updateHub(dt, nave, input, {
            nearZone: exploration.nearGate,
            nearPlanet: exploration.nearPlanet,
            nearCache: exploration.nearCache,
            combatProjectiles: bullets,
            sector: exploration.sector,
            inSafeZone: exploration.inSafeZone,
            encounter: exploration.encounter,
            threatMessage: exploration.threatMessage,
            threatTimer: exploration.threatMessageTimer,
            zoneLabel: exploration.enteringZone?.type === 'procedural'
                ? `RETO ${exploration.enteringZone.kind} · ${exploration.enteringZone.enemyTotal} ENEMIGOS / ${exploration.enteringZone.bossTotal} JEFES`
                : exploration.nearPlanet ? ''
                : exploration.enteringZone?.type === 'meteors' ? 'SECCIÓN DE METEOROS' : 'SECCIÓN INVADIDA'
        });
        syncHud();
        return;
    }
    if(gameState!=='PLAYING') return;
    if(fxState.hitStopFrames>0){ fxState.hitStopFrames--; return; }
    fxState.frameCount++; 
    updateParticles();
    updateBlasts();
    // Portal azul: si mientras estaba activo aparece un jefe o empieza una
    // transición, se descarta. Si no, se podría entrar y dejar al jefe vivo
    // disparando dentro de la arena (o apareciendo tras el timeout).
    if (bosses.length > 0 || progression.waveTransition || superBossState.active) clearPortals();
    else updatePortals({ nave, onEnter: () => {
        // Teleport a arena azul/roja con nodriza
        enemies.length = 0; enemyBullets.length = 0; portals.length = 0;
        // Pausar oleadas normales mientras dure arena
        spawnSuperBoss(canvas);
        floatingTexts.push({ x: canvas.width/2, y: canvas.height/2 - 40, text: '¡ENTRANDO A ZONA NODRIZA!', life: 1.8, color: '#6ec8ff' });
        fxState.screenShake = 18;
        nave.y = canvas.height - 90;
        // Mensaje de fases
        setTimeout(()=> floatingTexts.push({ x: nave.x, y: nave.y - 60, text: 'FASE 1: DESTRUYE LOS CAÑONES', life: 2.0, color: '#ff5555' }), 900);
    }});
    // Super Boss update tiene prioridad y pausa progresión normal en arena
    if (superBossState.active) {
        updateSuperBoss({ canvas, nave, bullets, enemyBullets, enemies, particles, floatingTexts, fxState, createExplosion, spawnDebris, hudState, combatState, frameCount: fxState.frameCount });
        // Si está activo, no procesar oleadas normales
        if (superBossState.arena) { /* saltar checkProgression */ } else if (gameMode === 'procedural' || gameMode === 'planet') updateProceduralChallenge(); else { checkProgression({ gameMode:{value:gameMode}, currentWaveRef:{canvas}, customSelection, frameCount: fxState.frameCount, winGame, onBossDefeated }); if(gameMode==='progressive') updateWaveProgress({gameMode:{value:gameMode}, progression, bosses}); }
    } else {
        if (gameMode === 'procedural' || gameMode === 'planet') updateProceduralChallenge(); else { checkProgression({ gameMode:{value:gameMode}, currentWaveRef:{canvas}, customSelection, frameCount: fxState.frameCount, winGame, onBossDefeated }); if(gameMode==='progressive') updateWaveProgress({gameMode:{value:gameMode}, progression, bosses}); }
    }
    if (gameState !== 'PLAYING') return;
    updatePlanetGimmick(dt);
    if (gameMode === 'free_boss' && updateFreeBossReward(dt)) return;
    if (superBossState.active && superBossState.arena) {
        // En arena, no spawnear enemigos normales del loop clásico
    } else {
        // El resto del update continúa normal abajo; spawn se maneja más abajo con guarda
    }

    if(weaponState.current!=='normal'){ weaponState.timer--; if(weaponState.timer<=0){ weaponState.current='normal'; weaponState.timer=0; } }
    if(homingState.active){
        homingState.timer--; if(homingState.timer<=0){ homingState.active=false; floatingTexts.push({x:nave.x,y:nave.y-40,text:'Misiles agotados',life:1.0,color:'#00ffaa'}); }
        if(homingState.active && fxState.frameCount%70===0){
            const target=findHomingTarget(nave.x,nave.y);
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
        if(dist2(wp.x,wp.y,nave.x,nave.y)<25){
            if(wp.letter==='R'){ homingState.active=true; homingState.timer=900; sfx.powerup(); floatingTexts.push({x:wp.x,y:wp.y,text:'🎯 MISILES TELEDIRIGIDOS!',life:1.2,color:'#00ffaa'}); }
            else if(wp.letter==='D'){ if(droneState.drones.length<2) droneState.drones.push({angleOffset:droneState.drones.length*Math.PI,x:nave.x,y:nave.y}); droneState.timer=900; sfx.powerup(); floatingTexts.push({x:wp.x,y:wp.y,text:'🛰️ DRONES ACTIVADOS!',life:1.2,color:'#ffffff'}); }
            else { weaponState.current=wp.letter==='S'?'spread':'laser'; weaponState.timer=600; sfx.powerup(); floatingTexts.push({x:wp.x,y:wp.y,text:wp.letter==='S'?'★ SPREAD!':'★ LASER!',life:1.2,color:'#ff9900'}); }
            weaponPowerUps.splice(wi,1);
        } else if(wp.life<=0|| wp.y>canvas.height) weaponPowerUps.splice(wi,1);
    }
    for(let di=debrisChunks.length-1; di>=0; di--){
        const d=debrisChunks[di]; const distToNave=dist2(d.x,d.y,nave.x,nave.y);
        if(distToNave<26){ const pushAng=Math.atan2(d.y-nave.y,d.x-nave.x); const pushForce=(26-distToNave)*(dashActive?1.1:0.5); d.vx+=Math.cos(pushAng)*pushForce; d.vy+=Math.sin(pushAng)*pushForce; d.rotSpeed+=(Math.random()-0.5)*0.05; }
        d.x+=d.vx; d.y+=d.vy; d.rot+=d.rotSpeed; d.vx*=0.98; d.vy*=0.98; d.life-=0.008; if(d.life<=0) debrisChunks.splice(di,1);
    }
    if(parryCooldown){ parryTimer-=1000/60; if(parryTimer<=0) parryTimer=0; }
    const planetMoveScale = activePlanet?.style === 'aquamar' ? 0.7 : 1;
    nave.vx+=input.moveX*nave.accel*planetMoveScale; nave.vy+=input.moveY*nave.accel*planetMoveScale; nave.vx*=nave.fric; nave.vy*=nave.fric; nave.x=Math.max(10,Math.min(canvas.width-10,nave.x+nave.vx)); nave.y=Math.max(10,Math.min(canvas.height-10,nave.y+nave.vy));
    const naveSpd=len2(nave.vx,nave.vy);
    if((dashActive||naveSpd>7) && fxState.frameCount%3===0){ const trailAngle=Math.atan2(input.aimY-nave.y,input.aimX-nave.x); shipTrail.push({x:nave.x,y:nave.y,angle:trailAngle,life:1.0,color:dashActive?'#a0c4ff':nave.color}); }
    for(let ti=shipTrail.length-1; ti>=0; ti--){ shipTrail[ti].life-=0.09; if(shipTrail[ti].life<=0) shipTrail.splice(ti,1); }
    if(len2(nave.vx,nave.vy)>0.2){ const aimAngle=Math.atan2(input.aimY-nave.y,input.aimX-nave.x); const px=nave.x-Math.cos(aimAngle)*15; const py=nave.y-Math.sin(aimAngle)*15; pushParticle({x:px+(Math.random()-0.5)*10,y:py+(Math.random()-0.5)*10,vx:-Math.cos(aimAngle)*2+(Math.random()-0.5),vy:-Math.sin(aimAngle)*2+(Math.random()-0.5),life:0.8,color:'#ffcc00',type:'spark'}); }
    if(input.shoot && fxState.frameCount%6===0) spawnBullets(false);
    if(input.triple && fxState.frameCount%12===0) spawnBullets(true);
    if(input.bomb) triggerBomb(true,nave);
    if(weaponState.current==='laser' && input.shoot && fxState.frameCount%3===0){
        sfx.laser(); const ang=Math.atan2(input.aimY-nave.y,input.aimX-nave.x); const cos=Math.cos(ang),sin=Math.sin(ang);
        // El láser respeta las fases del Super Boss (igual que las balas):
        // fase 1 → cañones, fase 2 → compuerta, fase 3 → Nodriza solo sin escudo.
        if (superBossState.active && !superBossState.destroyed) {
            const sb = superBossState;
            const beamHits = (tx, ty, radius, halfW = Infinity) => {
                const dx = tx - nave.x, dy = ty - nave.y;
                const proj = dx * cos + dy * sin;
                const perp = Math.abs(dx * sin - dy * cos);
                return proj > 0 && perp < radius && Math.abs(tx - (nave.x + cos * proj)) <= halfW;
            };
            if (sb.phase === 1) {
                // Cañones: el escudo de la Nodriza no los protege
                sb.cannons.forEach((c, idx) => {
                    if (!c.alive || !beamHits(c.x, c.y, 20)) return;
                    const killed = damageCannon(idx, 90);
                    createExplosion(c.x, c.y, '#00ccff', 2);
                    if (killed) {
                        createExplosion(c.x, c.y, '#ff6600', 18);
                        spawnDebris(c.x, c.y, '#ff6600', 4);
                        fxState.screenShake = 8;
                        floatingTexts.push({ x: c.x, y: c.y - 24, text: '¡CAÑÓN DESTRUIDO!', life: 1.2, color: '#ff9900' });
                    }
                });
            } else if (sb.phase === 2 && sb.gate) {
                // Solo la compuerta recibe daño
                const g = sb.gate;
                const dx = g.x - nave.x, dy = g.y - nave.y;
                const proj = dx * cos + dy * sin;
                const perp = Math.abs(dx * sin - dy * cos);
                if (proj > 0 && perp < 24 && Math.abs(g.x - (nave.x + cos * proj)) < g.w / 2) {
                    damageGate(90);
                    createExplosion(g.x, g.y, '#ff9900', 3);
                }
            } else if (sb.phase === 3 && beamHits(sb.x, sb.y, sb.h / 2 + 12, sb.w / 2)) {
                if (canDamageSuperBoss()) {
                    damageSuperBoss(90);
                    createExplosion(sb.x + (Math.random() - 0.5) * sb.w * 0.6, sb.y, '#00ff66', 3);
                } else {
                    // Escudo activo: absorbe el láser, sin daño
                    createExplosion(sb.x + (Math.random() - 0.5) * sb.w * 0.6, sb.y, '#1e90ff', 2);
                }
            }
        }
        for(let ei=enemies.length-1; ei>=0; ei--){ const e=enemies[ei]; const dx=e.x-nave.x,dy=e.y-nave.y; const proj=dx*cos+dy*sin; const perpDist=Math.abs(dx*sin-dy*cos); if(proj>0 && perpDist<18){ if(e.shield){e.shield=false;} else { createExplosion(e.x,e.y); if(e.type==='elite'||e.type==='special') spawnDebris(e.x,e.y,'#00ccff'); enemies.splice(ei,1); if(e.type!=='life'){ awardCredits(5); const combo=registerComboHit(); const pts=combo.pts; floatingTexts.push({x:e.x,y:e.y,text:combo.multiplier>1?`+${pts} x${combo.multiplier}!`:`+${pts}`,life:1.0,color:combo.multiplier>=3?'#ff3366':combo.multiplier===2?'#ffcc00':'#00ccff'}); if(gameMode==='progressive'){progression.waveKills++; updateWaveProgress({gameMode:{value:gameMode},progression,bosses});} if(e.type==='elite'&&Math.random()>0.4){ const letters=['S','L','R','D']; const wt=letters[Math.floor(Math.random()*4)]; weaponPowerUps.push({x:e.x,y:e.y,letter:wt,vy:1.5,life:600}); } } else { combatState.health=Math.min(100, combatState.health+combatState.damagePerHit); syncHud(); floatingTexts.push({x:e.x,y:e.y,text:`+${combatState.damagePerHit}% VIDA`,life:1.0,color:'#ff66cc'}); } } } }
        for(let bLIdx=bosses.length-1; bLIdx>=0; bLIdx--){ const b=bosses[bLIdx]; if(b.type==='doppel'&&b.parryActive) continue; if(b.immune) continue; const dx=b.x-nave.x,dy=b.y-nave.y; const proj=dx*cos+dy*sin,perp=Math.abs(dx*sin-dy*cos); const lRadius=(b.type==='doppel_y'||b.type==='doppel_o')?30:50; if(proj>0 && perp<lRadius){ b.hp-=100; updateBossHP(b); if(b.hp<=0 && (b.type==='doppel_y'||b.type==='doppel_o')){ const col=b.type==='doppel_y'?'#ffff00':'#ff6600'; createExplosion(b.x,b.y,col,50); spawnDebris(b.x,b.y,col,6); fxState.hitStopFrames=8; fxState.screenShake=20; hudState.score+=8000; floatingTexts.push({x:b.x,y:b.y-50,text:b.type==='doppel_y'?'★ DOPPEL AMARILLO DESTRUIDO ★':'★ DOPPEL NARANJA DESTRUIDO ★',life:2.0,color:col}); cleanupBossTimers(b); bosses.splice(bLIdx,1); renderBossUI(); dropRevivePickup(b.x,b.y); } } }
    }
    if(input.parry && !parryCooldown){ sfx.parry(); parryActive=true; parryCooldown=true; input.parry=false; parryTimer=parryCooldownMs(); const el=document.getElementById('val-parry'); if(el){el.innerText="ACTIVE"; el.style.color="var(--success)";} setTimeout(()=>{parryActive=false; const e2=document.getElementById('val-parry'); if(e2){e2.innerText="RECHARGING"; e2.style.color="var(--danger)";}},parryWindowMs()); setTimeout(()=>{parryCooldown=false; const e3=document.getElementById('val-parry'); if(e3){e3.innerText="READY"; e3.style.color="var(--success)";}},parryCooldownMs()); }
    if(input.dash && !dashCooldown && !dashActive){ input.dash=false; sfx.dash(); dashActive=true; dashCooldown=true; grantImmunity(DASH.DURATION); dashHitSet.clear(); const dx=input.moveX||0,dy=input.moveY||0; const len=len2(dx,dy)||1; const dashSpeed=DASH.SPEED*(activePlanet?.style==='aquamar'?0.7:1); nave.vx=(dx/len)*dashSpeed; nave.vy=(dy/len)*dashSpeed; const el=document.getElementById('val-dash'); if(el){el.innerText="ACTIVE"; el.style.color="#a0c4ff";} for(let i=0;i<12;i++) pushParticle({x:nave.x,y:nave.y,vx:(Math.random()-0.5)*4,vy:(Math.random()-0.5)*4,life:0.9,color:'#a0c4ff',type:'spark'}); setTimeout(()=>{dashActive=false; const e2=document.getElementById('val-dash'); if(e2){e2.innerText="RECHARGING"; e2.style.color="var(--danger)";}},DASH.DURATION); setTimeout(()=>{dashCooldown=false; const e3=document.getElementById('val-dash'); if(e3){e3.innerText="READY"; e3.style.color="var(--success)";}},dashCooldownMs()); }
    if(!superBossState.arena && gameMode !== 'procedural' && gameMode !== 'planet' && gameMode !== 'free_boss') {
        if(Math.random()<0.02+(progression.currentWave*0.005) && bosses.length===0) spawnEnemy({canvas,bosses,gameMode:{value:gameMode},currentWave:{value:progression.currentWave},waveTransition:{value:progression.waveTransition},customSelection});
        if(bosses.length===0 && !progression.waveTransition && fxState.frameCount%420===0 && gameMode!=='custom'){ const forms=['triangle','square','circle']; spawnFormation({canvas,bosses,formType:forms[Math.floor(Math.random()*forms.length)],waveTransition:{value:progression.waveTransition}}); }
    }
    for(let i=enemies.length-1; i>=0; i--){
        const e=enemies[i];
        // doPlayerHit() puede llamar a triggerRevive(), que vacía `enemies`:
        // sin esta guarda el frame aborta con "Cannot read properties of undefined".
        if(!e) continue;
        if(e.zigzag){ e.zigzagPhase=(e.zigzagPhase||0)+0.05; e.vx=Math.sin(e.zigzagPhase)*3; }
        const enemyPlanetSpeed = activePlanet?.style === 'krono' ? 1.45 : 1;
        e.x+=e.vx*enemyPlanetSpeed; e.y+=e.vy*enemyPlanetSpeed;
        if(e.type==='kamikaze'){ const ang=Math.atan2(nave.y-e.y,nave.x-e.x); e.vx+=Math.cos(ang)*0.4; e.vy+=Math.sin(ang)*0.4; const spd=len2(e.vx,e.vy); if(spd>9){e.vx=(e.vx/spd)*9; e.vy=(e.vy/spd)*9; } }
        if(e.type==='kamikaze_bomb'){ const ang=Math.atan2(nave.y-e.y,nave.x-e.x); e.vx+=Math.cos(ang)*0.32; e.vy+=Math.sin(ang)*0.32; const spd=len2(e.vx,e.vy); if(spd>7.5){e.vx=(e.vx/spd)*7.5; e.vy=(e.vy/spd)*7.5; } // explota cerca
            if(dist2(e.x,e.y,nave.x,nave.y) < (e.bombRadius||42)) {
                createExplosion(e.x, e.y, '#ff6600', 22); spawnDebris(e.x,e.y,'#ff6600',3);
                fxState.screenShake = 16; fxState.hitStopFrames = 6;
                // Daño en área
                if(dist2(e.x,e.y,nave.x,nave.y) < 52) doPlayerHit(true);
                // limpiar balas cercanas (antes borraba las 4 últimas del array)
                for (let bi2 = enemyBullets.length - 1; bi2 >= 0; bi2--) {
                    const nb = enemyBullets[bi2];
                    if (nb && dist2(nb.x, nb.y, e.x, e.y) < 120) enemyBullets.splice(bi2, 1);
                }
                enemies.splice(i,1);
                continue;
            }
        }
        if(e.type==='elite' && !(e.dodgeCooldown)){ const aimAngle=Math.atan2(input.aimY-nave.y,input.aimX-nave.x); const toEnemy=Math.atan2(e.y-nave.y,e.x-nave.x); const angleDiff=Math.abs(((aimAngle-toEnemy)+Math.PI)%(Math.PI*2)-Math.PI); const dist=dist2(e.x,e.y,nave.x,nave.y); if(angleDiff<0.12 && dist<350 && input.shoot){ e.vx+=(Math.random()>0.5?1:-1)*8; e.dodgeCooldown=true; setTimeout(()=>{if(e) e.dodgeCooldown=false;},1200); } }
        if(e.suicidal){ const ang=Math.atan2(nave.y-e.y,nave.x-e.x); e.vx+=Math.cos(ang)*0.25; e.vy+=Math.sin(ang)*0.25; const spd=len2(e.vx,e.vy); if(spd>6){e.vx=(e.vx/spd)*6; e.vy=(e.vy/spd)*6; } }
        if(e.type==='elite' && fxState.frameCount%70===0){ const angle=Math.atan2(nave.y-e.y,nave.x-e.x); enemyBullets.push({x:e.x,y:e.y,vx:Math.cos(angle)*6,vy:Math.sin(angle)*6,color:'#00ffcc'}); }
        if(dist2(e.x,e.y,nave.x,nave.y)<20){ if(dashActive && !dashHitSet.has(e)){ dashHitSet.add(e); createExplosion(e.x,e.y,'#a0c4ff',22); spawnDebris(e.x,e.y,'#a0c4ff',3); awardCredits(e.type==='life'?0:5); hudState.score+=100; floatingTexts.push({x:e.x,y:e.y,text:'¡EMBESTIDA! +100',life:1.0,color:'#a0c4ff'}); fxState.hitStopFrames=3; fxState.screenShake=5; } else { doPlayerHit(); } enemies.splice(i,1); continue; }
        if(e.y>canvas.height) enemies.splice(i,1);
    }

    // --- Bosses (resumen idéntico al original, compactado) ---
    let bossDied = false;
    bosses.forEach((b,i)=>{
        if(b.y<b.targetY) b.y+=2;
        if(dashActive && !b.immune && !dashHitSet.has(b)){
            const ramRadius=(b.type==='doppel_y'||b.type==='doppel_o')?42:55;
            if(dist2(b.x,b.y,nave.x,nave.y)<ramRadius){ dashHitSet.add(b); const ramDmg=Math.max(60,Math.round(b.maxHp*0.06)); b.hp-=ramDmg; updateBossHP(b); createExplosion(b.x,b.y,'#a0c4ff',25); spawnDebris(b.x,b.y,'#a0c4ff',4); floatingTexts.push({x:b.x,y:b.y-50,text:`¡EMBESTIDA! -${ramDmg}`,life:1.2,color:'#a0c4ff'}); fxState.hitStopFrames=6; fxState.screenShake=10; }
        }
        // moving B2 etc handled igual que original — se replica lógica completa
        if(b.type==='moving' || b.id==='B2'){
            const enrageSpeed=(b.enraged||b.hp<b.maxHp*0.3)?5:3;
            b.x+=b.dir*enrageSpeed; if(b.x>canvas.width-50||b.x<50) b.dir*=-1;
            const b2Enraged=b.enraged||b.hp<b.maxHp*0.3;
            if(!b2Enraged){
                if(!b.telegraphActive && (Date.now()-b.lastShot)>(400-600)){ b.telegraphActive=true; setTimeout(()=>{if(b) b.telegraphActive=false;},600); }
                if(Date.now()-b.lastShot>400){ const ang=Math.atan2(nave.y-b.y,nave.x-b.x); for(let j=-2;j<=2;j++){ const a=ang+j*0.18; enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*5.5,vy:Math.sin(a)*5.5,color:'#ffcc00'}); } b.lastShot=Date.now(); }
            } else {
                if(Date.now()-b.lastShot>200){ const ang=Math.atan2(nave.y-b.y,nave.x-b.x); for(let j=-1;j<=1;j++){ const a=ang+j*0.1; enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*7,vy:Math.sin(a)*7,color:'#ff6600'}); } b.lastShot=Date.now(); }
            }
        } else if(b.type==='doppel'){
            if(!b.transformed && b.hp<=0){ b.transformed=true; b.immune=true; b.vx=0; b.vy=0; b.transformPhase='toCenter'; floatingTexts.push({x:b.x,y:b.y-70,text:'⚡ COLAPSO — FASE 2 ⚡',life:3.0,color:'#ffff00'}); fxState.screenShake=12; b.transformTimeout=setTimeout(()=>{ b.transformTimeout=null; const bi2=bosses.indexOf(b); if(bi2!==-1) bosses.splice(bi2,1); const enraged=gameMode==='free_boss'; bosses.push({id:'DOPPEL_Y',type:'doppel_y',x:canvas.width*0.3,y:140,targetY:140,hp:3000,maxHp:3000,vx:0,vy:0,lastMissile:Date.now(),lastSpiral:Date.now(),spiralActive:false,spiralCount:0,parryCooldown:false,parryActive:false,enraged,bombs:0}); bosses.push({id:'DOPPEL_O',type:'doppel_o',x:canvas.width*0.7,y:140,targetY:140,hp:3000,maxHp:3000,vx:0,vy:0,dashState:'chase',dashTimer:0,dashVx:0,dashVy:0,dashCount:0,maxDashes:3,lastDashTime:Date.now(),lastExplosion:0,explodeCooldown:false,enraged,bombs:0}); renderBossUI(); fxState.hitStopFrames=10; fxState.screenShake=20; createExplosion(canvas.width/2,canvas.height/2,'#ffff00',40); spawnDebris(canvas.width/2,canvas.height/2,'#ffff00',8); },2000); }
            if(b.immune){ const cx=canvas.width/2,cy=canvas.height/2; if(b.transformPhase==='toCenter'){ const dx=cx-b.x,dy=cy-b.y,dist=len2(dx,dy); if(dist>6){b.x+=(dx/dist)*Math.min(12,dist); b.y+=(dy/dist)*Math.min(12,dist);} else {b.x=cx;b.y=cy;b.transformPhase='spinning'; b.spinAngle=0; floatingTexts.push({x:cx,y:cy-70,text:'¡FUSIÓN INESTABLE!',life:1.6,color:'#ffff00'});} } else if(b.transformPhase==='spinning'){ b.spinAngle=(b.spinAngle||0)+0.85; b.x=cx+Math.sin(fxState.frameCount*0.6)*3; b.y=cy+Math.cos(fxState.frameCount*0.5)*3; } return; }
            let targetX=nave.x+Math.sin(fxState.frameCount/30)*150; let targetY=nave.y-150+Math.cos(fxState.frameCount/20)*50; targetX=Math.max(50,Math.min(canvas.width-50,targetX)); targetY=Math.max(50,Math.min(canvas.height-150,targetY)); b.x+=(targetX-b.x)*0.04; b.y+=(targetY-b.y)*0.04; let danger=bullets.find(bul=>dist2(bul.x,bul.y,b.x,b.y)<70); if(danger && !b.parryCooldown && Math.random()>0.5){b.parryActive=true; b.parryCooldown=true; setTimeout(()=>b.parryActive=false,300); setTimeout(()=>b.parryCooldown=false,2500);} if(Date.now()-b.lastShot>150){ const ang=Math.atan2(nave.y-b.y,nave.x-b.x); enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(ang)*14,vy:Math.sin(ang)*14,color:'#ff0044'}); if(fxState.frameCount%60===0){for(let j=-2;j<=2;j++) enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(ang+(j*0.2))*10,vy:Math.sin(ang+(j*0.2))*10,color:'#ffcc00'});} b.lastShot=Date.now(); } if(b.bombs>0 && dist2(b.x,b.y,nave.x,nave.y)<100){ triggerBomb(false,b); b.bombs--; }
        } else if(b.type==='doppel_y'){
            const now=Date.now(); const enraged=b.enraged; const missileRate=enraged?2200:5000;
            const distToPlayer=dist2(nave.x,nave.y,b.x,b.y); const safeZone=enraged?220:280;
            if(distToPlayer<safeZone){ const ang=Math.atan2(b.y-nave.y,b.x-nave.x); b.vx+=Math.cos(ang)*(enraged?0.4:0.3); b.vy+=Math.sin(ang)*(enraged?0.4:0.3);} else { b.vx+=Math.sin(fxState.frameCount/40)*(enraged?0.22:0.15); b.vy+=Math.cos(fxState.frameCount/40)*(enraged?0.22:0.15); }
            const maxYSpd=enraged?4.5:3.5; const spd=len2(b.vx,b.vy); if(spd>maxYSpd){b.vx=(b.vx/spd)*maxYSpd; b.vy=(b.vy/spd)*maxYSpd;} b.x+=b.vx; b.y+=b.vy; b.vx*=0.96; b.vy*=0.96; b.x=Math.max(30,Math.min(canvas.width-30,b.x)); b.y=Math.max(30,Math.min(canvas.height*0.6,b.y));
            if(!b.enraged && bosses.every(bx=>bx.type!=='doppel_o')){ b.enraged=true; b.lastMissile=0; b.lastSpiral=now+1200; fxState.screenShake=16; fxState.hitStopFrames=10; floatingTexts.push({x:b.x,y:b.y-60,text:'⚠ ÚLTIMO DOPPEL — FURIA AMARILLA ⚠',life:2.4,color:'#ffff00'}); }
            if(now-b.lastMissile>missileRate){ const ang=Math.atan2(nave.y-b.y,nave.x-b.x); enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(ang)*4,vy:Math.sin(ang)*4,color:'#ffff00',isMissile:true,hp:3,life:420}); if(enraged){for(let j=-1;j<=1;j+=2) enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(ang+j*0.35)*6,vy:Math.sin(ang+j*0.35)*6,color:'#ffcc00'});} floatingTexts.push({x:b.x,y:b.y-40,text:'⚠ MISIL',life:1.0,color:'#ffff00'}); b.lastMissile=now; }
            if(enraged){ if(!b.spiralActive && now-b.lastSpiral>5500){ b.spiralActive=true; b.spiralStart=now; b.spiralCount=0; floatingTexts.push({x:b.x,y:b.y-60,text:'¡ESPIRAL!',life:1.2,color:'#ffee00'}); } if(b.spiralActive){ if(fxState.frameCount%3===0){ const arms=3; for(let a=0;a<arms;a++){ const spAng=(b.spiralCount*0.28)+(a*(Math.PI*2/arms)); enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(spAng)*3.4,vy:Math.sin(spAng)*3.4,color:'#ffee00'}); } b.spiralCount++; } if(now-b.spiralStart>2600){ b.spiralActive=false; b.lastSpiral=now; } } }
        } else if(b.type==='doppel_o'){
            const now=Date.now(); const enraged=b.enraged;
            if(!b.enraged && bosses.every(bx=>bx.type!=='doppel_y')){ b.enraged=true; b.maxDashes=4; fxState.screenShake=12; floatingTexts.push({x:b.x,y:b.y-60,text:'⚠ FURIA NARANJA ⚠',life:2.0,color:'#ff6600'}); }
            if(enraged && !b.explodeCooldown && now-b.lastExplosion>7000){ b.lastExplosion=now; b.explodeCooldown=true; b.dashState='toCenter'; floatingTexts.push({x:b.x,y:b.y-60,text:'¡EXPLOSIÓN!',life:1.5,color:'#ff4400'}); }
            if(b.dashState==='toCenter'){ const cx=canvas.width/2,cy=canvas.height/2; const dx=cx-b.x,dy=cy-b.y,dist=len2(dx,dy); if(dist>8){b.x+=(dx/dist)*6; b.y+=(dy/dist)*6;} else { b.x=cx; b.y=cy; if(!b.centerChargeFrames) b.centerChargeFrames=30; b.centerChargeFrames--; if(b.centerChargeFrames<=0){ b.centerChargeFrames=0; b.lastBreathCount=2; b.dashState='centerExploding'; b.explodeTickFrames=0; } } return; }
            if(b.dashState==='centerExploding'){ b.x=canvas.width/2; b.y=canvas.height/2; b.explodeTickFrames=(b.explodeTickFrames||0)+1; if(b.explodeTickFrames>=60){ b.explodeTickFrames-=60; b.lastBreathCount--; fxState.screenShake=8; if(b.lastBreathCount<=0){ fxState.hitStopFrames=10; fxState.screenShake=30; const ringCount=28; for(let j=0;j<ringCount;j++){const a=(j/ringCount)*Math.PI*2; enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*16,vy:Math.sin(a)*16,color:'#ff6600',isBerserkerSpike:true}); const a2=a+(Math.PI/ringCount); enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(a2)*9,vy:Math.sin(a2)*9,color:'#ffaa00',isBerserkerSpike:true});} createExplosion(b.x,b.y,'#ff6600',60); spawnDebris(b.x,b.y,'#ff6600',5); b.dashState='chase'; b.explodeCooldown=false; b.lastBreathCount=0; b.explodeTickFrames=0; } } return; }
            const maxSpd=enraged?7:5.5; b.vx+=(nave.x-b.x)*0.028; b.vy+=(nave.y-b.y)*0.028; const spd=len2(b.vx,b.vy); if(spd>maxSpd && b.dashState==='chase'){b.vx=(b.vx/spd)*maxSpd; b.vy=(b.vy/spd)*maxSpd;} if(b.dashState==='chase'){ b.x+=b.vx; b.y+=b.vy; b.x=Math.max(20,Math.min(canvas.width-20,b.x)); b.y=Math.max(20,Math.min(canvas.height*0.85,b.y)); const interval=enraged?900:1500; if(now-b.lastDashTime>interval){b.vx=0;b.vy=0;b.dashCount=0;b.dashState='telegraph';b.dashTimer=now;}} else if(b.dashState==='telegraph'){ const dur=enraged?200:280; if(now-b.dashTimer>dur){ const ang=Math.atan2(nave.y-b.y,nave.x-b.x); const dspd=enraged?38:30; b.dashVx=Math.cos(ang)*dspd; b.dashVy=Math.sin(ang)*dspd; b.dashState='dashing'; b.dashTimer=now; }} else if(b.dashState==='dashing'){ b.x+=b.dashVx; b.y+=b.dashVy; if(b.x<20){b.x=20;b.dashVx=Math.abs(b.dashVx)*0.4;} if(b.x>canvas.width-20){b.x=canvas.width-20;b.dashVx=-Math.abs(b.dashVx)*0.4;} if(b.y<20){b.y=20;b.dashVy=Math.abs(b.dashVy)*0.4;} if(b.y>canvas.height-20){b.y=canvas.height-20;b.dashVy=-Math.abs(b.dashVy)*0.4;} b.dashVx*=0.93; b.dashVy*=0.93; const cs=len2(b.dashVx,b.dashVy); if(cs<1.5||now-b.dashTimer>900){b.vx=0;b.vy=0;b.dashVx=0;b.dashVy=0;b.dashCount++; if(b.dashCount>=(b.maxDashes||3)){b.dashState='chase';b.lastDashTime=now;} else {b.dashState='telegraph';b.dashTimer=now;}} }
            if(dist2(b.x,b.y,nave.x,nave.y)<38) doPlayerHit(b.dashState==='dashing');
        } else if(b.type==='hunter'){
            const enraged=b.enraged||b.hp<b.maxHp*0.3; if(!b.enraged && enraged){b.enraged=true; fxState.screenShake=8; floatingTexts.push({x:b.x,y:b.y-60,text:'⚠ PÁNICO ⚠',life:2.0,color:'#ff0000'});}
            const spd=enraged?4.5:3; b.vx=b.vx||0; b.vy=b.vy||0; b.vx+=(nave.x-b.x)*0.018; b.vy+=(nave.y-200-b.y)*0.018; const curSpd=len2(b.vx,b.vy); if(curSpd>spd){b.vx=(b.vx/curSpd)*spd; b.vy=(b.vy/curSpd)*spd;} b.x+=b.vx; b.y+=b.vy; b.x=Math.max(50,Math.min(canvas.width-50,b.x)); b.y=Math.max(40,Math.min(canvas.height*0.55,b.y));
            if(!b.dodgeCooldown){ const threat=bullets.find(bul=>{const dx=bul.x-b.x,dy=bul.y-b.y; const dist=len2(dx,dy); const proj=(dx*b.vx+dy*b.vy); return dist<120 && proj<0;}); if(threat){b.vx+=(Math.random()>0.5?1:-1)*6; b.dodgeCooldown=true; setTimeout(()=>{if(b) b.dodgeCooldown=false;},900);} }
            const laserRate=enraged?600:1200; if(!b.telegraphActive && (Date.now()-b.lastLaser)>(laserRate-600)){b.telegraphActive=true; setTimeout(()=>{if(b) b.telegraphActive=false;},600);} if(Date.now()-b.lastLaser>laserRate){ const ang=Math.atan2(nave.y-b.y,nave.x-b.x); const shots=enraged?5:3; for(let j=0;j<shots;j++){const spread=(j-Math.floor(shots/2))*0.15; enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(ang+spread)*8,vy:Math.sin(ang+spread)*8,color:'#ff00ff',isLaser:true});} b.lastLaser=Date.now(); } if(enraged && Date.now()-b.lastShot>300){ for(let j=0;j<6;j++){const a=(fxState.frameCount/20)+(j*(Math.PI*2/6)); enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*3.5,vy:Math.sin(a)*3.5,color:'#ff6600'});} b.lastShot=Date.now(); }
        } else if(b.type==='berserker'){
            const enraged=b.enraged||b.hp<b.maxHp*0.3; const now=Date.now();
            if(b.lastBreath){ b.immune=true; const cx=canvas.width/2,cy=canvas.height/2; const dx=cx-b.x,dy=cy-b.y,dist=len2(dx,dy); if(dist>8){b.x+=(dx/dist)*5; b.y+=(dy/dist)*5;} else { b.x=cx; b.y=cy; b.lastBreathFrames=(b.lastBreathFrames||0)+1; if(b.lastBreathFrames>=60){ b.lastBreathFrames-=60; b.lastBreathCount--; fxState.screenShake=6; if(b.lastBreathCount<=0){ fxState.hitStopFrames=12; fxState.screenShake=35; for(let j=0;j<24;j++){const a=(j/24)*Math.PI*2; enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*16,vy:Math.sin(a)*16,color:'#ff4400',isBerserkerSpike:true});} createExplosion(b.x,b.y,'#ff4400',80); spawnDebris(b.x,b.y,'#ff4400',8); hudState.score+=10000; b.lastBreathCount=0; b.lastBreathFrames=0; const bi2=bosses.indexOf(b); if(bi2!==-1){bosses.splice(bi2,1); renderBossUI(); dropRevivePickup(b.x,b.y);} } } } return; }
            if(!b.enraged && enraged){ b.enraged=true; b.maxDashes=3; b.dashInterval=1400; b.dashState='chase'; fxState.screenShake=10; floatingTexts.push({x:b.x,y:b.y-70,text:'⚠ FRENESÍ ⚠',life:2.0,color:'#ff4400'}); }
            if(b.hp<=0 && !b.lastBreath){ b.lastBreath=true; b.vx=0; b.vy=0; b.dashState='chase'; b.lastBreathCount=3; b.lastBreathFrames=0; floatingTexts.push({x:b.x,y:b.y-60,text:'¡ÚLTIMO ALIENTO!',life:2.5,color:'#ff0000'}); fxState.screenShake=15; return; }
            if(b.dashState==='chase'){ const maxSpd=enraged?5.2:3.8; b.vx+=(nave.x-b.x)*0.022; b.vy+=(nave.y-b.y)*0.022; const spd=len2(b.vx,b.vy); if(spd>maxSpd){b.vx=(b.vx/spd)*maxSpd; b.vy=(b.vy/spd)*maxSpd;} b.x+=b.vx; b.y+=b.vy; b.x=Math.max(30,Math.min(canvas.width-30,b.x)); b.y=Math.max(30,Math.min(canvas.height*0.75,b.y)); const interval=b.dashInterval||2400; if(now-b.lastDashTime>interval){b.vx=0;b.vy=0;b.dashCount=0;b.dashState='telegraph';b.dashTimer=now;}} else if(b.dashState==='telegraph'){ const telegraphDuration=enraged?300:500; if(now-b.dashTimer>telegraphDuration){ const ang=Math.atan2(nave.y-b.y,nave.x-b.x); const spd2=enraged?30:24; b.dashVx=Math.cos(ang)*spd2; b.dashVy=Math.sin(ang)*spd2; b.dashState='dashing'; b.dashTimer=now; }} else if(b.dashState==='dashing'){ b.x+=b.dashVx; b.y+=b.dashVy; if(b.x<20){b.x=20;b.dashVx=Math.abs(b.dashVx)*0.5;} if(b.x>canvas.width-20){b.x=canvas.width-20;b.dashVx=-Math.abs(b.dashVx)*0.5;} if(b.y<20){b.y=20;b.dashVy=Math.abs(b.dashVy)*0.5;} if(b.y>canvas.height-20){b.y=canvas.height-20;b.dashVy=-Math.abs(b.dashVy)*0.5;} b.dashVx*=0.95; b.dashVy*=0.95; const curSpd=len2(b.dashVx,b.dashVy); if(curSpd<1.5||now-b.dashTimer>1200){b.vx=0;b.vy=0;b.dashVx=0;b.dashVy=0;b.dashCount++; if(!enraged||b.dashCount>=b.maxDashes){b.dashState='exhausted'; b.dashTimer=now; b.lastDashTime=now; if(enraged) floatingTexts.push({x:b.x,y:b.y-50,text:'AGOTADO...',life:1.5,color:'#aaa'});} else {b.dashState='telegraph'; b.dashTimer=now;}}} else if(b.dashState==='exhausted'){ b.vx+=(nave.x-b.x)*0.002; b.vy+=(nave.y-b.y)*0.002; b.x+=b.vx*0.3; b.y+=b.vy*0.3; if(now-b.dashTimer>2500){b.vx=0;b.vy=0;b.dashState='chase'; b.lastDashTime=now;}}
            if(dist2(b.x,b.y,nave.x,nave.y)<46) doPlayerHit(b.dashState==='dashing');
        } else {
            const enraged=b.enraged||b.hp<b.maxHp*0.3; if(!b.enraged && enraged){b.enraged=true; fxState.screenShake=8; floatingTexts.push({x:b.x,y:b.y-60,text:'⚠ PÁNICO ⚠',life:2.0,color:'#ff0000'});}
            let fireRate=b.type==='static'?(enraged?150:300):(enraged?200:400);
            if(!b.telegraphActive && (Date.now()-b.lastShot)>(fireRate-600)){ b.telegraphActive=true; setTimeout(()=>{b.telegraphActive=false;},600); }
            if(Date.now()-b.lastShot>fireRate){ let total=(8+(config.diff*2))*(enraged?1.5:1)|0; if(b.type==='static'||b.id==='B1'){for(let j=0;j<total;j++){const a=(fxState.frameCount/15)+(j*(Math.PI*2/total)); enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*4,vy:Math.sin(a)*4,color:enraged?'#ff6600':'#ff3366'});} } else if(b.type==='moving'||b.id==='B2'){let baseDir=Math.PI/2+Math.sin(fxState.frameCount/20)*0.8; for(let j=-2;j<=2;j++){const a=baseDir+(j*0.2); enemyBullets.push({x:b.x,y:b.y,vx:Math.cos(a)*5.5,vy:Math.sin(a)*5.5,color:enraged?'#ff6600':'#ffcc00'});} } b.lastShot=Date.now(); }
        }
        if(b.hp<=0 && b.type!=='berserker' && b.type!=='doppel'){ createExplosion(b.x,b.y,'#fff',50); spawnDebris(b.x,b.y,'#ff3366',5); fxState.hitStopFrames=8; dropRevivePickup(b.x,b.y); b._dead=true; bossDied=true; hudState.score+=10000; }
    });
    // Compactar después del forEach: hacer splice dentro se salta el siguiente jefe.
    if (bossDied) {
        for (let bi = bosses.length - 1; bi >= 0; bi--) if (bosses[bi]._dead) bosses.splice(bi, 1);
        renderBossUI();
    }

    // Recorrido inverso: al eliminar con splice no se salta la siguiente bala.
    for(let bi=bullets.length-1; bi>=0; bi--){ const bul=bullets[bi];
        if(bul.isHoming){ bul.life=(bul.life!==undefined?bul.life:240)-1; const target=findHomingTarget(bul.x,bul.y); if(target){const hAng=Math.atan2(target.y-bul.y,target.x-bul.x); bul.vx+=Math.cos(hAng)*0.7; bul.vy+=Math.sin(hAng)*0.7;} const hs=len2(bul.vx,bul.vy); if(hs>9){bul.vx=(bul.vx/hs)*9; bul.vy=(bul.vy/hs)*9;}}
        bul.x+=bul.vx; bul.y+=bul.vy;
        if (activePlanet?.style === 'cristalia') {
            bul.bounces = bul.bounces || 0;
            if (bul.bounces < 4 && (bul.x < 12 || bul.x > canvas.width - 12)) { bul.vx *= -1; bul.x = Math.max(12, Math.min(canvas.width - 12, bul.x)); bul.bounces++; }
            if (bul.bounces < 4 && (bul.y < 12 || bul.y > canvas.height - 12)) { bul.vy *= -1; bul.y = Math.max(12, Math.min(canvas.height - 12, bul.y)); bul.bounces++; }
        }
        let hit=bul.isHoming && bul.life<=0;
        for(let ei=enemies.length-1; ei>=0; ei--){ const e=enemies[ei]; if(!hit && dist2(bul.x,bul.y,e.x,e.y)<25){ hit=true; if(e.shield){e.shield=false; e.vy*=1.5;} else { e.hp-=bul.dmg; if(e.hp<=0){ createExplosion(e.x,e.y); if(e.type==='elite') fxState.hitStopFrames=5; if(e.type==='elite'||e.type==='special') spawnDebris(e.x,e.y,e.type==='elite'?'#00ffcc':'#ffcc00'); enemies.splice(ei,1); if(e.type!=='life') awardCredits(5); if(e.type!=='life' && gameMode==='progressive'){progression.waveKills++; updateWaveProgress({gameMode:{value:gameMode},progression,bosses});} const combo=registerComboHit(); const pts=combo.pts; floatingTexts.push({x:e.x,y:e.y,text:combo.multiplier>1?`+${pts} x${combo.multiplier}!`:`+${pts}`,life:1.0,color:combo.multiplier>=3?'#ff3366':combo.multiplier===2?'#ffcc00':'#fff'}); if(e.type==='life'){ combatState.health=Math.min(100, combatState.health+combatState.damagePerHit); syncHud(); floatingTexts.push({x:e.x,y:e.y-20,text:`+${combatState.damagePerHit}% VIDA`,life:1.0,color:'#ff66cc'}); } if(e.type==='elite'&&Math.random()>0.4){ const letters=['S','L','R','D']; const wt=letters[Math.floor(Math.random()*4)]; weaponPowerUps.push({x:e.x,y:e.y,letter:wt,vy:1.5,life:600}); } if(Math.random()>0.95 && e.type!=='life') pickUps.push({x:e.x,y:e.y,type:'bomb'}); } } } }
        // --- Super Boss colisiones ---
        if(!hit && superBossState.active && !superBossState.destroyed) {
            if(superBossState.phase===1) {
                for(let ci=0; ci<superBossState.cannons.length; ci++){
                    const c = superBossState.cannons[ci];
                    if(!c.alive) continue;
                    if(dist2(bul.x,bul.y,c.x,c.y) < 22){
                        hit=true; const killed = damageCannon(ci, bul.dmg);
                        createExplosion(bul.x, bul.y, '#ff5555', 4);
                        floatingTexts.push({x:c.x, y:c.y-18, text:`-${bul.dmg}`, life:0.7, color:'#ffaaaa'});
                        if(killed) { createExplosion(c.x,c.y,'#ff6600',18); spawnDebris(c.x,c.y,'#ff6600',4); fxState.screenShake=8; floatingTexts.push({x:c.x,y:c.y-24, text:'¡CAÑÓN DESTRUIDO!', life:1.2, color:'#ff9900'}); }
                        break;
                    }
                }
                // Escudo del boss principal bloquea todo si intentas pegarle directo
                if(!hit && dist2(bul.x,bul.y,superBossState.x,superBossState.y) < 42) {
                    // choca contra escudo
                    createExplosion(bul.x, bul.y, '#1e90ff', 3); hit=true;
                }
            } else if(superBossState.phase===2 && superBossState.gate) {
                const g = superBossState.gate;
                if(Math.abs(bul.x - g.x) < g.w/2 + 6 && Math.abs(bul.y - g.y) < g.h/2 + 8) {
                    hit=true; damageGate(bul.dmg); createExplosion(bul.x, bul.y, '#ff9900', 4);
                    floatingTexts.push({x:g.x, y:g.y-10, text:`-${bul.dmg}`, life:0.6, color:'#ffcc00'});
                }
            } else if(superBossState.phase===3) {
                if(canDamageSuperBoss() && Math.abs(bul.x - superBossState.x) < superBossState.w/2 && Math.abs(bul.y - superBossState.y) < superBossState.h/2 + 10) {
                    hit=true; damageSuperBoss(bul.dmg); createExplosion(bul.x, bul.y, '#00ff66', 4);
                    floatingTexts.push({x: superBossState.x + (Math.random()-0.5)*40, y: superBossState.y, text:`-${bul.dmg}`, life:0.7, color:'#00ff66'});
                } else if(!canDamageSuperBoss() && Math.abs(bul.x - superBossState.x) < superBossState.w/2 + 8 && Math.abs(bul.y - superBossState.y) < 30) {
                    createExplosion(bul.x, bul.y, '#1e90ff', 2); hit=true;
                }
            }
        }
        if(!hit){ for(let mi=enemyBullets.length-1; mi>=0; mi--){ const mb=enemyBullets[mi]; if(mb.isMissile && dist2(bul.x,bul.y,mb.x,mb.y)<18){ createExplosion(mb.x,mb.y,'#ffff00',8); floatingTexts.push({x:mb.x,y:mb.y,text:'MISIL ✓',life:0.8,color:'#ffff00'}); enemyBullets.splice(mi,1); hit=true; break; } } }
        for(let bIdx=bosses.length-1; bIdx>=0; bIdx--){ const b=bosses[bIdx]; const bRadius=b.type==='doppel'?30:(b.type==='berserker'?44:(b.type==='doppel_y'||b.type==='doppel_o'?28:45)); if(!hit && dist2(bul.x,bul.y,b.x,b.y)<bRadius){ if(b.immune){ createExplosion(bul.x,bul.y,b.type==='berserker'?'#ff4400':'#ffff00',3); hit=true; } else if(b.type==='doppel'&&b.parryActive){ createExplosion(bul.x,bul.y,'#00ffcc',5); hit=true; } else { hit=true; b.hp-=bul.dmg; updateBossHP(b); floatingTexts.push({x:b.x+(Math.random()-0.5)*40,y:b.y-20+(Math.random()-0.5)*20,text:`-${bul.dmg}`,life:1.0,color:'#ff3366'}); if(b.hp<=0 && (b.type==='doppel_y'||b.type==='doppel_o')){ const col=b.type==='doppel_y'?'#ffff00':'#ff6600'; createExplosion(b.x,b.y,col,50); spawnDebris(b.x,b.y,col,6); fxState.hitStopFrames=8; fxState.screenShake=20; hudState.score+=8000; floatingTexts.push({x:b.x,y:b.y-50,text:b.type==='doppel_y'?'★ DOPPEL AMARILLO DESTRUIDO ★':'★ DOPPEL NARANJA DESTRUIDO ★',life:2.0,color:col}); cleanupBossTimers(b); bosses.splice(bIdx,1); renderBossUI(); dropRevivePickup(b.x,b.y); } } } }
        if(hit || bul.y<0 || bul.y>canvas.height || bul.x<0 || bul.x>canvas.width) bullets.splice(bi,1);
    }
    for(let ei=enemyBullets.length-1; ei>=0; ei--){
        let eb=enemyBullets[ei];
        // triggerRevive() vacía enemyBullets desde doPlayerHit(): guarda obligatoria.
        if(!eb) continue;
        if (!eb.planetScaled && (activePlanet?.style === 'aquamar' || activePlanet?.style === 'glacia')) {
            const projectileScale = activePlanet.style === 'aquamar' ? 0.7 : 0.78;
            eb.vx *= projectileScale; eb.vy *= projectileScale; eb.planetScaled = true;
        }
        if(eb.isMissile){ eb.life=(eb.life||420)-1; if(eb.life<=0){enemyBullets.splice(ei,1); continue;} const mAng=Math.atan2(nave.y-eb.y,nave.x-eb.x); eb.vx+=Math.cos(mAng)*0.35; eb.vy+=Math.sin(mAng)*0.35; const ms=len2(eb.vx,eb.vy); if(ms>10){eb.vx=(eb.vx/ms)*10; eb.vy=(eb.vy/ms)*10; } }
        eb.x+=eb.vx; eb.y+=eb.vy;
        if (activePlanet?.style === 'cristalia') {
            eb.bounces = eb.bounces || 0;
            if (eb.bounces < 4 && (eb.x < 8 || eb.x > canvas.width - 8)) { eb.vx *= -1; eb.x = Math.max(8, Math.min(canvas.width - 8, eb.x)); eb.bounces++; }
            if (eb.bounces < 4 && (eb.y < 8 || eb.y > canvas.height - 8)) { eb.vy *= -1; eb.y = Math.max(8, Math.min(canvas.height - 8, eb.y)); eb.bounces++; }
        }
        let destroyed=false;
        if(parryActive && dist2(eb.x,eb.y,nave.x,nave.y)<45){ createExplosion(eb.x,eb.y,'#00ffcc',5); hudState.score+=50; enemyBullets.splice(ei,1); destroyed=true; }
        if(!destroyed && dist2(eb.x,eb.y,nave.x,nave.y)<12){ doPlayerHit(); enemyBullets.splice(ei,1); destroyed=true; }
        if(!destroyed && (eb.y>canvas.height||eb.x<0||eb.x>canvas.width||eb.y<-50)) enemyBullets.splice(ei,1);
    }
    for(let pi=pickUps.length-1; pi>=0; pi--){
        const p=pickUps[pi]; p.y+=2;
        if(dist2(p.x,p.y,nave.x,nave.y)<30){
            if(p.type==='bomb'){ combatState.bombs++; }
            else if(p.type==='revive'){ combatState.hasRevive=true; sfx.powerup(); floatingTexts.push({x:p.x,y:p.y-20,text:'✨ 2ª OPORTUNIDAD LISTA',life:1.4,color:'#ffee88'}); }
            if (gameMode === 'free_boss' && freeBossCombat?.rewardSpawned && bosses.length === 0 && p.bossReward) freeBossCombat.rewardCollected = true;
            const checkpointReward = Boolean(p.bossReward && progression.awaitingBossReward);
            if (checkpointReward) { progression.awaitingBossReward=false; progression.awaitingCheckpoint=true; }
            syncHud(); pickUps.splice(pi,1);
            if (checkpointReward) onBossDefeated();
        }
    }
    for(let fi=floatingTexts.length-1; fi>=0; fi--){ const ft=floatingTexts[fi]; ft.y-=1; ft.life-=0.02; if(ft.life<=0) floatingTexts.splice(fi,1); }
    syncHud();
}

// --- DRAW ---
let lastDrawTime=0; const fpsInterval=1000/60;
// Presupuesto adaptativo de partículas. Se compara el ritmo de frames con el
// refresco real de la pantalla: si el juego pierde >25% de frames bajamos el
// tope; si va fino y con CPU holgada lo recuperamos hasta MAX_PARTICLES.
let frameAvg=16.7, workAvg=4, frameSamples=0, baseDelta=16.7;
function adaptParticleBudget(deltaTime, workMs){
    // Un salto enorme (>100 ms) es cambio de pestaña o pausa del rAF, no carga real.
    if(deltaTime>100) return;
    // baseDelta ≈ refresco real de la pantalla (60/90/120 Hz, o 30 si el
    // dispositivo va limitado): así no confundimos "pantalla lenta" con "juego lento".
    baseDelta=Math.min(deltaTime, baseDelta*1.02);
    frameAvg=frameAvg*0.95+deltaTime*0.05;
    workAvg=workAvg*0.9+workMs*0.1;
    if(++frameSamples<90) return;
    frameSamples=0;
    const b=getParticleBudget();
    if(frameAvg>baseDelta*1.25) setParticleBudget(Math.round(b*0.75));
    else if(frameAvg<baseDelta*1.06 && workAvg<6 && b<MAX_PARTICLES) setParticleBudget(Math.min(MAX_PARTICLES,Math.round(b*1.2)));
}
// Nave del menú: órbita idle y transición de lanzamiento. Se dibuja sobre el
// parallax (que también se mueve en MENU) para que el menú no parezca estático.
function drawMenuShip(ctx){
    if (gameState !== 'MENU' && gameState !== 'LAUNCHING') return;
    const x = nave.x, y = nave.y;
    const pulse = 0.85 + Math.sin(menuIdle.time * 3) * 0.15;
    if (!menuIdle.launching){
        // Anillo tenue de la órbita (solo en el menú, no durante el despegue).
        ctx.save();
        ctx.strokeStyle = 'rgba(110,200,255,0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(canvas.width / 2, canvas.height * MENU_ORBIT_CY,
            canvas.width * MENU_ORBIT_RADIUS_X, canvas.height * MENU_ORBIT_RADIUS_Y,
            0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    // Estela del motor
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(menuIdle.rot);
    ctx.globalAlpha = 0.22 * pulse;
    ctx.fillStyle = nave.color;
    ctx.beginPath();
    ctx.moveTo(-16, -6); ctx.lineTo(-16 - 24 * pulse, 0); ctx.lineTo(-16, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    drawGlow(ctx, x, y, 40 * menuIdle.scale, nave.color, 0.9);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(menuIdle.rot);
    ctx.scale(menuIdle.scale, menuIdle.scale);
    ctx.fillStyle = nave.color;
    ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-16, -16); ctx.lineTo(-16, 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
}

function draw(currentTime){
    requestAnimationFrame(draw);
    if(!currentTime) currentTime=performance.now();
    const deltaTime=currentTime-lastDrawTime;
    if(deltaTime<fpsInterval) return;
    lastDrawTime=currentTime-(deltaTime%fpsInterval);
    const workStart=performance.now();
    ctx.save();
    // Exploración libre: el mundo se dibuja con la cámara; el HUD va aparte.
    if (gameState === 'EXPLORING' || (gameState === 'PAUSED' && pausedFrom === 'EXPLORING')) {
        drawExploration(ctx, canvas, nave, input, { enemies, bullets, enemyBullets, parryActive });
        drawSystemMapFrame();
        ctx.restore();
        update(deltaTime);
        adaptParticleBudget(deltaTime, performance.now()-workStart);
        return;
    }
    if(fxState.screenShake>0){ ctx.translate((Math.random()-0.5)*fxState.screenShake,(Math.random()-0.5)*fxState.screenShake); fxState.screenShake*=0.9; if(fxState.screenShake<0.5) fxState.screenShake=0; }
    if (superBossState.arena) {
        drawSuperArena(ctx, canvas, gameState);
    } else if (activePlanet) {
        // Cada mundo combate dentro de su propia atmósfera (color y clima).
        const atmosphereTime = performance.now() / 1000;
        drawPlanetAtmosphere(ctx, canvas, activePlanet, atmosphereTime);
        drawPlanetForeground(ctx, canvas, activePlanet, atmosphereTime);
    } else {
        ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
        drawParallax(ctx, canvas, gameState);
    }
    // Portal azul siempre visible si existe
    drawPortals(ctx);
    // Nave del menú (órbita idle / despegue) sobre el fondo animado
    drawMenuShip(ctx);
    if (gameState === 'PLAYING' && activePlanet) {
        // Atmósfera ya aplicada en el fondo; aquí solo se mantiene el tinte
        // de peligro de las arenas hostiles sobre las entidades.
        if (activePlanet.style === 'mecanis') {
            ctx.save();ctx.globalAlpha=.16+.12*Math.sin(Date.now()/170);ctx.strokeStyle='#ff304e';ctx.lineWidth=3;
            for(const y of [canvas.height*.34,canvas.height*.66]){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}
            ctx.restore();
        }
    }
    if(gameState==='PLAYING'||gameState==='PAUSED'||gameState==='CONTINUE'||gameState==='WIN'||gameState==='FREE_BOSS_DEATH'){
        pickUps.forEach(p=>{
            if(p.type==='revive'){ const pulse=0.75+Math.sin(fxState.frameCount*0.15)*0.25; drawGlow(ctx,p.x,p.y,26,'#ffee88',pulse*0.85); ctx.save(); ctx.globalAlpha=pulse; ctx.fillStyle='#ffee88'; ctx.beginPath(); ctx.arc(p.x,p.y,12,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; ctx.fillStyle='#000'; ctx.font='bold 13px Orbitron'; ctx.fillText('✨',p.x-7,p.y+5); ctx.restore(); }
            else { ctx.fillStyle='#ffcc00'; ctx.beginPath(); ctx.arc(p.x,p.y,10,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#000'; ctx.fillText('B',p.x-4,p.y+4); }
        });
        enemies.forEach(e=>{
            if(e.type==='kamikaze_bomb'){ ctx.fillStyle='#ff4400'; } else ctx.fillStyle=e.type==='elite'?'#00ffcc':(e.shield?'#ffcc00':(e.type==='life'?'#ff66cc':(e.type==='kamikaze'?'#ff6600':'#ff3366')));
            if(e.type==='elite'){ ctx.beginPath(); ctx.moveTo(e.x,e.y+15); ctx.lineTo(e.x-15,e.y-10); ctx.lineTo(e.x+15,e.y-10); ctx.fill(); }
            else if(e.type==='kamikaze'){ const ang=Math.atan2(e.vy,e.vx); drawGlow(ctx,e.x,e.y,24,'#ff6600',0.8); ctx.save(); ctx.translate(e.x,e.y); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(16,0); ctx.lineTo(-10,-10); ctx.lineTo(-5,0); ctx.lineTo(-10,10); ctx.fill(); ctx.restore(); }
            else if(e.type==='kamikaze_bomb'){ const ang=Math.atan2(e.vy,e.vx); drawGlow(ctx,e.x,e.y,26,'#ff4400',0.85); ctx.save(); ctx.translate(e.x,e.y); ctx.rotate(ang); ctx.fillStyle='#ff4400'; ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(-10,-11); ctx.lineTo(-6,0); ctx.lineTo(-10,11); ctx.fill(); ctx.fillStyle='#ffcc00'; ctx.font='10px Orbitron'; ctx.fillText('💣', -5, 4); ctx.restore(); }
            else { ctx.fillRect(e.x-12,e.y-12,24,24); if(e.shield){ctx.strokeStyle='#fff'; ctx.strokeRect(e.x-15,e.y-15,30,30);} }
        });
        // Super Boss nodriza
        drawSuperBoss(ctx, fxState.frameCount);
        bosses.forEach(b=>{
            const enraged=b.type==='doppel_y'||b.type==='doppel_o'?b.enraged:(b.enraged||b.hp<b.maxHp*0.3);
            const bossColor=enraged?'#ff6600':'#ff3366'; const bossGlow=enraged?'#ff6600':'#ff3366'; const enragePulse=enraged?(0.8+Math.sin(fxState.frameCount*0.25)*0.2):1;
            if(b.telegraphActive && b.type!=='doppel_y' && b.type!=='doppel_o'){ ctx.globalAlpha=0.25+Math.sin(Date.now()/60)*0.15; ctx.fillStyle='#ff0000'; ctx.beginPath(); ctx.arc(b.x,b.y,b.type==='doppel'?50:70,0,Math.PI*2); ctx.fill(); if(b.type==='static'||b.id==='B1'){ ctx.strokeStyle='rgba(255,0,0,0.4)'; ctx.lineWidth=1; const total=8+(config.diff*2); for(let j=0;j<total;j++){const a=(fxState.frameCount/15)+(j*(Math.PI*2/total)); ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.x+Math.cos(a)*canvas.width,b.y+Math.sin(a)*canvas.width); ctx.stroke();}} ctx.globalAlpha=1; }
            if(b.type==='doppel'){ const spinning=b.immune && b.transformPhase==='spinning'; const angle=spinning?(b.spinAngle||0):Math.atan2(nave.y-b.y,nave.x-b.x); const dColor=b.immune?(fxState.frameCount%6<3?'#ffffff':'#ffff00'):'#ff0044'; drawGlow(ctx,b.x,b.y,b.immune?52:38,dColor,0.85); ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(angle); if(b.parryActive){ctx.strokeStyle='#00ffcc'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(0,0,35,0,Math.PI*2); ctx.stroke();} ctx.fillStyle=dColor; ctx.beginPath(); ctx.moveTo(20,0); ctx.lineTo(-15,-15); ctx.lineTo(-15,15); ctx.fill(); ctx.restore(); if(spinning){ctx.save(); ctx.translate(b.x,b.y); ctx.strokeStyle=fxState.frameCount%6<3?'#ffffff':'#ffff00'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,38+Math.sin(fxState.frameCount*0.3)*8,0,Math.PI*2); ctx.stroke(); ctx.restore();} }
            else if(b.type==='doppel_y'){ const angle=Math.atan2(nave.y-b.y,nave.x-b.x); const yEnrage=b.enraged; const yPulse=yEnrage?(0.85+Math.sin(fxState.frameCount*0.25)*0.15):1; drawGlow(ctx,b.x,b.y,yEnrage?52:40,yEnrage?'#ffff00':'#ffcc00',yPulse*0.85); ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(angle); ctx.globalAlpha=yPulse; ctx.fillStyle='#ff2200'; ctx.beginPath(); ctx.moveTo(22,0); ctx.lineTo(-14,-20); ctx.lineTo(-14,20); ctx.fill(); ctx.fillStyle=yEnrage?'#ffffff':'#ffee00'; ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(-8,-13); ctx.lineTo(-8,13); ctx.fill(); ctx.globalAlpha=1; ctx.restore(); }
            else if(b.type==='doppel_o'){ const isTelegraph=b.dashState==='telegraph'; const isDashing=b.dashState==='dashing'; const goingCenter=b.dashState==='toCenter'||b.dashState==='centerExploding'; const angle=isDashing?Math.atan2(b.dashVy,b.dashVx):Math.atan2(nave.y-b.y,nave.x-b.x); drawGlow(ctx,b.x,b.y,isDashing?58:(b.enraged?48:40),isDashing?'#ffffff':'#ff6600',isDashing?1:0.85); ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(angle); if(isTelegraph){ctx.strokeStyle='rgba(255,100,0,0.5)'; ctx.lineWidth=1.5; ctx.setLineDash([5,4]); const global={x:nave.x-b.x,y:nave.y-b.y}; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(global.x,global.y); ctx.stroke(); ctx.setLineDash([]);} ctx.fillStyle='#ff2200'; ctx.beginPath(); ctx.moveTo(22,0); ctx.lineTo(-14,-20); ctx.lineTo(-14,20); ctx.fill(); ctx.fillStyle=isDashing?'#ffffff':(b.enraged?'#ff8800':'#ff7700'); ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(-8,-13); ctx.lineTo(-8,13); ctx.fill(); ctx.restore(); if(goingCenter && b.lastBreathCount>0){const p=0.5+Math.abs(Math.sin(fxState.frameCount*0.3))*0.5; ctx.globalAlpha=p; ctx.textAlign='center'; ctx.font=`bold ${36+p*8}px Orbitron`; ctx.fillStyle='#ff4400'; ctx.shadowBlur=15; ctx.shadowColor='#ff4400'; ctx.fillText(`${b.lastBreathCount}...`,b.x,b.y-50); ctx.shadowBlur=0; ctx.globalAlpha=1; ctx.textAlign='left';}}
            else if(b.type==='berserker'){
                const enraged=b.enraged||b.hp<b.maxHp*0.3; const isLastBreath=b.lastBreath; const isExhausted=b.dashState==='exhausted'; const isDashing=b.dashState==='dashing'; const isTelegraph=b.dashState==='telegraph';
                if(isTelegraph){ctx.save(); ctx.globalAlpha=0.4+Math.sin(Date.now()/40)*0.3; ctx.strokeStyle='#ff0000'; ctx.lineWidth=1.5; ctx.setLineDash([6,4]); ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(nave.x,nave.y); ctx.stroke(); ctx.setLineDash([]); ctx.restore();}
                const lbPulse=isLastBreath?(fxState.frameCount%6<3?'#ffffff':'#ff0000'):null; const baseColor=isLastBreath?lbPulse:enraged?`hsl(${10+Math.sin(fxState.frameCount*0.2)*10}, 100%, ${50+Math.sin(fxState.frameCount*0.3)*10}%)`:isExhausted?'#888':isDashing?'#ffffff':'#cc3300'; const glowColor=isLastBreath?'#ff0000':enraged?'#ff4400':isDashing?'#fff':'#cc3300'; const glowBlur=isDashing?30:enraged?25:15;
                drawGlow(ctx,b.x,b.y,(enraged?50:44)+glowBlur*0.6,glowColor,isDashing?0.95:0.8);
                ctx.save(); ctx.translate(b.x,b.y); const rotAng=len2(b.vx||b.dashVx,b.vy||b.dashVy)>0.5?Math.atan2(b.dashVy||b.vy,b.dashVx||b.vx):Math.atan2(nave.y-b.y,nave.x-b.x); ctx.rotate(rotAng); ctx.fillStyle=baseColor; const spikeCount=enraged?10:8; const outerR=enraged?50:44; const innerR=enraged?16:18; ctx.beginPath(); for(let s=0;s<spikeCount*2;s++){const a=(s/(spikeCount*2))*Math.PI*2; const r=s%2===0?outerR:innerR; s===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);} ctx.closePath(); ctx.fill(); ctx.fillStyle=isLastBreath?lbPulse:(enraged?'#ff8800':'#ff5500'); ctx.beginPath(); ctx.arc(0,0,innerR*0.7,0,Math.PI*2); ctx.fill(); if(isExhausted){ctx.globalAlpha=0.25; ctx.fillStyle='#aaaaaa'; ctx.beginPath(); ctx.arc(0,0,outerR+10,0,Math.PI*2); ctx.fill();} ctx.globalAlpha=1; ctx.restore();
                if(isLastBreath && b.lastBreathCount>0){const pulse=0.5+Math.abs(Math.sin(fxState.frameCount*0.3))*0.5; ctx.globalAlpha=pulse; ctx.textAlign='center'; ctx.font=`bold ${40+pulse*10}px Orbitron`; ctx.fillStyle='#ff0000'; ctx.shadowBlur=20; ctx.shadowColor='#ff0000'; ctx.fillText(`${b.lastBreathCount}...`,b.x,b.y-55); ctx.shadowBlur=0; ctx.globalAlpha=1; ctx.textAlign='left';}
            } else if(b.type==='hunter'){ const ang=Math.atan2(nave.y-b.y,nave.x-b.x); drawGlow(ctx,b.x,b.y,enraged?52:42,enraged?'#ff00ff':'#cc00ff',enragePulse*0.85); ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(ang); ctx.fillStyle=enraged?'#ff00ff':'#cc00ff'; ctx.globalAlpha=enragePulse; ctx.beginPath(); ctx.moveTo(28,0); ctx.lineTo(-10,-18); ctx.lineTo(-20,0); ctx.lineTo(-10,18); ctx.fill(); ctx.fillStyle=enraged?'#ffff00':'#aa66ff'; ctx.globalAlpha=0.7; ctx.beginPath(); ctx.arc(-22,0,6+Math.sin(fxState.frameCount*0.3)*2,0,Math.PI*2); ctx.fill(); if(enraged){ctx.fillStyle='#ff6600'; ctx.globalAlpha=0.8; ctx.beginPath(); ctx.arc(-12,-12,4+Math.sin(fxState.frameCount*0.4)*2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(-12,12,4+Math.sin(fxState.frameCount*0.4+1)*2,0,Math.PI*2); ctx.fill();} ctx.globalAlpha=1; ctx.restore(); }
            else { drawGlow(ctx,b.x,b.y,enraged?78:64,bossGlow,enragePulse*0.85); ctx.fillStyle=bossColor; ctx.globalAlpha=enragePulse; ctx.beginPath(); ctx.arc(b.x,b.y,45,0,Math.PI*2); ctx.fill(); if(enraged){ctx.fillStyle='#ffff00'; ctx.globalAlpha=0.7; for(let j=0;j<3;j++){const ja=(fxState.frameCount*0.15)+j*(Math.PI*2/3); ctx.beginPath(); ctx.arc(b.x+Math.cos(ja)*30,b.y+Math.sin(ja)*30,6+Math.sin(fxState.frameCount*0.3+j)*3,0,Math.PI*2); ctx.fill();}} ctx.globalAlpha=1; }
        });
        if (gameMode === 'free_boss') bosses.forEach(b => {
            const width = b.type === 'doppel' ? 84 : 110;
            const y = b.y - (b.type === 'berserker' ? 72 : 58);
            ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(b.x - width / 2, y, width, 8);
            ctx.fillStyle = '#ff3344'; ctx.fillRect(b.x - width / 2 + 1, y + 1, (width - 2) * Math.max(0, b.hp / b.maxHp), 6);
        });
        enemyBullets.forEach(eb=>{
            if(eb.isMissile){ const mAng=Math.atan2(eb.vy,eb.vx); drawGlow(ctx,eb.x,eb.y,18,'#ffff00',0.8); ctx.save(); ctx.translate(eb.x,eb.y); ctx.rotate(mAng); ctx.fillStyle='#ff2200'; ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(-8,-7); ctx.lineTo(-8,7); ctx.closePath(); ctx.fill(); ctx.fillStyle='#ffee00'; ctx.beginPath(); ctx.moveTo(7,0); ctx.lineTo(-4,-4); ctx.lineTo(-4,4); ctx.closePath(); ctx.fill(); ctx.globalAlpha=0.4; ctx.fillStyle='#ff6600'; ctx.beginPath(); ctx.arc(-10,0,5,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; ctx.restore(); }
            else if(eb.isLaser){ const ang=Math.atan2(eb.vy,eb.vx); drawGlow(ctx,eb.x,eb.y,14,'#ff00ff',0.7); ctx.save(); ctx.translate(eb.x,eb.y); ctx.rotate(ang); ctx.fillStyle='#ff00ff'; ctx.globalAlpha=0.9; ctx.fillRect(-10,-3,20,6); ctx.fillStyle='#fff'; ctx.fillRect(-6,-1,12,2); ctx.globalAlpha=1; ctx.restore(); }
            else if(eb.isBerserkerSpike){ const ang=Math.atan2(eb.vy,eb.vx); drawGlow(ctx,eb.x,eb.y,14,'#ff4400',0.75); ctx.save(); ctx.translate(eb.x,eb.y); ctx.rotate(ang); ctx.fillStyle='#ff4400'; ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(0,-5); ctx.lineTo(-10,0); ctx.lineTo(0,5); ctx.closePath(); ctx.fill(); ctx.fillStyle='#ffaa00'; ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(0,-3); ctx.lineTo(-6,0); ctx.lineTo(0,3); ctx.closePath(); ctx.fill(); ctx.restore(); }
            else { ctx.fillStyle=eb.color; ctx.beginPath(); ctx.arc(eb.x,eb.y,5,0,Math.PI*2); ctx.fill(); }
        });
        bullets.forEach(b=>{ if(b.isHoming){ drawGlow(ctx,b.x,b.y,20,b.color,0.8); ctx.fillStyle=b.color; ctx.fillRect(b.x-4,b.y-16,8,32); } else { ctx.fillStyle=b.color; if(b.isDrone){ctx.fillRect(b.x-1.5,b.y-7,3,14);} else {ctx.fillRect(b.x-2,b.y-10,4,20);} } });
        droneState.drones.forEach(d=>{ drawGlow(ctx,d.x,d.y,14,'#ffffff',0.8); ctx.save(); ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.arc(d.x,d.y,5,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(d.x,d.y); ctx.lineTo(nave.x,nave.y); ctx.stroke(); ctx.restore(); });
        if(weaponState.current==='laser' && input.shoot){ const ang=Math.atan2(input.aimY-nave.y,input.aimX-nave.x); const endX=nave.x+Math.cos(ang)*canvas.width*2; const endY=nave.y+Math.sin(ang)*canvas.width*2; drawGlow(ctx,nave.x,nave.y,46,'#00ccff',0.55); ctx.save(); ctx.globalAlpha=0.18+Math.sin(fxState.frameCount*0.4)*0.07; ctx.strokeStyle='#00ccff'; ctx.lineWidth=18; ctx.beginPath(); ctx.moveTo(nave.x,nave.y); ctx.lineTo(endX,endY); ctx.stroke(); ctx.globalAlpha=0.85; ctx.strokeStyle='#ffffff'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(nave.x,nave.y); ctx.lineTo(endX,endY); ctx.stroke(); ctx.globalAlpha=1; ctx.restore(); }
        weaponPowerUps.forEach(wp=>{ const pulse=0.7+Math.sin(fxState.frameCount*0.12)*0.3; ctx.globalAlpha=pulse; const boxColor=wp.letter==='R'?'#00ffaa':wp.letter==='D'?'#66ccff':'#ff9900'; ctx.fillStyle=boxColor; ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.fillRect(wp.x-14,wp.y-14,28,28); ctx.strokeRect(wp.x-14,wp.y-14,28,28); ctx.fillStyle='#fff'; ctx.font='bold 16px Orbitron'; ctx.fillText(wp.letter,wp.x-6,wp.y+6); ctx.globalAlpha=1; });
        debrisChunks.forEach(d=>{ ctx.save(); ctx.globalAlpha=d.life; ctx.translate(d.x,d.y); ctx.rotate(d.rot); ctx.fillStyle=d.color; ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(d.pts[0][0],d.pts[0][1]); d.pts.forEach(p=>ctx.lineTo(p[0],p[1])); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); });
        shipTrail.forEach(g=>{ ctx.save(); ctx.globalAlpha=g.life*0.3; ctx.translate(g.x,g.y); ctx.rotate(g.angle); ctx.fillStyle=g.color; ctx.beginPath(); ctx.moveTo(20,0); ctx.lineTo(-15,-15); ctx.lineTo(-15,15); ctx.fill(); ctx.restore(); }); ctx.globalAlpha=1;
        if(!nave.inmune || fxState.frameCount%10<5){
            if(parryActive){ctx.strokeStyle='#00ffcc'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(nave.x,nave.y,35,0,Math.PI*2); ctx.stroke();}
            const angle=Math.atan2(input.aimY-nave.y,input.aimX-nave.x);
            drawGlow(ctx,nave.x,nave.y,34,nave.color,0.85);
            ctx.save(); ctx.translate(nave.x,nave.y); ctx.rotate(angle); ctx.fillStyle=nave.color; ctx.beginPath(); ctx.moveTo(20,0); ctx.lineTo(-15,-15); ctx.lineTo(-15,15); ctx.fill(); ctx.restore();
            if(parryCooldown && parryTimer>0){ let ratio=1-(parryTimer/2000); ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(nave.x-20,nave.y+25,40,4); ctx.fillStyle='#00ffcc'; ctx.fillRect(nave.x-20,nave.y+25,40*ratio,4); }
        }
        if (activePlanet?.style === 'umbra') {
            const vision = ctx.createRadialGradient(nave.x, nave.y, 90, nave.x, nave.y, Math.max(canvas.width, canvas.height) * 0.72);
            vision.addColorStop(0, 'rgba(0,0,8,0)'); vision.addColorStop(0.34, 'rgba(0,0,8,0.28)'); vision.addColorStop(1, 'rgba(0,0,8,0.94)');
            ctx.fillStyle = vision; ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.strokeStyle='rgba(255,0,0,0.5)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(input.aimX,input.aimY,10,0,Math.PI*2); ctx.moveTo(input.aimX-15,input.aimY); ctx.lineTo(input.aimX+15,input.aimY); ctx.moveTo(input.aimX,input.aimY-15); ctx.lineTo(input.aimX,input.aimY+15); ctx.stroke();
        // Explosiones (hoja de animación) + partículas (anillos y chispas).
        drawBlasts(ctx);
        drawParticles(ctx); ctx.globalAlpha=1;
        floatingTexts.forEach(ft=>{ ctx.globalAlpha=Math.max(0,ft.life); ctx.fillStyle=ft.color; ctx.font="bold 16px Orbitron"; ctx.fillText(ft.text,ft.x-25,ft.y-15); }); ctx.globalAlpha=1;
        if(combatState.health>0 && combatState.health<=combatState.damagePerHit && gameState==='PLAYING'){ ensureVignettes(); const pulse=0.32+Math.sin(fxState.frameCount*0.12)*0.18; ctx.globalAlpha=pulse; ctx.drawImage(dangerVignette,0,0); ctx.globalAlpha=1; for(let s=0;s<22;s++){const sx=Math.random()*canvas.width,sy=Math.random()*canvas.height; ctx.globalAlpha=Math.random()*0.35; ctx.fillStyle=Math.random()>0.5?'#ffffff':'#ff2222'; ctx.fillRect(sx,sy,Math.random()*2+1,Math.random()*2+1);} ctx.globalAlpha=1; }
        if(progression.waveTransition && progression.waveTransitionMsg){ const progress=1-(progression.waveTransitionTimer/150); const alpha=progress<0.2?progress/0.2:progress>0.8?(1-progress)/0.2:1; ctx.globalAlpha=alpha*0.85; ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.globalAlpha=alpha; ctx.textAlign='center'; ctx.font='bold 14px Orbitron'; ctx.fillStyle='#666'; ctx.fillText('— PREPARATE —',canvas.width/2,canvas.height/2-50); ctx.font='bold 40px Orbitron'; ctx.fillStyle=waveGradient(); ctx.shadowBlur=20; ctx.shadowColor='#fff'; ctx.fillText(progression.waveTransitionMsg,canvas.width/2,canvas.height/2+10); ctx.shadowBlur=0; ctx.font='13px Orbitron'; ctx.fillStyle='#aaa'; const waveLabel=['SECTOR 1','BOSS 1','SECTOR 2','BOSS 2','SECTOR 3','BOSS 3','SECTOR 4','JEFE FINAL','FIN'][progression.wavePhase-1]||''; ctx.fillText(`SIGUIENTE: ${waveLabel}`,canvas.width/2,canvas.height/2+55); ctx.globalAlpha=1; ctx.textAlign='left'; if(progression.waveTransitionTimer>0) progression.waveTransitionTimer--; }
        if(nave.inmune && !dashActive){ ensureVignettes(); const pulse=Math.abs(Math.sin(fxState.frameCount*0.18)); ctx.globalAlpha=0.35*pulse; ctx.drawImage(immuneVignette,0,0); ctx.globalAlpha=1; }
    }
    if (['FREE_BOSS_DEATH', 'EXPLORATION_DEATH', 'TRAINING_DEATH'].includes(gameState)) {
        const elapsed = performance.now() - freeBossDeathStartedAt;
        ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center'; ctx.fillStyle = '#ff4058'; ctx.font = 'bold 42px Orbitron';
        ctx.globalAlpha = Math.min(1, elapsed / 1400); ctx.fillText('HAS MUERTO', canvas.width / 2, canvas.height / 2 - 18); ctx.globalAlpha = 1;
        if (elapsed >= 2000) {
            const count = Math.max(0, 5 - Math.floor((elapsed - 2000) / 1000));
            ctx.fillStyle = '#dce8f5'; ctx.font = canvas.width < 600 ? '10px Orbitron' : '15px Orbitron';
            if (deathSequenceState === 'TRAINING_DEATH') {
                ctx.fillText('Has muerto en el entrenamiento,', canvas.width / 2, canvas.height / 2 + 23);
                ctx.fillText('saliendo de sala de entrenamiento', canvas.width / 2, canvas.height / 2 + 40);
            } else ctx.fillText('Reapareciendo en zona segura...', canvas.width / 2, canvas.height / 2 + 25);
            ctx.fillStyle = '#6ec8ff'; ctx.font = 'bold 32px Orbitron'; ctx.fillText(String(count), canvas.width / 2, canvas.height / 2 + 82);
        }
        ctx.textAlign = 'left';
    }
    ctx.restore(); update(deltaTime);
    adaptParticleBudget(deltaTime, performance.now()-workStart);
}

// El canvas HTML nace en 300×150: si se inicializa el parallax antes de
// applyOptions(), las estrellas quedan medidas para 300×150 y el resto del
// fondo aparece vacío. Primero se fija el tamaño real y luego se reparte.
applyOptions();
refreshModeSlots();
initParallax(canvas);
updateVolumeVisibility();
requestAnimationFrame(draw);

// El juego arrancó correctamente: el diagnóstico de index.html ya no debe avisar.
window.__gameBooted = true;
if (window.__hideBootError) window.__hideBootError();
