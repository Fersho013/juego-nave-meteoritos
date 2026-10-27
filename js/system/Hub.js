// js/system/Hub.js — Sector Hub: estaciones, cinturón de asteroides, créditos
import { nave } from '../entities/Player.js';
import { combatState } from './Combat.js';

export const hubState = {
  stations: [],
  belt: null, // { x, y, r }
  debris: [],
  warpTimer: 0,
  warpActive: false,
  nearStation: null
};

export function initHub(canvas) {
  hubState.stations = [];
  hubState.debris = [];
  // Estación de taller (curar/bombas/mejoras)
  hubState.stations.push({ x: canvas.width * 0.25, y: canvas.height * 0.35, r: 60, type: 'workshop', color: '#00ffcc', label: 'TALLER' });
  // Astillero (color/mejoras nave)
  hubState.stations.push({ x: canvas.width * 0.75, y: canvas.height * 0.65, r: 60, type: 'shipyard', color: '#9933ff', label: 'ASTILLERO' });
  // Cinturón de asteroides (zona de combate) en borde inferior
  hubState.belt = { x: canvas.width / 2, y: canvas.height - 60, w: canvas.width * 0.8, h: 90 };
  // Escombros pacíficos
  for (let i = 0; i < 18; i++) {
    hubState.debris.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: 8 + Math.random() * 14, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, rot: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.03, hp: 3 });
  }
}

export function updateHub(canvas, dt) {
  // mover escombros
  hubState.debris.forEach(d => {
    d.x += d.vx; d.y += d.vy; d.rot += d.rotSpeed;
    if (d.x < -40) d.x = canvas.width + 40; if (d.x > canvas.width + 40) d.x = -40;
    if (d.y < -40) d.y = canvas.height + 40; if (d.y > canvas.height + 40) d.y = -40;
  });
  // detección estación cercana
  hubState.nearStation = null;
  for (const st of hubState.stations) {
    const dist = Math.hypot(nave.x - st.x, nave.y - st.y);
    if (dist < st.r + 20) { hubState.nearStation = st; break; }
  }
  // fricción al entrar en estación
  if (hubState.nearStation) {
    nave.fric = 0.82; nave.vx *= 0.92; nave.vy *= 0.92;
  } else {
    nave.fric = 0.90;
  }
  // cinturón de combate
  if (hubState.belt && !hubState.warpActive) {
    const b = hubState.belt;
    if (nave.y > canvas.height - b.h - 20 && nave.x > (canvas.width - b.w) / 2 && nave.x < (canvas.width + b.w) / 2) {
      hubState.warpActive = true; hubState.warpTimer = 60;
    }
  }
  if (hubState.warpActive) {
    hubState.warpTimer--;
    if (hubState.warpTimer <= 0) {
      hubState.warpActive = false;
      return 'WARP';
    }
  }
  return null;
}

export function drawHub(ctx, canvas) {
  // estaciones
  hubState.stations.forEach(st => {
    ctx.save();
    ctx.shadowBlur = 24; ctx.shadowColor = st.color;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.strokeStyle = st.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = st.color; ctx.font = 'bold 12px Orbitron'; ctx.textAlign = 'center';
    ctx.fillText(st.label, st.x, st.y + 4);
    // aura
    const grad = ctx.createRadialGradient(st.x, st.y, st.r * 0.6, st.x, st.y, st.r * 1.6);
    grad.addColorStop(0, st.color + '33'); grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(st.x, st.y, st.r * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
  // escombros pacíficos
  hubState.debris.forEach(d => {
    ctx.save();
    ctx.translate(d.x, d.y); ctx.rotate(d.rot);
    ctx.fillStyle = '#6a6a7a'; ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const ang = (k / 6) * Math.PI * 2; const rr = d.r * (0.85 + (k % 2) * 0.15); const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr; if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  });
  // cinturón de asteroides rojos
  if (hubState.belt) {
    const b = hubState.belt;
    const x0 = (canvas.width - b.w) / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(80,10,10,0.55)'; ctx.fillRect(x0, canvas.height - b.h, b.w, b.h);
    ctx.strokeStyle = '#ff3366'; ctx.lineWidth = 2; ctx.shadowBlur = 12; ctx.shadowColor = '#ff3366';
    for (let i = 0; i < 22; i++) {
      const ax = x0 + (i / 21) * b.w; const ay = canvas.height - b.h / 2 + Math.sin(i * 1.3) * 18;
      ctx.fillStyle = '#ff3366'; ctx.beginPath(); ctx.arc(ax, ay, 6 + (i % 3) * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff3366'; ctx.font = 'bold 14px Orbitron'; ctx.textAlign = 'center';
    ctx.fillText('⚠ CINTURÓN DE ASTEROIDES — ZONA DE COMBATE ⚠', canvas.width / 2, canvas.height - b.h - 12);
    ctx.restore();
  }
  // warp overlay
  if (hubState.warpActive) {
    const t = 1 - hubState.warpTimer / 60;
    ctx.save();
    ctx.fillStyle = `rgba(255,51,102,${t * 0.5})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Orbitron'; ctx.textAlign = 'center';
    ctx.fillText('WARP...', canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }
}

export function damageHubDebris(bullets) {
  // permite disparar escombros pacíficos
  for (let i = hubState.debris.length - 1; i >= 0; i--) {
    const d = hubState.debris[i];
    for (let j = bullets.length - 1; j >= 0; j--) {
      const bul = bullets[j];
      if (Math.hypot(bul.x - d.x, bul.y - d.y) < d.r + 4) {
        d.hp--; bullets.splice(j, 1);
        if (d.hp <= 0) {
          hubState.debris.splice(i, 1);
          // drop créditos
          combatState.credits += 5;
        }
        break;
      }
    }
  }
}
