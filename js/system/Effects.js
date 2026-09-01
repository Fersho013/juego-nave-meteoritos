// js/system/Effects.js — Partículas, debris, textos flotantes, screenShake, hitStop

export const particles = [];
export const debrisChunks = [];
export const floatingTexts = [];
export const shipTrail = [];

export const fxState = { screenShake: 0, hitStopFrames: 0, frameCount: 0 };

export function createExplosion(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) particles.push({ x, y, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, life: 1.0, color: color || '#ff5500', type: 'spark' });
}

export function spawnDebris(x, y, color, count = 3) {
    for (let i = 0; i < count; i++) {
        const pts = [];
        const sides = 3 + Math.floor(Math.random() * 3);
        for (let j = 0; j < sides; j++) {
            const a = (j / sides) * Math.PI * 2 + Math.random() * 0.8;
            const r = 5 + Math.random() * 10;
            pts.push([Math.cos(a)*r, Math.sin(a)*r]);
        }
        debrisChunks.push({ x, y, pts, vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5 - 1, rot: 0, rotSpeed: (Math.random()-0.5)*0.15, life: 1.0, color: color || '#888' });
    }
}
