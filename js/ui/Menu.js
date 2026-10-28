// js/ui/Menu.js — Navegación de menús y preview de nave

import { initAudio } from '../Core/Audio.js';
import { nave } from '../entities/Player.js';

// El preview de la nave es una imagen fija (no se anima): se dibuja solo al
// abrir su pantalla, al cambiar de color y al redimensionar. Antes había un
// bucle de rAF que seguía corriendo durante toda la partida y leía
// pCanvas.offsetParent en cada frame (lectura de layout forzada 60 veces/s).
let previewCanvas = null;
let previewCtx = null;

export function showScreen(id) {
    initAudio();
    document.querySelectorAll('.ui-screen').forEach(s => s.classList.remove('active'));
    if (id !== 'none' && document.getElementById(id)) document.getElementById(id).classList.add('active');
    if (id === 'menu-customize') drawPreview();
    updateVolumeVisibility();
}

export function updateVolumeVisibility() {
    const volBtn = document.getElementById('btn-volume');
    if (!volBtn) return;
    // gameState se consulta desde Main via getter
    const gameState = window.__getGameState ? window.__getGameState() : 'MENU';
    volBtn.style.display = (gameState === 'MENU' || gameState === 'PAUSED') ? 'flex' : 'none';
}

export function initPreview() {
    const pCanvas = document.getElementById('previewCanvas');
    if (!pCanvas) return;
    previewCanvas = pCanvas;
    previewCtx = pCanvas.getContext('2d');
    drawPreview();
    window.addEventListener('resize', drawPreview);
}

function drawPreview() {
    if (!previewCtx) return;
    const pCtx = previewCtx;
    pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    pCtx.save();
    pCtx.translate(previewCanvas.width / 2, previewCanvas.height / 2);
    pCtx.rotate(-Math.PI / 2);
    pCtx.shadowBlur = 15; pCtx.shadowColor = nave.color;
    pCtx.fillStyle = nave.color;
    pCtx.beginPath(); pCtx.moveTo(25, 0); pCtx.lineTo(-20, -20); pCtx.lineTo(-20, 20); pCtx.fill();
    pCtx.restore();
}

export function changeNaveColor(newColor) { nave.color = newColor; drawPreview(); }

// La UI llama a window.changeNaveColor (Player.js); tras cambiar el color hay
// que repintar el preview, que ya no tiene un bucle propio.
export function refreshPreview() { drawPreview(); }
