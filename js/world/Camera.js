// Cámara y estado compartido del universo de exploración.
// Las entidades conservan coordenadas de mundo; el render resta cameraX/Y.

export const world = {
    cameraX: 0,
    cameraY: 0,
    zoom: 1,
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
    const zoom = Math.max(0.55, Math.min(1, Number(world.zoom) || 1));
    camera.viewW = Math.max(1, (w || 1) / zoom);
    camera.viewH = Math.max(1, (h || 1) / zoom);
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
    const zoom = Math.max(0.55, Math.min(1, Number(world.zoom) || 1));
    return { x: camera.viewW * zoom / 2 + (x - camera.x - camera.viewW / 2) * zoom,
        y: camera.viewH * zoom / 2 + (y - camera.y - camera.viewH / 2) * zoom };
}

export function screenToWorld(x, y) {
    const zoom = Math.max(0.55, Math.min(1, Number(world.zoom) || 1));
    return { x: camera.x + camera.viewW / 2 + (x - camera.viewW * zoom / 2) / zoom,
        y: camera.y + camera.viewH / 2 + (y - camera.viewH * zoom / 2) / zoom };
}

export function resetCamera() {
    camera.x = 0;
    camera.y = 0;
}
