// Catálogo visual y de combate para los mundos del vacío.
// Cada planeta se dibuja directamente en Canvas; no requiere recursos externos.
import { drawGlow } from '../system/Sprites.js';
export const PLANET_CATALOG = [
    { id:'terranova', name:'Terranova', distance:15000, radius:270, color:'#59ce70', style:'terra', gimmick:'Formaciones en V y enemigos comunes; zona segura para farmear.' , stages:[{groups:[{type:'common',count:18},{type:'shield',count:8}],bosses:[]}] },
    { id:'ignis', name:'Ignis', distance:25000, radius:230, color:'#ff6328', style:'ignis', gimmick:'La tormenta solar castiga si te quedas quieto; abundan kamikazes.', stages:[{groups:[{type:'kamikaze',count:24},{type:'kamikaze_bomb',count:10}],bosses:[]}] },
    { id:'glacia', name:'Glacia', distance:35000, radius:250, color:'#a4f7ff', style:'glacia', gimmick:'Baja fricción; los enemigos usan disparos ralentizadores.', stages:[{groups:[{type:'shield',count:16},{type:'special',count:12}],bosses:['moving']}] },
    { id:'aurum', name:'Aurum', distance:45000, radius:300, color:'#ffcf52', style:'aurum', gimmick:'Campo minero con chatarra valiosa y enemigos protegidos.', stages:[{groups:[{type:'elite',count:12},{type:'shield',count:14}],bosses:['static']}] },
    { id:'umbra', name:'Umbra', distance:60000, radius:260, color:'#b54cff', style:'umbra', gimmick:'Visibilidad reducida y emboscadas translúcidas.', stages:[{groups:[{type:'special',count:18},{type:'kamikaze',count:12}],bosses:['hunter']}] },
    { id:'caelum', name:'Caelum', distance:75000, radius:340, color:'#4f8cff', style:'caelum', gimmick:'Anomalía gaseosa: deriva extrema y fijación de misiles inestable.', stages:[{groups:[{type:'elite',count:14},{type:'special',count:12}],bosses:['berserker']}] },
    { id:'mecanis', name:'Mecanis', distance:90000, radius:245, color:'#ff4058', style:'mecanis', gimmick:'Fortaleza con oleadas protegidas y cañones de alta presión.', stages:[{groups:[{type:'shield',count:22},{type:'elite',count:10}],bosses:['static','moving']}] },
    { id:'aquamar', name:'Aquamar', distance:105000, radius:285, color:'#42e4cf', style:'aquamar', gimmick:'La presión abisal ralentiza el movimiento y los proyectiles.', stages:[{groups:[{type:'common',count:20},{type:'special',count:16}],bosses:['hunter']}] },
    { id:'toxina', name:'Toxina', distance:120000, radius:235, color:'#8fbd35', style:'toxina', gimmick:'Nubes ácidas dañinas bloquean partes de la arena.', stages:[{groups:[{type:'kamikaze_bomb',count:20},{type:'special',count:14}],bosses:['berserker']}] },
    { id:'cristalia', name:'Cristalia', distance:140000, radius:310, color:'#ef69d0', style:'cristalia', gimmick:'La refracción hace rebotar los proyectiles en los bordes.', stages:[{groups:[{type:'elite',count:18},{type:'shield',count:16}],bosses:['moving','hunter']}] },
    { id:'krono', name:'Krono', distance:165000, radius:270, color:'#ffd45c', style:'krono', gimmick:'Fisuras temporales frenan el campo; enemigos rápidos y frágiles.', stages:[{groups:[{type:'kamikaze',count:24},{type:'elite',count:12}],bosses:['berserker']}] },
    { id:'echelon', name:'Echelon', distance:200000, radius:360, color:'#ed263e', style:'echelon', gimmick:'Capital imperial: Doppel y Nodriza en combate simultáneo.', stages:[{groups:[{type:'elite',count:24},{type:'kamikaze_bomb',count:20}],bosses:['doppel','hunter'],superBoss:true}] }
];

export function createPlanets(seed) {
    return PLANET_CATALOG.map((spec, index) => {
        const angle = ((seed >>> (index % 24)) * 0.0000001 + index * 2.3999632297) % (Math.PI * 2);
        return { ...spec, x:Math.cos(angle)*spec.distance, y:Math.sin(angle)*spec.distance,
            activationRadius:Math.max(400, spec.radius + 150), discovered:index < 3, cleared:false };
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
    ctx.globalAlpha=1;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();ctx.restore();
    ctx.save();ctx.textAlign='center';ctx.font='bold 14px Orbitron';ctx.fillStyle=color;drawGlow(ctx,x,y-r-16,80,color,0.35);ctx.fillText(planet.name,x,y-r-16);ctx.restore();
}
