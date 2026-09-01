// js/State.js — Separador entre versión móvil y PC (HUD + controles)
// No debe combinar controles ni HUD: toda la bifurcación pasa por aquí.

export const platform = {
    isMobile: /Mobi|Android/i.test(navigator.userAgent),
    isForcedMobile: false,
    isTouchUIHidden: false,
    usingGamepad: false,
    // touch joystick state (compartido con input)
    touchMoveX: 0,
    touchMoveY: 0,
    rightJoyActive: false
};

export function isTouchActive() {
    return platform.isMobile && !platform.isTouchUIHidden;
}

export function toggleTouchUI() {
    platform.isTouchUIHidden = !platform.isTouchUIHidden;
    const mobileUi = document.getElementById('mobile-ui');
    if (!mobileUi) return;
    if (platform.isTouchUIHidden) {
        mobileUi.style.display = 'none';
    } else if (platform.isMobile) {
        mobileUi.style.display = 'block';
    }
}

export function setTouchMove(x, y) {
    platform.touchMoveX = x;
    platform.touchMoveY = y;
}

export function setRightJoyActive(v) {
    platform.rightJoyActive = v;
}

export function setUsingGamepad(v) {
    platform.usingGamepad = v;
}

export function toggleDeviceMode(config, canvas) {
    platform.isForcedMobile = !platform.isForcedMobile;
    const btn = document.getElementById('btn-device-toggle');

    if (platform.isForcedMobile) {
        if (btn) { btn.innerText = "CAMBIAR A MODO PC"; btn.style.borderColor = "var(--primary)"; btn.style.color = "var(--primary)"; }
        platform.isMobile = true;
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().then(() => {
                if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
            }).catch(() => {});
        }
        config.w = window.innerWidth;
        config.h = window.innerHeight;
    } else {
        if (btn) { btn.innerText = "CAMBIAR A MODO MÓVIL"; btn.style.borderColor = "var(--success)"; btn.style.color = "var(--success)"; }
        const touchOpt = document.getElementById('opt-touch')?.value;
        if (touchOpt === 'force') platform.isMobile = true;
        else if (touchOpt === 'hide') platform.isMobile = false;
        else platform.isMobile = /Mobi|Android/i.test(navigator.userAgent);

        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
        if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();

        const sizeVal = document.getElementById('opt-size')?.value || '800x600';
        if (sizeVal !== 'auto') {
            const [w, h] = sizeVal.split('x').map(Number);
            config.w = w; config.h = h;
        }
    }

    if (canvas) {
        canvas.width = config.w; canvas.height = config.h;
        const container = document.getElementById('game-container');
        if (container) { container.style.width = config.w + 'px'; container.style.height = config.h + 'px'; }
    }
}

// Suscribe a resize para modo auto / forzado móvil
export function bindResize(config, canvas, nave, getGameState) {
    window.addEventListener('resize', () => {
        const sizeOpt = document.getElementById('opt-size')?.value;
        if (platform.isForcedMobile || sizeOpt === 'auto') {
            setTimeout(() => {
                config.w = window.innerWidth; config.h = window.innerHeight;
                canvas.width = config.w; canvas.height = config.h;
                const container = document.getElementById('game-container');
                if (container) { container.style.width = config.w + 'px'; container.style.height = config.h + 'px'; }
                if (getGameState() === 'MENU') { nave.x = canvas.width / 2; nave.y = canvas.height - 100; }
            }, 150);
        }
    });
}
