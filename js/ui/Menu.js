// js/ui/Menu.js — Navegación de menús y preview de nave

import { initAudio } from '../Core/Audio.js';
import { nave } from '../entities/Player.js';

export function showScreen(id) {
    initAudio();
    document.querySelectorAll('.ui-screen').forEach(s => s.classList.remove('active'));
    if (id !== 'none' && document.getElementById(id)) document.getElementById(id).classList.add('active');
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
    const pCtx = pCanvas.getContext('2d');
    function renderPreview() {
        pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
        pCtx.save();
        pCtx.translate(pCanvas.width / 2, pCanvas.height / 2);
        pCtx.rotate(-Math.PI / 2);
        pCtx.shadowBlur = 15; pCtx.shadowColor = nave.color;
        pCtx.fillStyle = nave.color;
        pCtx.beginPath(); pCtx.moveTo(25, 0); pCtx.lineTo(-20, -20); pCtx.lineTo(-20, 20); pCtx.fill();
        pCtx.restore();
        requestAnimationFrame(renderPreview);
    }
    renderPreview();
}

export function changeNaveColor(newColor) { nave.color = newColor; }
