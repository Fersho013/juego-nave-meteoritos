// js/ui/LayoutEditor.js — Editor visual de HUD y controles táctiles
// Permite mover y escalar elementos en pausa sin conflictos con los controles del juego.
// La ventana emergente se arrastra SOLO por su header (handle dedicado) para evitar colisión con joysticks.
import { platform } from '../State.js';

const STORAGE_KEY = 'jogo_layout_v1';
const PANEL_STORAGE_KEY = 'jogo_panel_pos_v1';

// 3 bloques HUD independientes (vida/parry/dash | score/bombas/arma | sector/kills)
export const HUD_IDS = [
    'hud-block-score',   // Score / bombas / arma
    'hud-block-sector',  // contador kills + título sector
    'hud-block-vida',    // Vida / parry / dash
    'boss-container'
];
export const TOUCH_IDS = [
    'joy-base-l',
    'joy-base-r',
    'btn-triple',
    'btn-parry',
    'btn-bomb',
    'btn-dash',
    'btn-pause-m'
];
// Compat: mantener EDITABLE_IDS para imports externos
export const EDITABLE_IDS = [...HUD_IDS, ...TOUCH_IDS];

export function getEditableIds() {
    // PC: solo HUD (3 bloques). Móvil: HUD + controles táctiles
    return platform.isMobile ? [...HUD_IDS, ...TOUCH_IDS] : [...HUD_IDS];
}

// Defaults capturados al inicio (en px convertidos a %)
let defaults = {};
let layout = {};
let panelPos = { x: 12, y: 12 };
let isEditing = false;
let selectedId = null;
let dragState = null;
let hasAppliedInitial = false;

function getContainer() { return document.getElementById('game-container'); }
function getEl(id) { return document.getElementById(id); }
function pct(val, total) { return (val / total) * 100; }

function captureDefaults() {
    const container = getContainer();
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    EDITABLE_IDS.forEach(id => {
        const el = getEl(id);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        defaults[id] = {
            leftPct: pct(rect.left - cRect.left, cRect.width),
            topPct: pct(rect.top - cRect.top, cRect.height),
            scale: 1,
            widthPx: rect.width,
            heightPx: rect.height
        };
    });
    // Guardar transform base especial para hud-block-sector (translateX)
    const sector = getEl('hud-block-sector');
    if (sector) sector.dataset.baseTransform = 'translateX(-50%)';
}

function loadLayout() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) layout = JSON.parse(raw);
        else layout = {};
        // Migración: eliminar viejo 'hud' si existe
        if (layout['hud']) delete layout['hud'];
        const pRaw = localStorage.getItem(PANEL_STORAGE_KEY);
        if (pRaw) panelPos = JSON.parse(pRaw);
    } catch { layout = {}; }
}

function saveLayout() { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); }
function savePanelPos() { localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(panelPos)); }

export function getLayout() { return layout; }
export function isEditorActive() { return isEditing; }
export function getSelectedId() { return selectedId; }

function applyElement(id) {
    const el = getEl(id);
    if (!el) return;
    const data = layout[id];
    if (!data) {
        el.style.left = '';
        el.style.top = '';
        el.style.right = '';
        el.style.bottom = '';
        // Restaurar transform base
        if (id === 'hud-block-sector') el.style.transform = 'translateX(-50%)';
        else el.style.transform = el.dataset.baseTransform || '';
        if (id.startsWith('joy-base')) {
            const baseW = defaults[id]?.widthPx || 120;
            el.style.width = baseW + 'px';
            el.style.height = baseW + 'px';
        } else if (id.startsWith('btn-') && el.classList.contains('t-btn')) {
            el.style.width = ''; el.style.height = ''; el.style.fontSize = '';
        }
        return;
    }
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.left = data.leftPct + '%';
    el.style.top = data.topPct + '%';
    const baseTransform = el.dataset.baseTransform || (id === 'hud-block-sector' ? 'translateX(-50%)' : '');
    // Para bloques HUD, el left/top % mueve el bloque; escala se aplica con transform
    if (data.scale && data.scale !== 1) {
        if (id.startsWith('joy-base')) {
            const baseW = defaults[id]?.widthPx || 120;
            el.style.width = (baseW * data.scale) + 'px';
            el.style.height = (baseW * data.scale) + 'px';
        } else if (id.startsWith('btn-')) {
            const baseS = 55;
            el.style.width = (baseS * data.scale) + 'px';
            el.style.height = (baseS * data.scale) + 'px';
            el.style.fontSize = (1.6 * data.scale) + 'rem';
        } else {
            // hud-blocks y boss-container
            const base = baseTransform ? baseTransform + ' ' : '';
            el.style.transform = base + `scale(${data.scale})`;
            el.style.transformOrigin = 'top left';
            if (id === 'hud-block-sector' && baseTransform.includes('translateX')) {
                el.style.transform = `translateX(-50%) scale(${data.scale})`;
                el.style.transformOrigin = 'top center';
            }
        }
    } else {
        if (id.startsWith('joy-base')) {
            const baseW = defaults[id]?.widthPx || 120;
            el.style.width = baseW + 'px';
            el.style.height = baseW + 'px';
        } else if (id.startsWith('btn-') && el.classList.contains('t-btn')) {
            el.style.width = ''; el.style.height = ''; el.style.fontSize = '';
        } else {
            el.style.transform = baseTransform || (id === 'hud-block-sector' ? 'translateX(-50%)' : '');
            if (id === 'hud-block-sector' && !el.style.transform) el.style.transform = 'translateX(-50%)';
        }
    }
}

export function applyLayout() {
    // Aplicar según modo: en PC, limpiar posiciones de controles táctiles para que queden ocultos
    EDITABLE_IDS.forEach(id => {
        if (!platform.isMobile && TOUCH_IDS.includes(id)) {
            // En PC, forzar reset de controles táctiles (no deben existir)
            const el = getEl(id);
            if (el) { el.style.left=''; el.style.top=''; el.style.transform=''; }
            return;
        }
        applyElement(id);
    });
    applyPanelPos();
}

function applyPanelPos() {
    const panel = document.getElementById('layout-editor-panel');
    if (!panel) return;
    panel.style.left = panelPos.x + '%';
    panel.style.top = panelPos.y + '%';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
}

function ensureLayoutEntry(id) {
    if (!layout[id]) {
        const d = defaults[id];
        layout[id] = { leftPct: d ? d.leftPct : 5, topPct: d ? d.topPct : 5, scale: 1 };
    }
}

function onEditablePointerDown(e) {
    if (!isEditing) return;
    // Si en PC y es control táctil, ignorar
    const id = e.currentTarget.dataset.editId;
    if (!id) return;
    if (!platform.isMobile && TOUCH_IDS.includes(id)) return;
    if (!getEditableIds().includes(id)) return;
    e.preventDefault(); e.stopPropagation();
    selectedId = id;
    highlightSelection();
    syncPanelControls();
    const container = getContainer();
    const cRect = container.getBoundingClientRect();
    ensureLayoutEntry(id);
    const data = layout[id];
    dragState = { id, startX: e.clientX, startY: e.clientY, origLeftPct: data.leftPct, origTopPct: data.topPct, cWidth: cRect.width, cHeight: cRect.height };
    e.currentTarget.setPointerCapture(e.pointerId);
}

function onPointerMove(e) {
    if (!dragState) return;
    e.preventDefault();
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    layout[dragState.id].leftPct = Math.max(0, Math.min(92, dragState.origLeftPct + (dx / dragState.cWidth)*100));
    layout[dragState.id].topPct = Math.max(0, Math.min(92, dragState.origTopPct + (dy / dragState.cHeight)*100));
    applyElement(dragState.id);
}

function onPointerUp(e) {
    if (!dragState) return;
    e.preventDefault();
    saveLayout();
    syncPanelControls();
    dragState = null;
}

let panelDrag = null;
function onPanelHeaderPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const cRect = getContainer().getBoundingClientRect();
    panelDrag = { startX: e.clientX, startY: e.clientY, origX: panelPos.x, origY: panelPos.y, cW: cRect.width, cH: cRect.height };
    e.currentTarget.setPointerCapture(e.pointerId);
}
function onPanelPointerMove(e) {
    if (!panelDrag) return;
    e.preventDefault();
    panelPos.x = Math.max(0, Math.min(78, panelDrag.origX + (e.clientX - panelDrag.startX)/panelDrag.cW*100));
    panelPos.y = Math.max(0, Math.min(82, panelDrag.origY + (e.clientY - panelDrag.startY)/panelDrag.cH*100));
    applyPanelPos();
}
function onPanelPointerUp(){ if (!panelDrag) return; savePanelPos(); panelDrag=null; }

function highlightSelection() {
    EDITABLE_IDS.forEach(id => {
        const el = getEl(id);
        if (!el) return;
        const isActive = id === selectedId && getEditableIds().includes(id);
        el.classList.toggle('editable-selected', isActive);
    });
}

function syncPanelControls() {
    const sel = document.getElementById('editor-select');
    const scale = document.getElementById('editor-scale');
    const scaleVal = document.getElementById('editor-scale-val');
    const posLabel = document.getElementById('editor-pos-label');
    if (sel) {
        // Reconstruir opciones según modo actual
        const ids = getEditableIds();
        sel.innerHTML = ids.map(id => `<option value="${id}">${id}</option>`).join('');
        if (selectedId && ids.includes(selectedId)) sel.value = selectedId;
        else if (ids.length) { selectedId = ids[0]; sel.value = selectedId; highlightSelection(); }
    }
    if (selectedId && layout[selectedId]) {
        const d = layout[selectedId];
        if (scale) scale.value = d.scale;
        if (scaleVal) scaleVal.innerText = d.scale.toFixed(2) + 'x';
        if (posLabel) posLabel.innerText = `X:${d.leftPct.toFixed(1)}% Y:${d.topPct.toFixed(1)}%`;
    } else {
        if (scaleVal) scaleVal.innerText = '—';
        if (posLabel) posLabel.innerText = 'Selecciona un elemento';
    }
}

function buildPanelIfNeeded() {
    if (document.getElementById('layout-editor-panel')) return;
    const container = getContainer();
    const panel = document.createElement('div');
    panel.id = 'layout-editor-panel';
    panel.style.display = 'none';
    const ids = getEditableIds();
    panel.innerHTML = `
        <div id="layout-editor-header">
            <span style="font-weight:bold; letter-spacing:0.5px;">🎛️ EDITOR LAYOUT</span>
            <span style="font-size:0.7rem; opacity:0.7;">arrastra desde aquí</span>
            <button id="editor-minimize" title="Minimizar">—</button>
            <button id="editor-close" title="Cerrar">✕</button>
        </div>
        <div id="layout-editor-body">
            <p id="editor-mode-hint" style="font-size:0.7rem; margin:4px 0 8px; padding:6px; border-radius:6px;"></p>
            <label style="font-size:0.75rem; color:#aaa;">Elemento</label>
            <select id="editor-select" style="width:100%; margin:4px 0 8px;">${ids.map(id=>`<option value="${id}">${id}</option>`).join('')}</select>
            <div id="editor-pos-label" style="font-family:JetBrains Mono; font-size:0.7rem; color:var(--primary); margin-bottom:6px;">—</div>
            <label style="font-size:0.75rem; color:#aaa;">Tamaño <span id="editor-scale-val">1.00x</span></label>
            <input id="editor-scale" type="range" min="0.6" max="1.8" step="0.05" value="1" style="width:100%; accent-color:var(--primary);">
            <div style="display:flex; gap:6px; margin-top:10px;">
                <button id="editor-reset-one" class="btn-editor small">Reset elemento</button>
                <button id="editor-reset-all" class="btn-editor small btn-danger">Reset todo</button>
            </div>
            <div style="display:flex; gap:6px; margin-top:6px;">
                <button id="editor-save" class="btn-editor">💾 Guardar</button>
                <button id="editor-exit" class="btn-editor btn-success">✓ Listo</button>
            </div>
            <div style="font-size:0.65rem; color:#666; margin-top:8px; text-align:center;">Tip: arrastra la barra superior para ver toda la pantalla</div>
        </div>
    `;
    container.appendChild(panel);
    const header = panel.querySelector('#layout-editor-header');
    header.addEventListener('pointerdown', onPanelHeaderPointerDown);
    header.addEventListener('pointermove', onPanelPointerMove);
    header.addEventListener('pointerup', onPanelPointerUp);
    header.addEventListener('pointercancel', onPanelPointerUp);
    header.style.touchAction = 'none';
    panel.querySelector('#editor-close').addEventListener('click', () => exitEditMode());
    panel.querySelector('#editor-minimize').addEventListener('click', () => {
        const body = panel.querySelector('#layout-editor-body');
        body.style.display = body.style.display === 'none' ? 'block' : 'none';
    });
    panel.querySelector('#editor-select').addEventListener('change', (e) => { selectedId = e.target.value; highlightSelection(); syncPanelControls(); });
    panel.querySelector('#editor-scale').addEventListener('input', (e) => {
        if (!selectedId) return;
        ensureLayoutEntry(selectedId);
        layout[selectedId].scale = parseFloat(e.target.value);
        document.getElementById('editor-scale-val').innerText = layout[selectedId].scale.toFixed(2) + 'x';
        applyElement(selectedId);
    });
    panel.querySelector('#editor-scale').addEventListener('change', saveLayout);
    panel.querySelector('#editor-reset-one').addEventListener('click', () => {
        if (!selectedId) return;
        delete layout[selectedId]; saveLayout(); applyElement(selectedId); syncPanelControls();
    });
    panel.querySelector('#editor-reset-all').addEventListener('click', () => {
        if (!confirm('¿Resetear todas las posiciones y tamaños?')) return;
        layout = {}; saveLayout(); EDITABLE_IDS.forEach(applyElement); syncPanelControls();
    });
    panel.querySelector('#editor-save').addEventListener('click', () => {
        saveLayout(); savePanelPos();
        const btn = panel.querySelector('#editor-save');
        const orig = btn.innerText; btn.innerText = '✓ Guardado'; setTimeout(()=> btn.innerText = orig, 1200);
    });
    panel.querySelector('#editor-exit').addEventListener('click', () => exitEditMode(true));
    window.addEventListener('pointermove', onPanelPointerMove);
    window.addEventListener('pointerup', onPanelPointerUp);
    window.addEventListener('pointercancel', onPanelPointerUp);
}

function attachEditableListeners() {
    EDITABLE_IDS.forEach(id => {
        const el = getEl(id);
        if (!el) return;
        if (el.dataset.editorBound === '1') return;
        el.dataset.editorBound = '1';
        el.dataset.baseTransform = el.style.transform || (id==='hud-block-sector' ? 'translateX(-50%)' : '');
        el.dataset.editId = id;
        el.addEventListener('pointerdown', onEditablePointerDown);
        el.addEventListener('pointermove', onPointerMove);
        el.addEventListener('pointerup', onPointerUp);
        el.addEventListener('pointercancel', onPointerUp);
        el.style.touchAction = 'none';
    });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
}

export function initLayoutEditor() {
    loadLayout();
    if (!getContainer()) { window.addEventListener('DOMContentLoaded', initLayoutEditor); return; }
    captureDefaults();
    buildPanelIfNeeded();
    attachEditableListeners();
    applyLayout();
    hasAppliedInitial = true;
    window.addEventListener('resize', () => { if (hasAppliedInitial) applyLayout(); });
}

export function enterEditMode() {
    if (!hasAppliedInitial) captureDefaults();
    buildPanelIfNeeded();
    isEditing = true;
    const ids = getEditableIds();
    selectedId = ids[0] || null;
    document.body.classList.add('editing-layout');
    getContainer()?.classList.add('editing-layout');
    // Añadir clase editable solo a los permitidos por modo
    EDITABLE_IDS.forEach(id => {
        const el = getEl(id);
        if (!el) return;
        const allowed = ids.includes(id);
        el.classList.toggle('editable', allowed);
        if (!allowed) el.classList.remove('editable-selected');
    });
    // En PC, ocultar controles táctiles por completo durante edición
    const mu = getEl('mobile-ui');
    if (mu) {
        if (!platform.isMobile) { mu.style.display = 'none'; }
        else { mu.style.display = 'block'; mu.style.opacity = '0.95'; }
    }
    // Mostrar los 3 bloques HUD para editar
    HUD_IDS.forEach(id => {
        const el = getEl(id);
        if (el && (id.startsWith('hud-block'))) { el.style.display = 'block'; el.style.opacity = '0.95'; }
    });
    // Boss container visible si tiene contenido o para editar
    const boss = getEl('boss-container');
    if (boss && !boss.style.display) boss.style.opacity = '0.5';
    // Actualizar hint según modo
    const hint = document.getElementById('editor-mode-hint');
    if (hint) {
        if (platform.isMobile) {
            hint.style.background = 'rgba(0,255,204,0.12)'; hint.style.border = '1px solid rgba(0,255,204,0.3)'; hint.style.color = '#00ffcc';
            hint.innerText = '📱 Modo Móvil: puedes mover HUD (3 bloques) + controles táctiles.';
        } else {
            hint.style.background = 'rgba(30,144,255,0.12)'; hint.style.border = '1px solid rgba(30,144,255,0.3)'; hint.style.color = '#1e90ff';
            hint.innerText = '🖥️ Modo PC: solo HUD (Score / Sector / Vida). Controles táctiles ocultos.';
        }
    }
    highlightSelection();
    syncPanelControls();
    const panel = document.getElementById('layout-editor-panel');
    if (panel) panel.style.display = 'block';
    applyPanelPos();
}

export function exitEditMode(save = true) {
    if (save) saveLayout();
    isEditing = false;
    document.body.classList.remove('editing-layout');
    getContainer()?.classList.remove('editing-layout');
    EDITABLE_IDS.forEach(id => getEl(id)?.classList.remove('editable','editable-selected'));
    const panel = document.getElementById('layout-editor-panel');
    if (panel) panel.style.display = 'none';
    // Restaurar opacidades
    HUD_IDS.forEach(id => {
        const el = getEl(id);
        if (el && id.startsWith('hud-block')) el.style.opacity = '';
    });
    dragState = null;
}

export function resetLayout() { layout = {}; saveLayout(); applyLayout(); }
