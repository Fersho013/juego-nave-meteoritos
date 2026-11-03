let open = false;
let getData = () => ({ planets: [], cells: [], objects: [], stations: [], ship: { x: 0, y: 0 } });
let centerX = 0, centerY = 0, scale = 1, fitScale = 1;
const pointers = new Map();
let pinchDistance = 0;
let tap = null;

// Punto de ruta: se coloca tocando el mapa y se comparte con el minimapa.
const WAYPOINT_KEY = 'space-mission-waypoint-v1';
let waypoint = null;
try {
    const saved = JSON.parse(localStorage.getItem(WAYPOINT_KEY) || 'null');
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        waypoint = { x: saved.x, y: saved.y, label: saved.label || 'PUNTO DE RUTA' };
    }
} catch { /* Sin ruta guardada. */ }

function persistWaypoint() {
    try {
        if (waypoint) localStorage.setItem(WAYPOINT_KEY, JSON.stringify(waypoint));
        else localStorage.removeItem(WAYPOINT_KEY);
    } catch { /* La ruta sigue activa en esta sesión. */ }
}
export function getWaypoint() { return waypoint; }
export function hasWaypoint() { return Boolean(waypoint); }
export function setWaypoint(x, y, label = 'PUNTO DE RUTA') {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    waypoint = { x, y, label };
    persistWaypoint();
    updateRouteButton();
    return waypoint;
}
export function clearWaypoint() {
    waypoint = null;
    persistWaypoint();
    updateRouteButton();
}
function updateRouteButton() {
    const button = document.getElementById('system-map-clear-route');
    if (button) button.style.display = waypoint ? '' : 'none';
}

// Convierte un toque en un punto de ruta. Si cae cerca de un planeta,
// estación o zona conocida, se ancla a ese objetivo.
function placeWaypointAt(clientX, clientY) {
    const canvas = mapCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left, py = clientY - rect.top;
    const w = rect.width, h = rect.height;
    const data = getData();
    const toScreen = (x, y) => ({ x: w / 2 + (x - centerX) * scale, y: h / 2 + (y - centerY) * scale });

    let target = null, bestDistance = 20;
    const consider = (x, y, label) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const screen = toScreen(x, y);
        const distance = Math.hypot(screen.x - px, screen.y - py);
        if (distance < bestDistance) { bestDistance = distance; target = { x, y, label }; }
    };
    for (const planet of data.planets || []) consider(planet.x, planet.y, planet.name);
    for (const station of data.stations || []) consider(station.x, station.y, station.label || 'ESTACIÓN');
    for (const object of data.objects || []) consider(object.x, object.y, object.label || 'OBJETIVO');

    if (!target) {
        target = {
            x: centerX + (px - w / 2) / scale,
            y: centerY + (py - h / 2) / scale,
            label: 'PUNTO DE RUTA'
        };
    }
    setWaypoint(target.x, target.y, target.label);
    draw();
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function mapCanvas() { return document.getElementById('system-map-canvas'); }
function mapPanel() { return document.getElementById('system-map'); }

function draw() {
    if (!open) return;
    const canvas = mapCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.floor(rect.width * ratio));
    const height = Math.max(1, Math.floor(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const w = rect.width, h = rect.height;
    ctx.fillStyle = '#050b16'; ctx.fillRect(0, 0, w, h);
    const data = getData();
    const point = (x, y) => ({ x: w / 2 + (x - centerX) * scale, y: h / 2 + (y - centerY) * scale });

    // Las celdas solo se iluminan después de que el jugador las ha recorrido.
    ctx.fillStyle = 'rgba(40,113,157,0.14)'; ctx.strokeStyle = 'rgba(74,166,208,0.11)'; ctx.lineWidth = 1;
    for (const key of data.cells || []) {
        const [cx, cy] = key.split(',').map(Number); const p = point(cx * 6000, cy * 6000); const size = 6000 * scale;
        if (p.x + size < 0 || p.x > w || p.y + size < 0 || p.y > h) continue;
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size); ctx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);
    }

    // Anillos de distancia del sistema solar.
    for (const r of [50000, 100000, 150000, 200000]) {
        const p = point(0, 0); ctx.beginPath(); ctx.arc(p.x, p.y, r * scale, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(122,153,190,0.22)'; ctx.setLineDash([3, 7]); ctx.stroke();
    }
    ctx.setLineDash([]);
    const hub = point(0, 0);
    ctx.fillStyle = 'rgba(37,218,247,0.07)'; ctx.strokeStyle = 'rgba(63,225,255,0.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hub.x, hub.y, 1500 * scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#73e8ff'; ctx.beginPath(); ctx.arc(hub.x, hub.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 11px Orbitron'; ctx.textAlign = 'left'; ctx.fillText('AEGIS PRIME', hub.x + 11, hub.y - 8);
    for (const station of data.stations || []) {
        const p = point(station.x, station.y); ctx.fillStyle = station.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
        if (scale > 0.004) { ctx.font = '7px Orbitron'; ctx.fillStyle = '#cce2f4'; ctx.fillText(station.label, p.x + 6, p.y + 3); }
    }

    for (const planet of data.planets || []) {
        const p = point(planet.x, planet.y); if (p.x < -80 || p.x > w + 80 || p.y < -80 || p.y > h + 80) continue;
        const r = clamp(planet.radius * scale, 5, 15);
        ctx.fillStyle = planet.color; ctx.shadowColor = planet.color; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.strokeStyle = planet.cleared ? '#80ffc1' : planet.color; ctx.lineWidth = planet.cleared ? 2 : 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(r + 3, 7), 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#edf6ff'; ctx.font = '10px Orbitron'; ctx.fillText(planet.name, p.x + 12, p.y + 4);
        ctx.fillStyle = 'rgba(195,211,230,0.7)'; ctx.font = '8px Orbitron'; ctx.fillText(`${Math.round(planet.distance / 1000)}k`, p.x + 12, p.y + 16);
    }

    for (const object of data.objects || []) {
        const p = point(object.x, object.y); if (p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) continue;
        ctx.fillStyle = object.color; ctx.strokeStyle = object.color;
        if (object.type === 'procedural') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore(); }
        else { ctx.beginPath(); ctx.arc(p.x, p.y, object.type === 'belt' ? 5 : 4, 0, Math.PI * 2); ctx.fill(); }
        if (scale > 0.0017) { ctx.fillStyle = '#dce9f7'; ctx.font = '8px Orbitron'; ctx.fillText(object.label, p.x + 8, p.y - 7); }
    }
    const ship = point(data.ship?.x || 0, data.ship?.y || 0);
    let routeInfo = '';
    if (waypoint) {
        const waypointX = waypoint.x, waypointY = waypoint.y;
        const target = point(waypointX, waypointY);
        const distance = Math.hypot(waypointX - (data.ship?.x || 0), waypointY - (data.ship?.y || 0));
        routeInfo = ` · RUTA ${(distance / 1000).toFixed(1)}k`;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,214,102,0.72)';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 6]);
        ctx.beginPath(); ctx.moveTo(ship.x, ship.y); ctx.lineTo(target.x, target.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }
    ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(-Math.PI / 4); ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(0, 4); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.restore();

    if (waypoint) {
        const waypointX = waypoint.x, waypointY = waypoint.y;
        const target = point(waypointX, waypointY);
        const pulse = 0.6 + Math.sin(performance.now() / 320) * 0.4;
        const inside = target.x > 12 && target.x < w - 12 && target.y > 12 && target.y < h - 12;
        if (inside) {
            ctx.save();
            ctx.translate(target.x, target.y);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = '#ffd666';
            ctx.fillRect(-5, -5, 10, 10);
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = '#ffe9a8';
            ctx.lineWidth = 1.4;
            ctx.strokeRect(-9, -9, 18, 18);
            ctx.restore();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 9px Orbitron'; ctx.textAlign = 'left';
            const label = waypoint.label || 'PUNTO DE RUTA';
            ctx.fillText(label, target.x + 13, target.y - 10);
        } else {
            // El objetivo queda fuera de la vista: flecha en el borde.
            const dx = target.x - ship.x, dy = target.y - ship.y;
            const angle = Math.atan2(dy, dx);
            const margin = 30;
            const ratio = Math.min(
                dx !== 0 ? (w / 2 - margin) / Math.abs(dx) : Infinity,
                dy !== 0 ? (h / 2 - margin) / Math.abs(dy) : Infinity
            );
            const edgeX = ship.x + dx * ratio;
            const edgeY = ship.y + dy * ratio;
            ctx.save();
            ctx.translate(edgeX, edgeY);
            ctx.rotate(angle);
            ctx.globalAlpha = pulse;
            ctx.fillStyle = '#ffd666';
            ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
            ctx.restore();
            ctx.globalAlpha = 1;
        }
    }

    ctx.fillStyle = 'rgba(210,226,244,0.75)'; ctx.font = '9px Orbitron'; ctx.textAlign = 'left';
    ctx.fillText(`X ${Math.round(data.ship?.x || 0)} · Y ${Math.round(data.ship?.y || 0)} · ZOOM ${Math.round(scale / fitScale * 100)}%${routeInfo}`, 16, h - 16);
}

function zoomAt(factor, x, y) {
    const canvas = mapCanvas(); if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = x - rect.left, py = y - rect.top;
    const beforeX = centerX + (px - rect.width / 2) / scale;
    const beforeY = centerY + (py - rect.height / 2) / scale;
    scale = clamp(scale * factor, 0.00065, 0.12);
    centerX = beforeX - (px - rect.width / 2) / scale;
    centerY = beforeY - (py - rect.height / 2) / scale;
}

export function initSystemMap(provider) {
    getData = provider;
    const canvas = mapCanvas();
    if (!canvas || canvas.dataset.mapBound) return;
    canvas.dataset.mapBound = 'true';
    canvas.addEventListener('wheel', event => { event.preventDefault(); zoomAt(event.deltaY < 0 ? 1.14 : 0.87, event.clientX, event.clientY); draw(); }, { passive: false });
    canvas.addEventListener('pointerdown', event => {
        try { canvas.setPointerCapture(event.pointerId); } catch { /* Puntero sintético o ya liberado. */ }
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 1) {
            tap = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), moved: 0 };
        } else {
            tap = null;
        }
        if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDistance = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    canvas.addEventListener('pointermove', event => {
        if (!pointers.has(event.pointerId)) return;
        if (tap && tap.id === event.pointerId) {
            tap.moved = Math.max(tap.moved, Math.hypot(event.clientX - tap.x, event.clientY - tap.y));
        }
        const previous = pointers.get(event.pointerId);
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2) {
            const [a, b] = [...pointers.values()]; const nextDistance = Math.hypot(a.x - b.x, a.y - b.y);
            if (pinchDistance > 0 && nextDistance > 0) zoomAt(nextDistance / pinchDistance, (a.x + b.x) / 2, (a.y + b.y) / 2);
            pinchDistance = nextDistance;
        } else { centerX -= (event.clientX - previous.x) / scale; centerY -= (event.clientY - previous.y) / scale; }
        draw();
    });
    const release = (event, cancelled = false) => {
        if (tap && tap.id === event.pointerId) {
            const wasTap = !cancelled && pointers.size === 1 && tap.moved < 9 && performance.now() - tap.time < 700;
            tap = null;
            if (wasTap && open) placeWaypointAt(event.clientX, event.clientY);
        }
        pointers.delete(event.pointerId); if (pointers.size < 2) pinchDistance = 0;
    };
    canvas.addEventListener('pointerup', event => release(event, false));
    canvas.addEventListener('pointercancel', event => release(event, true));
    document.getElementById('system-map-close')?.addEventListener('click', closeSystemMap);
    document.getElementById('system-map-reset')?.addEventListener('click', fitSystemMap);
    document.getElementById('system-map-clear-route')?.addEventListener('click', () => { clearWaypoint(); draw(); });
    document.getElementById('system-map-zoom-in')?.addEventListener('click', () => { zoomAt(1.3, innerWidth / 2, innerHeight / 2); draw(); });
    document.getElementById('system-map-zoom-out')?.addEventListener('click', () => { zoomAt(0.77, innerWidth / 2, innerHeight / 2); draw(); });
    updateRouteButton();
}

export function isSystemMapOpen() { return open; }
export function openSystemMap() {
    open = true; mapPanel()?.classList.add('open'); updateRouteButton(); fitSystemMap();
}
export function closeSystemMap() { open = false; mapPanel()?.classList.remove('open'); }
export function toggleSystemMap() { if (open) closeSystemMap(); else openSystemMap(); }
export function fitSystemMap() {
    const canvas = mapCanvas(); const rect = canvas?.getBoundingClientRect();
    centerX = 0; centerY = 0;
    fitScale = rect ? Math.min(rect.width, rect.height) / 460000 : 0.001;
    scale = fitScale;
    draw();
}
export function drawSystemMapFrame() { draw(); }
