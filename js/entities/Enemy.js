// js/entities/Enemy.js — Enemigos comunes y formaciones

export const enemies = [];

export function spawnEnemy({ canvas, bosses, gameMode, currentWave, waveTransition, customSelection, forcedType = null }) {
    if (bosses.length > 0 && gameMode.value !== 'custom') return;
    if (waveTransition.value && gameMode.value === 'progressive') return;
    let type = 'common';

    if (forcedType) type = forcedType;
    else if (gameMode.value === 'progressive') {
        type = pickWaveType(currentWave.value);
    } else if (gameMode.value === 'custom') {
        const avail = customSelection.filter(v => ['common','special','elite','kamikaze','kamikaze_bomb'].includes(v));
        if (avail.length > 0) type = avail[Math.floor(Math.random()*avail.length)]; else return;
    }

    if (type === 'kamikaze_bomb') { /* nuevo enemigo Fase 2 Super Boss */ }
    let enemyHp = type === 'elite' ? 120 : (type === 'special' ? 60 : (type === 'life' ? 40 : (type === 'kamikaze' ? 25 : (type === 'kamikaze_bomb' ? 35 : 30))));
    let enemyVy = type === 'special' ? 3.5 : (type === 'life' ? 1 : (type === 'kamikaze' ? 1.5 : (type === 'kamikaze_bomb' ? 2.8 : 2)));
    const suicidal = (gameMode.value === 'progressive' && currentWave.value >= 4 && (type === 'special' || type === 'common')) || type === 'kamikaze_bomb';

    const isBombKamikaze = type === 'kamikaze_bomb';
    enemies.push({ x: Math.random() * (canvas.width - 40) + 20, y: -30, type, hp: enemyHp, vx: (Math.random() - 0.5) * 2, vy: enemyVy, shield: type === 'special', lastShot: 0, suicidal, isBombKamikaze, bombRadius: 42 });
}

function pickWaveType(currentWave) {
    const r = Math.random();
    if (currentWave === 1) return r < 0.10 ? 'life' : 'common';
    if (currentWave === 2) { if (r < 0.10) return 'life'; return r < 0.55 ? 'special' : 'common'; }
    if (currentWave === 3) {
        if (r < 0.10) return 'life';
        if (r < 0.15) return 'kamikaze';
        if (r < 0.45) return 'elite';
        if (r < 0.75) return 'special';
        return 'common';
    }
    // Wave 4
    if (r < 0.10) return 'life';
    if (r < 0.30) return 'kamikaze';
    if (r < 0.60) return 'elite';
    if (r < 0.80) return 'special';
    return 'common';
}

export function spawnFormation({ canvas, bosses, formType }) {
    if (bosses.length > 0) return;
    const baseX = canvas.width / 2, baseY = -30;
    let positions = [];
    if (formType === 'triangle') {
        for (let i = -2; i <= 2; i++) positions.push({ x: baseX + i*60, y: baseY - Math.abs(i)*40 });
    } else if (formType === 'square') {
        for (let row = 0; row < 3; row++) { for (let col = 0; col < 3; col++) positions.push({ x: baseX + (col-1)*70, y: baseY - row*60 }); }
    } else if (formType === 'circle') {
        for (let i = 0; i < 6; i++) { const a = (i/6)*Math.PI*2; positions.push({ x: baseX + Math.cos(a)*80, y: baseY + Math.sin(a)*40 - 20 }); }
    }
    const type = Math.random() > 0.5 ? 'special' : 'common';
    const enemyHp = type === 'special' ? 60 : 30;
    positions.forEach(p => {
        enemies.push({ x: p.x, y: p.y, type, hp: enemyHp, vx: 0, vy: 1.5, shield: type === 'special', lastShot: 0, suicidal: true, formation: formType });
    });
}

export function clearEnemies() { enemies.length = 0; }
