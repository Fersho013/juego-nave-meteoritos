// js/system/Combat.js — Bombas, revive, daño al jugador, pickups de vida/bomba

import { sfx } from '../Core/Audio.js';
import { nave } from '../entities/Player.js';
import { bosses, updateBossHP } from '../entities/Boss.js';
import { enemies } from '../entities/Enemy.js';
import { enemyBullets, pickUps } from '../entities/Projectile.js';
import { particles, debrisChunks, floatingTexts, fxState, createExplosion } from './Effects.js';

export const combatState = { health: 100, maxHealth: 100, damagePerHit: 20, bombs: 3, hasRevive: false };

export function dropRevivePickup(x, y) {
    if (combatState.hasRevive) pickUps.push({ x, y, type: 'bomb' });
    else pickUps.push({ x, y, type: 'revive' });
}

export function triggerBomb(isPlayer, origin, { inputRef }) {
    if (isPlayer) { if (combatState.bombs <= 0) return; combatState.bombs--; if (inputRef) inputRef.bomb = false; sfx.bomb(); }
    fxState.screenShake = 40;
    particles.push({ x: origin.x, y: origin.y, vx: 0, vy: 0, life: 1, type: 'bomb_ring', color: isPlayer ? '#fff' : '#ff0044' });
    if (isPlayer) {
        enemyBullets.length = 0;
        enemies.forEach(e => createExplosion(e.x, e.y, '#fff', 10));
        enemies.length = 0;
        bosses.forEach(b => { b.hp -= b.maxHp * 0.1; updateBossHP(b); });
    } else {
        // enemy bomb
        // bullets is handled in Main; we clear via callback
    }
}

export function triggerRevive({ updateHUD }) {
    combatState.hasRevive = false;
    combatState.health = 100;
    fxState.screenShake = 50; fxState.hitStopFrames = 14;
    particles.push({ x: nave.x, y: nave.y, vx: 0, vy: 0, life: 1, type: 'bomb_ring', color: '#ffee88' });
    enemyBullets.length = 0;
    enemies.forEach(e => createExplosion(e.x, e.y, '#fff', 10));
    enemies.length = 0;
    bosses.forEach(b => { if (!b.immune) { b.hp -= b.maxHp * 0.15; updateBossHP(b); } });
    nave.inmune = true; setTimeout(() => nave.inmune = false, 3000);
    floatingTexts.push({ x: nave.x, y: nave.y - 60, text: '✨ ¡SEGUNDA OPORTUNIDAD! ✨', life: 2.5, color: '#ffee88' });
    if (updateHUD) updateHUD();
}

export function playerHit(heavy = false, { updateHUD, promptContinue }) {
    if (nave.inmune) return;
    sfx.hit();
    fxState.hitStopFrames = heavy ? 7 : 4;
    combatState.health -= heavy ? combatState.damagePerHit * 2 : combatState.damagePerHit;
    combatState.health = Math.max(0, combatState.health);
    fxState.screenShake = heavy ? 30 : 15;
    nave.inmune = true;
    createExplosion(nave.x, nave.y, '#ff0000', heavy ? 40 : 25);
    if (updateHUD) updateHUD();
    setTimeout(() => nave.inmune = false, 2000);
    if (combatState.health <= 0) {
        if (combatState.hasRevive) triggerRevive({ updateHUD });
        else if (promptContinue) promptContinue();
    }
}
