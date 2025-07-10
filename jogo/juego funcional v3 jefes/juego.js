const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 900;
canvas.height = 600;

const nave = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  width: 40,
  height: 40,
  color: 'white',
  velocidad: 5,
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

// NUEVAS VARIABLES PARA MULTIPLES JEFES Y SUS DISPAROS
let jefes = [];
let disparosJefe = [];

function iniciarJuego() {
  estado = 'jugando';
  puntaje = 0;
  vidas = 3;
  meteoritos = [];
  disparos = [];
  particulas = [];
  nave.x = canvas.width / 2;
  nave.y = canvas.height / 2;
  nave.inmune = false;
  nave.parpadeoTiempo = 0;
  jefes = [];
  disparosJefe = [];
  contadorMeteoritos = 0;
  tiempoDisparo = 0;
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

function dibujarNave() {
  if (nave.inmune) {
    const now = Date.now();
    if (Math.floor(now / 100) % 2 === 0) return; // parpadeo
  }

  const centerX = nave.x;
  const centerY = nave.y;
  const angle = Math.atan2(mouseY - centerY, mouseX - centerX);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);
  ctx.fillStyle = nave.color;

  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-20, -15);
  ctx.lineTo(-20, 15);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function dibujarMeteoritos() {
  ctx.fillStyle = 'gray';
  meteoritos.forEach(m => {
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radio, 0, Math.PI * 2);
    ctx.fill();
  });
}

function dibujarDisparos() {
  ctx.fillStyle = 'red';
  disparos.forEach(d => {
    ctx.fillRect(d.x - d.width / 2, d.y - d.height / 2, d.width, d.height);
  });
}

function dibujarParticulas() {
  particulas.forEach((p, i) => {
    ctx.fillStyle = `rgba(255, ${p.g}, 0, ${p.alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();

    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.02;
    p.size *= 0.95;

    if (p.alpha <= 0) {
      particulas.splice(i, 1);
    }
  });
}

function dibujarHUD() {
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.fillText(`Puntaje: ${puntaje}`, 20, 30);
  ctx.fillText(`Vidas: ${vidas}`, canvas.width - 100, 30);
}

function dibujarTextoCentral(texto, subtitulo = '') {
  ctx.fillStyle = 'white';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(texto, canvas.width / 2, canvas.height / 2 - 40);

  if (subtitulo) {
    ctx.font = '20px Arial';
    ctx.fillText(subtitulo, canvas.width / 2, canvas.height / 2);
  }

  if (estado === 'inicio') {
    ctx.font = '18px Arial';
    ctx.fillText('Controles:', canvas.width / 2, canvas.height / 2 + 60);
    ctx.fillText('WASD o Flechas: Mover nave', canvas.width / 2, canvas.height / 2 + 90);
    ctx.fillText('Mouse: Apuntar', canvas.width / 2, canvas.height / 2 + 120);
    ctx.fillText('Clic y mantener: Disparar', canvas.width / 2, canvas.height / 2 + 150);
    ctx.fillText('ENTER: Empezar juego', canvas.width / 2, canvas.height / 2 + 180);
    ctx.fillText('R: Reiniciar después de perder', canvas.width / 2, canvas.height / 2 + 210);
  }
}

function perderVida() {
  vidas--;
  nave.inmune = true;
  nave.parpadeoTiempo = 1000;

  if (vidas <= 0) {
    estado = 'final';
  }
}

function crearExplosión(x, y) {
  const numParticulas = 15;
  for (let i = 0; i < numParticulas; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const speed = Math.random() * 3 + 1;
    particulas.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 4 + 2,
      g: Math.floor(Math.random() * 256),
      alpha: 1
    });
  }
}

function dibujarJefes() {
  jefes.forEach(jefe => {
    ctx.save();
    ctx.fillStyle = jefe.color;
    ctx.translate(jefe.x, jefe.y);
    const angle = Math.atan2(nave.y - jefe.y, nave.x - jefe.x);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-20, -15);
    ctx.lineTo(-20, 15);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Barra de vida encima
    ctx.fillStyle = 'red';
    ctx.fillRect(jefe.x - jefe.width / 2, jefe.y - jefe.height / 2 - 10, jefe.width, 6);
    ctx.fillStyle = 'lime';
    ctx.fillRect(jefe.x - jefe.width / 2, jefe.y - jefe.height / 2 - 10, jefe.width * (jefe.vidas / 20), 6);
  });
}

function dibujarDisparosJefe() {
  disparosJefe.forEach(d => {
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.width / 2, 0, Math.PI * 2);
    ctx.fill();
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

  // Movimiento nave
  if ((teclas['ArrowLeft'] || teclas['KeyA']) && nave.x - nave.width / 2 > 0) nave.x -= nave.velocidad;
  if ((teclas['ArrowRight'] || teclas['KeyD']) && nave.x + nave.width / 2 < canvas.width) nave.x += nave.velocidad;
  if ((teclas['ArrowUp'] || teclas['KeyW']) && nave.y - nave.height / 2 > 0) nave.y -= nave.velocidad;
  if ((teclas['ArrowDown'] || teclas['KeyS']) && nave.y + nave.height / 2 < canvas.height) nave.y += nave.velocidad;

  // Dificultad meteoritos
  const frecuenciaMeteoritos = Math.max(10, 40 - Math.floor(puntaje / 5));
  const velocidadMeteoritos = 2 + Math.min(puntaje * 0.1, 5);

  contadorMeteoritos++;
  if (contadorMeteoritos % frecuenciaMeteoritos === 0 && jefes.length === 0) {
    const borde = Math.floor(Math.random() * 4);
    let x, y;

    switch (borde) {
      case 0:
        x = Math.random() * canvas.width;
        y = -20;
        break;
      case 1:
        x = canvas.width + 20;
        y = Math.random() * canvas.height;
        break;
      case 2:
        x = Math.random() * canvas.width;
        y = canvas.height + 20;
        break;
      case 3:
        x = -20;
        y = Math.random() * canvas.height;
        break;
    }

    const dx = nave.x - x;
    const dy = nave.y - y;
    const distancia = Math.sqrt(dx * dx + dy * dy);
    const vx = (dx / distancia) * velocidadMeteoritos;
    const vy = (dy / distancia) * velocidadMeteoritos;

    meteoritos.push({ x, y, radio: 15, vx, vy });
  }

  // Aparecer jefes (2) al puntaje 50 si no hay ya
  if (puntaje >= 50 && jefes.length === 0) {
    jefes.push({
      x: canvas.width / 3,
      y: 80,
      width: nave.width,
      height: nave.height,
      color: 'black',
      velocidadX: 5,
      velocidadY: 5,
      vidas: 20,
      dirX: 1,
      dirY: 1,
      disparoCooldown: 30,
      disparoTimer: 0
    });
    jefes.push({
      x: (canvas.width * 2) / 3,
      y: 80,
      width: nave.width,
      height: nave.height,
      color: 'black',
      velocidadX: 5,
      velocidadY: 5,
      vidas: 20,
      dirX: -1,
      dirY: 1,
      disparoCooldown: 30,
      disparoTimer: 0
    });
  }

  // Actualizar meteoritos
  meteoritos.forEach((m, i) => {
    m.x += m.vx;
    m.y += m.vy;

    if (!nave.inmune) {
      const dx = m.x - nave.x;
      const dy = m.y - nave.y;
      const distancia = Math.sqrt(dx * dx + dy * dy);
      if (distancia < m.radio + Math.min(nave.width, nave.height) / 2) {
        meteoritos.splice(i, 1);
        perderVida();
      }
    }

    if (m.x < -30 || m.x > canvas.width + 30 || m.y < -30 || m.y > canvas.height + 30) {
      meteoritos.splice(i, 1);
      puntaje++;
    }
  });

  // Actualizar disparos jugador
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
        puntaje += 2;
      }
    });

    // Impacto en jefes
    jefes.forEach((jefe, ji) => {
      if (
        d.x > jefe.x - jefe.width / 2 &&
        d.x < jefe.x + jefe.width / 2 &&
        d.y > jefe.y - jefe.height / 2 &&
        d.y < jefe.y + jefe.height / 2
      ) {
        jefe.vidas--;
        crearExplosión(d.x, d.y);
        disparos.splice(i, 1);
        if (jefe.vidas <= 0) {
          crearExplosión(jefe.x, jefe.y);
          jefes.splice(ji, 1);
          puntaje += 50;
        }
      }
    });
  });

  // Actualizar jefes y disparos jefe
  jefes.forEach((jefe) => {
    jefe.x += jefe.velocidadX * jefe.dirX;
    jefe.y += jefe.velocidadY * jefe.dirY;

    if (jefe.x - jefe.width / 2 < 0 || jefe.x + jefe.width / 2 > canvas.width) {
      jefe.dirX *= -1;
    }
    if (jefe.y - jefe.height / 2 < 0 || jefe.y + jefe.height / 2 > canvas.height / 2) {
      jefe.dirY *= -1;
    }

    jefe.disparoTimer++;
    if (jefe.disparoTimer >= jefe.disparoCooldown) {
      jefe.disparoTimer = 0;
      const angle = Math.atan2(nave.y - jefe.y, nave.x - jefe.x);
      disparosJefe.push({
        x: jefe.x,
        y: jefe.y,
        width: 8,
        height: 8,
        velocidad: 7,
        dx: Math.cos(angle) * 7,
        dy: Math.sin(angle) * 7,
        color: 'blue'
      });
    }
  });

  // Actualizar disparos jefe
  disparosJefe = disparosJefe.filter(d => d.x > 0 && d.x < canvas.width && d.y > 0 && d.y < canvas.height);
  disparosJefe.forEach((d, i) => {
    d.x += d.dx;
    d.y += d.dy;

    if (!nave.inmune) {
      if (
        d.x > nave.x - nave.width / 2 &&
        d.x < nave.x + nave.width / 2 &&
        d.y > nave.y - nave.height / 2 &&
        d.y < nave.y + nave.height / 2
      ) {
        disparosJefe.splice(i, 1);
        perderVida();
      }
    }
  });
}

function loopJuego() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (estado === 'inicio') {
    dibujarTextoCentral('Presiona ENTER para empezar');
  } else if (estado === 'jugando') {
    actualizar();
    dibujarNave();
    dibujarMeteoritos();
    dibujarDisparos();
    dibujarParticulas();
    dibujarJefes();
    dibujarDisparosJefe();
    dibujarHUD();
  } else if (estado === 'final') {
    dibujarTextoCentral('¡GAME OVER!', 'Presiona R para reiniciar');
  }

  requestAnimationFrame(loopJuego);
}

loopJuego();
