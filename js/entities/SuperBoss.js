// js/entities/SuperBoss.js — Super Boss Nodriza (3 fases) + modifier permanente
export const superBossState = {
    active: false,
    arena: false,
    phase: 1,
    x: 0, y: 0, w: 0, h: 0,
    hp: 20000, maxHp: 20000,
    shield: true,
    cannons: [],
    gate: null,
    lasersActive: false,
    laserTimer: 0,
    shieldTimer: 0,
    destroyed: false,
    explosionTimer: 0,
    modifierPickup: null, // consumible verde para mejora permanente
    greenPortal: null // {x,y,radius,pulse,active}
};

export let hasSuperModifier = false; // permanente por run

export function grantSuperModifier() { hasSuperModifier = true; }
export function hasSuperModifierActive() { return hasSuperModifier; }
export function clearSuperModifier() { hasSuperModifier = false; }

export function spawnSuperBoss(canvas) {
    superBossState.active = true;
    superBossState.arena = true;
    superBossState.phase = 1;
    superBossState.destroyed = false;
    superBossState.explosionTimer = 0;
    superBossState.x = canvas.width / 2;
    superBossState.y = 62;
    superBossState.w = canvas.width - 12; // triple de largo: abarca toda la pantalla (antes 720 cap)
    superBossState.h = 56;
    superBossState.hp = 20000;
    superBossState.maxHp = 20000;
    superBossState.shield = true;
    superBossState.lasersActive = false;
    superBossState.laserTimer = 0;
    superBossState.shieldTimer = 0;
    superBossState.modifierPickup = null;
    // 3 cañones
    const spacing = superBossState.w / 4;
    superBossState.cannons = [];
    for (let i = 0; i < 3; i++) {
        superBossState.cannons.push({
            x: superBossState.x - spacing * 1.2 + i * spacing * 1.2,
            y: superBossState.y + 38,
            hp: 2500,
            maxHp: 2500,
            lastShot: 0,
            alive: true
        });
    }
    superBossState.gate = null;
}

export function clearSuperBoss() {
    superBossState.active = false;
    superBossState.arena = false;
    superBossState.phase = 1;
    superBossState.cannons = [];
    superBossState.gate = null;
    superBossState.modifierPickup = null;
    superBossState.greenPortal = null;
}

function getCannonPositions() { return superBossState.cannons; }

export function updateSuperBoss({ canvas, nave, bullets, enemyBullets, enemies, particles, floatingTexts, fxState, createExplosion, spawnDebris, hudState, combatState, dropPickup, frameCount }) {
    if (!superBossState.active || superBossState.destroyed) return;

    // Si destruido, manejar animación + portal verde + consumible
    if (superBossState.hp <= 0 && !superBossState.destroyed) {
        superBossState.destroyed = true;
        superBossState.explosionTimer = 90;
        // Consumible verde para mejora permanente (separado del portal)
        superBossState.modifierPickup = { x: canvas.width / 2 + 70, y: canvas.height / 2, vy: 1.1, active: true, pulse: 0 };
        // Portal verde de retorno a zona normal
        superBossState.greenPortal = { x: canvas.width / 2 - 70, y: canvas.height / 2, radius: 24, pulse: 0, active: true };
        createExplosion(superBossState.x, superBossState.y, '#00ff66', 60);
        spawnDebris(superBossState.x, superBossState.y, '#00ff66', 8);
        fxState.screenShake = 34;
        fxState.hitStopFrames = 12;
        if (floatingTexts) floatingTexts.push({ x: superBossState.x, y: superBossState.y - 70, text: '★ SUPER BOSS DESTRUIDO ★', life: 2.2, color: '#00ff66' });
        if (floatingTexts) floatingTexts.push({ x: superBossState.greenPortal.x, y: superBossState.greenPortal.y - 36, text: 'PORTAL VERDE → SALIR', life: 4, color: '#00ff66' });
        if (floatingTexts) floatingTexts.push({ x: superBossState.modifierPickup.x, y: superBossState.modifierPickup.y - 30, text: 'CONSUMIBLE VERDE', life: 4, color: '#00ff66' });
    }
    if (superBossState.destroyed) {
        superBossState.explosionTimer--;
        if (superBossState.explosionTimer % 12 === 0) {
            const rx = superBossState.x + (Math.random() - 0.5) * superBossState.w * 0.8;
            const ry = superBossState.y + (Math.random() - 0.5) * 22;
            createExplosion(rx, ry, '#ff6600', 10);
        }
        // Actualizar consumible flotante
        if (superBossState.modifierPickup?.active) {
            const mp = superBossState.modifierPickup;
            mp.y += mp.vy;
            mp.pulse = (mp.pulse || 0) + 0.09;
            if (mp.y > canvas.height - 26 || mp.y < canvas.height * 0.35) mp.vy *= -1;
            if (Math.hypot(mp.x - nave.x, mp.y - nave.y) < 28) {
                mp.active = false;
                grantSuperModifier();
                hasSuperModifier = true;
                if (floatingTexts) floatingTexts.push({ x: mp.x, y: mp.y - 30, text: '✦ MODIFICADOR VERDE PERMANENTE ✦', life: 2.0, color: '#00ff66' });
                if (particles) particles.push({ x: mp.x, y: mp.y, vx: 0, vy: 0, life: 1, type: 'bomb_ring', color: '#00ff66' });
                if (hudState) hudState.score += 15000;
            }
        }
        // Portal verde: al tocarlo, sale de la arena (vuelve a zona normal)
        if (superBossState.greenPortal?.active) {
            const gp = superBossState.greenPortal;
            gp.pulse += 0.11;
            if (Math.hypot(gp.x - nave.x, gp.y - nave.y) < gp.radius + 16) {
                if (floatingTexts) floatingTexts.push({ x: gp.x, y: gp.y - 30, text: '¡REGRESANDO A ZONA NORMAL!', life: 1.6, color: '#00ff66' });
                if (particles) particles.push({ x: gp.x, y: gp.y, vx: 0, vy: 0, life: 1, type: 'bomb_ring', color: '#00ff66' });
                clearSuperBoss();
            }
        }
        return;
    }

    // Actualizar posiciones de cañones (siguen al boss que está fijo)
    const spacing = superBossState.w / 4;
    superBossState.cannons.forEach((c, i) => {
        c.x = superBossState.x - spacing * 1.2 + i * spacing * 1.2;
        c.y = superBossState.y + 38;
    });

    // FASE 1: Cañones
    if (superBossState.phase === 1) {
        superBossState.shield = true;
        let aliveCount = 0;
        superBossState.cannons.forEach(c => {
            if (!c.alive) return;
            aliveCount++;
            // disparo doble cadencia (antes 260 -> 130)
            const now = Date.now();
            if (now - c.lastShot > 130) {
                const ang = Math.atan2(nave.y - c.y, nave.x - c.x);
                // 1 bala por cañón alta cadencia
                enemyBullets.push({ x: c.x, y: c.y, vx: Math.cos(ang) * 5.8, vy: Math.sin(ang) * 5.8, color: '#ff5555' });
                c.lastShot = now;
            }
            // Colisión con balas jugador (chequeado fuera, aquí solo mantenemos)
        });
        if (aliveCount === 0) {
            // Transición a fase 2
            superBossState.phase = 2;
            // Crear compuerta x5 HP
            superBossState.gate = {
                x: superBossState.x,
                y: superBossState.y + 26,
                w: 120, h: 22,
                hp: 6000, maxHp: 6000, // 1200*5
                open: true,
                lastSpawn: Date.now()
            };
            if (floatingTexts) floatingTexts.push({ x: superBossState.x, y: superBossState.y + 80, text: '— COMPUERTA ABIERTA —', life: 1.8, color: '#ff9900' });
            if (particles) particles.push({ x: superBossState.x, y: superBossState.y, vx: 0, vy: 0, life: 1, type: 'bomb_ring', color: '#ff9900' });
        }
    } else if (superBossState.phase === 2) {
        // Compuerta suelta enemigos
        superBossState.shield = true; // sigue protegido excepto compuerta
        const g = superBossState.gate;
        if (!g) return;
        // gate puede recibir daño (manejado en Main colisión)
        if (g.hp <= 0) {
            superBossState.phase = 3;
            superBossState.shield = false;
            superBossState.lasersActive = true;
            superBossState.laserTimer = Date.now();
            superBossState.shieldTimer = 0;
            superBossState.gate = null;
            if (floatingTexts) floatingTexts.push({ x: superBossState.x, y: superBossState.y + 80, text: 'ESCUDOS CAÍDOS — FASE LÁSER', life: 1.8, color: '#00ffcc' });
            return;
        }
        // spawn doble tasa (antes 850 -> 425)
        if (Date.now() - g.lastSpawn > 425) {
            g.lastSpawn = Date.now();
            const types = ['common', 'special', 'elite', 'kamikaze', 'kamikaze_bomb'];
            const pick = types[Math.floor(Math.random() * types.length)];
            const nx = g.x + (Math.random() - 0.5) * (g.w - 10);
            const ny = g.y + 12;
            const hpMap = { common: 30, special: 60, elite: 120, kamikaze: 25, kamikaze_bomb: 35 };
            const vyMap = { common: 1.8, special: 2.2, elite: 1.4, kamikaze: 3.0, kamikaze_bomb: 2.8 };
            enemies.push({
                x: nx, y: ny,
                type: pick,
                hp: hpMap[pick] || 30,
                vx: (Math.random() - 0.5) * 1.6,
                vy: vyMap[pick] || 1.8,
                shield: pick === 'special',
                lastShot: 0,
                suicidal: pick === 'kamikaze' || pick === 'kamikaze_bomb',
                isBombKamikaze: pick === 'kamikaze_bomb',
                bombRadius: 42
            });
        }
    } else if (superBossState.phase === 3) {
        // Alternancia escudo / lasers
        const now = Date.now();
        if (superBossState.lasersActive) {
            superBossState.shield = false;
            // disparo láser triple cadencia (antes 140 -> 46)
            if (now - superBossState.laserTimer > 46) {
                superBossState.laserTimer = now;
                const leftX = superBossState.x - superBossState.w * 0.42;
                const rightX = superBossState.x + superBossState.w * 0.42;
                const y = superBossState.y + 18;
                [leftX, rightX].forEach(lx => {
                    const ang = Math.atan2(nave.y - y, nave.x - lx);
                    enemyBullets.push({ x: lx, y, vx: Math.cos(ang) * 7.2, vy: Math.sin(ang) * 7.2, color: '#00ccff', isLaser: true });
                });
            }
            // Tras 3s, activar escudo
            if (!superBossState.shieldTimer) superBossState.shieldTimer = now;
            if (now - superBossState.shieldTimer > 3000) {
                superBossState.lasersActive = false;
                superBossState.shield = true;
                superBossState.shieldTimer = now;
            }
        } else {
            superBossState.shield = true;
            // escudo activo 2s
            if (now - superBossState.shieldTimer > 2000) {
                superBossState.lasersActive = true;
                superBossState.shield = false;
                superBossState.laserTimer = now;
                superBossState.shieldTimer = now;
            }
        }
    }

    // Dañar boss directo solo si corresponde:
    // - Fase 1: shield true => no daño
    // - Fase 2: solo gate
    // - Fase 3: solo cuando lasersActive (shield false)
}

export function canDamageSuperBoss() {
    if (!superBossState.active || superBossState.destroyed) return false;
    if (superBossState.phase === 1) return false; // escudo
    if (superBossState.phase === 2) return false; // solo gate
    if (superBossState.phase === 3) return superBossState.lasersActive; // shield off
    return false;
}

export function damageSuperBoss(dmg) {
    if (!canDamageSuperBoss()) return 0;
    superBossState.hp -= dmg;
    if (superBossState.hp < 0) superBossState.hp = 0;
    return dmg;
}

export function damageCannon(index, dmg) {
    const c = superBossState.cannons[index];
    if (!c || !c.alive) return 0;
    c.hp -= dmg;
    if (c.hp <= 0) { c.hp = 0; c.alive = false; return 1; }
    return 0;
}

export function damageGate(dmg) {
    if (!superBossState.gate) return 0;
    superBossState.gate.hp -= dmg;
    if (superBossState.gate.hp < 0) superBossState.gate.hp = 0;
    return dmg;
}

export function drawSuperBoss(ctx, frameCount) {
    if (!superBossState.active) return;
    const sb = superBossState;

    // Si destruido, solo dibujar restos breves + portal verde + consumible
    if (sb.destroyed) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, sb.explosionTimer / 90);
        ctx.fillStyle = '#111';
        ctx.fillRect(sb.x - sb.w / 2, sb.y - sb.h / 2, sb.w, sb.h);
        ctx.restore();
        // Portal verde
        if (sb.greenPortal?.active) {
            const gp = sb.greenPortal;
            const pulse = 0.5 + Math.sin(gp.pulse) * 0.32;
            ctx.save();
            ctx.globalAlpha = 0.20 * pulse + 0.14;
            const gg = ctx.createRadialGradient(gp.x, gp.y, 0, gp.x, gp.y, gp.radius * 3.0);
            gg.addColorStop(0, 'rgba(40,255,120,0.95)');
            gg.addColorStop(0.45, 'rgba(20,180,80,0.42)');
            gg.addColorStop(1, 'transparent');
            ctx.fillStyle = gg;
            ctx.beginPath(); ctx.arc(gp.x, gp.y, gp.radius * 3.0, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 0.96;
            ctx.strokeStyle = '#3dff8a'; ctx.lineWidth = 2.6; ctx.shadowBlur = 18; ctx.shadowColor = '#00ff66';
            ctx.beginPath(); ctx.arc(gp.x, gp.y, gp.radius, 0, Math.PI*2); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = '#b8ffcf'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(gp.x, gp.y, gp.radius*0.62, gp.pulse, gp.pulse + Math.PI*1.6); ctx.stroke();
            ctx.restore();
            ctx.save(); ctx.globalAlpha=0.9; ctx.fillStyle='#00ff66'; ctx.font='bold 9px Orbitron'; ctx.textAlign='center';
            ctx.fillText('PORTAL VERDE', gp.x, gp.y - gp.radius - 12); ctx.restore();
        }
        // Consumible verde (pickup)
        if (sb.modifierPickup?.active) {
            const p = sb.modifierPickup;
            const pulse = 0.8 + Math.sin(p.pulse || 0) * 0.2;
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.shadowBlur = 18; ctx.shadowColor = '#00ff66';
            ctx.fillStyle = '#00ff66';
            ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#003a18'; ctx.lineWidth = 2; ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#002b12';
            ctx.font = 'bold 14px Orbitron'; ctx.textAlign = 'center';
            ctx.fillText('✦', p.x, p.y + 5);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#00ff66'; ctx.font = 'bold 8px Orbitron';
            ctx.fillText('TRIPLE VERDE', p.x, p.y + 24);
            // anillo giratorio
            ctx.strokeStyle = 'rgba(0,255,102,0.7)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(p.x, p.y, 19 + Math.sin(p.pulse)*2, p.pulse, p.pulse + Math.PI*1.4); ctx.stroke();
            ctx.restore();
        }
        return;
    }

    // Fondo nodriza: barra superior que abarca ancho
    ctx.save();
    // sombra
    ctx.shadowBlur = 22; ctx.shadowColor = sb.shield ? '#1e90ff' : '#ff3366';
    // cuerpo principal
    const grad = ctx.createLinearGradient(sb.x - sb.w / 2, sb.y, sb.x + sb.w / 2, sb.y);
    grad.addColorStop(0, '#1a1a2e'); grad.addColorStop(0.5, '#2a2a4a'); grad.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(sb.x - sb.w / 2, sb.y - sb.h / 2, sb.w, sb.h);
    // borde
    ctx.strokeStyle = sb.shield ? '#1e90ff' : '#ff9900';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(sb.x - sb.w / 2, sb.y - sb.h / 2, sb.w, sb.h);
    // líneas detalle
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        const y = sb.y - sb.h / 2 + (sb.h / 4) * i;
        ctx.beginPath(); ctx.moveTo(sb.x - sb.w / 2 + 12, y); ctx.lineTo(sb.x + sb.w / 2 - 12, y); ctx.stroke();
    }
    // escudo overlay
    if (sb.shield) {
        ctx.globalAlpha = 0.18 + Math.sin(frameCount * 0.12) * 0.07;
        ctx.fillStyle = '#1e90ff';
        ctx.fillRect(sb.x - sb.w / 2 - 4, sb.y - sb.h / 2 - 4, sb.w + 8, sb.h + 8);
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = '#6ec8ff'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
        ctx.strokeRect(sb.x - sb.w / 2 - 6, sb.y - sb.h / 2 - 6, sb.w + 12, sb.h + 12);
        ctx.setLineDash([]);
    }
    ctx.shadowBlur = 0;
    // HP barra principal (solo cuando puede recibir daño o escudo)
    const hpPct = sb.hp / sb.maxHp;
    const barW = sb.w * 0.86;
    const barX = sb.x - barW / 2;
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(barX, sb.y - sb.h / 2 - 14, barW, 8);
    ctx.fillStyle = sb.shield ? '#1e90ff' : (sb.phase === 3 && sb.lasersActive ? '#00ff66' : '#ff3366');
    ctx.fillRect(barX, sb.y - sb.h / 2 - 14, barW * hpPct, 8);
    ctx.strokeStyle = '#333'; ctx.strokeRect(barX, sb.y - sb.h / 2 - 14, barW, 8);
    // texto fase
    ctx.fillStyle = '#aaa'; ctx.font = '7px Orbitron'; ctx.textAlign = 'center';
    ctx.fillText(`NODRIZA · FASE ${sb.phase} ${sb.shield ? '[ESCUDO]' : sb.lasersActive ? '[LÁSER]' : ''}`, sb.x, sb.y - sb.h / 2 - 18);
    ctx.restore();

    // Cañones fase 1
    if (sb.phase === 1) {
        sb.cannons.forEach((c, i) => {
            if (!c.alive) return;
            ctx.save();
            ctx.translate(c.x, c.y);
            // base
            ctx.fillStyle = '#2d2d3a'; ctx.strokeStyle = '#555'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            // cañón
            ctx.fillStyle = c.hp < 200 ? '#ff4444' : '#888';
            ctx.fillRect(-3, -18, 6, 22);
            // HP mini barra
            const pct = c.hp / c.maxHp;
            ctx.fillStyle = '#111'; ctx.fillRect(-18, 16, 36, 5);
            ctx.fillStyle = pct > 0.5 ? '#33ff66' : pct > 0.25 ? '#ffcc00' : '#ff3344';
            ctx.fillRect(-18, 16, 36 * pct, 5);
            ctx.strokeStyle = '#333'; ctx.strokeRect(-18, 16, 36, 5);
            ctx.restore();
        });
    }

    // Compuerta fase 2
    if (sb.phase === 2 && sb.gate) {
        const g = sb.gate;
        ctx.save();
        ctx.translate(g.x, g.y);
        // puerta
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-g.w / 2, -g.h / 2, g.w, g.h);
        ctx.strokeStyle = g.hp < 400 ? '#ff4444' : '#ff9900'; ctx.lineWidth = 2; ctx.strokeRect(-g.w / 2, -g.h / 2, g.w, g.h);
        // dientes
        ctx.fillStyle = '#333';
        for (let dx = -g.w / 2 + 6; dx < g.w / 2; dx += 14) {
            ctx.fillRect(dx, -g.h / 2 - 4, 8, 6);
            ctx.fillRect(dx, g.h / 2 - 2, 8, 6);
        }
        // HP
        const pct = g.hp / g.maxHp;
        ctx.fillStyle = '#111'; ctx.fillRect(-g.w / 2, g.h / 2 + 8, g.w, 6);
        ctx.fillStyle = pct > 0.5 ? '#ff9900' : '#ff3344'; ctx.fillRect(-g.w / 2, g.h / 2 + 8, g.w * pct, 6);
        ctx.fillStyle = '#ffcc00'; ctx.font = '6px Orbitron'; ctx.textAlign = 'center';
        ctx.fillText('COMPUERTA', 0, -g.h / 2 - 8);
        ctx.restore();
    }

    // Láseres fase 3 (cuando activos, dibujar glow)
    if (sb.phase === 3 && sb.lasersActive) {
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#00ccff';
        const lx1 = sb.x - sb.w * 0.42, lx2 = sb.x + sb.w * 0.42;
        // glow vertical
        ctx.fillRect(lx1 - 6, sb.y + 18, 12, 40);
        ctx.fillRect(lx2 - 6, sb.y + 18, 12, 40);
        ctx.restore();
    }
}

export function isInSuperArena() { return superBossState.arena; }
