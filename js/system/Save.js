// Persistencia local de recursos y checkpoint de campaña.
const SAVE_KEY = 'space-mission-echelON-save-v1';
let lastSerialized = '';
let lastSnapshotKey = '';

export function loadPlayerSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const combat = parsed?.combat || {};
        const ship = parsed?.ship || {};
        const run = parsed?.progression || {};
        const save = {
            combat: {
                health: clamp(combat.health, 0, 100, 100),
                bombs: clamp(combat.bombs, 0, 99, 3),
                hasRevive: Boolean(combat.hasRevive),
                credits: clamp(combat.credits, 0, 99999999, 0)
            },
            ship: {
                accel: clamp(ship.accel, 0.9, 1.3, 0.9),
                damageLevel: clamp(ship.damageLevel, 0, 5, 0), dashLevel: clamp(ship.dashLevel, 0, 5, 0),
                shieldLevel: clamp(ship.shieldLevel, 0, 5, 0), tripleLevel: clamp(ship.tripleLevel, 0, 1, 0),
                shieldRechargeLevel: clamp(ship.shieldRechargeLevel, 0, 5, 0),
                shieldCoverageLevel: clamp(ship.shieldCoverageLevel, 0, 5, 0)
            },
            progression: {
                currentWave: clamp(run.currentWave, 1, 4, 1),
                wavePhase: [1,2,3,4,5,6,7,8,9].includes(run.wavePhase) ? run.wavePhase : 1,
                waveKills: clamp(run.waveKills, 0, 200, 0),
                waveKillTarget: clamp(run.waveKillTarget, 50, 200, 50),
                awaitingCheckpoint: Boolean(run.awaitingCheckpoint),
                awaitingBossReward: Boolean(run.awaitingBossReward),
                suspendedAdventure: Boolean(run.suspendedAdventure),
                pendingBossRewardType: ['bomb','revive'].includes(run.pendingBossRewardType) ? run.pendingBossRewardType : null
            }
        };
        lastSerialized = JSON.stringify(save);
        lastSnapshotKey = signature(save.combat, save.ship, save.progression);
        return save;
    } catch {
        return null;
    }
}

export function savePlayerState(combatState, nave, progression) {
    const snapshotKey = signature(combatState, nave, progression);
    if (snapshotKey === lastSnapshotKey) return;
    const save = {
        combat: {
            health: clamp(combatState.health, 0, 100, 100),
            bombs: clamp(combatState.bombs, 0, 99, 3),
            hasRevive: Boolean(combatState.hasRevive),
            credits: clamp(combatState.credits, 0, 99999999, 0)
        },
        ship: {
            accel: clamp(nave.accel, 0.9, 1.3, 0.9),
            damageLevel: clamp(nave.damageLevel, 0, 5, 0), dashLevel: clamp(nave.dashLevel, 0, 5, 0),
            shieldLevel: clamp(nave.shieldLevel, 0, 5, 0), tripleLevel: clamp(nave.tripleLevel, 0, 1, 0),
            shieldRechargeLevel: clamp(nave.shieldRechargeLevel, 0, 5, 0),
            shieldCoverageLevel: clamp(nave.shieldCoverageLevel, 0, 5, 0)
        },
        progression: {
            currentWave: clamp(progression.currentWave, 1, 4, 1),
            wavePhase: progression.wavePhase,
            waveKills: clamp(progression.waveKills, 0, 200, 0),
            waveKillTarget: clamp(progression.waveKillTarget, 50, 200, 50),
            awaitingCheckpoint: Boolean(progression.awaitingCheckpoint),
            awaitingBossReward: Boolean(progression.awaitingBossReward),
            suspendedAdventure: Boolean(progression.suspendedAdventure),
            pendingBossRewardType: ['bomb','revive'].includes(progression.pendingBossRewardType) ? progression.pendingBossRewardType : null
        }
    };
    const serialized = JSON.stringify(save);
    if (serialized === lastSerialized) return;
    try {
        localStorage.setItem(SAVE_KEY, serialized);
        lastSerialized = serialized;
        lastSnapshotKey = snapshotKey;
    } catch { /* El juego sigue funcionando si el navegador bloquea el almacenamiento local. */ }
}

// Borra el guardado global heredado y sus cachés en memoria. Se usa al borrar
// partidas para que un guardado antiguo no pueda resucitar el progreso.
export function clearPlayerSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* Sin almacenamiento disponible. */ }
    lastSerialized = '';
    lastSnapshotKey = '';
}

function signature(combat, ship, progression) {
    return [combat.health, combat.bombs, combat.hasRevive ? 1 : 0, combat.credits,
        ship.accel, ship.damageLevel || 0, ship.dashLevel || 0, ship.shieldLevel || 0, ship.tripleLevel || 0,
        ship.shieldRechargeLevel || 0, ship.shieldCoverageLevel || 0,
        progression.currentWave, progression.wavePhase, progression.waveKills,
        progression.waveKillTarget, progression.awaitingCheckpoint ? 1 : 0,
        progression.awaitingBossReward ? 1 : 0, progression.suspendedAdventure ? 1 : 0,
        progression.pendingBossRewardType || ''].join('|');
}

function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
