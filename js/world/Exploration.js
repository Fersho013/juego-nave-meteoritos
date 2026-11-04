// Exploración espacial procedural y sin límites (Fase 2).
// La nave y los objetos usan coordenadas de mundo; el HUD usa coordenadas
// de pantalla. Los chunks lejanos se descartan y se regeneran con la semilla.

import { world, camera, setViewport, screenToWorld } from './Camera.js';
import { drawParallax } from './Parallax.js';
import { drawGlow, getGlowSprite } from '../system/Sprites.js';
import { drawHub, hubState } from './Hub.js?v=20261103a';
import { createPlanets, drawPlanet } from './Planets.js?v=20261103a';
import { getWaypoint, clearWaypoint } from '../ui/StarMap.js?v=20261103a';

const CHUNK_SIZE = 900;
const CHUNK_MARGIN = 1;
const SHIP_START_X = 0;
const SHIP_START_Y = 0;
const MAX_VISIBLE_CHUNKS = 100;
const SAFE_ZONE_RADIUS = 1500;
const EVENT_GRID_SIZE = 6000;
const EXPLORATION_ENEMY_TYPES = ['common', 'shield', 'suicidal', 'special', 'elite', 'kamikaze', 'kamikaze_bomb'];

export const exploration = {    initialized: false,
    time: 0,
    nearGate: false,
    gateDist: 0,
    sector: 'SECTOR ALFA',
    inSafeZone: true,
    gate: null,
    combatZones: [],
    enteringZone: null,
    speedParticles: [],
    particleTimer: 0,
    trail: [],
    traffic: [],
    encounter: null,
    encounterTimer: 7,
    encounterShots: [],
    spawnX: SHIP_START_X,
    spawnY: SHIP_START_Y,
    mapReveal: 1,
    proceduralEvents: new Map(),
    exploredCells: new Set(),
    bombDetonations: 0,
    bombCooldown: 0,
    threatMessage: '',
    threatMessageTimer: 0,
    statusMessage: '',
    statusMessageTimer: 0,
    huntBosses: [],
    planets: [], nearPlanet: null, planetDist: Infinity,
    cache: null, cacheTimer: 10, nearCache: false
};

// Una celda del mapa (6 km) solo revela sus objetos cuando el jugador la ha
// recorrido. Los planetas son la única excepción: siempre visibles.
export function isPointExplored(x, y) {
    return exploration.exploredCells.has(`${Math.round(x / EVENT_GRID_SIZE)},${Math.round(y / EVENT_GRID_SIZE)}`);
}

function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function seedForChunk(cx, cy) {
    let seed = (world.seed ^ Math.imul(cx, 0x9e3779b1) ^ Math.imul(cy, 0x85ebca6b)) >>> 0;
    seed ^= seed >>> 16;
    seed = Math.imul(seed, 0x7feb352d) >>> 0;
    seed ^= seed >>> 15;
    seed = Math.imul(seed, 0x846ca68b) >>> 0;
    return (seed ^ (seed >>> 16)) >>> 0;
}

function makeProceduralEvent(cellX, cellY) {
    let seed = (world.seed ^ Math.imul(cellX, 0x45d9f3b) ^ Math.imul(cellY, 0x119de1f3)) >>> 0;
    seed ^= seed >>> 16; seed = Math.imul(seed, 0x7feb352d) >>> 0; seed ^= seed >>> 15;
    const rnd = mulberry32(seed);
    const enemyTypes = ['common', 'special', 'elite', 'kamikaze', 'kamikaze_bomb'];
    const bossTypes = ['static', 'moving', 'hunter', 'berserker', 'doppel'];
    const distance = Math.hypot(cellX * EVENT_GRID_SIZE, cellY * EVENT_GRID_SIZE);
    const difficulty = Math.min(1, distance / 180000);
    const makeWave = () => {
        const total = 18 + Math.floor(difficulty * 160) + Math.floor(rnd() * (20 + difficulty * 50));
        const groups = [];
        let remaining = total;
        while (remaining > 0) {
            const count = groups.length === 4 ? remaining : Math.min(remaining, 5 + Math.floor(rnd() * Math.min(46, remaining)));
            groups.push({ type: enemyTypes[Math.floor(rnd() * enemyTypes.length)], count });
            remaining -= count;
        }
        return { groups, total };
    };
    const pickBoss = () => bossTypes[Math.floor(rnd() * bossTypes.length)];
    const mode = rnd() < 0.16 + difficulty * 0.52 ? 2 : Math.floor(rnd() * 4);
    let kind, stages;
    if (mode === 0) {
        kind = 'HORDA'; stages = [{ ...makeWave(), bosses: [] }];
    } else if (mode === 1) {
        kind = 'OLEADA + JEFE'; stages = [{ ...makeWave(), bosses: [pickBoss()] }];
    } else if (mode === 2) {
        kind = 'DOBLE JEFE'; stages = [{ groups: [], total: 0, bosses: [pickBoss(), pickBoss()] }];
        if (stages[0].bosses[1] === stages[0].bosses[0]) stages[0].bosses[1] = bossTypes[(bossTypes.indexOf(stages[0].bosses[1]) + 1) % bossTypes.length];
    } else {
        kind = 'SECTOR DE ASALTO';
        stages = [{ ...makeWave(), bosses: [] }, { ...makeWave(), bosses: [pickBoss()] }];
    }
    return {
        id: `proc-${cellX}-${cellY}`, type: 'procedural', x: cellX * EVENT_GRID_SIZE, y: cellY * EVENT_GRID_SIZE,
        r: 92, cleared: false, cellX, cellY, kind, stages,
        difficulty,
        enemyTotal: stages.reduce((sum, stage) => sum + stage.total, 0),
        bossTotal: stages.reduce((sum, stage) => sum + stage.bosses.length, 0)
    };
}

function updateProceduralEvents(nave) {
    const cellX = Math.round(nave.x / EVENT_GRID_SIZE);
    const cellY = Math.round(nave.y / EVENT_GRID_SIZE);
    const exploredKey = `${cellX},${cellY}`;
    if (!exploration.exploredCells.has(exploredKey)) {
        exploration.exploredCells.add(exploredKey);
        try { localStorage.setItem('space-mission-explored-cells', JSON.stringify([...exploration.exploredCells])); } catch { /* El mapa de esta sesión sigue disponible. */ }
    }
    for (let y = cellY - 2; y <= cellY + 2; y++) {
        for (let x = cellX - 2; x <= cellX + 2; x++) {
            if (x === 0 && y === 0) continue;
            const key = `${x},${y}`;
            if (exploration.proceduralEvents.has(key)) continue;
            const cellSeed = mulberry32((world.seed ^ Math.imul(x, 0x45d9f3b) ^ Math.imul(y, 0x119de1f3)) >>> 0);
            if (cellSeed() > 0.72) { exploration.proceduralEvents.set(key, null); continue; }
            const event = makeProceduralEvent(x, y);
            exploration.proceduralEvents.set(key, event);
            world.zones.push(event);
        }
    }
    exploration.combatZones = exploration.combatZones.filter(zone => zone.type !== 'procedural');
    world.zones = world.zones.filter(zone => zone.type !== 'procedural');
    for (const event of exploration.proceduralEvents.values()) {
        if (!event) continue;
        event.discovered ||= exploration.exploredCells.has(`${event.cellX},${event.cellY}`);
        if (Math.abs(event.cellX - cellX) <= 2 && Math.abs(event.cellY - cellY) <= 2) {
            exploration.combatZones.push(event);
            world.zones.push(event);
        }
    }
}

function makePlanetSprite(radius, base, light) {
    const size = Math.ceil((radius + 8) * 2);
    const sprite = document.createElement('canvas');
    sprite.width = size;
    sprite.height = size;
    const ctx = sprite.getContext('2d');
    const center = size / 2;
    const gradient = ctx.createRadialGradient(center - radius * 0.4, center - radius * 0.4, radius * 0.08, center, center, radius);
    gradient.addColorStop(0, light);
    gradient.addColorStop(0.5, base);
    gradient.addColorStop(1, '#04060d');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();
    return sprite;
}

function makeAsteroid(rnd, radius) {
    const count = 6 + Math.floor(rnd() * 4);
    const points = [];
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const r = radius * (0.76 + rnd() * 0.3);
        points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
    }
    const colors = ['#3a4a66', '#4a3f55', '#334455', '#40506b'];
    return { points, radius, color: colors[Math.floor(rnd() * colors.length)] };
}

function createChunk(cx, cy) {
    const rnd = mulberry32(seedForChunk(cx, cy));
    const left = cx * CHUNK_SIZE;
    const top = cy * CHUNK_SIZE;
    const chunk = { cx, cy, nebulas: [], planets: [], asteroids: [] };
    const nebulaColors = ['#1e50ff', '#b400ff', '#00c8b4', '#ff3c3c'];
    const planetColors = [
        ['#3a5f9e', '#9fc4ff'], ['#6b4a2f', '#e0b080'],
        ['#2f6b5a', '#8fe0c0'], ['#4a3a6b', '#b9a0ff']
    ];

    if (rnd() > 0.35) {
        const color = nebulaColors[Math.floor(rnd() * nebulaColors.length)];
        const radius = 120 + rnd() * 180;
        chunk.nebulas.push({
            x: left + rnd() * CHUNK_SIZE,
            y: top + rnd() * CHUNK_SIZE,
            radius,
            sprite: getGlowSprite(color, 320),
            color,
            alpha: 0.045 + rnd() * 0.06
        });
    }

    if (rnd() > 0.82) {
        const radius = 42 + rnd() * 72;
        const palette = planetColors[Math.floor(rnd() * planetColors.length)];
        chunk.planets.push({
            x: left + rnd() * CHUNK_SIZE,
            y: top + rnd() * CHUNK_SIZE,
            radius,
            sprite: makePlanetSprite(radius, palette[0], palette[1])
        });
    }

    const asteroidCount = 5 + Math.floor(rnd() * 9);
    for (let i = 0; i < asteroidCount; i++) {
        const radius = 8 + rnd() * 25;
        chunk.asteroids.push({
            x: left + rnd() * CHUNK_SIZE,
            y: top + rnd() * CHUNK_SIZE,
            rot: rnd() * Math.PI * 2,
            spin: (rnd() - 0.5) * 0.25,
            ...makeAsteroid(rnd, radius)
        });
    }
    return chunk;
}

function ensureChunk(cx, cy) {
    const key = `${cx},${cy}`;
    let chunk = world.chunks.get(key);
    if (!chunk) {
        chunk = createChunk(cx, cy);
        world.chunks.set(key, chunk);
    }
    return chunk;
}

function updateVisibleChunks() {
    const minX = Math.floor((world.cameraX - camera.viewW / 2) / CHUNK_SIZE) - CHUNK_MARGIN;
    const maxX = Math.floor((world.cameraX + camera.viewW * 1.5) / CHUNK_SIZE) + CHUNK_MARGIN;
    const minY = Math.floor((world.cameraY - camera.viewH / 2) / CHUNK_SIZE) - CHUNK_MARGIN;
    const maxY = Math.floor((world.cameraY + camera.viewH * 1.5) / CHUNK_SIZE) + CHUNK_MARGIN;

    for (let cy = minY; cy <= maxY; cy++) {
        for (let cx = minX; cx <= maxX; cx++) ensureChunk(cx, cy);
    }

    // Limita memoria: los sectores se regeneran de forma idéntica al volver.
    if (world.chunks.size > MAX_VISIBLE_CHUNKS) {
        for (const [key, chunk] of world.chunks) {
            if (chunk.cx < minX - 1 || chunk.cx > maxX + 1 || chunk.cy < minY - 1 || chunk.cy > maxY + 1) {
                world.chunks.delete(key);
            }
        }
    }
}

export function initExploration() {
    if (exploration.initialized) return;
    exploration.initialized = true;
}

// Borra el rastro del universo guardado sin tocar el perfil del jugador.
// La próxima entrada generará una semilla nueva.
export function resetExplorationProgress() {
    try {
        localStorage.removeItem('space-mission-world-seed');
        localStorage.removeItem('space-mission-explored-cells');
        localStorage.removeItem('space-mission-planets');
        localStorage.removeItem('space-mission-purged-planets');
    } catch { /* Sin almacenamiento disponible. */ }
    exploration.initialized = false;
    exploration.proceduralEvents.clear();
    exploration.exploredCells.clear();
    exploration.combatZones.length = 0;
    exploration.huntBosses.length = 0;
    exploration.cache = null;
    clearWaypoint();
}

// Persistencia de mundos purgados: el planeta sigue visible desde el espacio
// con las grietas y la etiqueta PURGADO hasta que se reintenta.
export function markPlanetPurged(planetId, purged = true) {
    if (!planetId) return;
    try {
        const set = new Set(JSON.parse(localStorage.getItem('space-mission-purged-planets') || '[]'));
        if (purged) set.add(planetId); else set.delete(planetId);
        localStorage.setItem('space-mission-purged-planets', JSON.stringify([...set]));
    } catch { /* Sin almacenamiento disponible. */ }
}

export function enterExploration(nave, canvas, { fresh = false } = {}) {
    try {
        if (fresh) {
            // Partida nueva: universo nuevo y sin celdas/planetas heredados.
            world.seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
            localStorage.setItem('space-mission-world-seed', String(world.seed));
            localStorage.removeItem('space-mission-explored-cells');
            localStorage.removeItem('space-mission-planets');
            localStorage.removeItem('space-mission-purged-planets');
        } else {
            const savedSeed = Number(localStorage.getItem('space-mission-world-seed'));
            world.seed = Number.isFinite(savedSeed) && savedSeed > 0 ? savedSeed >>> 0 : Date.now() >>> 0;
            localStorage.setItem('space-mission-world-seed', String(world.seed));
        }
    } catch { world.seed = Date.now() >>> 0; }
    world.chunks.clear();
    world.zones = [];
    exploration.planets = createPlanets(world.seed);
    try { exploration.exploredCells = fresh ? new Set() : new Set(JSON.parse(localStorage.getItem('space-mission-explored-cells') || '[]')); }
    catch { exploration.exploredCells = new Set(); }
    try {
        const discovered = fresh ? new Set() : new Set(JSON.parse(localStorage.getItem('space-mission-planets') || '[]'));
        exploration.planets.forEach(planet => { planet.discovered ||= discovered.has(planet.id); });
    } catch { /* El universo continúa sin progreso guardado. */ }
    try {
        const purged = new Set(JSON.parse(localStorage.getItem('space-mission-purged-planets') || '[]'));
        exploration.planets.forEach(planet => {
            if (!purged.has(planet.id)) return;
            planet.purged = true;
            planet.cleared = true;
            planet.discovered = true;
        });
    } catch { /* Los planetas siguen jugables si no hay almacenamiento. */ }
    exploration.planets.forEach(planet => world.zones.push(planet));
    exploration.proceduralEvents.clear();
    exploration.bombDetonations = 0;
    exploration.bombCooldown = 0;
    exploration.threatMessage = '';
    exploration.threatMessageTimer = 0;
    exploration.statusMessage = '';
    exploration.statusMessageTimer = 0;
    exploration.huntBosses.length = 0;
    const rnd = mulberry32(world.seed ^ 0xa5a5a5a5);
    const gate = {
        id: 'invaded-alpha',
        type: 'invaded',
        x: 1500 + rnd() * 500,
        y: -700 + rnd() * 500,
        r: 62,
        cleared: false, discovered: false
    };
    const meteorZone = {
        id: 'meteor-sector-alpha',
        type: 'meteors',
        x: -1150 + rnd() * 300,
        y: 850 + rnd() * 300,
        r: 84,
        cleared: false, discovered: false
    };
    exploration.combatZones = [gate, meteorZone];
    world.zones.push(gate, meteorZone);
    exploration.gate = gate;
    exploration.enteringZone = null;
    exploration.initialized = false;
    exploration.time = 0;
    exploration.nearGate = false;
    exploration.gateDist = Math.hypot(gate.x - SHIP_START_X, gate.y - SHIP_START_Y);
    exploration.trail.length = 0;
    exploration.speedParticles.length = 0;
    exploration.traffic.length = 0;
    exploration.encounter = null;
    exploration.encounterShots.length = 0;
    exploration.cache = null; exploration.cacheTimer = 8 + Math.random() * 5;
    exploration.encounterTimer = 7 + Math.random() * 5;
    exploration.mapReveal = 0;
    exploration.particleTimer = 0;
    initExploration();

    setViewport(canvas.width, canvas.height);
    nave.x = SHIP_START_X;
    nave.y = SHIP_START_Y;
    nave.vx = 0;
    nave.vy = 0;
    nave.rot = -Math.PI / 2;
    // La animación de lanzamiento termina en el centro y el jugador conserva
    // esa posición al tomar el control del universo.
    world.cameraX = nave.x - canvas.width / 2;
    world.cameraY = nave.y - canvas.height / 2;
    updateVisibleChunks();
    seedTraffic(nave);
    updateProceduralEvents(nave);
}

function seedTraffic(nave) {
    for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 700 + Math.random() * 1500;
        exploration.traffic.push({
            x: nave.x + Math.cos(angle) * distance,
            y: nave.y + Math.sin(angle) * distance,
            vx: (Math.random() - 0.5) * 13,
            vy: (Math.random() - 0.5) * 13,
            rot: Math.random() * Math.PI * 2,
            turn: (Math.random() - 0.5) * 0.08,
            scale: 0.38 + Math.random() * 0.28,
            color: ['#88b9dd', '#a6a2d8', '#91cdbb'][Math.floor(Math.random() * 3)]
        });
    }
}

function spawnExplorationEncounter(nave) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 620 + Math.random() * 300;
    const type = Math.random() < 0.3 ? 'elite' : EXPLORATION_ENEMY_TYPES[Math.floor(Math.random() * EXPLORATION_ENEMY_TYPES.length)];
    const shield = type === 'shield' || type === 'special';
    exploration.encounter = {
        type, shield,
        hp: type === 'elite' ? 4 : (type === 'special' ? 3 : 2),
        x: nave.x + Math.cos(angle) * distance,
        y: nave.y + Math.sin(angle) * distance,
        vx: 0, vy: 0, rot: angle + Math.PI,
        shotTimer: 1.8 + Math.random() * 1.7,
        fade: 1, retreating: false
    };
}

function updateSpaceTraffic(dt, nave, combatProjectiles = [], parryActive = false) {
    for (let i = exploration.traffic.length - 1; i >= 0; i--) {
        const ship = exploration.traffic[i];
        ship.x += ship.vx * dt;
        ship.y += ship.vy * dt;
        ship.rot += ship.turn * dt;
        if (Math.hypot(ship.x - nave.x, ship.y - nave.y) > 2300) exploration.traffic.splice(i, 1);
    }
    while (exploration.traffic.length < 5) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 1500 + Math.random() * 500;
        const rot = angle + Math.PI;
        const speed = 7 + Math.random() * 8;
        exploration.traffic.push({
            x: nave.x + Math.cos(angle) * distance, y: nave.y + Math.sin(angle) * distance,
            vx: Math.cos(rot) * speed, vy: Math.sin(rot) * speed,
            rot, turn: (Math.random() - 0.5) * 0.05, scale: 0.38 + Math.random() * 0.28,
            color: ['#88b9dd', '#a6a2d8', '#91cdbb'][Math.floor(Math.random() * 3)]
        });
    }

    const safe = Math.hypot(nave.x - exploration.spawnX, nave.y - exploration.spawnY) <= SAFE_ZONE_RADIUS;
    exploration.encounterTimer -= dt;
    if (!exploration.encounter && exploration.encounterTimer <= 0) {
        if (Math.random() < 0.88) spawnExplorationEncounter(nave);
        exploration.encounterTimer = 8 + Math.random() * 5;
    }
    const enemy = exploration.encounter;
    if (!enemy) return;
    const dx = nave.x - enemy.x, dy = nave.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    enemy.retreating = safe;
    const angle = safe ? Math.atan2(-dy, -dx) : Math.atan2(dy, dx);
    enemy.rot += Math.atan2(Math.sin(angle - enemy.rot), Math.cos(angle - enemy.rot)) * Math.min(1, dt * 3.2);
    const speed = safe ? 115 : (enemy.type === 'kamikaze' || enemy.type === 'kamikaze_bomb' ? 95 : 48);
    enemy.vx += (Math.cos(angle) * speed - enemy.vx) * Math.min(1, dt * 1.2);
    enemy.vy += (Math.sin(angle) * speed - enemy.vy) * Math.min(1, dt * 1.2);
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    if (safe && distance > 1180) {
        enemy.fade -= dt * 0.75;
        if (enemy.fade <= 0) {
            exploration.encounter = null;
            exploration.encounterShots.length = 0;
            return;
        }
    } else enemy.fade = Math.min(1, enemy.fade + dt * 2);

    if (!safe && distance < 620) {
        enemy.shotTimer -= dt;
        if (enemy.shotTimer <= 0 && distance > 100) {
            const shotAngle = Math.atan2(dy, dx);
            const shotSpeed = enemy.type === 'special' || enemy.type === 'elite' ? 220 : 165;
            exploration.encounterShots.push({ x: enemy.x, y: enemy.y, vx: Math.cos(shotAngle) * shotSpeed, vy: Math.sin(shotAngle) * shotSpeed, life: 4, color: enemy.shield ? '#ffcc66' : '#ff6688' });
            enemy.shotTimer = enemy.type === 'suicidal' || enemy.type === 'kamikaze' ? 3 : 2.4;
        }
    }
    for (let i = exploration.encounterShots.length - 1; i >= 0; i--) {
        const shot = exploration.encounterShots[i];
        shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
        const hitPlayer = Math.hypot(shot.x - nave.x, shot.y - nave.y) < 17;
        if (safe || shot.life <= 0 || hitPlayer || (parryActive && Math.hypot(shot.x - nave.x, shot.y - nave.y) < 45)) {
            if (!safe && !parryActive && shot.life > 0 && hitPlayer) {
                // La zona segura es la única protección de daño dentro del universo abierto.
                if (typeof window.explorationPlayerHit === 'function') window.explorationPlayerHit();
            }
            exploration.encounterShots.splice(i, 1);
        }
    }

    // Los disparos de salvamento también permiten defenderse durante la exploración.
    for (let i = combatProjectiles.length - 1; i >= 0; i--) {
        const shot = combatProjectiles[i];
        if (Math.hypot(shot.x - enemy.x, shot.y - enemy.y) > 23) continue;
        combatProjectiles.splice(i, 1);
        if (enemy.shield) enemy.shield = false;
        else enemy.hp--;
        if (enemy.hp <= 0) {
            exploration.encounter = null;
            exploration.encounterShots.length = 0;
            break;
        }
    }
}

// Devuelve 'enterArena' cuando el jugador activa el portal de combate.
export function updateExploration(dt, nave, input, canvas, combatProjectiles = [], parryActive = false) {
    const step = Math.min(2, Math.max(0, dt || 0) * 60);
    setViewport(canvas.width, canvas.height);

    const moveX = input.moveX || 0;
    const moveY = input.moveY || 0;
    // Usa la misma aceleración, fricción y suma de ejes del combate. Así se
    // conserva también la velocidad diagonal en lugar de normalizarla.
    nave.vx += moveX * nave.accel * step;
    nave.vy += moveY * nave.accel * step;
    const friction = Math.pow(nave.fric, step);
    nave.vx *= friction;
    nave.vy *= friction;

    nave.x += nave.vx * step;
    nave.y += nave.vy * step;
    exploration.inSafeZone = Math.hypot(nave.x - exploration.spawnX, nave.y - exploration.spawnY) <= SAFE_ZONE_RADIUS;

    const currentSpeed = Math.hypot(nave.vx, nave.vy);
    const aim = screenToWorld(input.aimX, input.aimY);
    const aimAngle = Math.atan2(aim.y - nave.y, aim.x - nave.x);
    nave.rot = aimAngle;
    if (currentSpeed > 0.8) {
        exploration.trail.push({ x: nave.x, y: nave.y, rot: nave.rot, life: 1 });
        if (exploration.trail.length > 26) exploration.trail.shift();
    }
    for (let i = exploration.trail.length - 1; i >= 0; i--) {
        exploration.trail[i].life -= step / 60 * 2.2;
        if (exploration.trail[i].life <= 0) exploration.trail.splice(i, 1);
    }
    exploration.particleTimer -= dt;
    if (currentSpeed > 6.2 && exploration.particleTimer <= 0) {
        const travelAngle = Math.atan2(nave.vy, nave.vx) + Math.PI;
        for (let i = 0; i < 2 && exploration.speedParticles.length < 150; i++) {
            const angle = travelAngle + (Math.random() - 0.5) * 0.9;
            const speed = 55 + Math.random() * 100;
            exploration.speedParticles.push({
                x: nave.x - nave.vx * 1.5,
                y: nave.y - nave.vy * 1.5,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.35 + Math.random() * 0.22,
                maxLife: 0.57,
                size: 1 + Math.random() * 1.8
            });
        }
        exploration.particleTimer = 0.035;
    }
    for (let i = exploration.speedParticles.length - 1; i >= 0; i--) {
        const particle = exploration.speedParticles[i];
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt;
        if (particle.life <= 0) exploration.speedParticles.splice(i, 1);
    }

    const cameraBlend = 1 - Math.exp(-24 * Math.max(0, dt));
    // Main aplica el zoom visual alrededor del centro del canvas. La cámara
    // debe conservar a la nave en el centro real de pantalla; usar viewW/H
    // (que crecen al alejar el zoom) desplaza la nave hacia la derecha/abajo.
    const desiredCameraX = nave.x - canvas.width / 2;
    const desiredCameraY = nave.y - canvas.height / 2;
    world.cameraX += (desiredCameraX - world.cameraX) * cameraBlend;
    world.cameraY += (desiredCameraY - world.cameraY) * cameraBlend;
    const shipScreenX = nave.x - world.cameraX, shipScreenY = nave.y - world.cameraY;
    if (shipScreenX < 52) world.cameraX = nave.x - canvas.width / 2;
    else if (shipScreenX > canvas.width - 52) world.cameraX = nave.x - canvas.width / 2;
    if (shipScreenY < 52) world.cameraY = nave.y - canvas.height / 2;
    else if (shipScreenY > canvas.height - 52) world.cameraY = nave.y - canvas.height / 2;
    updateVisibleChunks();
    updateSpaceTraffic(dt, nave, combatProjectiles, parryActive);
    updateProceduralEvents(nave);
    exploration.mapReveal = Math.min(1, exploration.mapReveal + Math.max(0, dt) * 0.72);
    exploration.bombCooldown = Math.max(0, exploration.bombCooldown - Math.max(0, dt));
    exploration.threatMessageTimer = Math.max(0, exploration.threatMessageTimer - Math.max(0, dt));
    exploration.statusMessageTimer = Math.max(0, exploration.statusMessageTimer - Math.max(0, dt));
    exploration.cacheTimer -= Math.max(0, dt);
    if (!exploration.cache && exploration.cacheTimer <= 0) {
        const fromSpawn = Math.hypot(nave.x-exploration.spawnX,nave.y-exploration.spawnY);
        if (fromSpawn > SAFE_ZONE_RADIUS) {
            const heading = Math.atan2(nave.y-exploration.spawnY,nave.x-exploration.spawnX);
            const angle = heading + (Math.random() - 0.5) * 1.7, distance = 1100 + Math.random() * 900;
            let x=nave.x+Math.cos(angle)*distance, y=nave.y+Math.sin(angle)*distance;
            const radiusFromSpawn = Math.hypot(x-exploration.spawnX,y-exploration.spawnY);
            if (radiusFromSpawn < SAFE_ZONE_RADIUS + 180) {
                const outward = Math.atan2(y-exploration.spawnY,x-exploration.spawnX);
                x=exploration.spawnX+Math.cos(outward)*(SAFE_ZONE_RADIUS+220);
                y=exploration.spawnY+Math.sin(outward)*(SAFE_ZONE_RADIUS+220);
            }
            exploration.cache = { x, y, type:'mimetic_cache' };
            exploration.cacheTimer = 14 + Math.random() * 9;
        } else exploration.cacheTimer = 2;
    }
    exploration.time += step / 60;
    let closestZone = null;
    exploration.gateDist = Infinity;
    for (const zone of exploration.combatZones) {
        const distance = Math.hypot(nave.x - zone.x, nave.y - zone.y);
        if (distance < Math.max(1000, zone.r + 600)) zone.discovered = true;
        if (!zone.cleared && distance < exploration.gateDist) {
            closestZone = zone;
            exploration.gateDist = distance;
        }
    }
    exploration.enteringZone = closestZone;
    exploration.nearGate = Boolean(closestZone && exploration.gateDist < closestZone.r + 90);

    let nearestPlanet = null;
    exploration.planetDist = Infinity;
    for (const planet of exploration.planets) {
        const distance = Math.hypot(nave.x - planet.x, nave.y - planet.y);
        if (distance < 30000 && !planet.discovered) {
            planet.discovered = true;
            try {
                const discovered = new Set(JSON.parse(localStorage.getItem('space-mission-planets') || '[]'));
                discovered.add(planet.id);
                localStorage.setItem('space-mission-planets', JSON.stringify([...discovered]));
            } catch { /* El radar sigue funcionando si no se permite almacenamiento local. */ }
        }
        if (distance < exploration.planetDist) { nearestPlanet = planet; exploration.planetDist = distance; }
    }
    exploration.nearPlanet = nearestPlanet && exploration.planetDist <= nearestPlanet.activationRadius ? nearestPlanet : null;
    if (exploration.nearPlanet && input.interact) {
        input.interact = false;
        if (exploration.nearPlanet.purged) return 'returnAegis';
        exploration.enteringZone = exploration.nearPlanet;
        exploration.gate = exploration.nearPlanet;
        return 'enterPlanet';
    }
    exploration.nearCache = Boolean(exploration.cache && Math.hypot(nave.x-exploration.cache.x,nave.y-exploration.cache.y) < 125);
    if (exploration.nearCache && input.interact) {
        input.interact = false;
        const cache = exploration.cache; exploration.cache = null;
        if (typeof window.claimExplorationCache === 'function') window.claimExplorationCache(cache);
    }

    if (exploration.nearGate && input.interact) {
        input.interact = false;
        exploration.gate = closestZone;
        return 'enterArena';
    }
    return null;
}

function drawChunkNebulas(ctx, canvas) {
    ctx.save();
    ctx.translate(-world.cameraX * 0.45, -world.cameraY * 0.45);
    for (const chunk of world.chunks.values()) {
        for (const nebula of chunk.nebulas) {
            const sx = nebula.x - world.cameraX * 0.45;
            const sy = nebula.y - world.cameraY * 0.45;
            if (sx < -nebula.radius * 2 || sx > canvas.width + nebula.radius * 2 || sy < -nebula.radius * 2 || sy > canvas.height + nebula.radius * 2) continue;
            ctx.save();
            ctx.globalAlpha = nebula.alpha;
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(nebula.sprite, nebula.x - nebula.radius, nebula.y - nebula.radius, nebula.radius * 2, nebula.radius * 2);
            ctx.restore();
        }
    }
    ctx.restore();
}

function drawChunkObjects(ctx, canvas) {
    for (const chunk of world.chunks.values()) {
        for (const planet of chunk.planets) {
            const sx = planet.x - world.cameraX;
            const sy = planet.y - world.cameraY;
            if (sx < -planet.radius - 40 || sx > canvas.width + planet.radius + 40 || sy < -planet.radius - 40 || sy > canvas.height + planet.radius + 40) continue;
            ctx.drawImage(planet.sprite, planet.x - planet.sprite.width / 2, planet.y - planet.sprite.height / 2);
        }
        for (const asteroid of chunk.asteroids) {
            const sx = asteroid.x - world.cameraX;
            const sy = asteroid.y - world.cameraY;
            if (sx < -asteroid.radius - 20 || sx > canvas.width + asteroid.radius + 20 || sy < -asteroid.radius - 20 || sy > canvas.height + asteroid.radius + 20) continue;
            ctx.save();
            ctx.translate(asteroid.x, asteroid.y);
            ctx.rotate(asteroid.rot + exploration.time * asteroid.spin);
            ctx.fillStyle = asteroid.color;
            ctx.strokeStyle = 'rgba(160,200,255,0.22)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(asteroid.points[0][0], asteroid.points[0][1]);
            for (let i = 1; i < asteroid.points.length; i++) ctx.lineTo(asteroid.points[i][0], asteroid.points[i][1]);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    }
}

function drawGate(ctx, gate) {
    if (!gate) return;
    const screenX = gate.x - world.cameraX, screenY = gate.y - world.cameraY;
    if (screenX < -gate.r * 4 || screenX > camera.viewW + gate.r * 4 || screenY < -gate.r * 4 || screenY > camera.viewH + gate.r * 4) return;
    const gateColor = gate.type === 'procedural' ? '#cf8cff' : gate.type === 'meteors' ? '#ffae62' : '#6ec8ff';
    const pulse = 0.6 + Math.sin(exploration.time * 2.2) * 0.4;
    drawGlow(ctx, gate.x, gate.y, gate.r * 3.2, gateColor, 0.35 + pulse * 0.15);
    ctx.save();
    ctx.translate(gate.x, gate.y);
    ctx.rotate(exploration.time * 0.4);
    ctx.strokeStyle = gateColor;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(0, 0, gate.r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, gate.r + 14, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(-exploration.time * 0.9);
    ctx.strokeStyle = gate.type === 'procedural' ? '#efd4ff' : gate.type === 'meteors' ? '#ffe1b8' : '#b3e1ff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, gate.r * 0.62, 0, Math.PI * 1.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, gate.r * 0.34, Math.PI, Math.PI * 2.3); ctx.stroke();
    ctx.globalAlpha = 0.72 + pulse * 0.24;
    const core = ctx.createRadialGradient(0, 0, 1, 0, 0, gate.r * 0.5);
    core.addColorStop(0, gate.type === 'meteors' ? 'rgba(255,235,205,0.9)' : 'rgba(230,245,255,0.9)');
    core.addColorStop(0.28, gate.type === 'procedural' ? 'rgba(176,74,255,0.48)' : gate.type === 'meteors' ? 'rgba(255,142,66,0.36)' : 'rgba(70,155,255,0.36)');
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, gate.r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.8 + pulse * 0.2;
    ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px Orbitron';
    ctx.fillStyle = gateColor;
    const label = gate.type === 'procedural' ? `SECTOR PROCEDURAL · ${gate.kind}` : gate.type === 'meteors' ? 'SECCIÓN DE METEOROS' : 'SECCIÓN INVADIDA';
    ctx.fillText(gate.cleared ? 'ZONA DESPEJADA' : label, gate.x, gate.y - gate.r - 26);
    ctx.font = '9px Orbitron';
    ctx.fillStyle = 'rgba(179,225,255,0.8)';
    const details = gate.type === 'procedural' ? `${gate.enemyTotal} ENEMIGOS · ${gate.bossTotal} JEFES` : `${Math.round(Math.hypot(gate.x - exploration.spawnX, gate.y - exploration.spawnY))} m`;
    ctx.fillText(details, gate.x, gate.y - gate.r - 13);
    ctx.restore();
}

// Minimapa compacto: reutiliza la información del mapa grande (estaciones,
// cinturones, zonas, retos, planetas, tráfico y nave) en una vista centrada en
// el jugador. Se dibuja en su propio canvas dentro de un bloque HUD editable.
let lastMiniMapDraw = 0;
function drawMiniMap(nave) {
    const miniCanvas = document.getElementById('minimap-canvas');
    if (!miniCanvas) return;
    const now = performance.now();
    if (now - lastMiniMapDraw < 33) return; // ~30 fps: suficiente y barato
    lastMiniMapDraw = now;
    const size = miniCanvas.clientWidth || 140;
    if (size <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const backing = Math.max(2, Math.round(size * dpr));
    if (miniCanvas.width !== backing || miniCanvas.height !== backing) {
        miniCanvas.width = backing;
        miniCanvas.height = backing;
    }
    const ctx = miniCanvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const centerX = size / 2, centerY = size / 2;
    const radius = size / 2 - 2;
    const plotRadius = radius - 7;
    const range = 6000;
    const project = (x, y) => {
        const dx = x - nave.x, dy = y - nave.y;
        const distance = Math.hypot(dx, dy);
        const scaled = Math.min(plotRadius, (distance / range) * plotRadius);
        return {
            x: centerX + (distance ? dx / distance * scaled : 0),
            y: centerY + (distance ? dy / distance * scaled : 0),
            distance,
            angle: Math.atan2(dy, dx)
        };
    };

    // Fondo circular con rejilla, anillos y barrido de radar.
    ctx.save();
    ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    const bg = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, radius);
    bg.addColorStop(0, 'rgba(12,34,56,0.98)');
    bg.addColorStop(0.7, 'rgba(4,13,26,0.98)');
    bg.addColorStop(1, 'rgba(2,7,15,0.98)');
    ctx.fillStyle = bg; ctx.fill();
    ctx.clip();

    ctx.strokeStyle = 'rgba(96,190,255,0.18)';
    ctx.lineWidth = 1;
    for (const ring of [plotRadius / 3, plotRadius * 2 / 3]) {
        ctx.beginPath(); ctx.arc(centerX, centerY, ring, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(centerX - plotRadius, centerY); ctx.lineTo(centerX + plotRadius, centerY);
    ctx.moveTo(centerX, centerY - plotRadius); ctx.lineTo(centerX, centerY + plotRadius);
    ctx.stroke();

    const sweep = (now / 1500) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(90,210,255,0.22)';
    ctx.beginPath(); ctx.arc(centerX, centerY, plotRadius, sweep - 0.7, sweep); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,225,255,0.5)';
    ctx.beginPath(); ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(sweep) * plotRadius, centerY + Math.sin(sweep) * plotRadius);
    ctx.stroke();

    // Zona segura de Aegis Prime.
    ctx.strokeStyle = 'rgba(86,216,255,0.5)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.arc(centerX, centerY, SAFE_ZONE_RADIUS / range * plotRadius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // Rastro reciente de la nave.
    for (const point of exploration.trail) {
        const p = project(point.x, point.y);
        ctx.globalAlpha = Math.max(0, point.life) * 0.22;
        ctx.fillStyle = nave.color || '#6ec8ff';
        ctx.fillRect(p.x - 0.8, p.y - 0.8, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;

    const drawPlanetMarker = (planet) => {
        const p = project(planet.x, planet.y);
        const far = p.distance > range;
        ctx.save();
        ctx.globalAlpha = planet.discovered ? 0.95 : 0.4;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = planet.color || '#8fd0ff';
        ctx.strokeStyle = planet.color || '#8fd0ff';
        if (far) {
            ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-3.5, -3.5); ctx.lineTo(-3.5, 3.5); ctx.closePath(); ctx.fill();
        } else {
            ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha *= 0.55;
            ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
    };

    // Estaciones y servicios (solo en cuadrantes ya explorados).
    for (const station of hubState.stations) {
        if (!isPointExplored(station.x, station.y)) continue;
        const p = project(station.x, station.y);
        const color = station.color || '#6ec8ff';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.95;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4.6, 0, Math.PI * 2); ctx.stroke();
    }
    // Cinturones/zona del hub.
    for (const zone of hubState.zones) {
        if (!isPointExplored(zone.x, zone.y)) continue;
        const p = project(zone.x, zone.y);
        ctx.globalAlpha = zone.cleared ? 0.32 : 0.9;
        ctx.fillStyle = '#ff9966';
        ctx.beginPath(); ctx.arc(p.x, p.y, zone.cleared ? 2 : 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Portales de combate.
    for (const zone of exploration.combatZones) {
        if (!isPointExplored(zone.x, zone.y)) continue;
        const p = project(zone.x, zone.y);
        const color = zone.type === 'procedural' ? '#cf8cff' : zone.type === 'meteors' ? '#ffae62' : '#6ec8ff';
        if (zone.type === 'procedural') {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4);
            ctx.fillStyle = color; ctx.fillRect(-3, -3, 6, 6);
            ctx.restore();
        } else {
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.5; ctx.strokeStyle = color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 4.4, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }
    // Retos procedurales descubiertos.
    for (const event of exploration.proceduralEvents.values()) {
        if (!event?.discovered || !isPointExplored(event.x, event.y)) continue;
        const p = project(event.x, event.y);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#cf8cff'; ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();
    }
    for (const planet of exploration.planets) drawPlanetMarker(planet);

    // Cofre de datos: diamante dorado pulsante.
    if (exploration.cache && isPointExplored(exploration.cache.x, exploration.cache.y)) {
        const p = project(exploration.cache.x, exploration.cache.y);
        const pulse = 0.65 + Math.sin(now / 220) * 0.35;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#ffe45c'; ctx.fillRect(-2.6, -2.6, 5.2, 5.2);
        ctx.globalAlpha = pulse; ctx.strokeStyle = '#fff3a8';
        ctx.strokeRect(-4.5, -4.5, 9, 9);
        ctx.restore(); ctx.globalAlpha = 1;
    }
    // Contacto hostil.
    if (exploration.encounter && isPointExplored(exploration.encounter.x, exploration.encounter.y)) {
        const p = project(exploration.encounter.x, exploration.encounter.y);
        const pulse = 0.55 + Math.sin(now / 180) * 0.45;
        ctx.fillStyle = '#ff657a';
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = pulse; ctx.strokeStyle = '#ff657a';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
    }
    // Jefes de caza: triángulos rojos con pulso.
    for (const boss of exploration.huntBosses) {
        if (!isPointExplored(boss.x, boss.y)) continue;
        const p = project(boss.x, boss.y);
        ctx.fillStyle = '#ff3344';
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 4.5); ctx.lineTo(p.x + 3.8, p.y + 3.2); ctx.lineTo(p.x - 3.8, p.y + 3.2); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.4 + Math.sin(now / 200) * 0.25; ctx.strokeStyle = '#ff3344';
        ctx.beginPath(); ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
    }
    // Tráfico civil.
    ctx.fillStyle = 'rgba(190,210,230,0.7)';
    for (const ship of exploration.traffic) {
        const p = project(ship.x, ship.y);
        if (p.distance > range) continue;
        if (!isPointExplored(ship.x, ship.y) && p.distance > 2600) continue;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ship.rot || 0);
        ctx.fillRect(-1.4, -1.4, 2.8, 2.8);
        ctx.restore();
    }
    // Base.
    const basePoint = project(exploration.spawnX, exploration.spawnY);
    ctx.fillStyle = '#56d8ff';
    ctx.beginPath(); ctx.arc(basePoint.x, basePoint.y, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(86,216,255,0.6)';
    ctx.beginPath(); ctx.arc(basePoint.x, basePoint.y, 5.4, 0, Math.PI * 2); ctx.stroke();

    // Punto de ruta fijado desde el mapa grande: línea guía y marcador dorado.
    const route = getWaypoint();
    let routeDistance = 0;
    if (route) {
        const angle = Math.atan2(route.y - nave.y, route.x - nave.x);
        routeDistance = Math.hypot(route.x - nave.x, route.y - nave.y);
        const markerDistance = Math.min(plotRadius - 4, routeDistance / range * plotRadius);
        const mx = centerX + Math.cos(angle) * markerDistance;
        const my = centerY + Math.sin(angle) * markerDistance;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,214,102,0.45)';
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.lineTo(mx, my); ctx.stroke();
        ctx.setLineDash([]);
        const routePulse = 0.6 + Math.sin(now / 260) * 0.4;
        ctx.globalAlpha = routePulse;
        ctx.strokeStyle = '#ffe9a8';
        ctx.beginPath(); ctx.arc(mx, my, 5.4, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.translate(mx, my); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#ffd666'; ctx.fillRect(-2.4, -2.4, 4.8, 4.8);
        ctx.restore();
    }

    // Brújula y escala dentro del radar.
    ctx.textAlign = 'center';
    ctx.font = 'bold 7px Orbitron';
    ctx.fillStyle = 'rgba(180,230,255,0.8)';
    ctx.fillText('N', centerX, centerY - plotRadius + 7);
    ctx.font = '6px Orbitron';
    if (route) {
        ctx.fillStyle = '#ffd666';
        ctx.fillText(`RUTA ${(routeDistance / 1000).toFixed(1)}k`, centerX, centerY + plotRadius - 4);
    } else {
        ctx.fillStyle = 'rgba(150,190,220,0.65)';
        ctx.fillText('6 km', centerX, centerY + plotRadius - 4);
    }
    ctx.restore();

    // Aro exterior y marcas cada 30°.
    ctx.save();
    ctx.strokeStyle = 'rgba(110,200,255,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        const inner = i % 3 === 0 ? radius - 4.5 : radius - 2.5;
        ctx.strokeStyle = i % 3 === 0 ? 'rgba(160,225,255,0.8)' : 'rgba(110,200,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
        ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
        ctx.stroke();
    }
    ctx.restore();

    // Nave del jugador: se desplaza ligeramente en el sentido de avance y
    // apunta siempre hacia la misma dirección que la nave real.
    const speed = Math.hypot(nave.vx || 0, nave.vy || 0);
    const travelAngle = speed > 0.2 ? Math.atan2(nave.vy, nave.vx) : (nave.rot || 0);
    const drift = Math.min(3.2, speed * 0.14);
    const shipX = centerX + Math.cos(travelAngle) * drift;
    const shipY = centerY + Math.sin(travelAngle) * drift;
    const heading = nave.rot || 0;

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = nave.color || '#6ec8ff';
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(shipX, shipY);
    ctx.lineTo(shipX + Math.cos(heading) * plotRadius * 0.34, shipY + Math.sin(heading) * plotRadius * 0.34);
    ctx.stroke();
    ctx.restore();

    if (speed > 2.4) {
        ctx.save();
        ctx.translate(shipX, shipY); ctx.rotate(heading);
        ctx.globalAlpha = 0.45 + Math.random() * 0.35;
        ctx.fillStyle = '#8fe8ff';
        ctx.beginPath(); ctx.moveTo(-4, -1.8); ctx.lineTo(-10 - Math.random() * 3, 0); ctx.lineTo(-4, 1.8); ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    ctx.save();
    ctx.translate(shipX, shipY);
    ctx.rotate(heading);
    drawGlow(ctx, 0, 0, 17, nave.color || '#6ec8ff', 0.42);
    ctx.fillStyle = '#f2fbff';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-2.6, 0);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = nave.color || '#6ec8ff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = nave.color || '#6ec8ff';
    ctx.beginPath(); ctx.arc(1.2, 0, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

export function drawExploration(ctx, canvas, nave, input, combat = {}) {
    if (!exploration.initialized) initExploration();
    setViewport(canvas.width, canvas.height);
    updateVisibleChunks();
    // Cuando Main escala el mundo, el fondo se pinta fuera de la transformación
    // para cubrir los márgenes y evitar que queden píxeles de cuadros previos.
    if (combat.background !== false) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawParallax(ctx, canvas, 'PLAYING');
    }
    ctx.save();
    ctx.globalAlpha = exploration.mapReveal;
    drawChunkNebulas(ctx, canvas);

    // Entidades del mundo en un único espacio transformado por la cámara.
    ctx.save();
    ctx.translate(-world.cameraX, -world.cameraY);
    drawChunkObjects(ctx, canvas);
    drawHub(ctx, canvas);
    if (exploration.cache) {
        ctx.save(); ctx.translate(exploration.cache.x, exploration.cache.y); ctx.rotate(Math.PI/4);
        drawGlow(ctx,0,0,35,'#ffe45c',.9); ctx.fillStyle='#e5bd36';ctx.strokeStyle='#fff3a2';ctx.lineWidth=2;ctx.fillRect(-13,-13,26,26);ctx.strokeRect(-13,-13,26,26);
        ctx.rotate(-Math.PI/4);ctx.fillStyle='#17120a';ctx.font='bold 16px Orbitron';ctx.textAlign='center';ctx.fillText('?',0,6);ctx.restore();
    }
    for (const planet of exploration.planets) {
        const sx = planet.x - world.cameraX, sy = planet.y - world.cameraY;
        if (sx < -planet.radius * 1.5 || sx > canvas.width + planet.radius * 1.5 || sy < -planet.radius * 1.5 || sy > canvas.height + planet.radius * 1.5) continue;
        drawPlanet(ctx, planet, exploration.time);
    }
    exploration.combatZones.forEach(zone => drawGate(ctx, zone));
    const safePulse = 0.5 + Math.sin(exploration.time * 1.5) * 0.08;
    ctx.save();
    ctx.globalAlpha = 0.075 + safePulse * 0.04; ctx.fillStyle = '#20dfff';
    ctx.beginPath(); ctx.arc(exploration.spawnX, exploration.spawnY, SAFE_ZONE_RADIUS, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.58 + safePulse * 0.2; ctx.strokeStyle = '#56d8ff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(exploration.spawnX, exploration.spawnY, SAFE_ZONE_RADIUS, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([18, 14]); ctx.globalAlpha = 0.28 + safePulse * 0.12; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(exploration.spawnX, exploration.spawnY, SAFE_ZONE_RADIUS - 12, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
    for (const ship of exploration.traffic) {
        ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.rot); ctx.scale(ship.scale, ship.scale);
        ctx.globalAlpha = 0.48; ctx.fillStyle = ship.color;
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-12, -8); ctx.lineTo(-7, 0); ctx.lineTo(-12, 8); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    for (const enemy of combat.enemies || []) {
        const color = enemy.type === 'elite' ? '#00ffcc' : enemy.type.includes('kamikaze') ? '#ff762e' : enemy.shield ? '#ffcc55' : '#ff5577';
        ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(Math.atan2(enemy.vy || 1, enemy.vx || 0));
        drawGlow(ctx, 0, 0, enemy.type === 'elite' ? 26 : 20, color, 0.8);
        ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, -9); ctx.lineTo(-6, 0); ctx.lineTo(-10, 9); ctx.closePath(); ctx.fill();
        if (enemy.shield) { ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
    }
    for (const shot of combat.bullets || []) {
        const color = shot.color || '#66caff';
        drawGlow(ctx, shot.x, shot.y, 18, color, 0.6);
        ctx.save(); ctx.fillStyle = color;
        ctx.fillRect(shot.x - 2, shot.y - 6, 4, 12); ctx.restore();
    }
    for (const shot of combat.enemyBullets || []) {
        const color = shot.color || '#ff6688';
        drawGlow(ctx, shot.x, shot.y, 16, color, 0.6);
        ctx.save(); ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(shot.x, shot.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    for (const boss of exploration.huntBosses) {
        const angle = Math.atan2(nave.y - boss.y, nave.x - boss.x);
        ctx.save(); ctx.translate(boss.x, boss.y); ctx.rotate(angle);
        const color = ['#ff3344', '#c72cff', '#ff8800'][boss.huntIndex % 3];
        drawGlow(ctx, 0, 0, 64, color, 0.92);
        ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(42, 0); ctx.lineTo(-28, -27); ctx.lineTo(-18, 0); ctx.lineTo(-28, 27); ctx.closePath(); ctx.fill();
        ctx.restore();
        const barWidth = 92, barY = boss.y - 54;
        ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(boss.x - barWidth / 2, barY, barWidth, 8);
        ctx.fillStyle = '#ff394e'; ctx.fillRect(boss.x - barWidth / 2 + 1, barY + 1, (barWidth - 2) * (boss.hp / boss.maxHp), 6);
        ctx.textAlign = 'center'; ctx.font = 'bold 8px Orbitron'; ctx.fillStyle = '#ffd5dc'; ctx.fillText(`JEFE HOSTIL · ${boss.type.toUpperCase()}`, boss.x, barY - 4);
    }
    for (const shot of exploration.encounterShots) {
        drawGlow(ctx, shot.x, shot.y, 18, shot.color, 0.7);
        ctx.save(); ctx.globalAlpha = 0.95; ctx.fillStyle = shot.color;
        ctx.beginPath(); ctx.arc(shot.x, shot.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (exploration.encounter) {
        const enemy = exploration.encounter;
        const color = enemy.retreating ? '#9bb8c9' : enemy.type === 'elite' ? '#00ffcc' : enemy.type.includes('kamikaze') || enemy.type === 'suicidal' ? '#ff772e' : enemy.shield ? '#ffcc55' : '#ff5577';
        ctx.save(); ctx.globalAlpha = enemy.fade; ctx.translate(enemy.x, enemy.y); ctx.rotate(enemy.rot);
        drawGlow(ctx, 0, 0, enemy.type === 'elite' ? 30 : 22, color, 0.8);
        ctx.fillStyle = color;
        if (enemy.type === 'elite') { ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(-12, -13); ctx.lineTo(-8, 0); ctx.lineTo(-12, 13); ctx.closePath(); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(-11, -10); ctx.lineTo(-7, 0); ctx.lineTo(-11, 10); ctx.closePath(); ctx.fill(); }
        if (enemy.shield) { ctx.strokeStyle = '#dff8ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
    }
    for (const trail of exploration.trail) {
        ctx.save();
        ctx.globalAlpha = trail.life * 0.22;
        ctx.translate(trail.x, trail.y);
        ctx.rotate(trail.rot);
        ctx.fillStyle = nave.color;
        ctx.beginPath();
        ctx.moveTo(-4, -6); ctx.lineTo(-18, 0); ctx.lineTo(-4, 6);
        ctx.closePath(); ctx.fill();
        ctx.restore();
    }
    for (const particle of exploration.speedParticles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife) * 0.68;
        ctx.fillStyle = '#9adfff';
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
        ctx.restore();
    }
    ctx.restore();
    ctx.restore();

    // La nave permanece nítida durante la revelación y mantiene su posición
    // inferior de lanzamiento mientras el mapa aparece a su alrededor.
    const shipScreenX = nave.x - world.cameraX;
    const shipScreenY = nave.y - world.cameraY;
    drawGlow(ctx, shipScreenX, shipScreenY, 42, nave.color, 0.9);
    ctx.save();
    ctx.translate(shipScreenX, shipScreenY);
    ctx.rotate(nave.rot || -Math.PI / 2);
    ctx.fillStyle = nave.color;
    ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-16, -16); ctx.lineTo(-16, 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (combat.parryActive) {
        ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(shipScreenX, shipScreenY, 36, 0, Math.PI * 2); ctx.stroke();
    }

    // Guía de ruta: chevron dorado alrededor de la nave apuntando al punto
    // fijado desde el mapa grande.
    const routeTarget = getWaypoint();
    if (routeTarget) {
        const routeDx = routeTarget.x - nave.x, routeDy = routeTarget.y - nave.y;
        const routeDist = Math.hypot(routeDx, routeDy);
        if (routeDist > 250) {
            const routeAngle = Math.atan2(routeDy, routeDx);
            const routePulse = 0.55 + Math.sin(exploration.time * 3) * 0.25;
            ctx.save();
            ctx.globalAlpha = routePulse;
            ctx.translate(shipScreenX + Math.cos(routeAngle) * 54, shipScreenY + Math.sin(routeAngle) * 54);
            ctx.rotate(routeAngle);
            ctx.fillStyle = '#ffd666';
            ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
            ctx.restore();
            ctx.globalAlpha = 1;
        }
    }

    // Segunda mira fija a pantalla, igual que durante el combate.
    ctx.save();
    ctx.strokeStyle = 'rgba(110,200,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(input.aimX, input.aimY, 10, 0, Math.PI * 2);
    ctx.moveTo(input.aimX - 15, input.aimY); ctx.lineTo(input.aimX + 15, input.aimY);
    ctx.moveTo(input.aimX, input.aimY - 15); ctx.lineTo(input.aimX, input.aimY + 15);
    ctx.stroke();
    ctx.restore();

    // HUD y radar permanecen anclados a la pantalla, no al mundo. El bloque de
    // sector/zona/contacto vive ahora en el HUD editable (Hud.js).
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left'; ctx.font = 'bold 12px Orbitron'; ctx.fillStyle = exploration.bombCooldown > 0 ? 'rgba(195,210,225,0.95)' : 'rgba(130,215,255,0.98)';
    ctx.fillText(exploration.bombCooldown > 0 ? `BOMBA · ${Math.ceil(exploration.bombCooldown)}s` : 'BOMBA · LISTA', 18, canvas.height - 23);
    if (exploration.statusMessageTimer > 0) {
        ctx.textAlign = 'center'; ctx.font = 'bold 10px Orbitron'; ctx.fillStyle = '#fff0c6';
        ctx.fillText(exploration.statusMessage, canvas.width / 2, canvas.height / 2 + 70);
    }
    ctx.restore();
    // Minimapa propio dentro del HUD editable.
    if (!hubState.panelOpen) drawMiniMap(nave);
    if (exploration.nearGate) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 10px Orbitron';
        ctx.fillStyle = '#d9efff';
        const event = exploration.enteringZone;
        if (event?.type === 'procedural') {
            const cardY = canvas.height - 116;
            const cardW = Math.min(510, canvas.width - 36);
            ctx.fillStyle = 'rgba(5,8,20,0.88)';
            ctx.fillRect((canvas.width - cardW) / 2, cardY - 20, cardW, 72);
            ctx.strokeStyle = 'rgba(207,140,255,0.72)'; ctx.strokeRect((canvas.width - cardW) / 2, cardY - 20, cardW, 72);
            ctx.fillStyle = '#e6c6ff'; ctx.font = 'bold 11px Orbitron';
            ctx.fillText(`RETO OPCIONAL · ${event.kind} · NIVEL ${1 + Math.round((event.difficulty || 0) * 9)}`, canvas.width / 2, cardY - 4);
            ctx.fillStyle = '#e0e8f2'; ctx.font = '9px Orbitron';
            ctx.fillText(`${event.enemyTotal} enemigos · ${event.bossTotal} jefes · ${event.stages.length} fase(s)`, canvas.width / 2, cardY + 13);
            const mix = event.stages.flatMap(stage => stage.groups.map(group => `${group.count} ${group.type}`)).slice(0, 5).join(' · ') || 'Sin oleadas de enemigos';
            const bossNames = event.stages.flatMap(stage => stage.bosses).map(type => type.toUpperCase()).join(' + ') || 'Sin jefes';
            ctx.fillStyle = '#b9c7d8'; ctx.font = '8px Orbitron';
            ctx.fillText(`${mix}  |  JEFES: ${bossNames}`.slice(0, 100), canvas.width / 2, cardY + 29);
            ctx.fillStyle = '#cf8cff'; ctx.font = 'bold 9px Orbitron';
            ctx.fillText('E / BOTÓN INTERACTUAR: ACEPTAR RETO', canvas.width / 2, cardY + 44);
        } else {
            ctx.fillText(event?.purged ? 'PLANETA PURGADO · PULSA E PARA REINTENTAR' : 'PULSA E / BOTÓN INTERACTUAR PARA ENTRAR', canvas.width / 2, canvas.height - 48);
        }
        ctx.restore();
    }
}
