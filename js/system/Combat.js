// js/system/Combat.js — Bombas, revive, daño al jugador, pickups de vida/bomba

import { sfx } from '../Core/Audio.js';
import { nave } from '../entities/Player.js';
import { bosses, updateBossHP } from '../entities/Boss.js';
import { enemies } from '../entities/Enemy.js';
import { enemyBullets, pickUps } from '../entities/Projectile.js';
import * as EffectsNS from './Effects.js';
import { floatingTexts, fxState, createExplosion } from './Effects.js';
const pushParticle = EffectsNS.pushParticle || ((p) => { if (EffectsNS.particles.length < (EffectsNS.MAX_PARTICLES || 400)) { EffectsNS.particles.push(p); return true; } return false; });
import { registerComboHits } from '../ui/Hud.js';

export const combatState = { health: 100, maxHealth: 100, damagePerHit: 20, bombs: 3, hasRevive: false };

// Mismo token de inmunidad que Main.js (vive en `nave`): un timer de 2 s no
// debe anular los 3 s de revive/continue. Sin export nuevo (caché mixta).
function grantImmunity(ms) {
    const token = (nave.__immToken || 0) + 1;
    nave.__immToken = token;
    nave.inmune = true;
    setTimeout(() => { if (nave.__immToken === token) nave.inmune = false; }, ms);
}

export function dropRevivePickup(x, y) {
    if (combatState.hasRevive) pickUps.push({ x, y, type: 'bomb' });
    else pickUps.push({ x, y, type: 'revive' });
}

export function triggerBomb(isPlayer, origin, { inputRef } = {}) {
    if (isPlayer) { if (combatState.bombs <= 0) return; combatState.bombs--; if (inputRef) inputRef.bomb = false; sfx.bomb(); }
    fxState.screenShake = 40;
    pushParticle({ x: origin.x, y: origin.y, vx: 0, vy: 0, life: 1, type: 'bomb_ring', color: isPlayer ? '#fff' : '#ff0044' });
    if (isPlayer) {
        enemyBullets.length = 0;
        let bombKills = 0;
        enemies.forEach(e => { createExplosion(e.x, e.y, '#fff', 10); if (e.type !== 'life') bombKills++; });
        enemies.length = 0;
        if (bombKills > 0) {
            const { pts } = registerComboHits(bombKills);
            floatingTexts.push({ x: origin.x, y: origin.y - 60, text: `+${pts} BOMBA x${bombKills}`, life: 1.5, color: '#ffcc00' });
        }
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
    pushParticle({ x: nave.x, y: nave.y, vx: 0, vy: 0, life: 1, type: 'bomb_ring', color: '#ffee88' });
    enemyBullets.length = 0;
    enemies.forEach(e => createExplosion(e.x, e.y, '#fff', 10));
    enemies.length = 0;
    bosses.forEach(b => { if (!b.immune) { b.hp -= b.maxHp * 0.15; updateBossHP(b); } });
    grantImmunity(3000);
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
    grantImmunity(2000);
    createExplosion(nave.x, nave.y, '#ff0000', heavy ? 40 : 25);
    if (updateHUD) updateHUD();
    if (combatState.health <= 0) {
        if (combatState.hasRevive) triggerRevive({ updateHUD });
        else if (promptContinue) promptContinue();
    }
}
