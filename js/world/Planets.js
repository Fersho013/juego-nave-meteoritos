// Catálogo visual y de combate para los mundos del vacío.
// Cada planeta se dibuja directamente en Canvas; no requiere recursos externos.
// Cada mundo se combate en 3 fases: atmósfera, descenso y superficie, con un
// jefe temático por fase y una estructura final destruible por partes.
import { drawGlow } from '../system/Sprites.js';

// Enemigos y jefes propios de cada mundo. Los colores salen del planeta para
// que la arena y los hostiles siempre compartan la misma identidad visual.
const THEMES = {
    terra:     { enemies: ['common', 'shield', 'elite', 'special'], bosses: ['moving', 'hunter'], motif: 'organic' },
    ignis:     { enemies: ['kamikaze', 'kamikaze_bomb', 'special', 'elite'], bosses: ['berserker', 'berserker'], motif: 'fire' },
    glacia:    { enemies: ['shield', 'special', 'common', 'elite'], bosses: ['moving', 'hunter'], motif: 'ice' },
    aurum:     { enemies: ['elite', 'shield', 'common', 'special'], bosses: ['static', 'moving'], motif: 'industrial' },
    umbra:     { enemies: ['special', 'kamikaze', 'common', 'elite'], bosses: ['hunter', 'berserker'], motif: 'void' },
    caelum:    { enemies: ['elite', 'special', 'common', 'kamikaze'], bosses: ['berserker', 'hunter'], motif: 'sky' },
    mecanis:   { enemies: ['shield', 'elite', 'special', 'kamikaze_bomb'], bosses: ['static', 'moving'], motif: 'machine' },
    aquamar:   { enemies: ['common', 'special', 'elite', 'shield'], bosses: ['hunter', 'static'], motif: 'ocean' },
    toxina:    { enemies: ['kamikaze_bomb', 'special', 'kamikaze', 'elite'], bosses: ['berserker', 'hunter'], motif: 'toxic' },
    cristalia: { enemies: ['elite', 'shield', 'special', 'common'], bosses: ['moving', 'hunter'], motif: 'crystal' },
    krono:     { enemies: ['kamikaze', 'elite', 'special', 'common'], bosses: ['berserker', 'moving'], motif: 'time' },
    echelon:   { enemies: ['elite', 'kamikaze_bomb', 'shield', 'special'], bosses: ['doppel', 'hunter'], motif: 'imperial' }
};

export const PLANET_CATALOG = [
    { id:'terranova', name:'Terranova', distance:15000, radius:270, color:'#59ce70', style:'terra', gimmick:'Formaciones en V y enemigos comunes; zona segura para farmear.' },
    { id:'ignis', name:'Ignis', distance:25000, radius:230, color:'#ff6328', style:'ignis', gimmick:'La tormenta solar castiga si te quedas quieto; abundan kamikazes.' },
    { id:'glacia', name:'Glacia', distance:35000, radius:250, color:'#a4f7ff', style:'glacia', gimmick:'Baja fricción; los enemigos usan disparos ralentizadores.' },
    { id:'aurum', name:'Aurum', distance:45000, radius:300, color:'#ffcf52', style:'aurum', gimmick:'Campo minero con chatarra valiosa y enemigos protegidos.' },
    { id:'umbra', name:'Umbra', distance:60000, radius:260, color:'#b54cff', style:'umbra', gimmick:'Visibilidad reducida y emboscadas translúcidas.' },
    { id:'caelum', name:'Caelum', distance:75000, radius:340, color:'#4f8cff', style:'caelum', gimmick:'Anomalía gaseosa: deriva extrema y fijación de misiles inestable.' },
    { id:'mecanis', name:'Mecanis', distance:90000, radius:245, color:'#ff4058', style:'mecanis', gimmick:'Fortaleza con oleadas protegidas y cañones de alta presión.' },
    { id:'aquamar', name:'Aquamar', distance:105000, radius:285, color:'#42e4cf', style:'aquamar', gimmick:'La presión abisal ralentiza el movimiento y los proyectiles.' },
    { id:'toxina', name:'Toxina', distance:120000, radius:235, color:'#8fbd35', style:'toxina', gimmick:'Nubes ácidas dañinas bloquean partes de la arena.' },
    { id:'cristalia', name:'Cristalia', distance:140000, radius:310, color:'#ef69d0', style:'cristalia', gimmick:'La refracción hace rebotar los proyectiles en los bordes.' },
    { id:'krono', name:'Krono', distance:165000, radius:270, color:'#ffd45c', style:'krono', gimmick:'Fisuras temporales frenan el campo; enemigos rápidos y frágiles.' },
    { id:'echelon', name:'Echelon', distance:200000, radius:360, color:'#ed263e', style:'echelon', gimmick:'Capital imperial: Doppel y Nodriza en combate simultáneo.' }
];

const PHASE_NAMES = ['ATMÓSFERA', 'DESCENSO', 'SUPERFICIE'];

function buildStages(spec, index) {
    const theme = THEMES[spec.style] || THEMES.terra;
    const [e0, e1 = e0, e2 = e1, e3 = e2] = theme.enemies;
    const [b0, b1 = b0] = theme.bosses;
    const tier = 1 + index * 0.08;
    const count = base => Math.round(base * tier);
    return [
        {
            phase: 1,
            phaseName: PHASE_NAMES[0],
            groups: [{ type: e0, count: count(14) }, { type: e1, count: count(8) }],
            bosses: [b0]
        },
        {
            phase: 2,
            phaseName: PHASE_NAMES[1],
            groups: [{ type: e1, count: count(16) }, { type: e2, count: count(10) }, { type: e3, count: count(6) }],
            bosses: [b1]
        },
        {
            phase: 3,
            phaseName: PHASE_NAMES[2],
            groups: [{ type: e2, count: count(18) }, { type: e3, count: count(12) }, { type: e1, count: count(8) }],
            bosses: [],
            superBoss: true
        }
    ];
}

export function planetTheme(planet) {
    return THEMES[planet?.style] || THEMES.terra;
}

export function planetPhaseName(planet) {
    const phase = planet?.planetPhase || 1;
    return PHASE_NAMES[phase - 1] || PHASE_NAMES[0];
}

export function planetBossName(planet) {
    const names = {
        terra: 'GUARDIÁN SELVÁTICO', ignis: 'TITÁN ÍGNEO', glacia: 'COLOSO GLACIAL',
        aurum: 'CENTINELA DORADO', umbra: 'ESPECTRO DEL VACÍO', caelum: 'DEVORADOR DE CIELOS',
        mecanis: 'FORTALEZA MECANIS', aquamar: 'LEVIATÁN ABISAL', toxina: 'BESTIA ÁCIDA',
        cristalia: 'PRISMA MADRE', krono: 'SEÑOR DEL TIEMPO', echelon: 'NÚCLEO IMPERIAL'
    };
    return names[planet?.style] || 'ESTRUCTURA PLANETARIA';
}

export function createPlanets(seed) {
    return PLANET_CATALOG.map((spec, index) => {
        const angle = ((seed >>> (index % 24)) * 0.0000001 + index * 2.3999632297) % (Math.PI * 2);
        return { ...spec, type:'planet', x:Math.cos(angle)*spec.distance, y:Math.sin(angle)*spec.distance,
            activationRadius:Math.max(400, spec.radius + 150), discovered:index < 3, cleared:false,
            purged:false, planetPhase:1, theme:THEMES[spec.style] || THEMES.terra,
            phaseNames:[...PHASE_NAMES], bossName:planetBossName(spec),
            stages:buildStages(spec, index) };
    });
}

function polygon(ctx, radius, count, wobble = 0, phase = 0) {
    ctx.beginPath();
    for (let i=0;i<count;i++) {
        const a=(i/count)*Math.PI*2;
        const r=radius*(1+wobble*Math.sin(i*12.9898+phase));
        const x=Math.cos(a)*r, y=Math.sin(a)*r;
        if (!i) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath();
}

// Grietas y fragmentos del planeta purgado. Se dibujan encima del cuerpo para
// que el mundo siga visible pero "cuarteado" al volver al espacio.
function drawPurgedOverlay(ctx, planet, time) {
    const { radius:r, color } = planet;
    const age = planet.purgeAt ? (Date.now() - planet.purgeAt) / 1000 : 99;
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(time * 2.2) * 0.12;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, r * 0.02);
    drawGlow(ctx, 0, 0, r * 1.15, color, 0.35);
    for (let i = 0; i < 9; i++) {
        const a = i * 2.1 + Math.sin(i * 3.1) * 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.08, Math.sin(a) * r * 0.08);
        for (let s = 1; s <= 4; s++) {
            const rr = r * (0.22 + s * 0.22);
            const jitter = Math.sin(i * 7 + s * 2.4) * r * 0.05;
            ctx.lineTo(Math.cos(a + jitter / r) * rr, Math.sin(a + jitter / r) * rr);
        }
        ctx.stroke();
    }
    // Fragmentos que se separan durante la explosión inicial y quedan
    // orbitando el mundo cuarteado.
    {
        const spread = planet.purgeAt ? Math.min(1, age / 1.6) : 1;
        for (let i = 0; i < 14; i++) {
            const a = i * 2.399963 + 0.4;
            const dist = r * (1.05 + spread * (0.45 + (i % 5) * 0.16));
            const size = r * (0.06 + (i % 3) * 0.025) * (1 - spread * 0.35);
            if (size <= 0.5) continue;
            ctx.save();
            ctx.translate(Math.cos(a) * dist, Math.sin(a) * dist);
            ctx.rotate(a + time * (0.1 + (i % 4) * 0.03));
            ctx.globalAlpha = 0.85 * Math.max(0, 1 - spread * 0.5);
            ctx.fillStyle = i % 3 === 0 ? '#0b1420' : color;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-size, -size * 0.55);
            ctx.lineTo(size * 0.8, -size);
            ctx.lineTo(size, size * 0.6);
            ctx.lineTo(-size * 0.4, size);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    }
    ctx.restore();
}

export function drawPlanet(ctx, planet, time) {
    const {x,y,radius:r,style,color}=planet;
    ctx.save(); ctx.translate(x,y);
    ctx.globalAlpha=0.2; ctx.fillStyle=color; ctx.beginPath(); ctx.arc(0,0,r*1.3,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    drawGlow(ctx,0,0,r*1.35,color,style==='glacia'?0.45:0.28);
    const gradient=ctx.createRadialGradient(-r*.35,-r*.38,r*.08,0,0,r);
    gradient.addColorStop(0,'#f1fbff'); gradient.addColorStop(.18,color); gradient.addColorStop(1,'#07101e');
    ctx.fillStyle=gradient;
    if (style==='caelum') {
        const gas=ctx.createRadialGradient(0,0,r*.1,0,0,r*1.15); gas.addColorStop(0,'rgba(45,100,255,.52)'); gas.addColorStop(.55,'rgba(45,100,255,.18)'); gas.addColorStop(1,'rgba(45,100,255,0)');
        ctx.fillStyle=gas; ctx.beginPath(); ctx.arc(0,0,r*1.15,0,Math.PI*2); ctx.fill(); ctx.restore();
        ctx.save();ctx.textAlign='center';ctx.font='bold 14px Orbitron';ctx.fillStyle=color;drawGlow(ctx,0,-r-16,80,color,0.35);ctx.fillText(planet.name,0,-r-16);ctx.restore();return;
    }
    if (style==='mecanis') polygon(ctx,r,8,.025,time);
    else if (style==='ignis') polygon(ctx,r,36,.085,time*.3);
    else if (style==='echelon') polygon(ctx,r,12,.11,time*.2);
    else if (style==='cristalia') polygon(ctx,r,9,.24,time*.4);
    else ctx.beginPath(),ctx.arc(0,0,r,0,Math.PI*2);
    ctx.fill();
    ctx.save(); ctx.clip();
    if (style==='terra') {
        ctx.fillStyle='rgba(245,255,247,.56)';
        for(let i=0;i<5;i++){ const a=time*.16+i*1.26; ctx.beginPath();ctx.ellipse(Math.cos(a)*r*.4,Math.sin(a)*r*.42, r*.34,r*.1,a,0,Math.PI*2);ctx.fill(); }
    } else if (style==='aurum') {
        ctx.save();ctx.rotate(-.22);ctx.strokeStyle='#ffe8a0';ctx.lineWidth=r*.12;ctx.globalAlpha=.8;ctx.beginPath();ctx.ellipse(0,0,r*1.55,r*.32,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    } else if (style==='umbra') {
        ctx.strokeStyle='#d14cff';ctx.lineWidth=4;ctx.globalAlpha=.6+.35*Math.sin(time*2); for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(-r*.7+i*30,-r*.6);ctx.lineTo(-r*.2+i*35,0);ctx.lineTo(-r*.35+i*28,r*.72);ctx.stroke();}
    } else if (style==='aquamar') {
        ctx.strokeStyle='rgba(200,255,250,.48)';ctx.lineWidth=3;for(let i=0;i<8;i++){ctx.beginPath();ctx.ellipse(0,Math.sin(time+i)*r*.55,r*.94,r*.12,i*.09,0,Math.PI*2);ctx.stroke();}
    } else if (style==='toxina') {
        ctx.fillStyle='rgba(180,255,70,.58)';for(let i=0;i<12;i++){const a=time*.2+i*2.4;const bx=Math.sin(a*1.7)*r*.75,by=Math.cos(a)*r*.7;ctx.beginPath();ctx.arc(bx,by,5+(i%4)*2,0,Math.PI*2);ctx.fill();}
    } else if (style==='krono') {
        ctx.strokeStyle='#ffe58d';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(0,0,r*1.35,r*.34,time*.12,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-r*.35);ctx.lineTo(0,0);ctx.lineTo(r*.28,r*.2);ctx.stroke();
    } else if (style==='mecanis') {
        ctx.fillStyle='#ff2945';for(let i=0;i<8;i++){const a=i*Math.PI/4+time*.12;ctx.beginPath();ctx.arc(Math.cos(a)*r*.85,Math.sin(a)*r*.85,5,0,Math.PI*2);ctx.fill();}
    } else if (style==='cristalia') {
        for(let i=0;i<7;i++){const a=i*2.4;ctx.fillStyle=i%2?'rgba(255,255,255,.38)':'rgba(255,105,224,.45)';ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.8,Math.sin(a)*r*.8);ctx.lineTo(Math.cos(a+.7)*r*.42,Math.sin(a+.7)*r*.42);ctx.lineTo(Math.cos(a+1.4)*r*.9,Math.sin(a+1.4)*r*.9);ctx.closePath();ctx.fill();}
    }
    ctx.restore();
    if (style==='aurum') {
        ctx.save();ctx.rotate(-.22);ctx.globalAlpha=.84;ctx.strokeStyle='#ffe8a0';ctx.lineWidth=r*.09;ctx.beginPath();ctx.ellipse(0,0,r*1.52,r*.3,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    if (style==='ignis') { ctx.globalAlpha=.75;ctx.fillStyle='#ffc14b';for(let i=0;i<9;i++){const a=time*(.35+i*.01)+i*2.1;ctx.beginPath();ctx.arc(Math.cos(a)*r*1.16,Math.sin(a)*r*1.16,2+i%3,0,Math.PI*2);ctx.fill();} }
    if (planet.purged) drawPurgedOverlay(ctx, planet, time);
    ctx.globalAlpha=1;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();ctx.restore();
    ctx.save();ctx.textAlign='center';ctx.font='bold 14px Orbitron';ctx.fillStyle=planet.purged?'#b9ffcd':color;drawGlow(ctx,x,y-r-16,80,planet.purged?'#59ce70':color,0.35);ctx.fillText(planet.name,x,y-r-16);
    if (planet.purged) {
        ctx.font='bold 10px Orbitron'; ctx.fillStyle='#59ce70';
        ctx.fillText('PURGADO · PULSA E PARA REINTENTAR', x, y - r + 2);
    }
    ctx.restore();
}
