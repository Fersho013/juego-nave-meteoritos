const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 900;
canvas.height = 600;

// ==========================================
// NUEVO SISTEMA DE INERCIA Y FRICCIÓN
// ==========================================
// Ahora la nave no cambia de posición directamente.
// WASD cambia vx/vy (aceleración), y luego la fricción la detiene suavemente.
const nave = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  vx: 0, // velocidad en X
  vy: 0, // velocidad en Y
  aceleracion: 0.8, // Qué tan rápido gana velocidad
  friccion: 0.94, // Qué tan rápido se detiene (0.9 a 0.99)
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
let contadorMeteoritos = 0;
let puntaje = 0;
let vidas = 3;
let estado = 'inicio'; // 'inicio', 'jugando', 'final'
let mousePresionado = false;
let tiempoDisparo = 0;

let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;

// ==========================================
// NUEVAS VARIABLES: FONDO PARALLAX Y SHAKE
// ==========================================
let vibracion = 0; // Intensidad del screen shake
let estrellas = []; // Fondo estelar

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
});

document.addEventListener('keydown', e => {
  teclas[e.code] = true;
  if (estado === 'inicio' && e.code === 'Enter') iniciarJuego();
  if (estado === 'final' && e.code === 'KeyR') reiniciarJuego();
});

canvas.addEventListener('mousedown', () => {
  if (estado === 'jugando') mousePresionado = true;
});
canvas.addEventListener('mouseup', () => {
  mousePresionado = false;
});
document.addEventListener('keyup', e => {
  teclas[e.code] = false;
});

let jefes = [];
let disparosJefe = [];

// ==========================================
// NUEVAS FUNCIONES: CREAR ESTRELLAS
// ==========================================
function crearEstrellas() {
  estrellas = [];
  const numEstrellas = 150;
  for (let i = 0; i < numEstrellas; i++) {
    estrellas.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2,
      // Capas de profundidad (parallax)
      z: Math.random() // 0 = fondo lento, 1 = frente rápido
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
  // Reset de inercia
  nave.x = canvas.width / 2;
  nave.y = canvas.height / 2;
  nave.vx = 0;
  nave.vy = 0;
  nave.inmune = false;
  nave.parpadeoTiempo = 0;
  jefes = [];
  disparosJefe = [];
  contadorMeteoritos = 0;
  tiempoDisparo = 0;
  crearEstrellas(); // Generar el fondo
}

function reiniciarJuego() {
  estado = 'inicio';
}

function disparar() {
  const centerX = nave.x;
  const centerY = nave.y;
  const angle = Math.atan2(mouseY - centerY, mouseX - centerX);
  disparos.push({
    x: centerX,
    y: centerY,
    width: 6,
    height: 6,
    velocidad: 10,
    dx: Math.cos(angle) * 10,
    dy: Math.sin(angle) * 10
  });
}

// ==========================================
// DIBUJADO DE ESTRELLAS CON PARALLAX
// ==========================================
function dibujarEstrellas() {
  estrellas.forEach(e => {
    // La velocidad de movimiento depende de la profundidad 'z'
    const velocidadParallax = 1 + e.z * 3;
    e.y += velocidadParallax;
    
    // Wrapping: si sale por abajo, reaparece arriba
    if (e.y > canvas.height) {
      e.y = 0;
      e.x = Math.random() * canvas.width;
    }
    
    // Dibujar estrellas (más brillantes/grandes si están más cerca)
    const alfa = 0.5 + e.z * 0.5;
    ctx.fillStyle = `rgba(255, 255, 255, ${alfa})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function dibujarNave() {
  if (nave.inmune) {
    const now = Date.now();
    if (Math.floor(now / 100) % 2 === 0) return;
  }

  const centerX = nave.x;
  const centerY = nave.y;
  const angle = Math.atan2(mouseY - centerY, mouseX - centerX);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);
  ctx.fillStyle = nave.color;

  // Efecto neón en la nave al jugar
  if (estado === 'jugando') {
    ctx.shadowColor = 'white';
    ctx.shadowBlur = 10;
  }

  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-20, -15);
  ctx.lineTo(-20, 15);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function dibujarMeteoritos() {
  ctx.fillStyle = '#AAAAAA'; // Un gris un poco más claro
  meteoritos.forEach(m => {
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radio, 0, Math.PI * 2);
    ctx.fill();
  });
}

function dibujarDisparos() {
  ctx.fillStyle = '#FF3333'; // Rojo neón
  disparos.forEach(d => {
    ctx.fillRect(d.x - d.width / 2, d.y - d.height / 2, d.width, d.height);
  });
}

function dibujarParticulas() {
  particulas.forEach((p, i) => {
    ctx.fillStyle = `rgba(255, ${p.g}, 50, ${p.alpha})`; // Un tono más fuego
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();

    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.02;
    p.size *= 0.96;

    if (p.alpha <= 0) {
      particulas.splice(i, 1);
    }
  });
}

// ==========================================
// MEJORA VISUAL DEL HUD
// ==========================================
function dibujarHUD() {
  ctx.fillStyle = 'white';
  ctx.font = 'bold 22px Courier New'; // Fuente más retro/arcade
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE: ${puntaje.toString().padStart(6, '0')}`, 20, 35);
  
  // Dibujar corazones en lugar de texto para las vidas
  ctx.textAlign = 'right';
  let livesStr = '';
  for(let i=0; i<vidas; i++) livesStr += '❤️ ';
  ctx.fillText(`LIVES: ${livesStr}`, canvas.width - 20, 35);
}

function dibujarTextoCentral(texto, subtitulo = '') {
  ctx.fillStyle = 'white';
  ctx.font = 'bold 42px Courier New'; // Fuente arcade
  ctx.textAlign = 'center';
  ctx.fillText(texto, canvas.width / 2, canvas.height / 2 - 40);

  if (subtitulo) {
    ctx.font = '22px Courier New';
    ctx.fillText(subtitulo, canvas.width / 2, canvas.height / 2);
  }

  if (estado === 'inicio') {
    ctx.font = '18px Courier New';
    ctx.fillText('Controles:', canvas.width / 2, canvas.height / 2 + 60);
    ctx.fillText('WASD / Flechas: Mover', canvas.width / 2, canvas.height / 2 + 85);
    ctx.fillText('Mouse: Apuntar', canvas.width / 2, canvas.height / 2 + 110);
    ctx.fillText('Clic: Disparar', canvas.width / 2, canvas.height / 2 + 135);
    ctx.fillText('[ ENTER ]: Empezar', canvas.width / 2, canvas.height / 2 + 170);
  }
}

function perderVida() {
  vidas--;
  nave.inmune = true;
  nave.parpadeoTiempo = 1000;
  // SCREEN SHAKE: Sacudida fuerte al recibir daño
  vibracion = 15; 

  if (vidas <= 0) {
    estado = 'final';
  }
}

function crearExplosión(x, y) {
  const numParticulas = 20; // Más partículas para que se vea mejor
  for (let i = 0; i < numParticulas; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const speed = Math.random() * 4 + 1.5;
    particulas.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 5 + 2,
      g: Math.floor(Math.random() * 200 + 55), // Tonos amarillos/naranjas
      alpha: 1
    });
  }
}

// ==========================================
// MEJORA VISUAL JEFES (COLOR Y GLOW)
// ==========================================
function dibujarJefes() {
  jefes.forEach(jefe => {
    ctx.save();
    // Cambiado color de 'black' a magenta neón brillante
    ctx.fillStyle = jefe.color; 
    ctx.translate(jefe.x, jefe.y);
    const angle = Math.atan2(nave.y - jefe.y, nave.x - jefe.x);
    ctx.rotate(angle);

    // Efecto GLOW imponente para los jefes
    ctx.shadowColor = jefe.color;
    ctx.shadowBlur = 20;

    ctx.beginPath();
    ctx.moveTo(25, 0); // Un poco más grandes
    ctx.lineTo(-20, -18);
    ctx.lineTo(-20, 18);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Barra de vida estilizada
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; // Fondo translúcido
    ctx.fillRect(jefe.x - jefe.width / 2, jefe.y - jefe.height / 2 - 15, jefe.width, 8);
    ctx.fillStyle = '#00FF88'; // Barra neón
    ctx.fillRect(jefe.x - jefe.width / 2, jefe.y - jefe.height / 2 - 15, jefe.width * (jefe.vidas / 20), 8);
  });
}

function dibujarDisparosJefe() {
  disparosJefe.forEach(d => {
    ctx.fillStyle = d.color;
    // Efecto de rastro/glow en disparos jefe
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // Reset rápido
  });
}

function actualizar() {
  if (estado !== 'jugando') return;

  if (mousePresionado) {
    tiempoDisparo++;
    if (tiempoDisparo >= 10) {
      disparar();
      tiempoDisparo = 0;
    }
  } else {
    tiempoDisparo = 10;
  }

  if (nave.inmune) {
    nave.parpadeoTiempo -= 16;
    if (nave.parpadeoTiempo <= 0) {
      nave.inmune = false;
      nave.parpadeoTiempo = 0;
    }
  }

  // ==========================================
=  // APLICAR INERCIA Y FRICCIÓN A LA NAVE
  // ==========================================
  if (teclas['ArrowLeft'] || teclas['KeyA']) nave.vx -= nave.aceleracion;
  if (teclas['ArrowRight'] || teclas['KeyD']) nave.vx += nave.aceleracion;
  if (teclas['ArrowUp'] || teclas['KeyW']) nave.vy -= nave.aceleracion;
  if (teclas['ArrowDown'] || teclas['KeyS']) nave.vy += nave.aceleracion;

  // Aplicar fricción (desaceleración suave)
  nave.vx *= nave.friccion;
  nave.vy *= nave.friccion;

  // Actualizar posición con la velocidad resultante
  nave.x += nave.vx;
  nave.y += nave.vy;

  // Colisión con bordes (ajustada para inercia)
  if (nave.x - nave.width / 2 < 0) { nave.x = nave.width / 2; nave.vx *= -0.5; } // Rebote suave
  if (nave.x + nave.width / 2 > canvas.width) { nave.x = canvas.width - nave.width / 2; nave.vx *= -0.5; }
  if (nave.y - nave.height / 2 < 0) { nave.y = nave.height / 2; nave.vy *= -0.5; }
  if (nave.y + nave.height / 2 > canvas.height) { nave.y = canvas.height - nave.height / 2; nave.vy *= -0.5; }

  const frecuenciaMeteoritos = Math.max(10, 40 - Math.floor(puntaje / 10));
  const velocidadMeteoritos = 2 + Math.min(puntaje * 0.1, 5);

  contadorMeteoritos++;
  if (contadorMeteoritos % frecuenciaMeteoritos === 0 && jefes.length === 0) {
    const borde = Math.floor(Math.random() * 4);
    let x, y;

    switch (borde) {
      case 0: x = Math.random() * canvas.width; y = -20; break;
      case 1: x = canvas.width + 20; y = Math.random() * canvas.height; break;
      case 2: x = Math.random() * canvas.width; y = canvas.height + 20; break;
      case 3: x = -20; y = Math.random() * canvas.height; break;
    }

    const dx = nave.x - x;
    const dy = nave.y - y;
    const distancia = Math.sqrt(dx * dx + dy * dy);
    const vx = (dx / distancia) * velocidadMeteoritos;
    const vy = (dy / distancia) * velocidadMeteoritos;

    meteoritos.push({ x, y, radio: 15, vx, vy });
  }

  if (puntaje >= 50 && jefes.length === 0) {
    // JEFES AHORA SON DE COLOR NEÓN
    jefes.push({
      x: canvas.width / 3,
      y: 80,
      width: nave.width,
      height: nave.height,
      color: '#FF00FF', // Magenta brillante
      velocidadX: 3,
      velocidadY: 3,
      vidas: 20,
      dirX: 1,
      dirY: 1,
      disparoCooldown: 50,
      disparoTimer: 0
    });
    jefes.push({
      x: (canvas.width * 2) / 3,
      y: 80,
      width: nave.width,
      height: nave.height,
      color: '#00FFFF', // Cyan brillante
      velocidadX: 3,
      velocidadY: 3,
      vidas: 20,
      dirX: -1,
      dirY: 1,
      disparoCooldown: 50,
      disparoTimer: 0
    });
  }

  meteoritos.forEach((m, i) => {
    m.x += m.vx;
    m.y += m.vy;

    if (!nave.inmune) {
      // COLISIÓN NAVE (CIRCULAR): Más justa para el jugador
      const dx = m.x - nave.x;
      const dy = m.y - nave.y;
      const distancia = Math.sqrt(dx * dx + dy * dy);
      // Usamos nave.width/2 como radio aproximado de la nave triangular
      if (distancia < m.radio + (nave.width / 2.5)) {
        meteoritos.splice(i, 1);
        perderVida();
      }
    }

    // ELIMINADO: Ya no damos puntos por meteoritos fallidos (puntaje++)
    if (m.x < -30 || m.x > canvas.width + 30 || m.y < -30 || m.y > canvas.height + 30) {
      meteoritos.splice(i, 1);
    }
  });

  disparos = disparos.filter(d => d.x > 0 && d.x < canvas.width && d.y > 0 && d.y < canvas.height);
  disparos.forEach((d, i) => {
    d.x += d.dx;
    d.y += d.dy;

    meteoritos.forEach((m, mi) => {
      const dx = m.x - d.x;
      const dy = m.y - d.y;
      const distancia = Math.sqrt(dx * dx + dy * dy);
      if (distancia < m.radio) {
        crearExplosión(m.x, m.y);
        meteoritos.splice(mi, 1);
        disparos.splice(i, 1);
        puntaje += 10; // Subimos la recompensa por meteorito destruido
        // Pequeño shake al destruir meteorito
        vibracion = Math.max(vibracion, 2); 
      }
    });

    jefes.forEach((jefe, ji) => {
      // Detección rectangular para jefe (está bien, son grandes)
      if (
        d.x > jefe.x - jefe.width / 2 &&
        d.x < jefe.x + jefe.width / 2 &&
        d.y > jefe.y - jefe.height / 2 &&
        d.y < jefe.y + jefe.height / 2
      ) {
        jefe.vidas--;
        crearExplosión(d.x, d.y);
        disparos.splice(i, 1);
        vibracion = Math.max(vibracion, 3); // Shake al impactar jefe
        
        if (jefe.vidas <= 0) {
          crearExplosión(jefe.x, jefe.y);
          jefes.splice(ji, 1);
          puntaje += 500; // Gran recompensa por jefe
          // SCREEN SHAKE FUERTE al destruir jefe
          vibracion = 25; 
        }
      }
    });
  });

  jefes.forEach((jefe) => {
    jefe.x += jefe.velocidadX * jefe.dirX;
    jefe.y += jefe.velocidadY * jefe.dirY;

    if (jefe.x - jefe.width / 2 < 0 || jefe.x + jefe.width / 2 > canvas.width) jefe.dirX *= -1;
    if (jefe.y - jefe.height / 2 < 0 || jefe.y + jefe.height / 2 > canvas.height) jefe.dirY *= -1;

    jefe.disparoTimer++;
    if (jefe.disparoTimer >= jefe.disparoCooldown) {
      jefe.disparoTimer = 0;
      const angle = Math.atan2(nave.y - jefe.y, nave.x - jefe.x);
      disparosJefe.push({
        x: jefe.x,
        y: jefe.y,
        width: 10, // Un poco más grandes
        height: 10,
        velocidad: 7,
        dx: Math.cos(angle) * 7,
        dy: Math.sin(angle) * 7,
        color: jefe.color // Disparo del mismo color que el jefe
      });
    }
  });

  disparosJefe = disparosJefe.filter(d => d.x > 0 && d.x < canvas.width && d.y > 0 && d.y < canvas.height);
  disparosJefe.forEach((d, i) => {
    d.x += d.dx;
    d.y += d.dy;

    if (!nave.inmune) {
      // COLISIÓN DISPARO JEFE (CIRCULAR): Más justa para el jugador
      const dx = d.x - nave.x;
      const dy = d.y - nave.y;
      const distancia = Math.sqrt(dx * dx + dy * dy);
      if (distancia < (nave.width / 2.5) + (d.width / 2)) {
        disparosJefe.splice(i, 1);
        perderVida();
      }
    }
  });
}

// ==========================================
// LOOP PRINCIPAL CON SCREEN SHAKE Y FONDO
// ==========================================
function loopJuego() {
  ctx.save(); // GUARDAR ESTADO LIMPIO

  // APLICAR SCREEN SHAKE ANTES DE DIBUJAR NADA
  if (vibracion > 0) {
    const shakeX = (Math.random() - 0.5) * vibracion;
    const shakeY = (Math.random() - 0.5) * vibracion;
    ctx.translate(shakeX, shakeY);
    vibracion *= 0.9; // Se detiene gradualmente
    if (vibracion < 0.1) vibracion = 0;
  }

  // Fondo negro espacial limpio
  ctx.fillStyle = '#050505'; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (estado === 'inicio') {
    dibujarEstrellas(); // Estrellas también en inicio
    dibujarTextoCentral('STARSHIP DEFENDER', 'Presiona ENTER para empezar');
  } else if (estado === 'jugando') {
    actualizar();
    dibujarEstrellas(); // DIBUJAR FONDO PRIMERO
    dibujarMeteoritos();
    dibujarParticulas();
    dibujarDisparos();
    dibujarNave();
    dibujarJefes();
    dibujarDisparosJefe();
    dibujarHUD(); // HUD SIEMPRE AL FRENTE
  } else if (estado === 'final') {
    dibujarTextoCentral('¡GAME OVER!', 'Presiona R para reiniciar');
  }

  ctx.restore(); // RESTAURAR ESTADO (limpiar shake para siguiente frame)
  requestAnimationFrame(loopJuego);
}

// Empezar a crear estrellas para el fondo de inicio
crearEstrellas();
loopJuego();
