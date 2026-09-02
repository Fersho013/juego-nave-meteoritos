// js/ui/LayoutEditor.js — Editor visual de HUD y controles táctiles
// Permite mover y escalar elementos en pausa sin conflictos con los controles del juego.
// La ventana emergente se arrastra SOLO por su header (handle dedicado) para evitar colisión con joysticks.

const STORAGE_KEY = 'jogo_layout_v1';
const PANEL_STORAGE_KEY = 'jogo_panel_pos_v1';

// IDs editables: cada uno corresponde a un elemento del DOM
export const EDITABLE_IDS = [
    'hud',
    'boss-container',
    'joy-base-l',
    'joy-base-r',
    'btn-triple',
    'btn-parry',
    'btn-bomb',
    'btn-dash',
    'btn-pause-m'
];

// Defaults capturados al inicio (en px convertidos a %)
let defaults = {};
let layout = {};
let panelPos = { x: 12, y: 12 }; // % dentro de game-container
let isEditing = false;
let selectedId = null;
let dragState = null; // {id, startX, startY, origLeftPct, origTopPct}
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
        // si está oculto, usar computed style fallback
        const scale = 1;
        defaults[id] = {
            leftPct: pct(rect.left - cRect.left, cRect.width),
            topPct: pct(rect.top - cRect.top, cRect.height),
            scale,
            widthPx: rect.width,
            heightPx: rect.height
        };
    });
}

function loadLayout() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) layout = JSON.parse(raw);
        else layout = {};
        const pRaw = localStorage.getItem(PANEL_STORAGE_KEY);
        if (pRaw) panelPos = JSON.parse(pRaw);
    } catch { layout = {}; }
}

function saveLayout() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}
function savePanelPos() {
    localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(panelPos));
}

export function getLayout() { return layout; }
export function isEditorActive() { return isEditing; }
export function getSelectedId() { return selectedId; }

function applyElement(id) {
    const el = getEl(id);
    if (!el) return;
    const data = layout[id];
    const container = getContainer();
    if (!container) return;
    // Si no hay dato, limpiar inline de posición (volver a CSS original)
    if (!data) {
        el.style.left = '';
        el.style.top = '';
        el.style.right = '';
        el.style.bottom = '';
        el.style.transform = '';
        return;
    }
    // Aplicar: usamos left/top en % y escalado vía transform
    // Para no romper joysticks, preservamos translate(-50%,-50%) si existe
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.left = data.leftPct + '%';
    el.style.top = data.topPct + '%';
    // Manejo de escala: envolver junto a posible translate del stick
    const baseTransform = el.dataset.baseTransform || '';
    if (data.scale && data.scale !== 1) {
        // Si el elemento es joy-base, su escala afecta tamaño, no transform
        if (id.startsWith('joy-base')) {
            const baseW = defaults[id]?.widthPx || 120;
            el.style.width = (baseW * data.scale) + 'px';
            el.style.height = (baseW * data.scale) + 'px';
        } else if (id.startsWith('btn-')) {
            const baseS = 55;
            // t-btn escalado
            el.style.width = (baseS * data.scale) + 'px';
            el.style.height = (baseS * data.scale) + 'px';
            el.style.fontSize = (1.6 * data.scale) + 'rem';
        } else {
            el.style.transform = (baseTransform ? baseTransform + ' ' : '') + `scale(${data.scale})`;
            el.style.transformOrigin = 'top left';
        }
    } else {
        if (id.startsWith('joy-base')) {
            const baseW = defaults[id]?.widthPx || 120;
            el.style.width = baseW + 'px';
            el.style.height = baseW + 'px';
        } else if (id.startsWith('btn-') && el.classList.contains('t-btn')) {
            el.style.width = ''; el.style.height = ''; el.style.fontSize = '';
        } else {
            el.style.transform = baseTransform;
        }
    }
}

export function applyLayout() {
    EDITABLE_IDS.forEach(applyElement);
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

// --- Drag de elementos editables (solo en modo edición, pointer events aislados) ---
function onEditablePointerDown(e) {
    if (!isEditing) return;
    const id = e.currentTarget.dataset.editId;
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    // Evitar que joystick original dispare
    selectedId = id;
    highlightSelection();
    syncPanelControls();

    const container = getContainer();
    const cRect = container.getBoundingClientRect();
    ensureLayoutEntry(id);
    const data = layout[id];
    dragState = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        origLeftPct: data.leftPct,
        origTopPct: data.topPct,
        cWidth: cRect.width,
        cHeight: cRect.height
    };
    e.currentTarget.setPointerCapture(e.pointerId);
}

function onPointerMove(e) {
    if (!dragState) return;
    e.preventDefault();
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    const dxPct = (dx / dragState.cWidth) * 100;
    const dyPct = (dy / dragState.cHeight) * 100;
    const id = dragState.id;
    layout[id].leftPct = Math.max(0, Math.min(92, dragState.origLeftPct + dxPct));
    layout[id].topPct = Math.max(0, Math.min(92, dragState.origTopPct + dyPct));
    applyElement(id);
}

function onPointerUp(e) {
    if (!dragState) return;
    e.preventDefault();
    saveLayout();
    syncPanelControls();
    dragState = null;
}

// --- Drag del PANEL (solo por header, canal independiente) ---
let panelDrag = null;
function onPanelHeaderPointerDown(e) {
    // Solo botón izquierdo / touch
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const panel = document.getElementById('layout-editor-panel');
    const container = getContainer();
    const cRect = container.getBoundingClientRect();
    panelDrag = {
        startX: e.clientX,
        startY: e.clientY,
        origX: panelPos.x,
        origY: panelPos.y,
        cW: cRect.width,
        cH: cRect.height
    };
    e.currentTarget.setPointerCapture(e.pointerId);
}
function onPanelPointerMove(e) {
    if (!panelDrag) return;
    e.preventDefault();
    const dx = e.clientX - panelDrag.startX;
    const dy = e.clientY - panelDrag.startY;
    panelPos.x = Math.max(0, Math.min(78, panelDrag.origX + (dx / panelDrag.cW) * 100));
    panelPos.y = Math.max(0, Math.min(82, panelDrag.origY + (dy / panelDrag.cH) * 100));
    applyPanelPos();
}
function onPanelPointerUp(e) {
    if (!panelDrag) return;
    savePanelPos();
    panelDrag = null;
}

function highlightSelection() {
    EDITABLE_IDS.forEach(id => {
        const el = getEl(id);
        if (!el) return;
        el.classList.toggle('editable-selected', id === selectedId);
    });
    // also highlight scale target
}

function syncPanelControls() {
    const sel = document.getElementById('editor-select');
    const scale = document.getElementById('editor-scale');
    const scaleVal = document.getElementById('editor-scale-val');
    const posLabel = document.getElementById('editor-pos-label');
    if (sel && selectedId) sel.value = selectedId;
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
    panel.innerHTML = `
        <div id="layout-editor-header">
            <span style="font-weight:bold; letter-spacing:0.5px;">🎛️ EDITOR LAYOUT</span>
            <span style="font-size:0.7rem; opacity:0.7;">arrastra desde aquí</span>
            <button id="editor-minimize" title="Minimizar">—</button>
            <button id="editor-close" title="Cerrar">✕</button>
        </div>
        <div id="layout-editor-body">
            <p style="font-size:0.72rem; color:#aaa; margin:4px 0 8px;">Toca/arrastra cualquier control o HUD para moverlo. Usa el deslizador para tamaño. La ventana se mueve solo desde la barra superior.</p>
            <label style="font-size:0.75rem; color:#aaa;">Elemento</label>
            <select id="editor-select" style="width:100%; margin:4px 0 8px;">
                ${EDITABLE_IDS.map(id => `<option value="${id}">${id}</option>`).join('')}
            </select>
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

    // Header drag (canal independiente, no colisiona con joysticks)
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
    panel.querySelector('#editor-select').addEventListener('change', (e) => {
        selectedId = e.target.value;
        highlightSelection();
        syncPanelControls();
    });
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
        delete layout[selectedId];
        saveLayout();
        applyElement(selectedId);
        // re-capture highlight needs re-apply
        syncPanelControls();
    });
    panel.querySelector('#editor-reset-all').addEventListener('click', () => {
        if (!confirm('¿Resetear todas las posiciones y tamaños?')) return;
        layout = {};
        saveLayout();
        EDITABLE_IDS.forEach(applyElement);
        syncPanelControls();
    });
    panel.querySelector('#editor-save').addEventListener('click', () => {
        saveLayout(); savePanelPos();
        const btn = panel.querySelector('#editor-save');
        const orig = btn.innerText; btn.innerText = '✓ Guardado'; setTimeout(()=> btn.innerText = orig, 1200);
    });
    panel.querySelector('#editor-exit').addEventListener('click', () => exitEditMode(true));

    // Global move/up for panel (captura fuera del header)
    window.addEventListener('pointermove', onPanelPointerMove);
    window.addEventListener('pointerup', onPanelPointerUp);
    window.addEventListener('pointercancel', onPanelPointerUp);
}

function attachEditableListeners() {
    EDITABLE_IDS.forEach(id => {
        const el = getEl(id);
        if (!el) return;
        // Evitar duplicar listeners
        if (el.dataset.editorBound === '1') return;
        el.dataset.editorBound = '1';
        // Guardar transform base para no pisarlo
        el.dataset.baseTransform = el.style.transform || '';
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
    // Esperar a que DOM esté listo
    if (!getContainer()) { window.addEventListener('DOMContentLoaded', initLayoutEditor); return; }
    captureDefaults();
    buildPanelIfNeeded();
    attachEditableListeners();
    applyLayout();
    hasAppliedInitial = true;

    // Reaplicar en resize (mantiene %)
    window.addEventListener('resize', () => {
        // No recalcular defaults, solo reaplicar
        if (hasAppliedInitial) applyLayout();
    });
}

export function enterEditMode() {
    if (!hasAppliedInitial) captureDefaults();
    buildPanelIfNeeded();
    isEditing = true;
    selectedId = EDITABLE_IDS[0];
    document.body.classList.add('editing-layout');
    getContainer()?.classList.add('editing-layout');
    EDITABLE_IDS.forEach(id => getEl(id)?.classList.add('editable'));
    highlightSelection();
    syncPanelControls();
    const panel = document.getElementById('layout-editor-panel');
    if (panel) panel.style.display = 'block';
    // Pausar inputs del juego mientras se edita
    // Mostrar también HUD y mobile-ui para editar aunque estén ocultos
    const hud = getEl('hud');
    const mu = getEl('mobile-ui');
    if (hud) { hud.dataset.prevDisplay = hud.style.display; hud.style.display = 'flex'; hud.style.opacity = '0.95'; }
    if (mu) { mu.dataset.prevDisplay = mu.style.display; mu.style.display = 'block'; mu.style.opacity = '0.95'; }
    applyPanelPos();
}

export function exitEditMode(save = true) {
    if (save) saveLayout();
    isEditing = false;
    document.body.classList.remove('editing-layout');
    getContainer()?.classList.remove('editing-layout');
    EDITABLE_IDS.forEach(id => {
        const el = getEl(id);
        if (!el) return;
        el.classList.remove('editable', 'editable-selected');
    });
    const panel = document.getElementById('layout-editor-panel');
    if (panel) panel.style.display = 'none';
    // Restaurar visibilidad previa si no estaba en juego
    // No forzamos hide: dejamos que Main decida al reanudar
    dragState = null;
}

// Exponer para debugging
export function resetLayout() {
    layout = {}; saveLayout(); applyLayout();
}
