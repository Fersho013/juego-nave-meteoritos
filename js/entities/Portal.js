// js/entities/Portal.js — Portal azul 1% al usar bomba
export const portals = [];

export function spawnPortal(x, y) {
    portals.push({ x, y, radius: 22, life: 600, pulse: 0, active: true });
}

export function clearPortals() { portals.length = 0; }

export function updatePortals({ nave, onEnter }) {
    for (let i = portals.length - 1; i >= 0; i--) {
        const p = portals[i];
        p.life--;
        p.pulse += 0.12;
        if (p.life <= 0) { portals.splice(i, 1); continue; }
        if (Math.hypot(p.x - nave.x, p.y - nave.y) < p.radius + 14) {
            const portal = portals.splice(i, 1)[0];
            if (onEnter) onEnter(portal);
        }
    }
}

export function drawPortals(ctx) {
    portals.forEach(p => {
        const pulse = 0.5 + Math.sin(p.pulse) * 0.3;
        // outer glow
        ctx.save();
        ctx.globalAlpha = 0.18 * pulse + 0.12;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3.2);
        g.addColorStop(0, 'rgba(60,160,255,0.9)');
        g.addColorStop(0.45, 'rgba(30,90,255,0.4)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * 3.2, 0, Math.PI * 2); ctx.fill();
        // core
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = '#6ec8ff';
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 18; ctx.shadowColor = '#1e90ff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.stroke();
        // inner swirl
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = '#b3e1ff';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * 0.62, p.pulse, p.pulse + Math.PI * 1.6); ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * 0.35, -p.pulse, -p.pulse + Math.PI * 1.4); ctx.stroke();
        // center highlight
        ctx.globalAlpha = 0.7 + pulse * 0.3;
        ctx.fillStyle = '#e6f4ff';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // label
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#6ec8ff';
        ctx.font = 'bold 9px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('PORTAL', p.x, p.y - p.radius - 10);
        ctx.restore();
    });
}
