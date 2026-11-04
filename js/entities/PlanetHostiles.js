// Enemigos y jefes exclusivos de cada planeta.
// Cada mundo tiene sus propios hostiles (no reutiliza los tipos clásicos):
// tres móviles temáticos, un mini jefe, un jefe de descenso y una estructura
// final que se dibuja con una silueta distinta según el motivo del planeta.

function mob(id, name, role, shot, hp, speed, color, extra = '') {
    return { id, name, role, shot, hp, speed, color, variant: extra };
}

export const PLANET_HOSTILES = {
    terra: {
        motif: 'vine', color: '#59ce70', accent: '#c9ffcf',
        mobs: [
            mob('terra_brote', 'BROTE ERRANTE', 'drifter', 'seed', 34, 1.8, '#6fe07f', 'leaf'),
            mob('terra_espina', 'ESPINA VIVA', 'charger', 'none', 26, 2.3, '#3eb85a', 'thorn'),
            mob('terra_polen', 'POLEN DEVORADOR', 'orbiter', 'spore', 54, 1.6, '#a4f0a0', 'bloom')
        ],
        mini: { name: 'GUARDIÁN DE RAÍCES', title: 'MINI JEFE', hp: 2400, color: '#59ce70', accent: '#b9ffc0', motif: 'vine', role: 'mini' },
        boss: { name: 'COLOSO SILVESTRE', title: 'JEFE', hp: 5600, color: '#3eb85a', accent: '#e2ffe4', motif: 'vine', role: 'boss' },
        final: { name: 'NÚCLEO DE LA SELVA', title: 'JEFE FINAL', hp: 15000, color: '#59ce70', accent: '#c9ffcf', motif: 'vine' }
    },
    ignis: {
        motif: 'fire', color: '#ff6328', accent: '#ffd08a',
        mobs: [
            mob('ignis_chispa', 'CHISPA ERRANTE', 'drifter', 'ember', 32, 1.9, '#ff8a3d', 'spark'),
            mob('ignis_gusano', 'GUSANO DE MAGMA', 'charger', 'none', 30, 2.5, '#ff4b1f', 'worm'),
            mob('ignis_torreta', 'TORRETA ÍGNEA', 'sniper', 'magma', 58, 1.5, '#ffb03a', 'turret')
        ],
        mini: { name: 'SENTINELA DE MAGMA', title: 'MINI JEFE', hp: 2500, color: '#ff6328', accent: '#ffd08a', motif: 'fire', role: 'mini' },
        boss: { name: 'TITÁN ÍGNEO', title: 'JEFE', hp: 5900, color: '#ff4420', accent: '#ffe0a8', motif: 'fire', role: 'boss' },
        final: { name: 'CORAZÓN DE FUEGO', title: 'JEFE FINAL', hp: 15500, color: '#ff6328', accent: '#ffd08a', motif: 'fire' }
    },
    glacia: {
        motif: 'ice', color: '#a4f7ff', accent: '#ffffff',
        mobs: [
            mob('glacia_esquirla', 'ESQUIRLA GLACIAL', 'sniper', 'iceblock', 40, 1.7, '#bffaff', 'shard'),
            mob('glacia_espectro', 'ESPECTRO DE ESCARCHA', 'drifter', 'frost', 34, 2.0, '#7fdcff', 'wisp'),
            mob('glacia_golem', 'GÓLEM DE HIELO', 'shielder', 'iceshard', 88, 1.2, '#d8ffff', 'golem')
        ],
        mini: { name: 'CENTINELA DE ESCARCHA', title: 'MINI JEFE', hp: 2600, color: '#a4f7ff', accent: '#ffffff', motif: 'ice', role: 'mini' },
        boss: { name: 'COLOSO GLACIAL', title: 'JEFE', hp: 6100, color: '#6fd8ff', accent: '#f0ffff', motif: 'ice', role: 'boss' },
        final: { name: 'CATEDRAL DE HIELO', title: 'JEFE FINAL', hp: 16000, color: '#a4f7ff', accent: '#ffffff', motif: 'ice' }
    },
    aurum: {
        motif: 'gear', color: '#ffcf52', accent: '#fff0b8',
        mobs: [
            mob('aurum_dron', 'DRON MINERO', 'orbiter', 'coin', 42, 1.7, '#ffe07a', 'drone'),
            mob('aurum_recaudador', 'RECAUDADOR BLINDADO', 'shielder', 'goldbolt', 90, 1.25, '#ffbf2e', 'vault'),
            mob('aurum_sierra', 'SIERRA DORADA', 'charger', 'none', 38, 2.4, '#ffd968', 'saw')
        ],
        mini: { name: 'CAPATAZ DORADO', title: 'MINI JEFE', hp: 2550, color: '#ffcf52', accent: '#fff3c4', motif: 'gear', role: 'mini' },
        boss: { name: 'CENTINELA DE ORO', title: 'JEFE', hp: 6000, color: '#ffb92e', accent: '#fff3c4', motif: 'gear', role: 'boss' },
        final: { name: 'BÓVEDA IMPERIAL', title: 'JEFE FINAL', hp: 15800, color: '#ffcf52', accent: '#fff0b8', motif: 'gear' }
    },
    umbra: {
        motif: 'void', color: '#b54cff', accent: '#ebc6ff',
        mobs: [
            mob('umbra_eclipse', 'ECLIPSE ERRANTE', 'drifter', 'void', 36, 1.9, '#c56bff', 'eclipse'),
            mob('umbra_devorador', 'DEVORADOR DE SOMBRAS', 'charger', 'none', 44, 2.45, '#8f34d6', 'maw'),
            mob('umbra_ojo', 'OJO DEL VACÍO', 'sniper', 'darkbeam', 62, 1.4, '#d9a0ff', 'eye')
        ],
        mini: { name: 'VIGÍA DEL VACÍO', title: 'MINI JEFE', hp: 2700, color: '#b54cff', accent: '#ebc6ff', motif: 'void', role: 'mini' },
        boss: { name: 'ESPECTRO DEL VACÍO', title: 'JEFE', hp: 6300, color: '#9a35e6', accent: '#e9c2ff', motif: 'void', role: 'boss' },
        final: { name: 'OJO ABISAL', title: 'JEFE FINAL', hp: 16200, color: '#b54cff', accent: '#ebc6ff', motif: 'void' }
    },
    caelum: {
        motif: 'wind', color: '#4f8cff', accent: '#c6dcff',
        mobs: [
            mob('caelum_ala', 'ALA TORMENTA', 'drifter', 'gale', 36, 2.1, '#7aa9ff', 'wing'),
            mob('caelum_nube', 'NUBE CAZADORA', 'orbiter', 'hail', 50, 1.7, '#a8c7ff', 'cloud'),
            mob('caelum_turbina', 'TURBINA CELESTE', 'sniper', 'windbolt', 60, 1.5, '#5f9dff', 'turbine')
        ],
        mini: { name: 'JINETE DE NUBES', title: 'MINI JEFE', hp: 2650, color: '#4f8cff', accent: '#d7e6ff', motif: 'wind', role: 'mini' },
        boss: { name: 'DEVORADOR DE CIELOS', title: 'JEFE', hp: 6200, color: '#3b74e8', accent: '#d7e6ff', motif: 'wind', role: 'boss' },
        final: { name: 'TORMENTA ETERNA', title: 'JEFE FINAL', hp: 16100, color: '#4f8cff', accent: '#c6dcff', motif: 'wind' }
    },
    mecanis: {
        motif: 'machine', color: '#ff4058', accent: '#ffc0c8',
        mobs: [
            mob('mecanis_tornillo', 'TORNILLO HOSTIL', 'charger', 'none', 42, 2.3, '#ff6b7d', 'drill'),
            mob('mecanis_bastion', 'BASTIÓN MÓVIL', 'shielder', 'shell', 100, 1.1, '#ff8a99', 'bastion'),
            mob('mecanis_laser', 'LÁSER DE PRESIÓN', 'sniper', 'redbeam', 64, 1.4, '#ff4058', 'cannon')
        ],
        mini: { name: 'TORRETA DE ASALTO', title: 'MINI JEFE', hp: 2750, color: '#ff4058', accent: '#ffc0c8', motif: 'machine', role: 'mini' },
        boss: { name: 'FORTALEZA MECANIS', title: 'JEFE', hp: 6600, color: '#e82d45', accent: '#ffd0d6', motif: 'machine', role: 'boss' },
        final: { name: 'NÚCLEO DE ACERO', title: 'JEFE FINAL', hp: 16600, color: '#ff4058', accent: '#ffc0c8', motif: 'machine' }
    },
    aquamar: {
        motif: 'ocean', color: '#42e4cf', accent: '#c9fff9',
        mobs: [
            mob('aquamar_medusa', 'MEDUSA ABISAL', 'orbiter', 'bubble', 46, 1.6, '#7ff5e6', 'jelly'),
            mob('aquamar_tiburon', 'TIBURÓN DE PRESIÓN', 'charger', 'none', 48, 2.3, '#24c9b8', 'fin'),
            mob('aquamar_coral', 'CORAL CAÑÓN', 'sniper', 'jet', 62, 1.3, '#b0fff5', 'coral')
        ],
        mini: { name: 'GUARDIÁN DE CORAL', title: 'MINI JEFE', hp: 2700, color: '#42e4cf', accent: '#d6fffb', motif: 'ocean', role: 'mini' },
        boss: { name: 'LEVIATÁN ABISAL', title: 'JEFE', hp: 6400, color: '#20c9b6', accent: '#d6fffb', motif: 'ocean', role: 'boss' },
        final: { name: 'TRINCHERA OCEÁNICA', title: 'JEFE FINAL', hp: 16300, color: '#42e4cf', accent: '#c9fff9', motif: 'ocean' }
    },
    toxina: {
        motif: 'toxic', color: '#8fbd35', accent: '#e4ff9f',
        mobs: [
            mob('toxina_espora', 'ESPORA ÁCIDA', 'drifter', 'acid', 38, 1.8, '#a9d84a', 'spore'),
            mob('toxina_larva', 'LARVA TÓXICA', 'charger', 'none', 40, 2.2, '#7aa82c', 'larva'),
            mob('toxina_bomba', 'BOMBA DE PUS', 'orbiter', 'toxin', 66, 1.5, '#c4ed5f', 'sac')
        ],
        mini: { name: 'SEMBRADOR ÁCIDO', title: 'MINI JEFE', hp: 2600, color: '#8fbd35', accent: '#e4ff9f', motif: 'toxic', role: 'mini' },
        boss: { name: 'BESTIA ÁCIDA', title: 'JEFE', hp: 6100, color: '#79a62a', accent: '#eaffb2', motif: 'toxic', role: 'boss' },
        final: { name: 'REACTOR TÓXICO', title: 'JEFE FINAL', hp: 15900, color: '#8fbd35', accent: '#e4ff9f', motif: 'toxic' }
    },
    cristalia: {
        motif: 'crystal', color: '#ef69d0', accent: '#ffd6f5',
        mobs: [
            mob('cristalia_prisma', 'PRISMA ERRANTE', 'drifter', 'prism', 40, 1.9, '#f58ade', 'prism'),
            mob('cristalia_fractura', 'FRACTURA VIVA', 'charger', 'none', 42, 2.5, '#d84ab8', 'shard'),
            mob('cristalia_refractor', 'LÁSER REFRACTADO', 'sniper', 'refract', 64, 1.45, '#ffb8ef', 'lens')
        ],
        mini: { name: 'TALLADOR DE PRISMA', title: 'MINI JEFE', hp: 2800, color: '#ef69d0', accent: '#ffe0fa', motif: 'crystal', role: 'mini' },
        boss: { name: 'PRISMA MADRE', title: 'JEFE', hp: 6500, color: '#dd48c0', accent: '#ffe0fa', motif: 'crystal', role: 'boss' },
        final: { name: 'GEODA SUPREMA', title: 'JEFE FINAL', hp: 16500, color: '#ef69d0', accent: '#ffd6f5', motif: 'crystal' }
    },
    krono: {
        motif: 'time', color: '#ffd45c', accent: '#fff4c2',
        mobs: [
            mob('krono_segundero', 'SEGUNDERO', 'orbiter', 'tick', 38, 1.9, '#ffe27a', 'clock'),
            mob('krono_bucle', 'BUCLE HOSTIL', 'drifter', 'phase', 44, 2.0, '#e8bc3a', 'loop'),
            mob('krono_aguja', 'AGUJA TEMPORAL', 'sniper', 'chrono', 58, 1.5, '#ffefad', 'needle')
        ],
        mini: { name: 'CELADOR DEL TIEMPO', title: 'MINI JEFE', hp: 2750, color: '#ffd45c', accent: '#fff4c2', motif: 'time', role: 'mini' },
        boss: { name: 'SEÑOR DEL TIEMPO', title: 'JEFE', hp: 6400, color: '#f0bd2e', accent: '#fff4c2', motif: 'time', role: 'boss' },
        final: { name: 'RELOJ DEL FIN', title: 'JEFE FINAL', hp: 16400, color: '#ffd45c', accent: '#fff4c2', motif: 'time' }
    },
    echelon: {
        motif: 'imperial', color: '#ed263e', accent: '#ffb8c2',
        mobs: [
            mob('echelon_alfil', 'ALFIL IMPERIAL', 'charger', 'none', 52, 2.5, '#ff4a60', 'lance'),
            mob('echelon_guardia', 'GUARDIA DE ÉLITE', 'shielder', 'royal', 108, 1.2, '#ff7a8c', 'guard'),
            mob('echelon_canon', 'CAÑÓN DE CAPITAL', 'sniper', 'imperial', 70, 1.4, '#ff2e48', 'cannon')
        ],
        mini: { name: 'ALFIL DE LA CAPITAL', title: 'MINI JEFE', hp: 2900, color: '#ed263e', accent: '#ffd0d6', motif: 'imperial', role: 'mini' },
        boss: { name: 'NÁCLEO IMPERIAL', title: 'JEFE', hp: 6900, color: '#d61e34', accent: '#ffd0d6', motif: 'imperial', role: 'boss' },
        final: { name: 'TRONO DE ECHELON', title: 'JEFE FINAL', hp: 17500, color: '#ed263e', accent: '#ffb8c2', motif: 'imperial' }
    }
};

const MOB_INDEX = new Map();
for (const [style, theme] of Object.entries(PLANET_HOSTILES)) {
    for (const spec of theme.mobs) MOB_INDEX.set(spec.id, { ...spec, style, motif: theme.motif, themeColor: theme.color, accent: theme.accent });
}

export function getPlanetHostiles(style) {
    return PLANET_HOSTILES[style] || PLANET_HOSTILES.terra;
}

export function getHostileMob(type) {
    return MOB_INDEX.get(type) || null;
}

export function planetHostileMobIds(style) {
    return getPlanetHostiles(style).mobs.map(spec => spec.id);
}

export function buildPlanetStages(style, index = 0) {
    const theme = getPlanetHostiles(style);
    const [m0, m1, m2] = theme.mobs;
    const tier = 1 + index * 0.08;
    const count = base => Math.round(base * tier);
    return [
        {
            phase: 1,
            phaseName: 'ATMÓSFERA',
            groups: [{ type: m0.id, count: count(14) }, { type: m1.id, count: count(8) }],
            bosses: [],
            bossSpec: { ...theme.mini, style, motif: theme.motif, accent: theme.mini.accent || theme.accent }
        },
        {
            phase: 2,
            phaseName: 'DESCENSO',
            groups: [{ type: m1.id, count: count(16) }, { type: m2.id, count: count(10) }, { type: m0.id, count: count(6) }],
            bosses: [],
            bossSpec: { ...theme.boss, style, motif: theme.motif, accent: theme.boss.accent || theme.accent }
        },
        {
            phase: 3,
            phaseName: 'SUPERFICIE',
            groups: [{ type: m2.id, count: count(18) }, { type: m0.id, count: count(12) }, { type: m1.id, count: count(8) }],
            bosses: [],
            superBoss: true,
            finalSpec: { ...theme.final, style, motif: theme.motif, spawnMob:m2.id, accent: theme.final.accent || theme.accent }
        }
    ];
}

export function buildCustomPlanetStages(style, index = 0, selection = {}) {
    const stages = buildPlanetStages(style, index);
    const allowedMobs = Array.isArray(selection.mobs) ? new Set(selection.mobs) : null;
    const mobsOn = selection.mobs !== false;
    const miniOn = selection.mini !== false;
    const bossOn = selection.boss !== false;
    const finalOn = selection.final !== false;
    return stages.map((stage, stageIndex) => {
        const next = { ...stage, groups: mobsOn ? stage.groups.filter(group => !allowedMobs || allowedMobs.has(group.type)) : [] };
        if (stageIndex === 0 && !miniOn) next.bossSpec = null;
        if (stageIndex === 1 && !bossOn) next.bossSpec = null;
        if (stageIndex === 2) {
            next.superBoss = finalOn;
            if (!finalOn) next.finalSpec = null;
        }
        return next;
    });
}

// ---------------------------------------------------------------------------
// Dibujo de enemigos y proyectiles temáticos
// ---------------------------------------------------------------------------

function motifShape(ctx, motif, size, time, variant = '') {
    const t = time || 0;
    ctx.beginPath();
    if (motif === 'ice') {
        const sides = variant === 'golem' ? 6 : 5;
        for (let i = 0; i < sides; i++) {
            const a = i / sides * Math.PI * 2 - Math.PI / 2;
            const r = size * (i % 2 === 0 ? 1 : 0.62);
            const x = Math.cos(a) * r, y = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
    } else if (motif === 'fire') {
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.7, -size * 0.75);
        ctx.lineTo(-size * 0.35, 0);
        ctx.lineTo(-size * 0.7, size * 0.75);
        ctx.closePath();
    } else if (motif === 'vine') {
        ctx.moveTo(size, 0);
        ctx.quadraticCurveTo(0, -size * 0.95, -size, 0);
        ctx.quadraticCurveTo(0, size * 0.95, size, 0);
        ctx.closePath();
    } else if (motif === 'gear') {
        const teeth = 10;
        for (let i = 0; i < teeth * 2; i++) {
            const a = i / (teeth * 2) * Math.PI * 2 + t * 0.35;
            const r = size * (i % 2 === 0 ? 1 : 0.72);
            const x = Math.cos(a) * r, y = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
    } else if (motif === 'void') {
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.82, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.82, 0);
        ctx.closePath();
    } else if (motif === 'wind') {
        ctx.moveTo(size, 0);
        ctx.quadraticCurveTo(0, -size, -size * 0.85, -size * 0.25);
        ctx.quadraticCurveTo(-size * 0.25, 0, -size * 0.85, size * 0.25);
        ctx.quadraticCurveTo(0, size, size, 0);
        ctx.closePath();
    } else if (motif === 'machine') {
        ctx.rect(-size * 0.85, -size * 0.7, size * 1.7, size * 1.4);
    } else if (motif === 'ocean') {
        ctx.arc(0, -size * 0.1, size * 0.82, Math.PI, 0);
        ctx.lineTo(size * 0.62, size * 0.55);
        ctx.lineTo(-size * 0.62, size * 0.55);
        ctx.closePath();
    } else if (motif === 'toxic') {
        ctx.arc(0, 0, size * 0.82, 0, Math.PI * 2);
    } else if (motif === 'crystal') {
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.72, -size * 0.15);
        ctx.lineTo(size * 0.35, size);
        ctx.lineTo(-size * 0.35, size);
        ctx.lineTo(-size * 0.72, -size * 0.15);
        ctx.closePath();
    } else if (motif === 'time') {
        ctx.arc(0, 0, size, 0, Math.PI * 2);
    } else {
        // imperial
        ctx.moveTo(size, 0);
        ctx.lineTo(0, -size * 0.8);
        ctx.lineTo(-size, -size * 0.35);
        ctx.lineTo(-size * 0.55, 0);
        ctx.lineTo(-size, size * 0.35);
        ctx.lineTo(0, size * 0.8);
        ctx.closePath();
    }
}

export function drawPlanetMotif(ctx, motif, size, time = 0, variant = '') {
    motifShape(ctx, motif, size, time, variant);
}

export function drawPlanetEnemy(ctx, enemy, frameCount = 0) {
    const spec = enemy?.hostileSpec;
    if (!spec) return false;
    const time = (frameCount || 0) * 0.04;
    const color = spec.color || '#ff5577';
    const accent = spec.accent || '#ffffff';
    const angle = spec.role === 'charger'
        ? Math.atan2(enemy.vy || 0, enemy.vx || 0)
        : Math.atan2(enemy.vy || 1, enemy.vx || 0);
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(angle);
    const size = spec.role === 'shielder' ? 19 : 15;
    // Halo temático
    ctx.globalAlpha = 0.28 + Math.sin(time * 2.2 + enemy.x * 0.01) * 0.08;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, size * 1.75, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // Cuerpo con silueta propia del planeta
    ctx.fillStyle = color;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.6;
    motifShape(ctx, spec.motif, size, time, spec.variant);
    ctx.fill();
    ctx.stroke();
    // Detalles por variante
    ctx.fillStyle = accent;
    if (spec.motif === 'ice') {
        ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.moveTo(0, -size * 0.55); ctx.lineTo(size * 0.22, 0); ctx.lineTo(0, size * 0.55); ctx.lineTo(-size * 0.22, 0); ctx.closePath(); ctx.fill();
    } else if (spec.motif === 'fire') {
        ctx.beginPath(); ctx.arc(-size * 0.15, 0, size * 0.24, 0, Math.PI * 2); ctx.fill();
    } else if (spec.motif === 'gear') {
        ctx.fillStyle = '#0c1420'; ctx.beginPath(); ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2); ctx.fill();
    } else if (spec.motif === 'machine') {
        ctx.fillRect(-size * 0.5, -size * 0.18, size, size * 0.36);
        ctx.fillStyle = '#0b111a'; ctx.fillRect(size * 0.55, -size * 0.14, size * 0.65, size * 0.28);
    } else if (spec.motif === 'ocean') {
        ctx.globalAlpha = 0.7;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath(); ctx.moveTo(i * size * 0.32, size * 0.4);
            ctx.quadraticCurveTo(i * size * 0.5 + Math.sin(time * 3 + i) * 3, size * 0.95, i * size * 0.24, size * 1.2);
            ctx.strokeStyle = accent; ctx.stroke();
        }
    } else if (spec.motif === 'time') {
        ctx.strokeStyle = accent; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -size * 0.62); ctx.moveTo(0, 0); ctx.lineTo(size * 0.42, size * 0.1); ctx.stroke();
    } else if (spec.motif === 'void') {
        ctx.fillStyle = '#10001a'; ctx.beginPath(); ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(0, 0, size * 0.12 + Math.sin(time * 3) * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (enemy.shield) {
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(enemy.x, enemy.y, size + 7, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
    return true;
}

export function drawPlanetBoss(ctx, b, frameCount = 0, nave = null) {
    if (!b || b.type !== 'planet_boss') return false;
    const spec = b.spec || {};
    const time = (frameCount || 0) * 0.035;
    const size = b.role === 'boss' ? 54 : 38;
    const color = b.color || spec.color || '#ff3366';
    const accent = b.accent || spec.accent || '#ffffff';
    const angle = nave ? Math.atan2((nave.y || 0) - b.y, (nave.x || 0) - b.x) : -Math.PI / 2;
    const enraged = b.enraged || b.hp < b.maxHp * 0.35;
    ctx.save();
    // Aura
    ctx.globalAlpha = enraged ? 0.4 : 0.28;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(b.x, b.y, size * 1.9 + Math.sin(time * 2) * 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.translate(b.x, b.y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = color;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    motifShape(ctx, b.motif, size, time);
    ctx.fill(); ctx.stroke();
    // Núcleo
    ctx.fillStyle = '#0b0f18';
    ctx.beginPath(); ctx.arc(0, 0, size * 0.38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(0, 0, size * (0.12 + Math.abs(Math.sin(time * 2.6)) * 0.1), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // Coronas y armamento extra para el jefe de descenso
    if (b.role === 'boss') {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.arc(0, 0, size * 1.25, time, time + Math.PI * 1.7); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + Math.PI / 4;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * size * 1.42, Math.sin(a) * size * 1.42, size * 0.16, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
    // Nombre del jefe sobre la entidad
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 9px Orbitron';
    ctx.fillStyle = accent;
    ctx.fillText(b.name || spec.name || 'JEFE', b.x, b.y - size - 18);
    ctx.restore();
    return true;
}

export function drawHostileShot(ctx, bullet) {
    if (!bullet || !bullet.style) return false;
    const angle = Math.atan2(bullet.vy || 0, bullet.vx || 0);
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(angle);
    ctx.fillStyle = bullet.color || '#ffffff';
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    if (bullet.style === 'iceblock' || bullet.style === 'iceshard') {
        const s = bullet.style === 'iceblock' ? 9 : 6;
        ctx.fillRect(-s, -s * 0.7, s * 2, s * 1.4);
        ctx.strokeRect(-s, -s * 0.7, s * 2, s * 1.4);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.8);
    } else if (bullet.style === 'seed' || bullet.style === 'spore') {
        ctx.beginPath(); ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.stroke();
    } else if (bullet.style === 'ember' || bullet.style === 'magma') {
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    } else if (bullet.style === 'coin' || bullet.style === 'goldbolt') {
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5a4300'; ctx.font = 'bold 7px Orbitron'; ctx.textAlign = 'center'; ctx.fillText('¤', 0, 3);
    } else if (bullet.style === 'void' || bullet.style === 'darkbeam') {
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, Math.PI * 2); ctx.fill();
    } else if (bullet.style === 'gale' || bullet.style === 'windbolt' || bullet.style === 'hail') {
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.quadraticCurveTo(0, -7, -8, 0); ctx.quadraticCurveTo(0, 7, 8, 0); ctx.fill();
    } else if (bullet.style === 'shell' || bullet.style === 'redbeam') {
        ctx.fillRect(-8, -4, 16, 8);
        ctx.fillStyle = '#ffd0d6'; ctx.fillRect(-3, -2, 6, 4);
    } else if (bullet.style === 'bubble' || bullet.style === 'jet') {
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
    } else if (bullet.style === 'acid' || bullet.style === 'toxin') {
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#eaffb2'; ctx.beginPath(); ctx.arc(-2, -2, 2, 0, Math.PI * 2); ctx.fill();
    } else if (bullet.style === 'prism' || bullet.style === 'refract') {
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(0, -6); ctx.lineTo(-6, 0); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
    } else if (bullet.style === 'tick' || bullet.style === 'chrono' || bullet.style === 'phase') {
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -5); ctx.moveTo(0, 0); ctx.lineTo(4, 2); ctx.stroke();
    } else if (bullet.style === 'royal' || bullet.style === 'imperial') {
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(0, -6); ctx.lineTo(-7, -2); ctx.lineTo(-4, 0); ctx.lineTo(-7, 2); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
    } else {
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return true;
}

// ---------------------------------------------------------------------------
// IA de móviles temáticos
// ---------------------------------------------------------------------------

export function updateThemedEnemy(enemy, dt, { nave, canvas, enemyBullets, fxState } = {}) {
    const spec = enemy?.hostileSpec;
    if (!spec || !nave) return false;
    const step = Math.min(2, Math.max(0, dt || 0) * 60);
    enemy.phaseTimer = (enemy.phaseTimer || Math.random() * 3) + (dt || 0);
    const toPlayer = Math.atan2(nave.y - enemy.y, nave.x - enemy.x);
    if (spec.role === 'drifter') {
        enemy.vx = Math.sin(enemy.phaseTimer * 1.7) * 2.1;
        enemy.vy = Math.max(enemy.vy || 1.6, 1.5);
    } else if (spec.role === 'charger') {
        enemy.vx += Math.cos(toPlayer) * 0.28 * step;
        enemy.vy += Math.sin(toPlayer) * 0.28 * step;
        const speed = Math.hypot(enemy.vx, enemy.vy);
        if (speed > 6.4) { enemy.vx = enemy.vx / speed * 6.4; enemy.vy = enemy.vy / speed * 6.4; }
    } else if (spec.role === 'orbiter') {
        const orbit = enemy.phaseTimer * 1.5;
        enemy.vx = Math.cos(orbit) * 2.4;
        enemy.vy = 1.3 + Math.sin(orbit) * 1.1;
    } else if (spec.role === 'shielder') {
        enemy.vx = Math.sin(enemy.phaseTimer * 0.9) * 1.1;
        enemy.vy = Math.max(0.9, (enemy.vy || 1.2) * 0.998);
    } else if (spec.role === 'sniper') {
        const dist = Math.hypot(nave.x - enemy.x, nave.y - enemy.y);
        const desired = 240;
        enemy.vx = Math.cos(toPlayer) * (dist < desired ? -1.4 : 0.7);
        enemy.vy = 0.55 + Math.sin(enemy.phaseTimer) * 0.6;
    }
    // Disparos temáticos
    const shootRoles = spec.role !== 'charger';
    if (shootRoles) {
        enemy.shotTimer = (enemy.shotTimer ?? 0.8) - Math.max(0, dt || 0);
        if (enemy.shotTimer <= 0) {
            const rate = spec.role === 'shielder' ? 2.6 : spec.role === 'sniper' ? 1.9 : spec.role === 'orbiter' ? 2.2 : 2.0;
            enemy.shotTimer = rate * (0.8 + Math.random() * 0.4);
            const speed = spec.role === 'sniper' ? 4.2 : 3.2;
            const shotStyle = spec.shot || 'bolt';
            const color = spec.color || '#ff5577';
            const push = (angle, spd = speed) => enemyBullets.push({
                x: enemy.x, y: enemy.y,
                vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
                color, style: shotStyle, hostileShot: true, life: 320
            });
            if (spec.role === 'shielder') {
                for (let i = -1; i <= 1; i++) push(toPlayer + i * 0.18, 3.0);
            } else if (spec.role === 'orbiter') {
                for (let i = 0; i < 4; i++) push(enemy.phaseTimer + i * Math.PI / 2, 2.8);
            } else {
                push(toPlayer, speed);
            }
        }
    }
    if (fxState && spec.role === 'charger' && Math.random() < 0.12) {
        fxState.screenShake = Math.max(fxState.screenShake || 0, 0.6);
    }
    return true;
}

// ---------------------------------------------------------------------------
// IA de jefes planetarios (mini jefe y jefe de descenso)
// ---------------------------------------------------------------------------

export function updatePlanetBoss(boss, { canvas, nave, enemyBullets, enemies, floatingTexts, fxState, createExplosion, frameCount } = {}) {
    if (!boss || !nave) return false;
    const now = Date.now();
    const spec = boss.spec || {};
    const isBoss = boss.role === 'boss';
    const enraged = boss.hp < boss.maxHp * 0.38;
    boss.enraged = enraged;
    if (boss.y < boss.targetY) {
        boss.y = Math.min(boss.targetY, boss.y + 2.4);
        return true;
    }
    // Movimiento: los mini jefes describen un arco; los jefes bajan y suben.
    const t = (frameCount || 0) * 0.012;
    if (isBoss) {
        boss.x = canvas.width * 0.5 + Math.sin(t * 0.9) * canvas.width * 0.28;
        boss.y = boss.targetY + Math.sin(t * 1.6) * 26;
    } else {
        boss.x += (boss.vx || 0);
        if (boss.x < canvas.width * 0.2 || boss.x > canvas.width * 0.8) boss.vx = -(boss.vx || 2.2);
        boss.y = boss.targetY + Math.sin(t * 1.8) * 18;
    }
    const color = boss.color || spec.color || '#ff3366';
    const shotStyle = spec.shot || (isBoss ? 'magma' : 'shard');
    const fire = (angle, speed, style = shotStyle) => enemyBullets.push({
        x: boss.x, y: boss.y + 30,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        color, style, hostileShot: true, life: 420
    });
    const toPlayer = Math.atan2(nave.y - boss.y, nave.x - boss.x);
    boss.lastShot = boss.lastShot || 0;
    boss.lastBurst = boss.lastBurst || 0;
    const shotRate = isBoss ? (enraged ? 420 : 680) : (enraged ? 620 : 900);
    if (now - boss.lastShot > shotRate) {
        boss.lastShot = now;
        if (isBoss) {
            for (let i = -3; i <= 3; i++) fire(toPlayer + i * 0.13, 5.2);
            if (enraged) for (let i = 0; i < 6; i++) fire(now * 0.001 + i * Math.PI / 3, 3.6);
        } else {
            for (let i = -1; i <= 1; i++) fire(toPlayer + i * 0.17, 4.7);
        }
    }
    // Ataque circular periódico
    if (now - boss.lastBurst > (isBoss ? 5200 : 7200)) {
        boss.lastBurst = now;
        const arms = isBoss ? 14 : 10;
        for (let i = 0; i < arms; i++) fire(i / arms * Math.PI * 2, isBoss ? 4.0 : 3.4);
        if (floatingTexts) floatingTexts.push({ x: boss.x, y: boss.y - 70, text: isBoss ? '¡DESCARGA TOTAL!' : '¡RÁFAGA CIRCULAR!', life: 1.3, color: boss.accent || color });
        if (fxState) fxState.screenShake = Math.max(fxState.screenShake || 0, 8);
        if (createExplosion) createExplosion(boss.x, boss.y + 20, color, 18);
    }
    // El jefe de descenso libera móviles temáticos
    if (isBoss && now - (boss.lastSpawn || 0) > (enraged ? 4200 : 7000)) {
        boss.lastSpawn = now;
        const mobId = spec.spawnMob || boss.mobId;
        if (mobId && enemies) {
            const hostile = getHostileMob(mobId);
            if (hostile) {
                for (let i = -1; i <= 1; i++) {
                    enemies.push({
                        x: boss.x + i * 48, y: boss.y + 40,
                        type: hostile.id, hp: Math.round(hostile.hp * 1.2),
                        vx: i * 1.4, vy: hostile.speed,
                        color: hostile.color, hostileSpec: hostile,
                        shield: hostile.role === 'shielder', lastShot: 0,
                        shotTimer: 1.2 + Math.random(), suicidal: hostile.role === 'charger'
                    });
                }
            }
        }
    }
    if (dist2Safe(boss, nave) < 52 * 52) {
        // El contacto lo resuelve Main con doPlayerHit; aquí solo evitamos
        // atravesar al jugador sin daño.
        if (typeof window.explorationPlayerHit === 'function') window.explorationPlayerHit(isBoss);
    }
    return true;
}

function dist2Safe(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
}
