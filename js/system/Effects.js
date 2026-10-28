// js/system/Effects.js — Partículas (pool reciclado), debris, textos flotantes, screenShake, hitStop

import { getGlowSprite } from './Sprites.js';

export const particles = [];
export const debrisChunks = [];
export const floatingTexts = [];
export const shipTrail = [];

export const fxState = { screenShake: 0, hitStopFrames: 0, frameCount: 0 };

// Presupuesto de partículas: se ajusta en caliente desde Main según el frame time.
const MOBILE = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const CAPACITY = 900;
const MAX_DEBRIS = 200;
export const MAX_PARTICLES = MOBILE ? 260 : 560;

let budget = MAX_PARTICLES;

export function getParticleBudget() { return budget; }
export function setParticleBudget(n) { budget = Math.max(60, Math.min(CAPACITY, n | 0)); }

// Pool: los objetos se reciclan, así no hay allocations (ni GC) en caliente.
const pool = [];
for (let i = 0; i < CAPACITY; i++) {
    pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, decay: 0.02, size: 9, color: '#ffffff', type: 'spark', sprite: null });
}

// Único punto de entrada para partículas: respeta el presupuesto global.
export function pushParticle(p) {
    if (particles.length >= budget || pool.length === 0) return false;
    const o = pool.pop();
    o.x = p.x; o.y = p.y;
    o.vx = p.vx || 0; o.vy = p.vy || 0;
    o.life = p.life === undefined ? 1 : p.life;
    o.decay = p.decay || 0.02;
    o.type = p.type || 'spark';
    o.color = p.color || '#ff5500';
    o.size = p.size || 9;
    // El sprite se resuelve al crear la partícula (una vez), no en cada frame.
    o.sprite = o.type === 'bomb_ring' ? null : getGlowSprite(o.color, o.size);
    particles.push(o);
    return true;
}

export function clearParticles() {
    while (particles.length) {
        const p = particles.pop();
        p.life = 0;
        pool.push(p);
    }
}

// Movimiento + vida. Se llama desde update() (no desde draw()).
export function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= p.decay;
        if (p.life <= 0) {
            const last = particles.length - 1;
            if (i !== last) particles[i] = particles[last];
            particles.pop();
            p.life = 0;
            pool.push(p);
            continue;
        }
        if (p.type !== 'bomb_ring') {
            p.x += p.vx; p.y += p.vy;
            p.vx *= 0.93; p.vy *= 0.93;
        }
    }
}

// Dibujo: anillos con mezcla normal + chispas aditivas con sprite (sin shadowBlur).
export function drawParticles(ctx) {
    const n = particles.length;
    if (n === 0) return;

    let hasRing = false;
    for (let i = 0; i < n; i++) { if (particles[i].type === 'bomb_ring') { hasRing = true; break; } }
    if (hasRing) {
        ctx.save();
        ctx.lineWidth = 10;
        for (let i = 0; i < n; i++) {
            const p = particles[i];
            if (p.type !== 'bomb_ring') continue;
            ctx.globalAlpha = p.life;
            ctx.strokeStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, (1 - p.life) * 1500, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
        const p = particles[i];
        if (p.type === 'bomb_ring') continue;
        ctx.globalAlpha = p.life > 1 ? 1 : p.life;
        const s = p.size;
        ctx.drawImage(p.sprite, p.x - s * 0.5, p.y - s * 0.5);
    }
    ctx.restore();
}

export function createExplosion(x, y, color, count = 12) {
    const c = color || '#ff5500';
    const n = Math.min(count, budget - particles.length);
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 0.8 + Math.random() * 4.2;
        pushParticle({
            x, y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: 0.7 + Math.random() * 0.5,
            decay: 0.024,
            size: 8 + Math.random() * 8,
            color: c,
            type: 'spark'
        });
    }
}

export function spawnDebris(x, y, color, count = 3) {
    if (debrisChunks.length >= MAX_DEBRIS) return;
    const n = Math.min(count, MAX_DEBRIS - debrisChunks.length);
    for (let i = 0; i < n; i++) {
        const pts = [];
        const sides = 3 + Math.floor(Math.random() * 3);
        for (let j = 0; j < sides; j++) {
            const a = (j / sides) * Math.PI * 2 + Math.random() * 0.8;
            const r = 5 + Math.random() * 10;
            pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        debrisChunks.push({ x, y, pts, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5 - 1, rot: 0, rotSpeed: (Math.random() - 0.5) * 0.15, life: 1.0, color: color || '#888' });
    }
}
