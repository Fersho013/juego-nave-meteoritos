// js/system/Shield.js — Escudo de energía del jugador.
// Absorbe daño antes que el casco: cada impacto normal consume 25% del escudo
// (4 golpes) y los golpes pesados consumen 50%. Tras 5 s sin recibir daño
// empieza a recargar +25% cada 2 s hasta completar el 100%.
// Las mejoras de estación reducen el tiempo de recarga y la cobertura de cada
// segmento (los golpes consumen menos escudo).

export const shieldState = {
    current: 100,
    max: 100,
    rechargeLevel: 0,
    coverageLevel: 0,
    lastHitAt: 0,
    rechargeFrom: 100,
    flash: 0,
    absorbedTotal: 0
};

const BASE_DELAY = 5;
const BASE_INTERVAL = 2;

function clampLevel(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(5, Math.round(n))) : 0;
}

export function shieldRegenDelay() {
    return Math.max(2, BASE_DELAY - shieldState.rechargeLevel * 0.4);
}

export function shieldRegenInterval() {
    return Math.max(0.8, BASE_INTERVAL - shieldState.rechargeLevel * 0.16);
}

// Fracción del escudo que consume cada impacto (25% base).
export function shieldHitCost(heavy = false) {
    const coverage = 1 - shieldState.coverageLevel * 0.045;
    return Math.min(100, 25 * (heavy ? 2 : 1) * Math.max(0.55, coverage));
}

export function configureShield({ rechargeLevel = 0, coverageLevel = 0, fill = true } = {}) {
    shieldState.rechargeLevel = clampLevel(rechargeLevel);
    shieldState.coverageLevel = clampLevel(coverageLevel);
    shieldState.max = 100;
    if (fill) shieldState.current = shieldState.max;
    shieldState.lastHitAt = 0;
    shieldState.rechargeFrom = shieldState.current;
    shieldState.flash = 0;
}

export function resetShield(fill = true) {
    shieldState.current = fill ? shieldState.max : 0;
    shieldState.lastHitAt = 0;
    shieldState.rechargeFrom = shieldState.current;
    shieldState.flash = 0;
}

export function shieldIsFull() {
    return shieldState.current >= shieldState.max;
}

export function shieldPercent() {
    return Math.max(0, Math.min(100, (shieldState.current / shieldState.max) * 100));
}

// Devuelve true si el escudo ha absorbido el impacto por completo.
export function absorbWithShield(heavy = false) {
    if (shieldState.current <= 0) return false;
    const cost = shieldHitCost(heavy);
    shieldState.current = Math.max(0, shieldState.current - cost);
    shieldState.rechargeFrom = shieldState.current;
    shieldState.lastHitAt = performance.now();
    shieldState.flash = 1;
    shieldState.absorbedTotal++;
    return true;
}

// Recarga perezosa: no acumula por frame, calcula cuántos segmentos de 25%
// corresponden desde el último impacto. Así el HUD puede consultarse sin
// escribir nada y el resultado es determinista.
export function updateShield() {
    shieldState.flash = Math.max(0, shieldState.flash - 0.06);
    if (shieldState.current >= shieldState.max || !shieldState.lastHitAt) return false;
    const elapsed = (performance.now() - shieldState.lastHitAt) / 1000;
    const delay = shieldState.regenDelay ? shieldState.regenDelay() : shieldRegenDelay();
    if (elapsed < delay) return false;
    const interval = shieldState.regenInterval ? shieldState.regenInterval() : shieldRegenInterval();
    const segments = Math.floor((elapsed - delay) / interval);
    const target = Math.min(shieldState.max, (shieldState.rechargeFrom ?? 0) + segments * 25);
    if (target > shieldState.current) {
        shieldState.current = target;
        return true;
    }
    return false;
}

// Tiempo que falta para el siguiente segmento (para el HUD).
export function shieldNextChargeIn() {
    if (shieldState.current >= shieldState.max) return 0;
    const elapsed = (performance.now() - shieldState.lastHitAt) / 1000;
    const delay = shieldRegenDelay();
    if (elapsed < delay) return delay - elapsed;
    const interval = shieldRegenInterval();
    return interval - ((elapsed - delay) % interval);
}

export function shieldStatusText() {
    updateShield();
    const pct = Math.round(shieldPercent());
    if (pct >= 100) return 'ESCUDO 100% · LISTO';
    if (!shieldState.lastHitAt || shieldState.current <= 0) {
        const wait = shieldNextChargeIn();
        return `ESCUDO ${pct}% · RECARGA ${wait.toFixed(1)}s`;
    }
    const wait = shieldNextChargeIn();
    if (wait <= 0.05) return `ESCUDO ${pct}% · RECARGANDO`;
    return `ESCUDO ${pct}% · +25% EN ${wait.toFixed(1)}s`;
}
