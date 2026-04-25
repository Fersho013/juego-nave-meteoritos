// ==========================================
// CONFIGURACIÓN Y REFERENCIAS UI
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const menuInicio = document.getElementById('menuInicio');
const btnReiniciar = document.getElementById('btnReiniciar');
const controlesTexto = document.getElementById('controles');
const tituloMenu = document.querySelector('#menuInicio h1');

canvas.width = 900;
canvas.height = 600;

// ==========================================
// VARIABLES DE ESTADO Y OBJETOS
// ==========================================
const nave = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  vx: 0,
  vy: 0,
  aceleracion: 0.8,
  friccion: 0.94,
  width: 40,
  height: 40,
  color: 'white',
  inmune: false,
  parpadeoTiempo: 0,
};

let teclas = {};
let meteoritos = [];
let disparos = [];
let particulas = [];
let estrellas = [];
let jefes = [];
let disparosJefe = [];

let puntaje = 0;
let vidas = 3;
let estado = 'inicio'; 
let mousePresionado = false;
let tiempoDisparo = 0;
let vibracion = 0;
let contadorMeteoritos = 0;

let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;

// ==========================================
// EVENT LISTENERS (CONTROLES)
// ==========================================
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

document.addEventListener('keydown', e => {
  teclas[e.code] = true;
  if (estado === 'inicio' && e.code === 'Enter') iniciarJuego();
  if (estado === 'final' && e.code === 'KeyR') iniciarJuego();
});

document.addEventListener('keyup', e => {
  teclas[e.code] = false;
});

canvas.addEventListener('mousedown', (e) => {
  if (estado === 'jugando') {
    if (e.button === 0) mousePresionado = true; // Clic izquierdo
  }
});

canvas.addEventListener('mouseup', () => {
  mousePresionado = false;
});

// DISPARO ESPECIAL (Clic Derecho)
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault(); 
  if (estado === 'jugando') {
    dispararEspecial();
  }
});

// ==========================================
// LÓGICA DEL SISTEMA
// ==========================================
function crearEstrellas() {
  estrellas = [];
  for (let i = 0; i < 150; i++) {
    estrellas.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2,
      z: Math.random() 
    });
  }
}

function iniciarJuego() {
  estado = 'jugando';
  puntaje = 0;
  vidas = 3;
  meteoritos = [];
  disparos = [];
  particulas = [];
  jefes = [];
  disparosJefe = [];
  contadorMeteoritos = 0;
  
  // Reset Nave
  nave.x = canvas.width / 2;
  nave.y = canvas.height / 2;
  nave.vx = 0;
  nave.vy = 0;
  nave.inmune = false;

  // Sincronización con HTML
  menuInicio.style.display = 'none';
  crearEstrellas();
}

function perderVida() {
  vidas--;
  nave.inmune = true;
  nave.parpadeoTiempo = 1000;
  vibracion = 15; 

  if (vidas <= 0) {
    estado = 'final';
    // Mostrar Menú HTML de nuevo
    menuInicio.style.display = 'flex';
    tituloMenu.innerText = '¡JUEGO TERMINADO!';
    controlesTexto.style.display = 'none';
    btnReiniciar.style.display = 'block';
    // Ocultar el botón original de "Iniciar"
    document.querySelector('button[onclick="iniciarJuego()"]').style.display = 'none';
  }
}

// ==========================================
// MECÁNICAS DE DISPARO
// ==========================================
function disparar() {
  const angle = Math.atan2(mouseY - nave.y, mouseX - nave.x);
  disparos.push({
    x: nave.x, y: nave.y,
    dx: Math.cos(angle) * 10,
    dy: Math.sin(angle) * 10,
    width: 6, height: 6
  });
}

function dispararEspecial() {
  // Disparo Triple en abanico
  const baseAngle = Math.atan2(mouseY - nave.y, mouseX - nave.x);
  const offsets = [-0.2, 0, 0.2]; // Tres direcciones
  
  offsets.forEach(offset => {
    const angle = baseAngle + offset;
    disparos.push({
      x: nave.x, y: nave.y,
      dx: Math.cos(angle) * 12, // Un poco más rápido
      dy: Math.sin(angle) * 12,
      width: 8, height: 8,
      especial: true
    });
  });
  vibracion = 5; // Pequeño retroceso visual
}

// ==========================================
// FUNCIONES DE DIBUJO
// ==========================================
function dibujarEstrellas() {
  estrellas.forEach(e => {
    const vel = 1 + e.z * 3;
    e.y += vel;
    if (e.y > canvas.height) e.y = 0;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + e.z * 0.7})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function dibujarNave() {
  if (nave.inmune && Math.floor(Date.now() / 100) % 2 === 0) return;

  const angle = Math.atan2(mouseY - nave.y, mouseX - nave.x);
  ctx.save();
  ctx.translate(nave.x, nave.y);
  ctx.rotate(angle);
  
  // Efecto Glow
  ctx.shadowColor = 'white';
  ctx.shadowBlur = 15;
  ctx.fillStyle = nave.color;

  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-20, -15);
  ctx.lineTo(-20, 15);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function dibujarJefes() {
  jefes.forEach(jefe => {
    ctx.save();
    ctx.translate(jefe.x, jefe.y);
    const angle = Math.atan2(nave.y - jefe.y, nave.x - jefe.x);
    ctx.rotate(angle);
    
    ctx.shadowColor = jefe.color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = jefe.color;

    ctx.beginPath();
    ctx.moveTo(25, 0);
    ctx.lineTo(-20, -18);
    ctx.lineTo(-20, 18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Barra de vida
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.fillRect(jefe.x - 20, jefe.y - 35, 40, 6);
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(jefe.x - 20, jefe.y - 35, 40 * (jefe.vidas / 20), 6);
  });
}

function dibujarHUD() {
  ctx.fillStyle = 'white';
  ctx.font = 'bold 20px Courier New';
  ctx.textAlign = 'left';
  ctx.fillText(`PUNTOS: ${puntaje}`, 20, 40);
  
  ctx.textAlign = 'right';
  let corazones = '';
  for(let i=0; i<vidas; i++) corazones += '❤️';
  ctx.fillText(corazones, canvas.width - 20, 40);
}

function crearExplosión(x, y, color = '255, 100, 0') {
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1;
    particulas.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 4 + 1,
      color: color,
      alpha: 1
    });
  }
}

// ==========================================
// ACTUALIZACIÓN DE LÓGICA (CORE)
// ==========================================
function actualizar() {
  if (estado !== 'jugando') return;

  // Inercia y Movimiento
  if (teclas['ArrowLeft'] || teclas['KeyA']) nave.vx -= nave.aceleracion;
  if (teclas['ArrowRight'] || teclas['KeyD']) nave.vx += nave.aceleracion;
  if (teclas['ArrowUp'] || teclas['KeyW']) nave.vy -= nave.aceleracion;
  if (teclas['ArrowDown'] || teclas['KeyS']) nave.vy += nave.aceleracion;

  nave.vx *= nave.friccion;
  nave.vy *= nave.friccion;
  nave.x += nave.vx;
  nave.y += nave.vy;

  // Límites pantalla con rebote
  if (nave.x < 20) { nave.x = 20; nave.vx *= -0.5; }
  if (nave.x > canvas.width - 20) { nave.x = canvas.width - 20; nave.vx *= -0.5; }
  if (nave.y < 20) { nave.y = 20; nave.vy *= -0.5; }
  if (nave.y > canvas.height - 20) { nave.y = canvas.height - 20; nave.vy *= -0.5; }

  // Auto-disparo
  if (mousePresionado) {
    tiempoDisparo++;
    if (tiempoDisparo >= 10) { disparar(); tiempoDisparo = 0; }
  }

  // Inmunidad
  if (nave.inmune) {
    nave.parpadeoTiempo -= 16;
    if (nave.parpadeoTiempo <= 0) nave.inmune = false;
  }

  // Generar Meteoritos
  contadorMeteoritos++;
  if (contadorMeteoritos % 30 === 0 && jefes.length === 0) {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if(side === 0) { x = Math.random()*canvas.width; y = -20; }
    else if(side === 1) { x = canvas.width+20; y = Math.random()*canvas.height; }
    else if(side === 2) { x = Math.random()*canvas.width; y = canvas.height+20; }
    else { x = -20; y = Math.random()*canvas.height; }
    
    const angle = Math.atan2(nave.y - y, nave.x - x);
    meteoritos.push({ x, y, radio: 15, vx: Math.cos(angle)*3, vy: Math.sin(angle)*3 });
  }

  // Aparecer Jefes
  if (puntaje >= 100 && jefes.length === 0) {
    jefes.push({ x: 200, y: 100, color: '#00ffff', vidas: 20, dirX: 1, dirY: 1, disparoTimer: 0, width: 40, height: 40 });
    jefes.push({ x: 700, y: 100, color: '#ff00ff', vidas: 20, dirX: -1, dirY: 1, disparoTimer: 0, width: 40, height: 40 });
  }

  // Actualizar Proyectiles
  disparos.forEach((d, i) => {
    d.x += d.dx; d.y += d.dy;
    if(d.x < 0 || d.x > canvas.width || d.y < 0 || d.y > canvas.height) disparos.splice(i, 1);
    
    meteoritos.forEach((m, mi) => {
      const dist = Math.hypot(m.x - d.x, m.y - d.y);
      if (dist < m.radio) {
        crearExplosión(m.x, m.y);
        meteoritos.splice(mi, 1);
        disparos.splice(i, 1);
        puntaje += 10;
        vibracion = 2;
      }
    });

    jefes.forEach((j, ji) => {
      if (Math.hypot(j.x - d.x, j.y - d.y) < 25) {
        j.vidas--;
        disparos.splice(i, 1);
        crearExplosión(d.x, d.y, '0, 255, 255');
        if (j.vidas <= 0) {
          crearExplosión(j.x, j.y, '255, 255, 255');
          jefes.splice(ji, 1);
          puntaje += 500;
          vibracion = 20;
        }
      }
    });
  });

  // Actualizar Meteoritos (Colisión nave)
  meteoritos.forEach((m, i) => {
    m.x += m.vx; m.y += m.vy;
    if (!nave.inmune && Math.hypot(m.x - nave.x, m.y - nave.y) < m.radio + 15) {
      meteoritos.splice(i, 1);
      perderVida();
    }
    if (m.x < -50 || m.x > canvas.width + 50 || m.y < -50 || m.y > canvas.height + 50) meteoritos.splice(i, 1);
  });

  // Actualizar Jefes
  jefes.forEach(j => {
    j.x += 2 * j.dirX; j.y += 1 * j.dirY;
    if (j.x < 50 || j.x > canvas.width - 50) j.dirX *= -1;
    if (j.y < 50 || j.y > 300) j.dirY *= -1;

    j.disparoTimer++;
    if (j.disparoTimer > 60) {
      const angle = Math.atan2(nave.y - j.y, nave.x - j.x);
      disparosJefe.push({ x: j.y, x: j.x, y: j.y, dx: Math.cos(angle)*5, dy: Math.sin(angle)*5, color: j.color });
      j.disparoTimer = 0;
    }
  });

  disparosJefe.forEach((d, i) => {
    d.x += d.dx; d.y += d.dy;
    if (!nave.inmune && Math.hypot(d.x - nave.x, d.y - nave.y) < 20) {
      disparosJefe.splice(i, 1);
      perderVida();
    }
  });

  // Partículas
  particulas.forEach((p, i) => {
    p.x += p.vx; p.y += p.vy; p.alpha -= 0.02;
    if (p.alpha <= 0) particulas.splice(i, 1);
  });
}

// ==========================================
// LOOP PRINCIPAL
// ==========================================
function loopJuego() {
  ctx.save();
  if (vibracion > 0) {
    ctx.translate((Math.random()-0.5)*vibracion, (Math.random()-0.5)*vibracion);
    vibracion *= 0.9;
  }

  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  dibujarEstrellas();
  
  if (estado === 'jugando') {
    actualizar();
    dibujarMeteoritos();
    particulas.forEach(p => {
      ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
    });
    dibujarDisparos();
    disparosJefe.forEach(d => {
      ctx.fillStyle = d.color;
      ctx.beginPath(); ctx.arc(d.x, d.y, 5, 0, Math.PI*2); ctx.fill();
    });
    dibujarJefes();
    dibujarNave();
    dibujarHUD();
  }

  ctx.restore();
  requestAnimationFrame(loopJuego);
}

// Inicialización de fondo para el menú
crearEstrellas();
loopJuego();

function dibujarMeteoritos() {
  ctx.fillStyle = '#888';
  meteoritos.forEach(m => {
    ctx.beginPath(); ctx.arc(m.x, m.y, m.radio, 0, Math.PI*2); ctx.fill();
  });
}

function dibujarDisparos() {
  disparos.forEach(d => {
    ctx.fillStyle = d.especial ? '#ffff00' : '#ff3333';
    ctx.fillRect(d.x - d.width/2, d.y - d.height/2, d.width, d.height);
  });
}
