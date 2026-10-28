// js/system/Sprites.js — Sprites de brillo generados por código (sin assets externos)
//
// Sustituyen a ctx.shadowBlur: un shadowBlur cuesta ~4,5× más que dibujar sin él
// (medido en el navegador) y en móvil es todavía peor. Un sprite pre-renderizado
// es un solo drawImage.

const cache = new Map();
const MAX_CACHE = 120;

// Convierte '#rgb' / '#rrggbb' a rgba() con el alfa indicado.
// Si el color no es hex (hsl, rgba, nombre) se devuelve tal cual.
export function rgba(color, a) {
    if (typeof color === 'string' && color.charCodeAt(0) === 35 /* # */) {
        let h = color.slice(1);
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        const n = parseInt(h, 16);
        if (!isNaN(n)) return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
    return a >= 1 ? color : 'rgba(255,255,255,' + a + ')';
}

/**
 * Devuelve un canvas cuadrado (cacheado) con un degradado radial del color dado.
 * El tamaño es exacto para poder dibujarlo 1:1 sin reescalado.
 */
export function getGlowSprite(color, size) {
    const s = Math.max(2, Math.round(size));
    const key = color + '|' + s;
    let sprite = cache.get(key);
    if (sprite) return sprite;
    if (cache.size >= MAX_CACHE) cache.clear();

    sprite = document.createElement('canvas');
    sprite.width = s; sprite.height = s;
    const g = sprite.getContext('2d');
    const r = s / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, rgba(color, 1));
    grad.addColorStop(0.4, rgba(color, 0.55));
    grad.addColorStop(0.72, rgba(color, 0.16));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);

    cache.set(key, sprite);
    return sprite;
}

/**
 * Dibuja un brillo aditivo centrado en (x, y).
 * `radius` es el radio visible; el sprite se genera a 2*radius.
 */
export function drawGlow(ctx, x, y, radius, color, alpha = 1) {
    const size = Math.max(4, Math.round(radius * 2));
    const sprite = getGlowSprite(color, size);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * ctx.globalAlpha; // respeta el alfa del llamador
    ctx.drawImage(sprite, x - size / 2, y - size / 2);
    ctx.restore();
}
