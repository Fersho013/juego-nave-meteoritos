// js/world/PlanetAtmosphere.js — Atmósfera y clima de cada mundo.
// Cada planeta pinta su arena con su propio color y fenómeno: brasas en Ignis,
// ventisca en Glacia, burbujas en Aquamar, esquirlas en Cristalia, etc.
// Todo es Canvas puro y se calcula con funciones baratas (sin shadowBlur).

const TAU = Math.PI * 2;
const particleCache = new Map();
const baseCache = new Map();

// Ruido determinista: la misma semilla siempre genera la misma lluvia de
// partículas, así el clima no "salta" entre frames.
function hash(seed) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
}
function styleSeed(style) {
    let seed = 0;
    for (let i = 0; i < style.length; i++) seed += style.charCodeAt(i) * (i + 3);
    return seed;
}
function rgbOf(hex) {
    const value = String(hex || '').replace('#', '');
    if (value.length !== 6) return [110, 200, 255];
    return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}
function rgba(hex, alpha) {
    const [r, g, b] = rgbOf(hex);
    return `rgba(${r},${g},${b},${alpha})`;
}

// Configuración del clima por estilo de planeta.
const WEATHER = {
    terra:     { count: 30, colorA: '#d8ffe2', colorB: '#59ce70', motion: 'drift', size: 2.0 },
    ignis:     { count: 48, colorA: '#ffe9a8', colorB: '#ff5a1e', motion: 'up',    size: 2.2 },
    glacia:    { count: 64, colorA: '#ffffff', colorB: '#a4f7ff', motion: 'down',  size: 1.7 },
    aurum:     { count: 40, colorA: '#fff4c2', colorB: '#ffcf52', motion: 'drift', size: 1.6 },
    umbra:     { count: 26, colorA: '#e0b8ff', colorB: '#8a2be2', motion: 'drift', size: 2.4 },
    caelum:    { count: 30, colorA: '#d6e6ff', colorB: '#4f8cff', motion: 'drift', size: 2.1 },
    mecanis:   { count: 42, colorA: '#ffd9b0', colorB: '#ff4058', motion: 'up',    size: 1.8 },
    aquamar:   { count: 46, colorA: '#e0fffb', colorB: '#42e4cf', motion: 'up',    size: 2.0 },
    toxina:    { count: 36, colorA: '#f0ffb0', colorB: '#8fbd35', motion: 'up',    size: 2.5 },
    cristalia: { count: 34, colorA: '#ffe6fa', colorB: '#ef69d0', motion: 'drift', size: 2.2 },
    krono:     { count: 28, colorA: '#fff6c8', colorB: '#ffd45c', motion: 'drift', size: 2.0 },
    echelon:   { count: 44, colorA: '#ffd6dc', colorB: '#ed263e', motion: 'down',  size: 1.9 }
};

function getParticles(style, count) {
    const key = `${style}:${count}`;
    const cached = particleCache.get(key);
    if (cached) return cached;
    const seed = styleSeed(style);
    const list = [];
    for (let i = 0; i < count; i++) {
        list.push({
            x: hash(seed + i * 1.73),
            y: hash(seed + 11 + i * 2.41),
            size: 0.65 + hash(seed + 23 + i * 3.1) * 1.9,
            speed: 0.02 + hash(seed + 37 + i * 1.9) * 0.08,
            drift: hash(seed + 53 + i * 2.7) * TAU,
            phase: hash(seed + 71 + i * 1.3) * TAU,
            spin: (hash(seed + 89 + i * 2.3) - 0.5) * 2.4
        });
    }
    particleCache.set(key, list);
    return list;
}

function drawWeather(ctx, w, h, style, time, alphaScale = 1) {
    const cfg = WEATHER[style] || WEATHER.terra;
    const list = getParticles(style, cfg.count);
    const rising = cfg.motion === 'up';
    const falling = cfg.motion === 'down';

    for (let i = 0; i < list.length; i++) {
        const p = list[i];
        let x, y;
        if (rising) {
            const travel = (p.y * (h + 90) + time * 26 * (0.4 + p.speed * 9)) % (h + 90);
            y = h + 40 - travel;
            x = p.x * w + Math.sin(time * 0.7 + p.drift) * 24;
        } else if (falling) {
            const travel = (p.y * (h + 90) + time * 30 * (0.4 + p.speed * 9)) % (h + 90);
            y = travel - 40;
            x = p.x * w + Math.sin(time * 0.45 + p.drift) * 30;
        } else {
            x = p.x * w + Math.sin(time * 0.18 + p.drift) * 46;
            y = p.y * h + Math.cos(time * 0.15 + p.phase) * 34;
        }
        const twinkle = 0.35 + 0.5 * Math.abs(Math.sin(time * (0.8 + p.speed * 6) + p.phase));
        ctx.globalAlpha = Math.min(1, twinkle * alphaScale);
        ctx.fillStyle = i % 3 === 0 ? cfg.colorA : cfg.colorB;

        if (style === 'cristalia') {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(time * 0.5 * p.spin + p.phase);
            ctx.fillRect(-p.size * 0.45, -p.size * 1.5, p.size * 0.9, p.size * 3);
            ctx.restore();
        } else if (style === 'krono') {
            ctx.strokeStyle = i % 3 === 0 ? cfg.colorA : cfg.colorB;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x, y, p.size * 2.4, p.phase, p.phase + Math.PI * 1.25);
            ctx.stroke();
        } else if (style === 'glacia') {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(p.phase);
            ctx.fillRect(-p.size * 0.3, -p.size * 1.3, p.size * 0.6, p.size * 2.6);
            ctx.restore();
        } else {
            ctx.beginPath();
            ctx.arc(x, y, p.size * cfg.size * 0.55, 0, TAU);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
}

function drawCloudBands(ctx, w, h, color, time, alpha = 0.06) {
    ctx.fillStyle = rgba(color, alpha);
    for (let i = 0; i < 5; i++) {
        const y = h * (0.1 + i * 0.2) + Math.sin(time * 0.12 + i) * 16;
        const x = w * (0.5 + Math.sin(time * 0.05 + i * 1.7) * 0.16);
        ctx.beginPath();
        ctx.ellipse(x, y, w * 0.55, h * 0.05, Math.sin(i) * 0.1, 0, TAU);
        ctx.fill();
    }
}

// Fase 2: descenso a los cielos. Sol lejano, montañas, ciudades y ruinas
// tintadas con el color del mundo.
function drawDescentLayers(ctx, w, h, color, style, time, phase) {
    // Sol/astro lejano.
    const sunX = w * (0.72 + Math.sin(time * 0.04) * 0.02);
    const sunY = h * 0.22;
    const sunR = Math.min(w, h) * 0.11;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3.2);
    sunGlow.addColorStop(0, rgba(color, 0.95));
    sunGlow.addColorStop(0.18, rgba(color, 0.42));
    sunGlow.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = sunGlow;
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 3.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff6e8';
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, TAU); ctx.fill();

    // Capas de montañas con parallax lento.
    for (let layer = 0; layer < 3; layer++) {
        const baseY = h * (0.5 + layer * 0.13);
        const amp = h * (0.16 - layer * 0.035);
        const speed = 8 + layer * 13;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w + 40; x += 40) {
            const px = x + (time * speed) % 40;
            const peak = baseY + Math.sin((px * 0.011) + layer * 2.1 + time * 0.03) * amp
                + Math.sin((px * 0.031) + layer) * amp * 0.32;
            ctx.lineTo(px, peak);
        }
        ctx.lineTo(w, h); ctx.closePath();
        ctx.fillStyle = layer === 2 ? 'rgba(3,8,16,0.94)' : rgba(color, 0.1 + layer * 0.07);
        ctx.fill();
    }

    // Ciudad/ruinas lejanas en la línea del horizonte.
    const cityY = h * 0.55;
    const scroll = (time * 14) % 90;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(4,10,20,0.95)';
    for (let x = -90 + scroll; x < w + 90; x += 42) {
        const tower = 18 + hash(Math.floor((x + time * 14) / 42) + 7) * 62;
        ctx.fillRect(x, cityY - tower, 26, tower);
        if (style === 'toxic' || style === 'toxina') {
            ctx.fillStyle = rgba(color, 0.28);
            ctx.fillRect(x + 6, cityY - tower + 6, 4, 4);
            ctx.fillStyle = 'rgba(4,10,20,0.95)';
        }
    }
    ctx.restore();

    // Ruinas: arcos y columnas quebradas.
    ctx.strokeStyle = rgba(color, 0.26);
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
        const x = w * (0.08 + i * 0.2) + Math.sin(time * 0.05 + i) * 14;
        const y = h * 0.66;
        ctx.beginPath(); ctx.arc(x, y, 18 + i * 4, Math.PI, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 22, y); ctx.lineTo(x - 22, y + 20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 22, y); ctx.lineTo(x + 22, y + 26); ctx.stroke();
    }

    // Estelas de descenso a toda velocidad.
    ctx.strokeStyle = rgba(color, phase === 3 ? 0.32 : 0.18);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 14; i++) {
        const x = ((i * 97 + time * (phase === 3 ? 320 : 120)) % (w + 80)) - 40;
        const y = h * (0.12 + hash(i + 31) * 0.6);
        const len = 18 + hash(i + 9) * 36;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len, y + len * 0.25); ctx.stroke();
    }
}

// Fase 3: superficie con edificios futuristas pasando a toda velocidad.
function drawSurfaceLayers(ctx, w, h, color, style, time) {
    const horizon = h * 0.52;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, 'rgba(2,6,14,0.92)');
    sky.addColorStop(0.7, rgba(color, 0.13));
    sky.addColorStop(1, rgba(color, 0.34));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon);

    // Suelo.
    const ground = ctx.createLinearGradient(0, horizon, 0, h);
    ground.addColorStop(0, rgba(color, 0.30));
    ground.addColorStop(0.25, 'rgba(4,10,18,0.96)');
    ground.addColorStop(1, 'rgba(1,3,8,1)');
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, w, h - horizon);

    // Rejilla de la superficie en perspectiva.
    ctx.strokeStyle = rgba(color, 0.22);
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
        const x = w * (i / 8);
        ctx.beginPath(); ctx.moveTo(w * 0.5 + (x - w * 0.5) * 0.25, horizon); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
        const y = horizon + Math.pow(i / 6, 1.8) * (h - horizon) + ((time * 90) % (h - horizon)) * 0.15;
        if (y > h) continue;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Edificios futuristas en dos capas de scroll rápido.
    for (let layer = 0; layer < 2; layer++) {
        const scroll = (time * (layer ? 300 : 160)) % (w + 160);
        const baseY = horizon + (layer ? 8 : -4);
        const alpha = layer ? 0.95 : 0.62;
        for (let i = -1; i < 9; i++) {
            const x = i * 150 - scroll;
            const bh = h * (layer ? 0.2 : 0.3) * (0.55 + hash(i + layer * 17) * 0.8);
            const bw = 46 + hash(i + layer * 5) * 46;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = layer ? '#050b14' : 'rgba(5,12,22,0.9)';
            ctx.fillRect(x, baseY - bh, bw, bh + 6);
            ctx.strokeStyle = rgba(color, layer ? 0.85 : 0.4);
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, baseY - bh, bw, bh + 6);
            // Ventanas encendidas del color del planeta.
            ctx.fillStyle = rgba(color, 0.55 + 0.3 * Math.sin(time * 2 + i));
            for (let wy = baseY - bh + 10; wy < baseY - 6; wy += 13) {
                for (let wx = x + 7; wx < x + bw - 8; wx += 12) {
                    if (hash(wx * 0.3 + wy * 0.7 + Math.floor(time * 2)) > 0.45) ctx.fillRect(wx, wy, 5, 4);
                }
            }
            if (layer) {
                ctx.fillStyle = rgba(color, 0.9);
                ctx.fillRect(x + bw * 0.5 - 1, baseY - bh - 16, 2, 16);
            }
        }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = rgba(color, 0.55);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(w, horizon); ctx.stroke();
}

// Fondo de la arena: cielo del planeta, halo atmosférico y clima.
export function drawPlanetAtmosphere(ctx, canvas, planet, time) {
    const style = planet?.style || 'terra';
    const color = planet?.color || '#6ec8ff';
    const phase = Math.max(1, Math.min(3, planet?.planetPhase || 1));
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return;

    ctx.save();
    // Cielo base cacheado por color y tamaño (evita recrear gradientes por frame).
    const baseKey = `${color}:${w}x${h}`;
    let base = baseCache.get(baseKey);
    if (!base) {
        if (baseCache.size > 8) baseCache.clear();
        base = document.createElement('canvas');
        base.width = w; base.height = h;
        const bctx = base.getContext('2d');
        bctx.fillStyle = '#03060d';
        bctx.fillRect(0, 0, w, h);
        const cx = w * 0.5, cy = h * 0.42;
        const halo = bctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.8);
        halo.addColorStop(0, rgba(color, 0.30));
        halo.addColorStop(0.42, rgba(color, 0.13));
        halo.addColorStop(1, rgba(color, 0));
        bctx.fillStyle = halo;
        bctx.fillRect(0, 0, w, h);
        baseCache.set(baseKey, base);
    }
    ctx.drawImage(base, 0, 0);

    // Nubes/estratos lentos del color del planeta.
    ctx.globalCompositeOperation = 'lighter';
    drawCloudBands(ctx, w, h, color, time, 0.055);
    ctx.globalCompositeOperation = 'source-over';

    // Estrellas tenues teñidas (dan profundidad sin competir con el gameplay).
    const stars = getParticles(`${style}-stars`, 46);
    ctx.fillStyle = rgba(color, 0.5);
    for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const x = (s.x * w + time * 2 * s.speed) % w;
        const y = (s.y * h) % h;
        ctx.globalAlpha = 0.12 + 0.22 * Math.abs(Math.sin(time * 0.6 + s.phase));
        ctx.fillRect(x, y, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;

    // Fases planetarias: descenso a los cielos y superficie futurista.
    if (phase >= 2) {
        drawDescentLayers(ctx, w, h, color, style, time, phase);
        if (phase === 3) drawSurfaceLayers(ctx, w, h, color, style, time);
    }

    // Fenómenos propios de cada mundo.
    if (style === 'ignis') {
        const heat = ctx.createLinearGradient(0, h * 0.35, 0, h);
        heat.addColorStop(0, 'rgba(255,80,20,0)');
        heat.addColorStop(1, 'rgba(255,90,25,0.30)');
        ctx.fillStyle = heat;
        ctx.fillRect(0, 0, w, h);
    } else if (style === 'glacia') {
        ctx.fillStyle = 'rgba(190,245,255,0.10)';
        for (let i = 0; i < 3; i++) {
            const y = h * (0.24 + i * 0.26) + Math.sin(time * 0.3 + i) * 20;
            ctx.beginPath();
            ctx.ellipse(w * (0.5 + Math.sin(time * 0.08 + i) * 0.2), y, w * 0.7, 26, 0, 0, TAU);
            ctx.fill();
        }
    } else if (style === 'toxina') {
        ctx.fillStyle = 'rgba(150,220,60,0.10)';
        for (let i = 0; i < 3; i++) {
            const x = w * (0.24 + i * 0.26) + Math.sin(time * 0.1 + i) * 30;
            const y = h * (0.3 + (i % 2) * 0.36);
            ctx.beginPath();
            ctx.arc(x, y, 90 + i * 22, 0, TAU);
            ctx.fill();
        }
    } else if (style === 'mecanis') {
        ctx.strokeStyle = 'rgba(255,64,88,0.10)';
        ctx.lineWidth = 2;
        const offset = (time * 40) % 90;
        for (let y = -offset; y < h; y += 90) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y + 24);
            ctx.stroke();
        }
    } else if (style === 'echelon') {
        ctx.strokeStyle = 'rgba(237,38,62,0.09)';
        ctx.lineWidth = 1;
        for (let x = (time * 18) % 70; x < w; x += 70) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += 70) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
    } else if (style === 'caelum' || style === 'aurum') {
        ctx.strokeStyle = rgba(color, 0.12);
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            ctx.save();
            ctx.translate(w * 0.5, h * 0.45);
            ctx.rotate(time * 0.05 + i * 0.8);
            ctx.beginPath();
            ctx.ellipse(0, 0, w * (0.28 + i * 0.08), h * (0.1 + i * 0.03), 0, 0, TAU);
            ctx.stroke();
            ctx.restore();
        }
    } else if (style === 'umbra') {
        ctx.fillStyle = 'rgba(6,2,14,0.5)';
        ctx.fillRect(0, 0, w, h);
    } else if (style === 'aquamar') {
        ctx.strokeStyle = 'rgba(190,255,250,0.10)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
            const y = h * (0.18 + i * 0.22) + Math.sin(time * 0.5 + i) * 8;
            ctx.beginPath();
            ctx.ellipse(w * 0.5, y, w * 0.46, 12, 0, 0, TAU);
            ctx.stroke();
        }
    } else if (style === 'krono') {
        ctx.strokeStyle = rgba(color, 0.14);
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(w * 0.5, h * 0.44, Math.min(w, h) * (0.24 + i * 0.12), time * (0.2 + i * 0.1), time * (0.2 + i * 0.1) + Math.PI * 1.3);
            ctx.stroke();
        }
    }

    drawWeather(ctx, w, h, style, time, 0.9);
    ctx.restore();
}

// Capa delantera sutil: viñeta del color del mundo y motas grandes en primer
// plano. Se dibuja antes de las entidades para no tapar el combate.
export function drawPlanetForeground(ctx, canvas, planet, time) {
    const style = planet?.style || 'terra';
    const color = planet?.color || '#6ec8ff';
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return;

    ctx.save();
    const vignette = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.32, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    vignette.addColorStop(0, rgba(color, 0));
    vignette.addColorStop(1, rgba(color, style === 'umbra' ? 0.42 : 0.20));
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    const cfg = WEATHER[style] || WEATHER.terra;
    const motes = getParticles(`${style}-fg`, 10);
    for (let i = 0; i < motes.length; i++) {
        const p = motes[i];
        const x = p.x * w + Math.sin(time * 0.22 + p.drift) * 50;
        const y = p.y * h + Math.cos(time * 0.19 + p.phase) * 40;
        ctx.globalAlpha = 0.16 + 0.14 * Math.abs(Math.sin(time * 0.9 + p.phase));
        ctx.fillStyle = i % 2 ? cfg.colorA : cfg.colorB;
        ctx.beginPath();
        ctx.arc(x, y, 2 + p.size * 2.4, 0, TAU);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}
