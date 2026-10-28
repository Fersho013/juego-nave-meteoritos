// js/world/Parallax.js — Estrellas, nebulosas y planetas

export const stars = [];
export const nebulas = [];
export const planets = [];
export const superAsteroids = [];

// Estrellas agrupadas por capa y nivel de alfa: así se hace un cambio de estado
// por grupo (15) en lugar de uno por estrella (155).
const STAR_LAYERS = 3;
const STAR_ALPHA_STEPS = 5;
export const starBuckets = Array.from({ length: STAR_LAYERS }, () => Array.from({ length: STAR_ALPHA_STEPS }, () => []));

function starBucket(alpha) {
    return Math.max(0, Math.min(STAR_ALPHA_STEPS - 1, Math.floor((alpha - 0.2) / 0.16)));
}

// Pre-renderiza un "glow" radial a un canvas: evita crear gradientes cada frame.
function makeGlowSprite(radius, color) {
    const size = Math.max(2, Math.ceil(radius * 2));
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'transparent');
    g.fillStyle = grad;
    g.beginPath(); g.arc(radius, radius, radius, 0, Math.PI * 2); g.fill();
    return c;
}

function addStars(count, layer, sizeMin, sizeExtra, alphaMin, alphaExtra, speedMin, speedExtra, canvas) {
    for (let i = 0; i < count; i++) {
        const s = {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            layer,
            size: Math.random() * sizeExtra + sizeMin,
            alpha: alphaMin + Math.random() * alphaExtra,
            speed: speedMin + Math.random() * speedExtra
        };
        stars.push(s);
        starBuckets[layer][starBucket(s.alpha)].push(s);
    }
}

export function initParallax(canvas) {
    // 3 capas de estrellas
    addStars(80, 0, 0.5, 1, 0.25, 0.25, 0.6, 0.3, canvas);
    addStars(50, 1, 1.2, 1, 0.45, 0.25, 1.8, 0.5, canvas);
    addStars(25, 2, 2, 1.4, 0.75, 0.25, 3.5, 1.2, canvas);

    const nebulaColors = ['rgba(30,80,255,1)', 'rgba(180,0,255,1)', 'rgba(0,200,180,1)', 'rgba(255,60,60,1)'];
    for (let i = 0; i < 8; i++) nebulas.push({ x: Math.random() * 3000, y: Math.random() * 3000, r: 80 + Math.random() * 120, color: nebulaColors[Math.floor(Math.random() * nebulaColors.length)], alpha: 0.06 + Math.random() * 0.07, speed: 0.3 + Math.random() * 0.4 });
    const planetColors = ['rgba(100,60,30,1)', 'rgba(60,80,180,1)', 'rgba(40,120,80,1)', 'rgba(160,160,80,1)'];
    for (let i = 0; i < 3; i++) planets.push({ x: Math.random() * 3000, y: Math.random() * 3000, r: 30 + Math.random() * 60, color: planetColors[Math.floor(Math.random() * planetColors.length)], speed: 0.08 + Math.random() * 0.12 });
    // Arena Super Boss: asteroides azules (vértices fijos para que no parpadeen)
    for (let i = 0; i < 16; i++) {
        const r = 18 + Math.random() * 26;
        const pts = [];
        for (let k = 0; k < 7; k++) {
            const ang = (k / 7) * Math.PI * 2;
            const rr = r * (0.82 + Math.random() * 0.22);
            pts.push([Math.cos(ang) * rr, Math.sin(ang) * rr]);
        }
        superAsteroids.push({ x: Math.random() * 3000, y: Math.random() * 3000, r, pts, rot: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.04, speed: 0.9 + Math.random() * 1.1 });
    }

    // Sprites pre-renderizados (una sola vez) en vez de gradientes por frame.
    nebulas.forEach(n => { n.sprite = makeGlowSprite(n.r, n.color); });
    planets.forEach(p => { p.sprite = makeGlowSprite(p.r, p.color); });
}

// Fondo de la arena pre-renderizado: antes se pintaba un degradado lineal a
// pantalla completa + un radial gigante en cada frame. Ahora es un drawImage.
let arenaKey = '';
let arenaCanvas = null;
function ensureArenaBg(canvas) {
    const key = canvas.width + 'x' + canvas.height;
    if (key === arenaKey) return arenaCanvas;
    arenaKey = key;
    const w = canvas.width, h = canvas.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#2a0a0a');
    bg.addColorStop(0.45, '#4a1018');
    bg.addColorStop(1, '#0a0a1a');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.22;
    const glow = g.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, w * 0.7);
    glow.addColorStop(0, 'rgba(255,60,40,0.55)');
    glow.addColorStop(1, 'transparent');
    g.fillStyle = glow;
    g.beginPath(); g.arc(w * 0.5, h * 0.35, w * 0.7, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    arenaCanvas = c;
    return c;
}

export function drawSuperArena(ctx, canvas, gameState) {
    ctx.drawImage(ensureArenaBg(canvas), 0, 0);

    // Estilo constante: se fija una vez, no por asteroide.
    ctx.fillStyle = '#3a6ea5'; ctx.strokeStyle = '#6ec8ff'; ctx.lineWidth = 1.2;
    for (let i = 0; i < superAsteroids.length; i++) {
        const a = superAsteroids[i];
        ctx.save();
        ctx.translate(a.x, a.y); ctx.rotate(a.rot);
        ctx.beginPath();
        ctx.moveTo(a.pts[0][0], a.pts[0][1]);
        for (let k = 1; k < a.pts.length; k++) ctx.lineTo(a.pts[k][0], a.pts[k][1]);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // brillo azul
        ctx.fillStyle = 'rgba(110,200,255,0.35)';
        ctx.beginPath(); ctx.arc(-a.r * 0.25, -a.r * 0.25, a.r * 0.28, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a6ea5';
        ctx.restore();
        if (gameState === 'PLAYING') { a.y += a.speed; a.rot += a.rotSpeed; if (a.y - a.r > canvas.height) { a.y = -a.r; a.x = Math.random() * canvas.width; } }
    }
}

export function drawParallax(ctx, canvas, gameState) {
    // Planetas (sprite cacheado)
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < planets.length; i++) {
        const p = planets[i];
        ctx.drawImage(p.sprite, p.x - p.r, p.y - p.r);
        if (gameState === 'PLAYING') p.y += p.speed;
        if (p.y - p.r > canvas.height) { p.y = -p.r; p.x = Math.random() * canvas.width; }
    }
    ctx.globalAlpha = 1;
    // Nebulosas (sprite cacheado)
    for (let i = 0; i < nebulas.length; i++) {
        const n = nebulas[i];
        ctx.globalAlpha = n.alpha;
        ctx.drawImage(n.sprite, n.x - n.r, n.y - n.r);
        if (gameState === 'PLAYING') n.y += n.speed;
        if (n.y - n.r > canvas.height) { n.y = -n.r; n.x = Math.random() * canvas.width; }
    }
    ctx.globalAlpha = 1;
    // Estrellas por lotes (capa × nivel de alfa). Se acumulan en un path y se
    // rellenan de una vez: ~1,8× más rápido que un fillRect por estrella.
    ctx.fillStyle = '#ffffff';
    const playing = gameState === 'PLAYING';
    for (let l = 0; l < STAR_LAYERS; l++) {
        const layers = starBuckets[l];
        for (let b = 0; b < STAR_ALPHA_STEPS; b++) {
            const arr = layers[b];
            if (arr.length === 0) continue;
            ctx.globalAlpha = 0.2 + b * 0.16 + 0.08;
            ctx.beginPath();
            for (let i = 0; i < arr.length; i++) {
                const s = arr[i];
                ctx.rect(s.x, s.y, s.size, s.size);
                if (playing) {
                    s.y += s.speed;
                    if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
                }
            }
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
}
