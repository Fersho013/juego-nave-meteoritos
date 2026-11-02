// Cámara y estado compartido del universo de exploración.
// Las entidades conservan coordenadas de mundo; el render resta cameraX/Y.

export const world = {
    cameraX: 0,
    cameraY: 0,
    seed: Date.now() >>> 0,
    chunks: new Map(),
    zones: []
};

export const camera = {
    viewW: 0,
    viewH: 0,
    get x() { return world.cameraX; },
    set x(value) { world.cameraX = Number.isFinite(value) ? value : 0; },
    get y() { return world.cameraY; },
    set y(value) { world.cameraY = Number.isFinite(value) ? value : 0; }
};

export function setViewport(w, h) {
    camera.viewW = Math.max(1, w || 1);
    camera.viewH = Math.max(1, h || 1);
}

export function centerCamera(x, y) {
    camera.x = x - camera.viewW / 2;
    camera.y = y - camera.viewH / 2;
}

export function followCamera(dt, x, y, leadX = 0, leadY = 0, smooth = 9) {
    const desiredX = x - camera.viewW / 2 + leadX;
    const desiredY = y - camera.viewH / 2 + leadY;
    const step = Math.max(0, Math.min(0.1, dt || 0));
    const blend = 1 - Math.exp(-smooth * step);
    camera.x += (desiredX - camera.x) * blend;
    camera.y += (desiredY - camera.y) * blend;
}

export function worldToScreen(x, y) {
    return { x: x - camera.x, y: y - camera.y };
}

export function screenToWorld(x, y) {
    return { x: x + camera.x, y: y + camera.y };
}

export function resetCamera() {
    camera.x = 0;
    camera.y = 0;
}
