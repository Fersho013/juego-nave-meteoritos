// js/world/Parallax.js — Estrellas, nebulosas y planetas

export const stars = [];
export const nebulas = [];
export const planets = [];

export function initParallax(canvas) {
    // 3 capas de estrellas
    for (let i = 0; i < 80; i++) stars.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, layer: 1, size: Math.random()*1 + 0.5, alpha: 0.25 + Math.random()*0.25, speed: 0.6 + Math.random()*0.3 });
    for (let i = 0; i < 50; i++) stars.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, layer: 2, size: Math.random()*1 + 1.2, alpha: 0.45 + Math.random()*0.25, speed: 1.8 + Math.random()*0.5 });
    for (let i = 0; i < 25; i++) stars.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, layer: 3, size: Math.random()*1.4 + 2, alpha: 0.75 + Math.random()*0.25, speed: 3.5 + Math.random()*1.2 });

    const nebulaColors = ['rgba(30,80,255,1)','rgba(180,0,255,1)','rgba(0,200,180,1)','rgba(255,60,60,1)'];
    for (let i = 0; i < 8; i++) nebulas.push({ x: Math.random()*3000, y: Math.random()*3000, r: 80+Math.random()*120, color: nebulaColors[Math.floor(Math.random()*nebulaColors.length)], alpha: 0.06+Math.random()*0.07, speed: 0.3+Math.random()*0.4 });
    const planetColors = ['rgba(100,60,30,1)','rgba(60,80,180,1)','rgba(40,120,80,1)','rgba(160,160,80,1)'];
    for (let i = 0; i < 3; i++) planets.push({ x: Math.random()*3000, y: Math.random()*3000, r: 30+Math.random()*60, color: planetColors[Math.floor(Math.random()*planetColors.length)], speed: 0.08+Math.random()*0.12 });
}

export function drawParallax(ctx, canvas, gameState) {
    // Planets (slowest)
    planets.forEach(p => {
        ctx.globalAlpha = 0.18;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        grad.addColorStop(0, p.color); grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
        if (gameState === 'PLAYING') p.y += p.speed; if (p.y - p.r > canvas.height) { p.y = -p.r; p.x = Math.random() * canvas.width; }
    });
    ctx.globalAlpha = 1;
    nebulas.forEach(n => {
        ctx.globalAlpha = n.alpha;
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        grad.addColorStop(0, n.color); grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI*2); ctx.fill();
        if (gameState === 'PLAYING') n.y += n.speed; if (n.y - n.r > canvas.height) { n.y = -n.r; n.x = Math.random() * canvas.width; }
    });
    ctx.globalAlpha = 1;
    stars.forEach(s => { ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`; ctx.fillRect(s.x, s.y, s.size, s.size); if (gameState === 'PLAYING') s.y += s.speed; if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; } });
}
