// js/ui/Hud.js — HUD, combo y progreso de oleada

export const hudState = { score: 0, comboCount: 0, comboMultiplier: 1, comboResetTimer: null };

export function updateHUD({ combatState, weaponState, progression, gameMode }) {
    const scoreEl = document.getElementById('val-score');
    if (scoreEl) scoreEl.innerText = hudState.score;
    const bombEl = document.getElementById('val-bombs');
    if (bombEl) bombEl.innerText = combatState.bombs;

    const hpPct = Math.max(0, Math.min(100, combatState.health));
    const healthFill = document.getElementById('health-bar-fill');
    const healthPctEl = document.getElementById('val-health-pct');
    if (healthFill) {
        healthFill.style.width = hpPct + '%';
        healthFill.style.background = hpPct > 50 ? '#33ff66' : hpPct > 25 ? '#ffcc00' : '#ff3344';
    }
    if (healthPctEl) healthPctEl.innerText = Math.round(hpPct) + '%';
    const sectorLabel = gameMode.value === 'progressive' ? ` — SECTOR ${progression.currentWave}` : '';
    const levelTag = document.getElementById('level-tag');
    if (levelTag) levelTag.innerText = `MODO: ${gameMode.value.toUpperCase()}${sectorLabel}`;
    const wEl = document.getElementById('val-weapon');
    if (wEl) {
        wEl.innerText = weaponState.current === 'spread' ? 'SPREAD ★' : weaponState.current === 'laser' ? 'LASER ★' : 'NORMAL';
        wEl.style.color = weaponState.current !== 'normal' ? '#ff9900' : 'var(--primary)';
    }
    const rEl = document.getElementById('val-revive');
    if (rEl) rEl.style.display = combatState.hasRevive ? 'inline' : 'none';
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

export function updateWaveProgress({ gameMode, progression, bosses }) {
    if (gameMode.value !== 'progressive') return;
    const el = document.getElementById('wave-progress');
    const alertEl = document.getElementById('bomb-alert');
    if (!el) return;
    const isWavePhase = [1,3,5,7].includes(progression.wavePhase);
    if (!isWavePhase || progression.waveTransition) {
        el.style.display = 'none';
        if (alertEl) alertEl.style.display = 'none';
        return;
    }
    const pct = Math.min(100, (progression.waveKills / progression.waveKillTarget) * 100);
    const sectorNum = progression.wavePhase === 1 ? 1 : progression.wavePhase === 3 ? 2 : progression.wavePhase === 5 ? 3 : 4;
    el.style.display = 'block';
    el.innerHTML = `SECTOR ${sectorNum}: <span style="color:${pct>=100?'#00ff00':'var(--primary)'}">${progression.waveKills}/${progression.waveKillTarget}</span>
        <div style="width:100%;height:4px;background:#333;border-radius:2px;margin-top:3px;">
          <div style="width:${pct}%;height:4px;background:${pct>=100?'#00ff00':'var(--primary)'};border-radius:2px;transition:width 0.1s;"></div>
        </div>`;
    if (alertEl) {
        if (pct >= 100 && bosses.length === 0) {
            alertEl.style.display = 'block';
            const pulse = Math.sin(Date.now() / 250);
            const col = pulse > 0 ? 'var(--warning)' : '#ff3366';
            alertEl.style.color = col;
            alertEl.style.borderColor = col;
            alertEl.style.textShadow = `0 0 10px ${col}`;
            alertEl.innerText = '💣 USA BOMBA → IR AL JEFE 💣';
        } else {
            alertEl.style.display = 'none';
        }
    }
}
