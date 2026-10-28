// js/ui/Hud.js — HUD, combo y progreso de oleada

export const hudState = { score: 0, comboCount: 0, comboMultiplier: 1, comboResetTimer: null };

// Referencias cacheadas: updateHUD se llama ~12 veces/s y antes hacía 6
// getElementById por llamada. Si el nodo se recrea, isConnected lo detecta.
const hudEls = {};
function el(id) {
    const cached = hudEls[id];
    if (cached && cached.isConnected) return cached;
    const node = document.getElementById(id);
    hudEls[id] = node;
    return node;
}

export function updateHUD({ combatState, weaponState, progression, gameMode }) {
    // Solo escribimos en el DOM cuando el valor cambia: innerText/textContent fuerza
    // recálculo de layout y esto se llamaba 60 veces por segundo.
    const scoreEl = el('val-score');
    if (scoreEl) { const v = String(hudState.score); if (scoreEl.textContent !== v) scoreEl.textContent = v; }
    const bombEl = el('val-bombs');
    if (bombEl) { const v = String(combatState.bombs); if (bombEl.textContent !== v) bombEl.textContent = v; }

    const hpPct = Math.max(0, Math.min(100, combatState.health));
    const healthFill = el('health-bar-fill');
    const healthPctEl = el('val-health-pct');
    if (healthFill) {
        const w = hpPct + '%';
        if (healthFill.style.width !== w) {
            healthFill.style.width = w;
            healthFill.style.background = hpPct > 50 ? '#33ff66' : hpPct > 25 ? '#ffcc00' : '#ff3344';
        }
    }
    if (healthPctEl) { const v = Math.round(hpPct) + '%'; if (healthPctEl.textContent !== v) healthPctEl.textContent = v; }
    const sectorLabel = gameMode.value === 'progressive' ? ` — SECTOR ${progression.currentWave}` : '';
    const levelTag = el('level-tag');
    if (levelTag) { const v = `MODO: ${gameMode.value.toUpperCase()}${sectorLabel}`; if (levelTag.textContent !== v) levelTag.textContent = v; }
    const wEl = el('val-weapon');
    if (wEl) {
        const v = weaponState.current === 'spread' ? 'SPREAD ★' : weaponState.current === 'laser' ? 'LASER ★' : 'NORMAL';
        if (wEl.textContent !== v) wEl.textContent = v;
        const c = weaponState.current !== 'normal' ? '#ff9900' : 'var(--primary)';
        if (wEl.style.color !== c) wEl.style.color = c;
    }
    const rEl = el('val-revive');
    if (rEl) { const v = combatState.hasRevive ? 'inline' : 'none'; if (rEl.style.display !== v) rEl.style.display = v; }
}

// Resetea el combo y cancela cualquier temporizador pendiente.
export function resetCombo() {
    if (hudState.comboResetTimer) {
        clearTimeout(hudState.comboResetTimer);
        hudState.comboResetTimer = null;
    }
    hudState.comboCount = 0;
    hudState.comboMultiplier = 1;
    updateComboDisplay();
}

function scheduleComboReset() {
    if (hudState.comboResetTimer) clearTimeout(hudState.comboResetTimer);
    hudState.comboResetTimer = setTimeout(() => {
        hudState.comboResetTimer = null;
        resetCombo();
    }, 2500);
}

// Registra N bajas de una sola vez (útil para bombas) y devuelve el puntaje total.
export function registerComboHits(count = 1, basePoints = 150) {
    if (count <= 0) return { pts: 0, multiplier: hudState.comboMultiplier };
    let total = 0;
    for (let i = 0; i < count; i++) {
        hudState.comboCount++;
        hudState.comboMultiplier = hudState.comboCount >= 10 ? 3 : hudState.comboCount >= 5 ? 2 : 1;
        total += basePoints * hudState.comboMultiplier;
    }
    hudState.score += total;
    scheduleComboReset();
    updateComboDisplay();
    return { pts: total, multiplier: hudState.comboMultiplier };
}

// Registra una baja individual.
export function registerComboHit(basePoints = 150) {
    return registerComboHits(1, basePoints);
}

export function updateComboDisplay() {
    const el = document.getElementById('combo-display');
    if (!el) return;
    if (hudState.comboCount >= 3) {
        el.style.display = 'block';
        el.innerText = hudState.comboMultiplier >= 3 ? `🔥 COMBO x${hudState.comboMultiplier} [${hudState.comboCount}]` : `⚡ COMBO x${hudState.comboMultiplier} [${hudState.comboCount}]`;
        el.style.color = hudState.comboMultiplier >= 3 ? 'var(--danger)' : 'var(--warning)';
        el.style.textShadow = `0 0 10px ${hudState.comboMultiplier >= 3 ? 'var(--danger)' : 'var(--warning)'}`;
    } else {
        el.style.display = 'none';
    }
}

// Se llama varias veces por frame: solo reconstruimos el DOM cuando cambia algo.
let waveProgressKey = '';

// Limpia el contador de oleada y el aviso de bomba al reiniciar o al cambiar
// de modo (progresivo → custom/solo_boss): antes quedaban visibles con datos
// de la partida anterior.
export function resetWaveProgressUI() {
    waveProgressKey = '';
    const el = document.getElementById('wave-progress');
    const alertEl = document.getElementById('bomb-alert');
    if (el) { el.style.display = 'none'; el.innerHTML = ''; }
    if (alertEl) { alertEl.style.display = 'none'; alertEl.textContent = ''; }
}

export function updateWaveProgress({ gameMode, progression, bosses }) {
    if (gameMode.value !== 'progressive') return;
    const el = document.getElementById('wave-progress');
    const alertEl = document.getElementById('bomb-alert');
    if (!el) return;
    const key = `${progression.wavePhase}|${progression.waveKills}|${progression.waveKillTarget}|${progression.waveTransition ? 1 : 0}|${bosses.length}`;
    if (key === waveProgressKey) return;
    waveProgressKey = key;

    const isWavePhase = [1,3,5,7].includes(progression.wavePhase);
    if (!isWavePhase || progression.waveTransition) {
        if (el.style.display !== 'none') el.style.display = 'none';
        if (alertEl && alertEl.style.display !== 'none') alertEl.style.display = 'none';
        return;
    }
    const pct = Math.min(100, (progression.waveKills / progression.waveKillTarget) * 100);
    const sectorNum = progression.wavePhase === 1 ? 1 : progression.wavePhase === 3 ? 2 : progression.wavePhase === 5 ? 3 : 4;
    if (el.style.display !== 'block') el.style.display = 'block';
    el.innerHTML = `SECTOR ${sectorNum}: <span style="color:${pct>=100?'#00ff00':'var(--primary)'}">${progression.waveKills}/${progression.waveKillTarget}</span>
        <div style="width:100%;height:4px;background:#333;border-radius:2px;margin-top:3px;">
          <div style="width:${pct}%;height:4px;background:${pct>=100?'#00ff00':'var(--primary)'};border-radius:2px;transition:width 0.1s;"></div>
        </div>`;
    if (alertEl) {
        if (pct >= 100 && bosses.length === 0) {
            if (alertEl.style.display !== 'block') alertEl.style.display = 'block';
            // El pulso se hace por CSS (antes se reescribían 4 estilos 60 veces/s).
            if (!alertEl.style.animation) {
                alertEl.style.animation = 'bombAlertPulse 0.5s infinite';
                alertEl.style.color = 'var(--warning)';
                alertEl.style.borderColor = 'var(--warning)';
                alertEl.style.textShadow = '0 0 10px var(--warning)';
            }
            alertEl.textContent = '💣 USA BOMBA → IR AL JEFE 💣';
        } else if (alertEl.style.display !== 'none') {
            alertEl.style.display = 'none';
        }
    }
}
