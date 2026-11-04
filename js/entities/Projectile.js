// js/entities/Projectile.js — Balas, pickups y estado de armas

export const bullets = [];
export const enemyBullets = [];
export const pickUps = [];
export const weaponPowerUps = [];

export const weaponState = { current: 'normal', timer: 0, duration: 0, label: '', color: '' };
export const planetWeaponState = { orbiting: [], burnTick: 0, poisonTick: 0 };
export const homingState = { active: false, timer: 0 };
export const droneState = { drones: [], timer: 0 };

export function clearProjectiles() {
    bullets.length = 0; enemyBullets.length = 0; pickUps.length = 0; weaponPowerUps.length = 0;
    planetWeaponState.orbiting.length = 0;
    planetWeaponState.burnTick = 0;
    planetWeaponState.poisonTick = 0;
}
