// js/entities/Boss.js — Lógica de jefes

export const bosses = [];

export function createBoss({ canvas, type, id }) {
    let b = { id, type, x: id === 'B1' ? canvas.width*0.3 : canvas.width*0.7, y: -100, targetY: 150, hp: 4000, maxHp: 4000, dir: 1, lastShot: 0, parryCooldown: false, parryActive: false, bombs: 2 };
    if (type === 'static') b.x = canvas.width / 2;
    if (type === 'doppel') { b.x = canvas.width / 2; b.targetY = 100; b.maxHp = 6000; b.hp = 6000; }
    if (type === 'hunter') {
        b.x = canvas.width / 2; b.targetY = 120;
        b.maxHp = 5000; b.hp = 5000;
        b.vx = 0; b.vy = 0;
        b.lastLaser = 0; b.laserCooldown = false;
        b.dodgeCooldown = false;
    }
    if (type === 'berserker') {
        b.x = canvas.width / 2; b.targetY = 130;
        b.maxHp = 5500; b.hp = 5500;
        b.vx = 0; b.vy = 0;
        b.dashState = 'chase';
        b.dashTimer = 0;
        b.dashInterval = 2400;
        b.lastDashTime = Date.now();
        b.dashVx = 0; b.dashVy = 0;
        b.dashCount = 0;
        b.maxDashes = 1;
        b.exhaustedTimer = 0;
        b.lastBreath = false;
        b.lastBreathTimer = 0;
        b.lastBreathCount = 3;
        b.lastBreathInterval = 0;
        b.immune = false;
    }
    bosses.push(b); renderBossUI();
}

export function renderBossUI() {
    const container = document.getElementById('boss-container');
    if (!container) return;
    container.innerHTML = '';
    bosses.forEach(b => { container.innerHTML += `<div class="boss-hp-row"><div style="font-size:0.6rem; color:var(--danger)">ADVERTENCIA: ENTIDAD ${b.id}</div><div class="hp-bar-bg"><div id="hp-${b.id}" class="hp-fill"></div></div></div>`; });
    container.style.display = bosses.length ? 'block' : 'none';
}

export function updateBossHP(b) {
    const hpBar = document.getElementById(`hp-${b.id}`);
    if (hpBar) hpBar.style.width = Math.max(0, (b.hp / b.maxHp) * 100) + '%';
}

export function clearBosses() { bosses.length = 0; renderBossUI(); }
