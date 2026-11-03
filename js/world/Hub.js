// Hub de exploración: estaciones, cinturones de asteroides y salvamento.

import { world } from './Camera.js';
import { nave } from '../entities/Player.js';
import { combatState, awardCredits, spendCredits } from '../system/Combat.js';
import { platform } from '../State.js';
import { updateExplorationHUD } from '../ui/Hud.js';
import { savePlayerState } from '../system/Save.js';
import { progression } from '../system/Progression.js';
import { hudState } from '../ui/Hud.js';
import { drawGlow } from '../system/Sprites.js';

const INTERACTION_RANGE = 175;
const CREDIT_PER_DEBRIS = 5;
const MAX_BOMBS = 5;
const BASE_ACCEL = 0.9;
const BELT_GRID_SIZE = 6000;
const BELT_REFILL_MS = 120000;
const SAFE_ZONE_RADIUS = 1500;

export const hubState = {
    stations: [],
    zones: [],
    beltRecords: new Map(),
    debris: [],
    projectiles: [],
    floaters: [],
    nearStation: null,
    panelOpen: false,
    fireCooldown: 0,
    thrusterLevel: 0,
    medicalTimer: 0,
    marketLoadout: { homing: false, spread: false }
};

function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function ensurePanel() {
    const panel = document.getElementById('station-panel');
    if (!panel || panel.dataset.hubBound) return panel;
    panel.dataset.hubBound = 'true';
    panel.addEventListener('click', event => {
        const button = event.target.closest?.('[data-hub-action], [data-hub-close]');
        if (!button) return;
        if (button.hasAttribute('data-hub-close')) closeStationPanel();
        else purchaseUpgrade(button.dataset.hubAction);
    });
    return panel;
}

function makeAsteroid(rnd, x, y, zoneId) {
    const radius = 30 + rnd() * 28;
    const pointCount = 6 + Math.floor(rnd() * 3);
    const points = [];
    for (let i = 0; i < pointCount; i++) {
        const angle = i / pointCount * Math.PI * 2;
        const r = radius * (0.78 + rnd() * 0.28);
        points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
    }
    return {
        x, y, zoneId, radius, points,
        hp: 5 + Math.floor((radius - 30) / 4),
        maxHp: 5 + Math.floor((radius - 30) / 4),
        rot: rnd() * Math.PI * 2,
        spin: (rnd() - 0.5) * 0.8,
        color: ['#56647a', '#675d78', '#596f70'][Math.floor(rnd() * 3)]
    };
}

function beltRandom(cellX, cellY, generation = 0) {
    const seed = (world.seed ^ Math.imul(cellX, 0x45d9f3b) ^ Math.imul(cellY, 0x119de1f3) ^ Math.imul(generation, 0x27d4eb2d)) >>> 0;
    return mulberry32(seed);
}

function populateBelt(zone, rnd) {
    zone.asteroids = [];
    const count = 12 + Math.floor(rnd() * 9);
    for (let i = 0; i < count; i++) {
        const angle = rnd() * Math.PI * 2;
        const distance = rnd() * zone.r * 0.82;
        zone.asteroids.push(makeAsteroid(rnd,
            zone.x + Math.cos(angle) * distance,
            zone.y + Math.sin(angle) * distance,
            zone.id));
    }
    zone.cleared = false;
    zone.refillAt = 0;
}

function ensureProceduralBelts(navePosition) {
    const cellX = Math.floor(navePosition.x / BELT_GRID_SIZE);
    const cellY = Math.floor(navePosition.y / BELT_GRID_SIZE);
    const activeZones = [];
    for (let y = cellY - 2; y <= cellY + 2; y++) {
        for (let x = cellX - 2; x <= cellX + 2; x++) {
            const key = `${x},${y}`;
            if (!hubState.beltRecords.has(key)) {
                const rnd = beltRandom(x, y);
                if (rnd() > 0.48) { hubState.beltRecords.set(key, null); continue; }
                const jitter = () => (rnd() - 0.5) * 700;
                const zoneX = x * BELT_GRID_SIZE + BELT_GRID_SIZE / 2 + jitter();
                const zoneY = y * BELT_GRID_SIZE + BELT_GRID_SIZE / 2 + jitter();
                const radius = 500 + rnd() * 220;
                if (Math.hypot(zoneX, zoneY) < SAFE_ZONE_RADIUS + radius + 250) {
                    hubState.beltRecords.set(key, null);
                    continue;
                }
                const zone = { id: `belt-${x}-${y}`, type: 'asteroid', cellX: x, cellY: y,
                    x: zoneX, y: zoneY, r: radius, cleared: false, refillAt: 0,
                    generation: 0, asteroids: [], label: 'CINTURÓN DE ASTEROIDES' };
                populateBelt(zone, rnd);
                hubState.beltRecords.set(key, zone);
            }
            const zone = hubState.beltRecords.get(key);
            if (!zone) continue;
            if (Math.hypot(navePosition.x - zone.x, navePosition.y - zone.y) < zone.r + 1100) zone.discovered = true;
            if (zone.cleared && zone.refillAt && Date.now() >= zone.refillAt) {
                zone.generation++;
                populateBelt(zone, beltRandom(x, y, zone.generation));
            }
            activeZones.push(zone);
        }
    }
    hubState.zones = activeZones;
    hubState.debris = activeZones.flatMap(zone => zone.asteroids);
    world.zones = world.zones.filter(zone => zone.type !== 'asteroid');
    world.zones.push(...activeZones);
}

export function initHub() {
    hubState.stations = [
        { id: 'shipyard', x: -405, y: -38, r: 78, interactionRange: INTERACTION_RANGE, type: 'shipyard', color: '#6ec8ff', label: 'ASTILLERO' },
        { id: 'medical', x: 405, y: -38, r: 62, interactionRange: INTERACTION_RANGE, type: 'medical', color: '#59ff8a', label: 'MÓDULO MÉDICO' },
        { id: 'black-market', x: 0, y: 405, r: 58, interactionRange: INTERACTION_RANGE, type: 'black_market', color: '#ffd84a', label: 'CONTRABANDO' },
        { id: 'data-vault', x: 0, y: -400, r: 58, interactionRange: INTERACTION_RANGE, type: 'data_vault', color: '#bf8bff', label: 'BÓVEDA DE DATOS' },
        { id: 'portal-progressive', x: -870, y: -720, r: 58, interactionRange: INTERACTION_RANGE, type: 'portal_progressive', color: '#56d8ff', label: 'PORTAL MODO PROGRESSIVE' },
        { id: 'portal-solo-boss', x: 870, y: -720, r: 58, interactionRange: INTERACTION_RANGE, type: 'portal_solo_boss', color: '#ff6688', label: 'PORTAL MODO SOLO BOSS' },
        { id: 'training', x: 0, y: 1030, r: 66, interactionRange: INTERACTION_RANGE, type: 'training', color: '#d6a0ff', label: 'CÁMARA DE ENTRENAMIENTO' }
    ];
    hubState.zones = [];
    hubState.debris = [];
    hubState.projectiles = [];
    hubState.floaters = [];
    hubState.nearStation = null;
    hubState.panelOpen = false;
    hubState.fireCooldown = 0;
    hubState.medicalTimer = 0;
    hubState.marketLoadout = { homing: false, spread: false };
    if (!Number.isFinite(nave.accel) || nave.accel < BASE_ACCEL) nave.accel = BASE_ACCEL;
    hubState.thrusterLevel = Math.max(0, Math.round((nave.accel - BASE_ACCEL) / 0.08));

    hubState.beltRecords = new Map();
    ensurePanel();
    updateExplorationHUD({ active: true, credits: combatState.credits, health: combatState.health, bombs: combatState.bombs, hasRevive: combatState.hasRevive, accel: nave.accel });
}

function stationOptions(station) {
    if (station?.type === 'shipyard') {
        return [
            { id: 'speed', label: 'Velocidad +8%', cost: 55, disabled: nave.accel >= 1.3 },
            { id: 'damage', label: `Daño +12% (nivel ${nave.damageLevel || 0}/5)`, cost: 100, disabled: (nave.damageLevel || 0) >= 5 },
            { id: 'dash', label: `Recarga de Dash -10% (nivel ${nave.dashLevel || 0}/5)`, cost: 90, disabled: (nave.dashLevel || 0) >= 5 },
            { id: 'shield', label: `Capacidad de escudo +15% (nivel ${nave.shieldLevel || 0}/5)`, cost: 90, disabled: (nave.shieldLevel || 0) >= 5 },
            { id: 'bomb', label: 'Recargar bomba (+1)', cost: 45, disabled: combatState.bombs >= MAX_BOMBS }
        ];
    }
    if (station?.type === 'black_market') return [
        { id: 'triple', label: 'Instalar modificador de triple disparo', cost: 180, disabled: (nave.tripleLevel || 0) >= 1 },
        { id: 'homing', label: 'Misiles teledirigidos (30 s)', cost: 90, disabled: false },
        { id: 'spread', label: 'Módulo de dispersión (30 s)', cost: 75, disabled: false }
    ];
    if (station?.type === 'medical') return [];
    if (station?.type === 'data_vault') return [ { id: 'save', label: 'Guardar partida y datos locales', cost: 0, disabled: false } ];
    if (station?.type === 'portal_progressive') return [ { id: 'enter_progressive', label: 'Portal modo progressive', cost: 0, disabled: false } ];
    if (station?.type === 'portal_solo_boss') return [ { id: 'enter_solo_boss', label: 'Portal modo solo boss', cost: 0, disabled: false } ];
    if (station?.type === 'training') return [ { id: 'open_training', label: 'Abrir partida personalizada', cost: 0, disabled: false } ];
    return [];
}

function refreshPanel() {
    const panel = ensurePanel();
    if (!panel) return;
    const station = hubState.nearStation;
    const title = document.getElementById('station-title');
    const description = document.getElementById('station-description');
    const balance = document.getElementById('station-credits');
    const actions = document.getElementById('station-actions');
    if (title) title.textContent = station ? station.label : 'ESTACIÓN';
    if (description) {
        const stats = typeof window.getExplorationStats === 'function' ? window.getExplorationStats() : { discovered: 0, total: 12 };
        let highScore = hudState.score;
        try { highScore = Math.max(Number(localStorage.getItem('space-mission-highscore')) || 0, hudState.score); } catch { /* Se muestra el score de esta sesión. */ }
        description.textContent = station?.type === 'shipyard'
            ? 'Mejora permanente de velocidad, daño, Dash y capacidad del escudo.'
            : station?.type === 'medical'
                ? 'Reparación gradual: 2% de casco por 3 créditos cada segundo mientras permanezcas aquí.'
                    : station?.type === 'black_market'
                    ? 'Intercambia créditos por modificadores y munición experimental.'
                    : station?.type === 'portal_progressive' || station?.type === 'portal_solo_boss'
                        ? 'Portal de acceso al modo de combate indicado.'
                    : station?.type === 'training'
                        ? 'Configura enemigos y jefes en una simulación. Si la nave cae, el entrenamiento termina y vuelves a la estación.'
                    : `Partida guardada localmente. High Score: ${highScore} · Sectores descubiertos: ${stats.discovered}/${stats.total}.`;
    }
    if (balance) balance.textContent = `CRÉDITOS: ${combatState.credits}`;
    if (!actions) return;
    actions.replaceChildren();
    for (const option of stationOptions(station)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.hubAction = option.id;
        button.textContent = `${option.label} — ${option.cost} CR`;
        button.disabled = option.disabled || combatState.credits < option.cost;
        actions.appendChild(button);
    }
}

function openStationPanel() {
    if (!hubState.nearStation) return false;
    hubState.panelOpen = true;
    const panel = ensurePanel();
    if (panel) panel.style.display = 'block';
    refreshPanel();
    return true;
}

export function closeStationPanel() {
    hubState.panelOpen = false;
    const panel = document.getElementById('station-panel');
    if (panel) panel.style.display = 'none';
    updateExplorationHUD({ active: true, credits: combatState.credits, health: combatState.health, bombs: combatState.bombs, hasRevive: combatState.hasRevive, accel: nave.accel, nearStation: hubState.nearStation });
}

function purchaseUpgrade(action) {
    const station = hubState.nearStation;
    if (!station || !hubState.panelOpen) return;
    let cost = 0;
    if (action === 'speed' && station.type === 'shipyard') {
        cost = 55;
        if (nave.accel >= 1.3) return;
        if (spendCredits(cost)) {
            nave.accel = Math.min(1.3, nave.accel + 0.08);
            hubState.thrusterLevel++;
        }
    } else if (station.type === 'shipyard' && ['damage','dash','shield'].includes(action)) {
        const levelKey = action === 'damage' ? 'damageLevel' : action === 'dash' ? 'dashLevel' : 'shieldLevel';
        const max = 5;
        if ((nave[levelKey] || 0) >= max) return;
        cost = action === 'damage' ? 100 : 90;
        if (spendCredits(cost)) nave[levelKey] = (nave[levelKey] || 0) + 1;
    } else if (action === 'bomb' && station.type === 'shipyard') {
        cost = 45; if (combatState.bombs >= MAX_BOMBS) return;
        if (spendCredits(cost)) combatState.bombs++;
    } else if (action === 'triple' && station.type === 'black_market') {
        cost = 180; if ((nave.tripleLevel || 0) >= 1) return;
        if (spendCredits(cost)) nave.tripleLevel = 1;
    } else if (action === 'homing' && station.type === 'black_market') {
        cost = 90; if (spendCredits(cost)) hubState.marketLoadout.homing = true;
    } else if (action === 'spread' && station.type === 'black_market') {
        cost = 75; if (spendCredits(cost)) hubState.marketLoadout.spread = true;
    } else if (action === 'save' && station.type === 'data_vault') {
        savePlayerState(combatState, nave, progression);
        try { localStorage.setItem('space-mission-highscore', String(Math.max(Number(localStorage.getItem('space-mission-highscore')) || 0, hudState.score))); } catch { /* Guardado principal usa su propio mecanismo. */ }
    } else if (action === 'enter_progressive' && station.type === 'portal_progressive') {
        window.startMission?.('progressive', { fromHubPortal: true });
        return;
    } else if (action === 'enter_solo_boss' && station.type === 'portal_solo_boss') {
        window.startMission?.('solo_boss', { fromHubPortal: true });
        return;
    } else if (action === 'open_training' && station.type === 'training') {
        window.openTrainingMode?.();
        return;
    }
    refreshPanel();
    updateExplorationHUD({ active: true, credits: combatState.credits, health: combatState.health, bombs: combatState.bombs, hasRevive: combatState.hasRevive, accel: nave.accel, nearStation: hubState.nearStation, panelOpen: true });
    savePlayerState(combatState, nave, progression);
}

function updateStationProximity(navePosition) {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const station of hubState.stations) {
        const distance = Math.hypot(navePosition.x - station.x, navePosition.y - station.y);
        if (distance <= station.interactionRange && distance < nearestDistance) {
            nearest = station;
            nearestDistance = distance;
        }
    }
    hubState.nearStation = nearest;
}

function drawAegisPrime(ctx, canvas) {
    const radius = 560;
    const sx = -world.cameraX;
    const sy = -world.cameraY;
    if (sx < -radius || sx > canvas.width + radius || sy < -radius || sy > canvas.height + radius) return;

    const time = Date.now() / 1000;
    const pulse = 0.72 + Math.sin(time * 1.4) * 0.08;
    ctx.save();
    ctx.translate(0, 0);

    // La estación se dibuja primero como una silueta continua, dejando los
    // cuatro servicios encima para que sigan siendo objetivos interactivos.
    ctx.save();
    ctx.globalAlpha = 0.3;
    drawGlow(ctx, 0, 0, 400, '#29dfff', 0.5);
    ctx.fillStyle = '#123449';
    ctx.beginPath(); ctx.arc(0, 0, 330, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Brazos estructurales radiales y conductos de energía.
    for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4 + Math.PI / 8;
        ctx.save(); ctx.rotate(angle);
        ctx.fillStyle = '#283847'; ctx.strokeStyle = '#7b9bac'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(245, -38); ctx.lineTo(365, -27); ctx.lineTo(398, -12);
        ctx.lineTo(398, 12); ctx.lineTo(365, 27); ctx.lineTo(245, 38); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#34c9e8'; ctx.globalAlpha = 0.6;
        ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(270, 0); ctx.lineTo(386, 0); ctx.stroke();
        ctx.restore();
    }

    // Anillos blindados con segmentos, remaches y marcas de rotación lenta.
    for (const [r, width, color] of [[285, 38, '#607989'], [230, 22, '#344958'], [180, 14, '#8198a4']]) {
        ctx.strokeStyle = '#182632'; ctx.lineWidth = width + 12;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = color; ctx.lineWidth = width;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(165,205,220,0.7)'; ctx.lineWidth = 2;
        ctx.setLineDash([12, 9]); ctx.lineDashOffset = -time * 7;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }

    // Placas del casco central.
    for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8;
        const inner = 112, outer = 165;
        const a1 = angle + 0.035, a2 = angle + Math.PI / 8 - 0.035;
        ctx.fillStyle = i % 2 ? '#263b49' : '#344b59';
        ctx.strokeStyle = '#7b9aa8'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a1) * inner, Math.sin(a1) * inner);
        ctx.lineTo(Math.cos(a1) * outer, Math.sin(a1) * outer);
        ctx.lineTo(Math.cos(a2) * outer, Math.sin(a2) * outer);
        ctx.lineTo(Math.cos(a2) * inner, Math.sin(a2) * inner);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        const boltAngle = (a1 + a2) / 2;
        ctx.fillStyle = '#b9d1d9'; ctx.beginPath();
        ctx.arc(Math.cos(boltAngle) * 151, Math.sin(boltAngle) * 151, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Núcleo del reactor y su halo cian.
    ctx.save(); drawGlow(ctx, 0, 0, 150, '#54eaff', 0.5);
    ctx.fillStyle = '#07131f'; ctx.strokeStyle = `rgba(82,230,255,${pulse})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, 105, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#9deeff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 76, 0, Math.PI * 2); ctx.stroke();
    const core = ctx.createRadialGradient(-18, -22, 4, 0, 0, 66);
    core.addColorStop(0, '#d8ffff'); core.addColorStop(0.18, '#55eaff');
    core.addColorStop(0.55, '#117b9d'); core.addColorStop(1, '#071321');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8ffff'; ctx.globalAlpha = pulse;
    ctx.beginPath(); ctx.arc(0, 0, 13 + Math.sin(time * 2) * 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Torre de control y bahía de atraque al norte.
    ctx.fillStyle = '#344a57'; ctx.strokeStyle = '#9cb4bd'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-62, -158); ctx.lineTo(-46, -245); ctx.lineTo(-27, -280);
    ctx.lineTo(27, -280); ctx.lineTo(46, -245); ctx.lineTo(62, -158); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff5a61';
    drawGlow(ctx, 0, -253, 32, '#ff4353', 0.7);
    ctx.fillRect(-25, -259, 50, 12);
    ctx.fillStyle = '#172630'; ctx.fillRect(-27, -236, 54, 48);
    ctx.strokeStyle = '#72dff2'; ctx.strokeRect(-27, -236, 54, 48);

    // Muelle inferior con propulsores y escape luminoso.
    ctx.fillStyle = '#314653'; ctx.strokeStyle = '#94aeb8'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-116, 238); ctx.lineTo(-76, 180); ctx.lineTo(-42, 160);
    ctx.lineTo(42, 160); ctx.lineTo(76, 180); ctx.lineTo(116, 238); ctx.lineTo(85, 291);
    ctx.lineTo(-85, 291); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#14232d'; ctx.beginPath(); ctx.moveTo(-48, 225); ctx.lineTo(0, 181); ctx.lineTo(48, 225);
    ctx.lineTo(31, 262); ctx.lineTo(-31, 262); ctx.closePath(); ctx.fill();
    for (const x of [-54, 54]) {
        drawGlow(ctx, x, 310, 40, '#ff9d43', 0.8);
        ctx.fillStyle = '#ffad55';
        ctx.beginPath(); ctx.moveTo(x - 10, 290); ctx.lineTo(x + 10, 290); ctx.lineTo(x, 328 + Math.sin(time * 8 + x) * 7); ctx.closePath(); ctx.fill();
    }

    ctx.textAlign = 'center'; ctx.font = 'bold 15px Orbitron';
    drawGlow(ctx, 0, 7, 110, '#2ddfff', 0.35);
    ctx.fillStyle = '#c9f7ff';
    ctx.fillText('AEGIS PRIME', 0, 14);
    ctx.font = '9px Orbitron'; ctx.fillStyle = '#81b7c8'; ctx.fillText('NÚCLEO DE OPERACIONES · 0, 0', 0, 31);
    ctx.restore();
}

function damageAsteroidAt(x, y) {
    for (let j = hubState.debris.length - 1; j >= 0; j--) {
        const asteroid = hubState.debris[j];
        if (Math.hypot(x - asteroid.x, y - asteroid.y) > asteroid.radius + 5) continue;
        asteroid.hp--;
        if (asteroid.hp <= 0) {
            hubState.debris.splice(j, 1);
            awardCredits(CREDIT_PER_DEBRIS);
            hubState.floaters.push({ x: asteroid.x, y: asteroid.y, life: 1, text: `+${CREDIT_PER_DEBRIS} CR` });
            const zone = hubState.zones.find(item => item.id === asteroid.zoneId);
            if (zone) {
                zone.asteroids = zone.asteroids.filter(item => item !== asteroid);
                if (typeof window.explorationBeltAsteroidDestroyed === 'function') window.explorationBeltAsteroidDestroyed(asteroid.x, asteroid.y);
                if (!zone.asteroids.length) {
                    zone.cleared = true;
                    zone.refillAt = Date.now() + BELT_REFILL_MS;
                    hubState.floaters.push({ x: zone.x, y: zone.y, life: 3, text: 'Despejado' });
                }
            }
        }
        return true;
    }
    return false;
}

function updateSalvage(dt, combatProjectiles = []) {
    for (let i = hubState.projectiles.length - 1; i >= 0; i--) {
        const projectile = hubState.projectiles[i];
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        projectile.life -= dt;
        const hit = damageAsteroidAt(projectile.x, projectile.y);
        if (hit || projectile.life <= 0) hubState.projectiles.splice(i, 1);
    }
    for (let i = combatProjectiles.length - 1; i >= 0; i--) {
        if (damageAsteroidAt(combatProjectiles[i].x, combatProjectiles[i].y)) combatProjectiles.splice(i, 1);
    }
    for (let i = hubState.floaters.length - 1; i >= 0; i--) {
        hubState.floaters[i].life -= dt;
        hubState.floaters[i].y -= dt * 24;
        if (hubState.floaters[i].life <= 0) hubState.floaters.splice(i, 1);
    }
}

export function updateHub(dt, navePosition, input, { nearZone = false, nearPlanet = null, nearCache = false, zoneLabel = '', combatProjectiles = [], sector = '', inSafeZone = false, encounter = null, threatMessage = '', threatTimer = 0 } = {}) {
    const step = Math.max(0, Math.min(0.05, dt || 0));
    ensureProceduralBelts(navePosition);
    updateStationProximity(navePosition);
    if (input.interact) {
        input.interact = false;
        if (hubState.panelOpen) closeStationPanel();
        else openStationPanel();
    }
    if (hubState.nearStation?.type === 'medical' && combatState.health < combatState.maxHealth) {
        hubState.medicalTimer += step;
        if (hubState.medicalTimer >= 1 && combatState.credits >= 3) {
            hubState.medicalTimer -= 1;
            if (spendCredits(3)) combatState.health = Math.min(combatState.maxHealth, combatState.health + 2);
        }
    } else hubState.medicalTimer = 0;
    updateSalvage(step, combatProjectiles);
    savePlayerState(combatState, nave, progression);
    updateExplorationHUD({
        active: true,
        credits: combatState.credits,
        health: combatState.health,
        bombs: combatState.bombs,
        hasRevive: combatState.hasRevive,
        accel: nave.accel,
        nearStation: hubState.nearStation,
        nearZone,
        nearPlanet,
        nearCache,
        zoneLabel,
        panelOpen: hubState.panelOpen,
        sector,
        inSafeZone,
        encounter,
        threatMessage,
        threatTimer
    });
}

export function drawHub(ctx, canvas) {
    drawAegisPrime(ctx, canvas);
    for (const zone of hubState.zones) {
        const sx = zone.x - world.cameraX;
        const sy = zone.y - world.cameraY;
        if (sx < -zone.r || sx > canvas.width + zone.r || sy < -zone.r || sy > canvas.height + zone.r) continue;
        ctx.save();
        ctx.globalAlpha = zone.cleared ? 0.18 : 0.32;
        ctx.strokeStyle = zone.cleared ? '#8aa0b8' : '#ff9966';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 9]);
        ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.textAlign = 'center';
        ctx.font = '9px Orbitron';
        ctx.fillText(zone.cleared ? `${zone.label} · LIMPIO` : zone.label, zone.x, zone.y - zone.r - 8);
        ctx.restore();
    }

    for (const station of hubState.stations) {
        const sx = station.x - world.cameraX;
        const sy = station.y - world.cameraY;
        if (sx < -station.r * 2 || sx > canvas.width + station.r * 2 || sy < -station.r * 2 || sy > canvas.height + station.r * 2) continue;
        ctx.save();
        ctx.translate(station.x, station.y);
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = station.color;
        ctx.beginPath(); ctx.arc(0, 0, station.r * 1.7, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = 'rgba(5,10,20,0.9)';
        ctx.strokeStyle = station.color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, station.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = station.color;
        ctx.strokeStyle = station.color;
        ctx.lineWidth = 3;
        if (station.type === 'shipyard') {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 6; const px = Math.cos(a) * station.r * .72; const py = Math.sin(a) * station.r * .72; if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#071320'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
        } else if (station.type === 'medical') {
            ctx.fillStyle = '#07130a'; ctx.fillRect(-21, -21, 42, 42); ctx.strokeRect(-21, -21, 42, 42);
            ctx.fillStyle = station.color; ctx.fillRect(-5, -16, 10, 32); ctx.fillRect(-16, -5, 32, 10);
        } else if (station.type === 'black_market') {
            ctx.fillStyle = '#201900'; ctx.beginPath(); ctx.ellipse(0, 0, 27, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff2a8'; ctx.beginPath(); ctx.arc(0, 0, 5 + Math.sin(Date.now() / 260) * 1.5, 0, Math.PI * 2); ctx.fill();
        } else if (station.type === 'portal_progressive' || station.type === 'portal_solo_boss') {
            const pulse = 0.78 + Math.sin(Date.now() / 250) * 0.18;
            ctx.save(); ctx.globalAlpha = pulse; drawGlow(ctx, 0, 0, 70, station.color, 0.6);
            ctx.strokeStyle = station.color; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(0, 0, 28, 40, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 0.24; ctx.fillStyle = station.color; ctx.beginPath(); ctx.ellipse(0, 0, 23, 35, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else if (station.type === 'training') {
            ctx.fillStyle = '#211632'; ctx.strokeStyle = station.color; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(34, 27); ctx.lineTo(-34, 27); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = station.color; ctx.font = 'bold 17px Orbitron'; ctx.textAlign = 'center'; ctx.fillText('SIM', 0, 9);
        } else {
            ctx.fillStyle = '#100d1a'; ctx.fillRect(-25, -19, 50, 38); ctx.strokeRect(-25, -19, 50, 38);
            ctx.fillStyle = station.color; ctx.fillRect(-15, -10, 30, 3); ctx.fillRect(-15, -3, 20, 3); ctx.fillRect(-15, 4, 25, 3);
        }
        ctx.font = 'bold 11px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = station.color;
        ctx.fillText(station.label, 0, station.r + 20);
        ctx.font = '8px Orbitron';
        ctx.fillStyle = '#c7d5e6';
        ctx.fillText('PRESIONA E', 0, station.r + 34);
        ctx.restore();
    }

    for (const asteroid of hubState.debris) {
        const sx = asteroid.x - world.cameraX;
        const sy = asteroid.y - world.cameraY;
        if (sx < -asteroid.radius - 8 || sx > canvas.width + asteroid.radius + 8 || sy < -asteroid.radius - 8 || sy > canvas.height + asteroid.radius + 8) continue;
        ctx.save();
        ctx.translate(asteroid.x, asteroid.y);
        ctx.rotate(asteroid.rot);
        ctx.fillStyle = asteroid.color;
        ctx.strokeStyle = 'rgba(198,220,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(asteroid.points[0][0], asteroid.points[0][1]);
        for (let i = 1; i < asteroid.points.length; i++) ctx.lineTo(asteroid.points[i][0], asteroid.points[i][1]);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        if (asteroid.hp < asteroid.maxHp) {
            ctx.strokeStyle = '#ffcc66';
            ctx.beginPath(); ctx.arc(0, 0, asteroid.radius + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * asteroid.hp / asteroid.maxHp); ctx.stroke();
        }
        ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = '#7ceaff';
    for (const projectile of hubState.projectiles) {
        ctx.globalAlpha = Math.min(1, projectile.life * 1.5);
        ctx.beginPath(); ctx.arc(projectile.x, projectile.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px Orbitron';
    for (const floater of hubState.floaters) {
        ctx.globalAlpha = Math.max(0, floater.life);
        ctx.fillStyle = '#ffe28a';
        ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.restore();
}
