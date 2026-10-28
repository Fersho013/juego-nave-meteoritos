// js/system/Atlas.js — Hoja de animación de explosiones generada por código.
//
// Una explosión de 50 partículas son 50 drawImage por frame. La misma explosión
// como fotograma de una hoja es UN drawImage. La hoja se genera una vez al
// cargar (10 fotogramas de 96x96 por color) y se cachea.

import { rgba } from './Sprites.js';

export const BLAST_FRAMES = 10;
export const BLAST_SIZE = 96;
// Duración en frames de juego (a 60 fps ≈ 0.33 s).
export const BLAST_LIFE = 20;

const sheets = new Map();
const MAX_SHEETS = 8;

function drawFrame(g, ox, t, color) {
    const cx = ox + BLAST_SIZE / 2, cy = BLAST_SIZE / 2;
    const fade = 1 - t;
    const ring = 12 + t * 40;

    // Onda expansiva
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba(color, Math.pow(fade, 1.3) * 0.9);
    g.lineWidth = 7 * fade + 0.8;
    g.beginPath(); g.arc(cx, cy, ring, 0, Math.PI * 2); g.stroke();

    // Halo suave detrás del anillo (da cuerpo a la explosión)
    const haloR = ring * 0.85;
    const halo = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, haloR));
    halo.addColorStop(0, rgba(color, fade * 0.28));
    halo.addColorStop(1, rgba(color, 0));
    g.fillStyle = halo;
    g.beginPath(); g.arc(cx, cy, Math.max(1, haloR), 0, Math.PI * 2); g.fill();

    // Núcleo: destello blanco que se apaga antes que el anillo
    const coreFade = Math.max(0, 1 - t / 0.72);
    const coreR = Math.max(2, 19 * (1 - t * 0.55));
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    grad.addColorStop(0, `rgba(255,255,255,${Math.pow(coreFade, 1.2)})`);
    grad.addColorStop(0.45, rgba(color, Math.pow(coreFade, 1.1) * 0.9));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cy, coreR, 0, Math.PI * 2); g.fill();
    g.restore();
}

/** Devuelve la hoja (canvas) de explosión para un color, generándola si hace falta. */
export function getBlastSheet(color) {
    const key = color || '#ff5500';
    let sheet = sheets.get(key);
    if (sheet) return sheet;
    if (sheets.size >= MAX_SHEETS) sheets.clear();

    sheet = document.createElement('canvas');
    sheet.width = BLAST_SIZE * BLAST_FRAMES;
    sheet.height = BLAST_SIZE;
    const g = sheet.getContext('2d');
    for (let f = 0; f < BLAST_FRAMES; f++) {
        drawFrame(g, f * BLAST_SIZE, f / (BLAST_FRAMES - 1), key);
    }
    sheets.set(key, sheet);
    return sheet;
}

/** Dibuja un fotograma concreto de la hoja, centrado en (x, y). */
export function drawBlastFrame(ctx, sheet, frame, x, y, scale, alpha) {
    const s = BLAST_SIZE * scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * ctx.globalAlpha;
    ctx.drawImage(sheet, frame * BLAST_SIZE, 0, BLAST_SIZE, BLAST_SIZE, x - s / 2, y - s / 2, s, s);
    ctx.restore();
}
