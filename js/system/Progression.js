// js/system/Progression.js — Oleadas, fases y transiciones

import { bosses, createBoss } from '../entities/Boss.js';
import { enemies } from '../entities/Enemy.js';
import { enemyBullets } from '../entities/Projectile.js';
import { fxState } from './Effects.js';

export const progression = {
    currentWave: 1,
    wavePhase: 1, // 1=wave1 2=boss1 3=wave2 4=boss2 5=wave3 6=boss3 7=wave4 8=doppel 9=win
    waveKills: 0,
    waveKillTarget: 50,
    waveTransition: false,
    waveTransitionTimer: 0,
    waveTransitionMsg: ''
};

export function startWaveTransition(msg, nextPhase, callback) {
    if (progression.waveTransition) return;
    progression.waveTransition = true;
    progression.waveTransitionMsg = msg;
    progression.waveTransitionTimer = 150;
    progression.wavePhase = nextPhase;
    enemies.length = 0; enemyBullets.length = 0;
    fxState.screenShake = 5;
    setTimeout(() => {
        callback();
        progression.waveTransition = false;
        progression.waveTransitionMsg = '';
    }, 2500);
}

export function checkProgression({ gameMode, currentWaveRef, customSelection, frameCount, winGame }) {
    if (gameMode.value === 'custom') {
        const hasBoss = customSelection.some(v => ['b1','b2','b3','b_hunter','b_berserker','b4'].includes(v));
        if (bosses.length === 0 && hasBoss && progression.currentWave > 1) { winGame(); }
        if (bosses.length === 0 && progression.currentWave === 1) progression.currentWave++;
        return;
    }
    if (gameMode.value === 'solo_boss' && bosses.length === 0) {
        if (progression.currentWave === 1) { createBoss({ canvas: currentWaveRef.canvas, type: 'static', id: 'B1' }); progression.currentWave++; }
        else if (progression.currentWave === 2) { createBoss({ canvas: currentWaveRef.canvas, type: 'moving', id: 'B2' }); progression.currentWave++; }
        else if (progression.currentWave === 3) { createBoss({ canvas: currentWaveRef.canvas, type: 'static', id: 'B1' }); createBoss({ canvas: currentWaveRef.canvas, type: 'moving', id: 'B2' }); progression.currentWave++; }
        else if (progression.currentWave === 4) { createBoss({ canvas: currentWaveRef.canvas, type: 'hunter', id: 'B3' }); progression.currentWave++; }
        else if (progression.currentWave === 5) { createBoss({ canvas: currentWaveRef.canvas, type: 'berserker', id: 'B4' }); progression.currentWave++; }
        else if (progression.currentWave === 6) { createBoss({ canvas: currentWaveRef.canvas, type: 'doppel', id: 'DOPPEL' }); progression.currentWave++; }
        else winGame();
        return;
    }
    if (gameMode.value === 'progressive') {
        if (progression.waveTransition) return;
        if (progression.wavePhase === 1 && progression.waveKills >= progression.waveKillTarget && bosses.length === 0 && enemies.length === 0) {
            startWaveTransition('JEFE 1', 2, () => { createBoss({ canvas: currentWaveRef.canvas, type: 'static', id: 'B1' }); });
        } else if (progression.wavePhase === 3 && progression.waveKills >= progression.waveKillTarget && bosses.length === 0 && enemies.length === 0) {
            startWaveTransition('JEFE 2', 4, () => { progression.currentWave = 2; createBoss({ canvas: currentWaveRef.canvas, type: 'moving', id: 'B2' }); });
        } else if (progression.wavePhase === 5 && progression.waveKills >= progression.waveKillTarget && bosses.length === 0 && enemies.length === 0) {
            startWaveTransition('JEFE 3', 6, () => { progression.currentWave = 3; createBoss({ canvas: currentWaveRef.canvas, type: 'hunter', id: 'B3' }); });
        } else if (progression.wavePhase === 7 && progression.waveKills >= progression.waveKillTarget && bosses.length === 0 && enemies.length === 0) {
            startWaveTransition('JEFE FINAL — DOPPEL', 8, () => { progression.currentWave = 4; createBoss({ canvas: currentWaveRef.canvas, type: 'doppel', id: 'DOPPEL' }); });
        } else if (progression.wavePhase === 9 && bosses.length === 0) winGame();

        if (progression.wavePhase === 2 && bosses.length === 0 && !progression.waveTransition && frameCount > 10) {
            startWaveTransition('SECTOR 2', 3, () => { progression.currentWave = 2; progression.waveKills = 0; });
        } else if (progression.wavePhase === 4 && bosses.length === 0 && !progression.waveTransition && frameCount > 10) {
            startWaveTransition('SECTOR 3', 5, () => { progression.currentWave = 3; progression.waveKills = 0; });
        } else if (progression.wavePhase === 6 && bosses.length === 0 && !progression.waveTransition && frameCount > 10) {
            startWaveTransition('SECTOR 4', 7, () => { progression.currentWave = 4; progression.waveKills = 0; });
        } else if (progression.wavePhase === 8 && !progression.waveTransition && frameCount > 10) {
            const doppelAllDead = !bosses.some(b => b.type === 'doppel' || b.type === 'doppel_y' || b.type === 'doppel_o');
            if (doppelAllDead && bosses.length === 0) progression.wavePhase = 9;
        }
    }
}
