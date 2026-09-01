// js/Core/Config.js — Configuración base y referencias al canvas

export const config = { w: 800, h: 600, diff: 2 };

export function getCanvas() {
    return document.getElementById('gameCanvas');
}
export function getCtx() {
    return getCanvas().getContext('2d');
}
export function getContainer() {
    return document.getElementById('game-container');
}

export function applyOptions(canvas, nave) {
    const sizeVal = document.getElementById('opt-size')?.value || '800x600';
    // Import dinámico de platform para evitar ciclo estático
    // Se resuelve en Main.js; aquí solo aplicamos tamaño si no estamos en móvil forzado
    // El check de isForcedMobile lo hace Main, aquí aplicamos genérico
    const isForcedMobile = document.documentElement.dataset.forcedMobile === 'true';
    if (sizeVal === 'auto' || isForcedMobile) {
        config.w = window.innerWidth;
        config.h = window.innerHeight;
    } else {
        const [w, h] = sizeVal.split('x').map(Number);
        config.w = w; config.h = h;
    }
    canvas.width = config.w; canvas.height = config.h;
    const container = getContainer();
    if (container) { container.style.width = config.w + 'px'; container.style.height = config.h + 'px'; }

    // Actualiza isMobile según opt-touch (si no es forzado)
    // La lógica de platform real se maneja en State.js; aquí solo reflejamos
    nave.x = canvas.width / 2; nave.y = canvas.height - 100;
}
